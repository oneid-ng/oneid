import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  Account,
  Keypair,
  Operation,
  StrKey,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import {
  LOCAL_NETWORK,
  TESTNET_NETWORK,
  resolveNetwork,
  getRpcServer,
  sanitizeForLog,
  mapSorobanErrorToApiCode,
  StellarOperationError,
  wrapFeeBumpTransaction,
  submitWithRetryAndIdempotency,
  InMemoryIdempotencyStore,
  type TransactionResult,
} from "./index.js";

describe("@oneid/stellar", () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = {
      STELLAR_NETWORK: process.env["STELLAR_NETWORK"],
      STELLAR_RPC_URL: process.env["STELLAR_RPC_URL"],
      STELLAR_NETWORK_PASSPHRASE: process.env["STELLAR_NETWORK_PASSPHRASE"],
    };
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  describe("Network configuration (README §11)", () => {
    it("resolves default local network profile", () => {
      delete process.env["STELLAR_NETWORK"];
      const net = resolveNetwork();
      expect(net.name).toBe("local");
      expect(net.rpcUrl).toContain("localhost:8000");
      expect(net.networkPassphrase).toBe(LOCAL_NETWORK.networkPassphrase);
    });

    it("resolves testnet profile when STELLAR_NETWORK=testnet", () => {
      process.env["STELLAR_NETWORK"] = "testnet";
      const net = resolveNetwork();
      expect(net.name).toBe("testnet");
      expect(net.rpcUrl).toContain("soroban-testnet.stellar.org");
      expect(net.networkPassphrase).toBe(TESTNET_NETWORK.networkPassphrase);
    });

    it("creates RPC server with allowHttp for local development", () => {
      const server = getRpcServer(LOCAL_NETWORK);
      expect(server).toBeDefined();
    });
  });

  describe("No secret keys logged (Security Rule)", () => {
    it("redacts Stellar S-prefix secret keys from strings and objects", () => {
      const secret = Keypair.random().secret(); // starts with S...
      expect(secret.startsWith("S")).toBe(true);

      const sanitizedStr = sanitizeForLog(
        `Connecting with secret key ${secret}`,
      ) as string;
      expect(sanitizedStr).not.toContain(secret);
      expect(sanitizedStr).toContain("[REDACTED_SECRET_KEY]");

      const logPayload = {
        action: "submit_tx",
        secretKey: secret,
        sponsorSecret: "S0000000000000000000000000000000000000000000000000000000",
        nested: {
          privateSeed: "secret_value",
          safeAddress: "GABC123",
        },
      };

      const sanitizedObj = sanitizeForLog(logPayload) as typeof logPayload;
      expect(sanitizedObj.secretKey).toBe("[REDACTED]");
      expect(sanitizedObj.sponsorSecret).toBe("[REDACTED]");
      expect(sanitizedObj.nested.privateSeed).toBe("[REDACTED]");
      expect(sanitizedObj.nested.safeAddress).toBe("GABC123");
    });
  });

  describe("Typed error mapping (README §14.4)", () => {
    it("maps 503 / connection errors to CHAIN_UNAVAILABLE with retryable: true", () => {
      const netErr = new Error("fetch failed: ECONNREFUSED 127.0.0.1:8000");
      const mapped = mapSorobanErrorToApiCode(netErr, "tx-fail-1");

      expect(mapped.code).toBe("CHAIN_UNAVAILABLE");
      expect(mapped.httpStatus).toBe(503);
      expect(mapped.retryable).toBe(true);
      expect(mapped.txHash).toBe("tx-fail-1");
    });

    it("maps contract unauthorized / #1 to FORBIDDEN_ROLE (403)", () => {
      const err = new Error("HostError: Error(Contract, #1)");
      const mapped = mapSorobanErrorToApiCode(err);

      expect(mapped.code).toBe("FORBIDDEN_ROLE");
      expect(mapped.httpStatus).toBe(403);
      expect(mapped.retryable).toBe(false);
    });

    it("maps suspended issuer (#2, #101) to ISSUER_NOT_ACTIVE (422)", () => {
      const err = new Error("HostError: Error(Contract, #101)");
      const mapped = mapSorobanErrorToApiCode(err);

      expect(mapped.code).toBe("ISSUER_NOT_ACTIVE");
      expect(mapped.httpStatus).toBe(422);
      expect(mapped.retryable).toBe(false);
    });

    it("maps revoked credential (#102) to CREDENTIAL_REVOKED (422)", () => {
      const err = new Error("HostError: Error(Contract, #102)");
      const mapped = mapSorobanErrorToApiCode(err);

      expect(mapped.code).toBe("CREDENTIAL_REVOKED");
      expect(mapped.httpStatus).toBe(422);
      expect(mapped.retryable).toBe(false);
    });

    it("maps expired credential or consent (#103, #203) to CREDENTIAL_EXPIRED (422)", () => {
      const err = new Error("HostError: Error(Contract, #103)");
      const mapped = mapSorobanErrorToApiCode(err);

      expect(mapped.code).toBe("CREDENTIAL_EXPIRED");
      expect(mapped.httpStatus).toBe(422);
      expect(mapped.retryable).toBe(false);
    });

    it("maps withdrawn consent (#202) to CONSENT_WITHDRAWN (403)", () => {
      const err = new Error("HostError: Error(Contract, #202)");
      const mapped = mapSorobanErrorToApiCode(err);

      expect(mapped.code).toBe("CONSENT_WITHDRAWN");
      expect(mapped.httpStatus).toBe(403);
      expect(mapped.retryable).toBe(false);
    });
  });

  describe("Retry with exponential backoff", () => {
    it("simulated RPC failure retries then succeeds", async () => {
      let attempts = 0;
      const executor = vi.fn(async (): Promise<TransactionResult> => {
        attempts++;
        if (attempts < 3) {
          // Simulate temporary 503 RPC unavailability on attempts 1 and 2
          throw new Error("RPC unreachable: 503 Service Unavailable");
        }
        return {
          status: "confirmed",
          txHash: "tx-success-abc-123",
          ledger: 1042,
          returnValue: { ok: true },
        };
      });

      const result = await submitWithRetryAndIdempotency(executor, {
        retryConfig: {
          maxRetries: 3,
          baseDelayMs: 10,
          maxDelayMs: 50,
          backoffFactor: 2,
        },
      });

      expect(attempts).toBe(3);
      expect(executor).toHaveBeenCalledTimes(3);
      expect(result.status).toBe("confirmed");
      expect(result.txHash).toBe("tx-success-abc-123");
      expect(result.ledger).toBe(1042);
    });

    it("fails immediately without retry on non-retryable errors", async () => {
      const executor = vi.fn(async () => {
        throw new Error("HostError: Error(Contract, #1)"); // FORBIDDEN_ROLE
      });

      await expect(
        submitWithRetryAndIdempotency(executor, {
          retryConfig: { maxRetries: 3, baseDelayMs: 10 },
        }),
      ).rejects.toThrow(StellarOperationError);

      expect(executor).toHaveBeenCalledTimes(1);
    });
  });

  describe("Idempotency tracking", () => {
    it("idempotent resubmission does not double-apply", async () => {
      const store = new InMemoryIdempotencyStore();
      const idempotencyKey = "req-idempotency-key-xyz-101";

      let executionCount = 0;
      const executor = vi.fn(async (): Promise<TransactionResult> => {
        executionCount++;
        return {
          status: "confirmed",
          txHash: "tx-hash-unique-789",
          ledger: 500,
        };
      });

      // First submission
      const firstResult = await submitWithRetryAndIdempotency(executor, {
        idempotencyKey,
        idempotencyStore: store,
      });

      expect(executionCount).toBe(1);
      expect(firstResult.status).toBe("confirmed");
      expect(firstResult.txHash).toBe("tx-hash-unique-789");

      // Second submission with identical idempotency key
      const secondResult = await submitWithRetryAndIdempotency(executor, {
        idempotencyKey,
        idempotencyStore: store,
      });

      // Executor was NOT called a second time
      expect(executionCount).toBe(1);
      expect(executor).toHaveBeenCalledTimes(1);

      // Same outcome returned
      expect(secondResult.status).toBe("confirmed");
      expect(secondResult.txHash).toBe("tx-hash-unique-789");
      expect(secondResult.idempotencyKey).toBe(idempotencyKey);
    });
  });

  describe("Fee-bump wrapping (README §14.5, §16)", () => {
    it("fee-bump path works on the local chain profile", () => {
      const citizen = Keypair.random();
      const sponsor = Keypair.random();

      // Citizen constructs an inner transaction
      const citizenAccount = new Account(citizen.publicKey(), "10");
      const dummyContractId = StrKey.encodeContract(Buffer.alloc(32, 5));

      const innerTx = new TransactionBuilder(citizenAccount, {
        fee: "100",
        networkPassphrase: LOCAL_NETWORK.networkPassphrase,
      })
        .addOperation(
          Operation.invokeContractFunction({
            contract: dummyContractId,
            function: "dummy_fn",
            args: [],
          }),
        )
        .setTimeout(30)
        .build();

      // Citizen signs inner transaction
      innerTx.sign(citizen);

      // Sponsor wraps transaction in Fee-Bump
      const feeBumpTx = wrapFeeBumpTransaction({
        innerTx,
        sponsorKeypair: sponsor,
        fee: "300",
        networkPassphrase: LOCAL_NETWORK.networkPassphrase,
      });

      // Verify fee sponsorship envelope
      expect(feeBumpTx.feeSource).toBe(sponsor.publicKey());
      expect(String(feeBumpTx.fee)).toBe("600"); // inner fee (100) + outer fee
      expect(feeBumpTx.innerTransaction.source).toBe(citizen.publicKey());
      expect(feeBumpTx.signatures.length).toBe(1); // Sponsor signature present
      expect(feeBumpTx.innerTransaction.signatures.length).toBe(1); // Citizen signature present
    });
  });
});
