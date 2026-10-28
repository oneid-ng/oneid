/**
 * indexer/verify-audit.ts — Verify the integrity of the audit hash chain.
 *
 * Checks every audit_events row: hash = SHA-256(prev_hash || canonical_event).
 * Exits 0 if valid, 1 if any row has been tampered with.
 *
 * Usage: node --import tsx/esm src/indexer/verify-audit.ts
 *        pnpm audit:verify
 */

import { verifyAuditChain } from "../lib/audit.js";

console.warn("[audit-verify] Verifying audit hash chain …");

const result = await verifyAuditChain();

if (result.valid) {
  console.warn(
    `[audit-verify] PASS: ${result.checked} events verified. Chain integrity confirmed.`,
  );
  process.exit(0);
} else {
  console.error(`[audit-verify] FAIL: Tampered row detected!`);
  console.error(`  First violation at event ID: ${result.firstViolationId}`);
  console.error(`  Expected hash: ${result.expected}`);
  console.error(`  Actual hash:   ${result.actual}`);
  console.error(`  Checked ${result.checked} events before violation.`);
  process.exit(1);
}
