/**
 * @oneid/contracts-client
 *
 * Generated TypeScript bindings and typed wrappers for Soroban contracts.
 *
 * The `generated/` sub-directories are produced by:
 *   pnpm contracts:bindings
 *
 * NOT IMPLEMENTED YET — bindings are generated after contracts are deployed
 * (infra/scripts/gen-bindings.sh, arrives on Day 2 with the real contracts).
 *
 * This file exports placeholder types so dependent packages compile cleanly.
 */

// ── Placeholder contract IDs ───────────────────────────────────────────────

export interface DeployedContracts {
  issuerRegistry: string;
  credentialStatus: string;
  consentRegistry: string;
  correctionTracker: string;
}

/**
 * Load deployed contract IDs from environment variables.
 * Throws if any ID is missing — fail closed.
 */
export function loadContractIds(): DeployedContracts {
  const issuerRegistry = process.env["ISSUER_REGISTRY_ID"];
  const credentialStatus = process.env["CREDENTIAL_STATUS_ID"];
  const consentRegistry = process.env["CONSENT_REGISTRY_ID"];
  const correctionTracker = process.env["CORRECTION_TRACKER_ID"];

  if (!issuerRegistry || !credentialStatus || !consentRegistry || !correctionTracker) {
    throw new Error(
      "Missing contract IDs in environment. Run pnpm contracts:deploy:local first.",
    );
  }

  return { issuerRegistry, credentialStatus, consentRegistry, correctionTracker };
}
