/**
 * indexer/rebuild.ts — Rebuild all mirrored DB state from chain events.
 *
 * Clears chain_cursor (and optionally mirrored status columns), then
 * replays all events from ledger 0.
 *
 * Usage: node --import tsx/esm src/indexer/rebuild.ts
 *        pnpm indexer:rebuild
 *
 * Idempotent: running twice produces the same result.
 */

import { getDb } from "../db/index.js";
import { chain_cursor, credentials, consents, entities } from "../db/schema.js";
import { resolveNetwork, getRpcServer } from "@oneid/stellar";
import { pollContract, setCursor } from "./worker.js";
import type { rpc as SorobanRpc } from "@stellar/stellar-sdk";

function getContractIds() {
  return {
    issuerRegistry: process.env["ISSUER_REGISTRY_ID"] ?? "",
    credentialStatus: process.env["CREDENTIAL_STATUS_ID"] ?? "",
    consentRegistry: process.env["CONSENT_REGISTRY_ID"] ?? "",
    correctionTracker: process.env["CORRECTION_TRACKER_ID"] ?? "",
  };
}

const db = getDb();
const network = resolveNetwork();
const rpc = getRpcServer(network);

console.warn("[rebuild] Starting rebuild from ledger 0 …");

// ── Step 1: Reset all cursors ─────────────────────────────────────────────
await db.delete(chain_cursor);
console.warn("[rebuild] Cleared chain_cursor.");

// ── Step 2: Reset mirrored status columns to defaults ────────────────────
// (Only fields that the indexer writes — not the issuer-set values)
await db.update(credentials).set({ status: "active" });
await db.update(consents).set({ status: "active" });
await db.update(entities).set({ status: "active" });
console.warn("[rebuild] Reset mirrored status fields.");

// ── Step 3: Replay all events from ledger 0 ──────────────────────────────
const contractIds = getContractIds();

const contracts = [
  { id: contractIds.issuerRegistry, name: "issuer-registry" },
  { id: contractIds.credentialStatus, name: "credential-status" },
  { id: contractIds.consentRegistry, name: "consent-registry" },
  { id: contractIds.correctionTracker, name: "correction-tracker" },
];

for (const { id: contractId, name } of contracts) {
  if (!contractId) {
    console.warn(`[rebuild] Skipping ${name}: contract ID not set.`);
    continue;
  }

  console.warn(`[rebuild] Replaying events for ${name} (${contractId}) …`);
  const newLedger = await pollContract(rpc as SorobanRpc.Server, contractId, 0);
  await setCursor(contractId, newLedger);
  console.warn(`[rebuild]   → cursor set to ledger ${newLedger}`);
}

console.warn("[rebuild] Rebuild complete.");
process.exit(0);
