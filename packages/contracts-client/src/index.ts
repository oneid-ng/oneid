/**
 * @oneid/contracts-client
 *
 * Generated TypeScript bindings and typed wrappers for Soroban contracts.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as IssuerRegistryBindings from "./generated/issuer-registry/src/index.js";
import * as CredentialStatusBindings from "./generated/credential-status/src/index.js";
import * as ConsentRegistryBindings from "./generated/consent-registry/src/index.js";
import * as CorrectionTrackerBindings from "./generated/correction-tracker/src/index.js";

export {
  IssuerRegistryBindings,
  CredentialStatusBindings,
  ConsentRegistryBindings,
  CorrectionTrackerBindings,
};

export interface DeployedContracts {
  issuerRegistry: string;
  credentialStatus: string;
  consentRegistry: string;
  correctionTracker: string;
}

export interface SeededEntity {
  address: string;
  role: "Issuer" | "Verifier";
  name: string;
  homeDomain: string;
  status: "Active" | "Suspended" | "Removed";
  registeredAt: number;
}

export interface SeededRegistry {
  network: string;
  adminAddress: string;
  issuerRegistryId: string;
  credentialStatusId: string;
  entities: Record<string, SeededEntity>;
}

/**
 * Load deployed contract IDs from environment variables or deployment manifest.
 * Throws if any ID is missing — fail closed.
 */
export function loadContractIds(
  network: string = process.env["STELLAR_NETWORK"] || "local",
): DeployedContracts {
  const issuerRegistry = process.env["ISSUER_REGISTRY_ID"];
  const credentialStatus = process.env["CREDENTIAL_STATUS_ID"];
  const consentRegistry = process.env["CONSENT_REGISTRY_ID"];
  const correctionTracker = process.env["CORRECTION_TRACKER_ID"];

  if (issuerRegistry && credentialStatus && consentRegistry && correctionTracker) {
    return { issuerRegistry, credentialStatus, consentRegistry, correctionTracker };
  }

  // Fallback to deployments/<network>.json if present
  const candidates = [
    resolve(process.cwd(), `../../deployments/${network}.json`),
    resolve(process.cwd(), `deployments/${network}.json`),
    resolve(process.cwd(), `../deployments/${network}.json`),
  ];

  for (const path of candidates) {
    if (existsSync(path)) {
      try {
        const data = JSON.parse(readFileSync(path, "utf-8"));
        return {
          issuerRegistry: issuerRegistry || data.issuerRegistry,
          credentialStatus: credentialStatus || data.credentialStatus,
          consentRegistry: consentRegistry || data.consentRegistry,
          correctionTracker: correctionTracker || data.correctionTracker,
        };
      } catch {
        // ignore
      }
    }
  }

  throw new Error(
    "Missing contract IDs in environment. Run pnpm contracts:deploy:local first.",
  );
}

/**
 * Load seeded registry info (for offline verification or contract tests).
 */
export function loadSeededRegistry(
  network: string = process.env["STELLAR_NETWORK"] || "local",
): SeededRegistry {
  const candidates = [
    resolve(process.cwd(), `../../deployments/seeded-${network}.json`),
    resolve(process.cwd(), `deployments/seeded-${network}.json`),
    resolve(process.cwd(), `../deployments/seeded-${network}.json`),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, "utf-8")) as SeededRegistry;
    }
  }
  throw new Error(
    `Seeded registry file not found for network: ${network}. Run pnpm chain:seed first.`,
  );
}

/**
 * Typed wrapper to get an IssuerRegistry client instance.
 */
export function getIssuerRegistryClient(options?: {
  contractId?: string;
  networkPassphrase?: string;
  rpcUrl?: string;
  publicKey?: string;
}): IssuerRegistryBindings.Client {
  const ids = options?.contractId
    ? { issuerRegistry: options.contractId }
    : loadContractIds();
  return new IssuerRegistryBindings.Client({
    contractId: ids.issuerRegistry,
    networkPassphrase:
      options?.networkPassphrase ||
      process.env["STELLAR_NETWORK_PASSPHRASE"] ||
      "Standalone Network ; February 2017",
    rpcUrl:
      options?.rpcUrl ||
      process.env["STELLAR_RPC_URL"] ||
      "http://localhost:8000/soroban/rpc",
    ...(options?.publicKey ? { publicKey: options.publicKey } : {}),
  });
}

/**
 * Typed wrapper to get a CredentialStatus client instance.
 */
export function getCredentialStatusClient(options?: {
  contractId?: string;
  networkPassphrase?: string;
  rpcUrl?: string;
  publicKey?: string;
}): CredentialStatusBindings.Client {
  const ids = options?.contractId
    ? { credentialStatus: options.contractId }
    : loadContractIds();
  return new CredentialStatusBindings.Client({
    contractId: ids.credentialStatus,
    networkPassphrase:
      options?.networkPassphrase ||
      process.env["STELLAR_NETWORK_PASSPHRASE"] ||
      "Standalone Network ; February 2017",
    rpcUrl:
      options?.rpcUrl ||
      process.env["STELLAR_RPC_URL"] ||
      "http://localhost:8000/soroban/rpc",
    ...(options?.publicKey ? { publicKey: options.publicKey } : {}),
  });
}

/**
 * Typed wrapper to get a ConsentRegistry client instance.
 */
export function getConsentRegistryClient(options?: {
  contractId?: string;
  networkPassphrase?: string;
  rpcUrl?: string;
  publicKey?: string;
}): ConsentRegistryBindings.Client {
  const ids = options?.contractId
    ? { consentRegistry: options.contractId }
    : loadContractIds();
  return new ConsentRegistryBindings.Client({
    contractId: ids.consentRegistry,
    networkPassphrase:
      options?.networkPassphrase ||
      process.env["STELLAR_NETWORK_PASSPHRASE"] ||
      "Standalone Network ; February 2017",
    rpcUrl:
      options?.rpcUrl ||
      process.env["STELLAR_RPC_URL"] ||
      "http://localhost:8000/soroban/rpc",
    ...(options?.publicKey ? { publicKey: options.publicKey } : {}),
  });
}

/**
 * Typed wrapper to get a CorrectionTracker client instance.
 */
export function getCorrectionTrackerClient(options?: {
  contractId?: string;
  networkPassphrase?: string;
  rpcUrl?: string;
  publicKey?: string;
}): CorrectionTrackerBindings.Client {
  const ids = options?.contractId
    ? { correctionTracker: options.contractId }
    : loadContractIds();
  return new CorrectionTrackerBindings.Client({
    contractId: ids.correctionTracker,
    networkPassphrase:
      options?.networkPassphrase ||
      process.env["STELLAR_NETWORK_PASSPHRASE"] ||
      "Standalone Network ; February 2017",
    rpcUrl:
      options?.rpcUrl ||
      process.env["STELLAR_RPC_URL"] ||
      "http://localhost:8000/soroban/rpc",
    ...(options?.publicKey ? { publicKey: options.publicKey } : {}),
  });
}

/**
 * Helper to check if an address is an active issuer.
 * Queries on-chain when RPC is reachable, falls back to seeded registry offline.
 */
export async function isActiveIssuer(
  address: string,
  network = "local",
): Promise<boolean> {
  if (mockStatusOverrides.issuers.has(address)) {
    return mockStatusOverrides.issuers.get(address)!;
  }
  try {
    const client = getIssuerRegistryClient();
    const result = await client.is_active_issuer({ addr: address });
    return result.result;
  } catch {
    // Offline / fallback to seeded registry
    try {
      const seeded = loadSeededRegistry(network);
      const entity = seeded.entities[address];
      return !!entity && entity.role === "Issuer" && entity.status === "Active";
    } catch {
      return false;
    }
  }
}

/**
 * Helper to check if an address is an active verifier.
 * Queries on-chain when RPC is reachable, falls back to seeded registry offline.
 */
export async function isActiveVerifier(
  address: string,
  network = "local",
): Promise<boolean> {
  // Check override/mock first
  if (mockStatusOverrides.verifiers.has(address)) {
    return mockStatusOverrides.verifiers.get(address)!;
  }
  try {
    const client = getIssuerRegistryClient();
    const result = await client.is_active_verifier({ addr: address });
    return result.result;
  } catch {
    // Offline / fallback to seeded registry
    try {
      const seeded = loadSeededRegistry(network);
      const entity = seeded.entities[address];
      return !!entity && entity.role === "Verifier" && entity.status === "Active";
    } catch {
      return false;
    }
  }
}

// ── In-memory mock/override registry for testing edge cases ─────────────────
export const mockStatusOverrides = {
  issuers: new Map<string, boolean>(),
  verifiers: new Map<string, boolean>(),
  credentials: new Map<string, "Active" | "Revoked" | "Expired">(),
  consents: new Map<string, "Active" | "Withdrawn" | "Expired">(),
  reset() {
    this.issuers.clear();
    this.verifiers.clear();
    this.credentials.clear();
    this.consents.clear();
  },
};

/**
 * Helper to check if a credential is active on-chain on credential-status contract.
 * Fails closed (returns false) if status is Revoked, Expired, or query fails.
 */
export async function isCredentialActive(
  credentialHash: string,
  _network = "local",
): Promise<boolean> {
  const normHash = credentialHash.replace(/^0x/, "").toLowerCase();
  if (mockStatusOverrides.credentials.has(normHash)) {
    return mockStatusOverrides.credentials.get(normHash) === "Active";
  }

  try {
    const client = getCredentialStatusClient();
    const buf = Buffer.from(normHash.padStart(64, "0").slice(0, 64), "hex");
    const result = await client.status({ hash: buf });
    // Check if result is "Active" or object representation
    const resVal = result?.result as unknown;
    if (
      resVal === "Active" ||
      (typeof resVal === "object" &&
        resVal !== null &&
        "tag" in resVal &&
        (resVal as { tag: string }).tag === "Active")
    ) {
      return true;
    }
    // Handle Ok/Err wrapper if present
    if (
      resVal &&
      typeof resVal === "object" &&
      "unwrap" in resVal &&
      typeof (resVal as { unwrap: () => unknown }).unwrap === "function"
    ) {
      try {
        const unwrapped = (resVal as { unwrap: () => unknown }).unwrap();
        return (
          unwrapped === "Active" ||
          (typeof unwrapped === "object" &&
            unwrapped !== null &&
            "tag" in unwrapped &&
            (unwrapped as { tag: string }).tag === "Active")
        );
      } catch {
        return false;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Helper to check if a consent receipt is active on-chain on consent-registry contract.
 * Fails closed (returns false) if status is Withdrawn, Expired, or query fails.
 */
export async function isConsentActive(
  receiptHash: string,
  _network = "local",
): Promise<boolean> {
  const normHash = receiptHash.replace(/^0x/, "").toLowerCase();
  if (mockStatusOverrides.consents.has(normHash)) {
    return mockStatusOverrides.consents.get(normHash) === "Active";
  }

  try {
    const client = getConsentRegistryClient();
    const buf = Buffer.from(normHash.padStart(64, "0").slice(0, 64), "hex");
    const result = await client.status({ receipt_hash: buf });
    const resVal = result?.result as unknown;
    if (
      resVal === "Active" ||
      (typeof resVal === "object" &&
        resVal !== null &&
        "tag" in resVal &&
        (resVal as { tag: string }).tag === "Active")
    ) {
      return true;
    }
    // Handle Ok/Err wrapper if present
    if (
      resVal &&
      typeof resVal === "object" &&
      "unwrap" in resVal &&
      typeof (resVal as { unwrap: () => unknown }).unwrap === "function"
    ) {
      try {
        const unwrapped = (resVal as { unwrap: () => unknown }).unwrap();
        return (
          unwrapped === "Active" ||
          (typeof unwrapped === "object" &&
            unwrapped !== null &&
            "tag" in unwrapped &&
            (unwrapped as { tag: string }).tag === "Active")
        );
      } catch {
        return false;
      }
    }
    return false;
  } catch {
    return false;
  }
}
