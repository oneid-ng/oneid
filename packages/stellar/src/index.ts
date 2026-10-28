/**
 * @oneid/stellar
 *
 * Network configuration, Soroban RPC client, fee-bump transaction wrapping,
 * exponential backoff retry with idempotency, and typed error mapping (README §14.4, §14.5, §16).
 * All keys used here are DEMO / local / testnet only — never mainnet.
 * Never logs secret keys.
 */

import {
  Operation,
  StrKey,
  TransactionBuilder,
  rpc as SorobanRpc,
  type Keypair,
  type Transaction,
  type FeeBumpTransaction,
  type xdr,
} from "@stellar/stellar-sdk";

// ── Network configs (README §11) ───────────────────────────────────────────

export interface NetworkConfig {
  name: string;
  rpcUrl: string;
  networkPassphrase: string;
  horizonUrl: string;
  friendbotUrl: string;
}

export const LOCAL_NETWORK: NetworkConfig = {
  name: "local",
  rpcUrl: process.env["STELLAR_RPC_URL"] || "http://localhost:8000/soroban/rpc",
  networkPassphrase:
    process.env["STELLAR_NETWORK_PASSPHRASE"] || "Standalone Network ; February 2017",
  horizonUrl: process.env["STELLAR_HORIZON_URL"] || "http://localhost:8000",
  friendbotUrl: process.env["STELLAR_FRIENDBOT_URL"] || "http://localhost:8000/friendbot",
};

export const TESTNET_NETWORK: NetworkConfig = {
  name: "testnet",
  rpcUrl: process.env["STELLAR_RPC_URL"] || "https://soroban-testnet.stellar.org",
  networkPassphrase:
    process.env["STELLAR_NETWORK_PASSPHRASE"] || "Test SDF Network ; September 2015",
  horizonUrl: process.env["STELLAR_HORIZON_URL"] || "https://horizon-testnet.stellar.org",
  friendbotUrl: process.env["STELLAR_FRIENDBOT_URL"] || "https://friendbot.stellar.org",
};

/**
 * Resolve active network configuration from environment.
 */
export function resolveNetwork(): NetworkConfig {
  const name = process.env["STELLAR_NETWORK"] ?? "local";
  if (name === "testnet") return TESTNET_NETWORK;
  return LOCAL_NETWORK;
}

/**
 * Create a Soroban RPC server instance configured for the active network.
 */
export function getRpcServer(
  network: NetworkConfig = resolveNetwork(),
  options?: { allowHttp?: boolean },
): SorobanRpc.Server {
  const allowHttp = options?.allowHttp ?? network.rpcUrl.startsWith("http://");
  return new SorobanRpc.Server(network.rpcUrl, { allowHttp });
}

// ── Secret Sanitization (Security Rule) ────────────────────────────────────

/**
 * Sanitize an object or string for logging, ensuring NO Stellar secret keys
 * or private keys are ever printed.
 */
export function sanitizeForLog(data: unknown): unknown {
  if (typeof data === "string") {
    // Redact Stellar Ed25519 secret keys: starts with S, 56 characters base32
    if (/^S[A-Z2-7]{55}$/.test(data)) {
      return "[REDACTED_SECRET_KEY]";
    }
    return data.replace(/S[A-Z2-7]{55}/g, "[REDACTED_SECRET_KEY]");
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeForLog);
  }

  if (typeof data === "object" && data !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const lower = key.toLowerCase();
      if (
        lower.includes("secret") ||
        lower.includes("private") ||
        lower.includes("seed") ||
        lower.includes("password")
      ) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = sanitizeForLog(value);
      }
    }
    return result;
  }

  return data;
}

// ── Error Model (README §14.4) ─────────────────────────────────────────────

export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN_ROLE"
  | "CONSENT_MISSING"
  | "CONSENT_EXPIRED"
  | "CONSENT_WITHDRAWN"
  | "CREDENTIAL_REVOKED"
  | "CREDENTIAL_EXPIRED"
  | "ISSUER_NOT_ACTIVE"
  | "CHAIN_UNAVAILABLE"
  | "CHAIN_TX_FAILED"
  | "VALIDATION_ERROR";

export class StellarOperationError extends Error {
  public readonly code: ApiErrorCode;
  public readonly httpStatus: number;
  public readonly retryable: boolean;
  public readonly txHash?: string | undefined;
  public readonly ledger?: number | undefined;

  constructor(options: {
    message: string;
    code: ApiErrorCode;
    httpStatus?: number;
    retryable?: boolean;
    txHash?: string | undefined;
    ledger?: number | undefined;
  }) {
    super(options.message);
    this.name = "StellarOperationError";
    this.code = options.code;
    this.txHash = options.txHash;
    this.ledger = options.ledger;

    switch (options.code) {
      case "UNAUTHENTICATED":
        this.httpStatus = options.httpStatus ?? 401;
        this.retryable = options.retryable ?? false;
        break;
      case "FORBIDDEN_ROLE":
      case "CONSENT_MISSING":
      case "CONSENT_EXPIRED":
      case "CONSENT_WITHDRAWN":
        this.httpStatus = options.httpStatus ?? 403;
        this.retryable = options.retryable ?? false;
        break;
      case "CREDENTIAL_REVOKED":
      case "CREDENTIAL_EXPIRED":
      case "ISSUER_NOT_ACTIVE":
        this.httpStatus = options.httpStatus ?? 422;
        this.retryable = options.retryable ?? false;
        break;
      case "CHAIN_UNAVAILABLE":
        this.httpStatus = options.httpStatus ?? 503;
        this.retryable = options.retryable ?? true;
        break;
      case "CHAIN_TX_FAILED":
        this.httpStatus = options.httpStatus ?? 502;
        this.retryable = options.retryable ?? false;
        break;
      case "VALIDATION_ERROR":
      default:
        this.httpStatus = options.httpStatus ?? 400;
        this.retryable = options.retryable ?? false;
        break;
    }
  }
}

/**
 * Map raw RPC, network or contract errors to typed StellarOperationError per README §14.4.
 */
export function mapSorobanErrorToApiCode(
  err: unknown,
  txHash?: string,
): StellarOperationError {
  if (err instanceof StellarOperationError) {
    return err;
  }

  const msg = err instanceof Error ? err.message : String(err);

  // Network / RPC reachability errors (503, retryable)
  if (
    msg.includes("fetch failed") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("503") ||
    msg.includes("RPC unreachable") ||
    msg.includes("network error")
  ) {
    return new StellarOperationError({
      message: `Soroban RPC unavailable: ${msg}`,
      code: "CHAIN_UNAVAILABLE",
      httpStatus: 503,
      retryable: true,
      txHash,
    });
  }

  // Contract specific error codes
  if (
    msg.includes("Error(Contract, #1)") ||
    msg.includes("NotAdmin") ||
    msg.includes("unauthorized")
  ) {
    return new StellarOperationError({
      message: "Action forbidden for the given role or caller",
      code: "FORBIDDEN_ROLE",
      httpStatus: 403,
      retryable: false,
      txHash,
    });
  }

  if (
    msg.includes("Error(Contract, #2)") ||
    msg.includes("Error(Contract, #101)") ||
    msg.includes("Error(Contract, #201)") ||
    msg.includes("IssuerNotActive") ||
    msg.includes("RequesterNotActiveVerifier")
  ) {
    return new StellarOperationError({
      message: "Issuer or verifier is suspended or inactive on-chain",
      code: "ISSUER_NOT_ACTIVE",
      httpStatus: 422,
      retryable: false,
      txHash,
    });
  }

  if (msg.includes("Error(Contract, #102)") || msg.includes("Revoked")) {
    return new StellarOperationError({
      message: "Credential has been revoked",
      code: "CREDENTIAL_REVOKED",
      httpStatus: 422,
      retryable: false,
      txHash,
    });
  }

  if (
    msg.includes("Error(Contract, #103)") ||
    msg.includes("Error(Contract, #203)") ||
    msg.includes("Expired")
  ) {
    return new StellarOperationError({
      message: "Credential or consent receipt has expired",
      code: "CREDENTIAL_EXPIRED",
      httpStatus: 422,
      retryable: false,
      txHash,
    });
  }

  if (msg.includes("Error(Contract, #202)") || msg.includes("Withdrawn")) {
    return new StellarOperationError({
      message: "Consent has been withdrawn",
      code: "CONSENT_WITHDRAWN",
      httpStatus: 403,
      retryable: false,
      txHash,
    });
  }

  return new StellarOperationError({
    message: `Transaction failed: ${msg}`,
    code: "CHAIN_TX_FAILED",
    httpStatus: 502,
    retryable: false,
    txHash,
  });
}

// ── Transaction Results (README §14.5) ─────────────────────────────────────

export type TransactionStatus = "pending" | "confirmed" | "failed";

export interface TransactionResult {
  status: TransactionStatus;
  txHash: string;
  ledger?: number | undefined;
  returnValue?: unknown | undefined;
  error?: StellarOperationError | undefined;
  idempotencyKey?: string | undefined;
}

// ── Idempotency Store (README §14.5) ───────────────────────────────────────

export interface IdempotencyStore {
  get(
    key: string,
  ): Promise<TransactionResult | undefined> | TransactionResult | undefined;
  set(key: string, result: TransactionResult): Promise<void> | void;
  has(key: string): Promise<boolean> | boolean;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly store = new Map<string, TransactionResult>();

  get(key: string): TransactionResult | undefined {
    return this.store.get(key);
  }

  set(key: string, result: TransactionResult): void {
    this.store.set(key, result);
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  clear(): void {
    this.store.clear();
  }
}

export const defaultIdempotencyStore = new InMemoryIdempotencyStore();

// ── Fee-Bump Wrapping (README §14.5, §16) ───────────────────────────────────

export interface WrapFeeBumpOptions {
  innerTx: Transaction;
  sponsorKeypair: Keypair;
  fee?: string | number; // base fee in stroops, default 200
  networkPassphrase?: string;
}

/**
 * Wrap an inner citizen transaction in a fee-bump transaction paid by FEE_SPONSOR.
 * Citizens hold zero XLM for fees.
 */
export function wrapFeeBumpTransaction(options: WrapFeeBumpOptions): FeeBumpTransaction {
  const networkPassphrase =
    options.networkPassphrase || resolveNetwork().networkPassphrase;
  const fee = options.fee ? String(options.fee) : "300";

  const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
    options.sponsorKeypair,
    fee,
    options.innerTx,
    networkPassphrase,
  );

  feeBumpTx.sign(options.sponsorKeypair);
  return feeBumpTx;
}

// ── Retry with Exponential Backoff & Idempotency (README §14.5) ─────────────

export interface RetryConfig {
  maxRetries?: number; // default: 3
  baseDelayMs?: number; // default: 100
  maxDelayMs?: number; // default: 2000
  backoffFactor?: number; // default: 2
}

export interface SubmitTransactionOptions {
  server?: SorobanRpc.Server;
  idempotencyKey?: string;
  idempotencyStore?: IdempotencyStore;
  retryConfig?: RetryConfig;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

/**
 * Submit a transaction or custom transaction executor with exponential backoff
 * and idempotency tracking.
 * Fail closed: fails immediately on non-retryable errors.
 */
export async function submitWithRetryAndIdempotency(
  executor: () => Promise<TransactionResult>,
  options?: SubmitTransactionOptions,
): Promise<TransactionResult> {
  const idempotencyKey = options?.idempotencyKey;
  const store = options?.idempotencyStore ?? defaultIdempotencyStore;

  // 1. Idempotency Check: if previously submitted with this key, return cached outcome
  if (idempotencyKey) {
    const existing = await store.get(idempotencyKey);
    if (existing) {
      return existing;
    }
  }

  const maxRetries = options?.retryConfig?.maxRetries ?? 3;
  const baseDelayMs = options?.retryConfig?.baseDelayMs ?? 100;
  const maxDelayMs = options?.retryConfig?.maxDelayMs ?? 2000;
  const backoffFactor = options?.retryConfig?.backoffFactor ?? 2;

  let attempt = 0;
  let lastError: unknown;

  while (attempt <= maxRetries) {
    try {
      const result = await executor();

      if (idempotencyKey) {
        await store.set(idempotencyKey, { ...result, idempotencyKey });
      }

      return result;
    } catch (err) {
      lastError = err;
      const mapped = mapSorobanErrorToApiCode(err);

      // If error is not retryable, fail immediately
      if (!mapped.retryable || attempt >= maxRetries) {
        const failedResult: TransactionResult = {
          status: "failed",
          txHash: mapped.txHash ?? "unknown",
          error: mapped,
          ...(idempotencyKey ? { idempotencyKey } : {}),
        };
        if (idempotencyKey) {
          await store.set(idempotencyKey, failedResult);
        }
        throw mapped;
      }

      // Exponential backoff
      const delay = Math.min(
        maxDelayMs,
        baseDelayMs * Math.pow(backoffFactor, attempt) + Math.random() * 20,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt++;
    }
  }

  const finalError = mapSorobanErrorToApiCode(lastError);
  throw finalError;
}

// ── Soroban Contract Invocation Helper ──────────────────────────────────────

export interface BuildContractCallOptions {
  contractId: string;
  method: string;
  args?: xdr.ScVal[];
  sourceKeypair: Keypair;
  server?: SorobanRpc.Server;
  network?: NetworkConfig;
  fee?: string;
  timeoutSeconds?: number;
}

/**
 * Build, simulate, assemble and sign a Soroban contract call transaction.
 */
export async function buildAndSignContractCall(
  options: BuildContractCallOptions,
): Promise<Transaction> {
  const network = options.network ?? resolveNetwork();
  const server = options.server ?? getRpcServer(network);

  // Load source account sequence
  const sourceAccount = await server.getAccount(options.sourceKeypair.publicKey());

  new StrKeyContract(options.contractId);
  const operation = Operation.invokeContractFunction({
    contract: options.contractId,
    function: options.method,
    args: options.args ?? [],
  });

  const tx = new TransactionBuilder(sourceAccount, {
    fee: options.fee ?? "100",
    networkPassphrase: network.networkPassphrase,
  })
    .addOperation(operation)
    .setTimeout(options.timeoutSeconds ?? 60)
    .build();

  // Simulate and prepare
  const prepared = await server.prepareTransaction(tx);
  prepared.sign(options.sourceKeypair);

  return prepared as Transaction;
}

/** Internal helper for StrKey check */
class StrKeyContract {
  constructor(public readonly id: string) {
    if (!StrKey.isValidContract(id)) {
      throw new StellarOperationError({
        message: `Invalid Soroban contract ID format: ${id}`,
        code: "VALIDATION_ERROR",
        httpStatus: 400,
      });
    }
  }
}

// ── Friendbot ──────────────────────────────────────────────────────────────

/**
 * Fund a Stellar account via Friendbot (local or testnet only).
 * Throws if the request fails.
 */
export async function fundAccount(
  address: string,
  network: NetworkConfig = resolveNetwork(),
): Promise<void> {
  const url = `${network.friendbotUrl}?addr=${encodeURIComponent(address)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text().catch(() => "(no body)");
      throw new Error(`Friendbot failed for ${address}: HTTP ${res.status} — ${body}`);
    }
  } catch (err) {
    throw mapSorobanErrorToApiCode(err);
  }
}

// ── High-level submitTransaction helper ────────────────────────────────────
// Used by apps/api routes for common contract calls (README §14.5).

export interface SubmitTxOptions {
  rpc: SorobanRpc.Server;
  network: NetworkConfig;
  sourceKeypair: Keypair;
  sponsorKeypair?: Keypair | undefined;
  contractId: string;
  method: string;
  /** args ignored in MVP — use generated bindings for type-safe arg encoding */
  args?: Record<string, unknown>;
  idempotencyKey?: string;
}

/**
 * Build, (optionally fee-bump), sign, and submit a Soroban contract call.
 * Returns txHash and ledger. Uses submitWithRetryAndIdempotency internally.
 *
 * Note: full arg serialisation uses the generated TS bindings in
 * @oneid/contracts-client. This wrapper is for routes that call simple
 * methods where the contracts-client is available. For the MVP demo the
 * raw buildAndSignContractCall with empty args is used (args encoding via
 * the generated Client is done in the indexer and dedicated service layers).
 */
export async function submitTransaction(
  opts: SubmitTxOptions,
): Promise<TransactionResult> {
  if (!opts.contractId) {
    throw new StellarOperationError({
      message: "Contract ID is empty. Run pnpm contracts:deploy:local first.",
      code: "CHAIN_UNAVAILABLE",
      httpStatus: 503,
      retryable: false,
    });
  }

  return submitWithRetryAndIdempotency(
    async (): Promise<TransactionResult> => {
      const tx = await buildAndSignContractCall({
        contractId: opts.contractId,
        method: opts.method,
        args: [],
        sourceKeypair: opts.sourceKeypair,
        server: opts.rpc,
        network: opts.network,
      });

      let signedTx: Transaction | FeeBumpTransaction = tx;
      if (opts.sponsorKeypair) {
        signedTx = wrapFeeBumpTransaction({
          innerTx: tx,
          sponsorKeypair: opts.sponsorKeypair,
          networkPassphrase: opts.network.networkPassphrase,
        });
      }

      const sendResult = await opts.rpc.sendTransaction(signedTx);

      if (sendResult.status === "ERROR" || sendResult.status === "DUPLICATE") {
        return {
          status: "failed",
          txHash: sendResult.hash,
          error: new StellarOperationError({
            message: `Send status: ${sendResult.status}`,
            code: "CHAIN_TX_FAILED",
            httpStatus: 502,
            txHash: sendResult.hash,
          }),
        };
      }

      // Poll for confirmation (max 10 s)
      let getResult = await opts.rpc.getTransaction(sendResult.hash);
      let polls = 0;
      while (
        getResult.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND &&
        polls < 20
      ) {
        await new Promise((r) => setTimeout(r, 500));
        getResult = await opts.rpc.getTransaction(sendResult.hash);
        polls++;
      }

      const confirmed = getResult.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS;
      const failed = getResult.status === SorobanRpc.Api.GetTransactionStatus.FAILED;

      return {
        status: confirmed ? "confirmed" : failed ? "failed" : "pending",
        txHash: sendResult.hash,
        ledger:
          "ledger" in getResult && typeof getResult.ledger === "number"
            ? getResult.ledger
            : undefined,
      };
    },
    opts.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : {},
  );
}
