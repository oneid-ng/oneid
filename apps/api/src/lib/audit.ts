/**
 * lib/audit.ts — Tamper-evident audit event log (README §15).
 *
 * hash = SHA-256( prev_hash || canonicalise(event) )
 *
 * This creates an append-only hash chain. Any row modification breaks
 * the chain and is detected by the verify command.
 *
 * Rules:
 *  - No personal data in type, ref_id or chain_tx fields.
 *  - actor_id (UUID) and actor_role are the only identity references.
 *  - Canonicalisation uses RFC 8785 JCS from @oneid/vc.
 */

import { createHash } from "node:crypto";
import { canonicalise } from "@oneid/vc";
import { getDb } from "../db/index.js";
import { audit_events } from "../db/schema.js";
import { desc } from "drizzle-orm";

export interface AuditEventInput {
  actorId?: string | null;
  actorRole?: string | null;
  type: string;
  refId?: string | null;
  chainTx?: string | null;
}

/** Build an AuditEventInput stripping null/undefined optional fields. */
export function auditInput(
  type: string,
  opts: {
    actorId?: string | null;
    actorRole?: string | null;
    refId?: string | null;
    chainTx?: string | null;
  } = {},
): AuditEventInput {
  return { type, ...opts };
}

/**
 * Append one tamper-evident audit event to the chain.
 * Fetches the latest hash, computes the new hash, and inserts.
 */
export async function appendAuditEvent(
  input: AuditEventInput,
): Promise<{ id: string; hash: string }> {
  const db = getDb();

  // Fetch previous hash (serialise access — acceptable for demo scale)
  const [latest] = await db
    .select({ hash: audit_events.hash })
    .from(audit_events)
    .orderBy(desc(audit_events.created_at))
    .limit(1);

  const prevHash =
    latest?.hash ?? "0000000000000000000000000000000000000000000000000000000000000000";

  // Canonical event payload for hashing (no personal data)
  const eventPayload = {
    type: input.type,
    actorId: input.actorId ?? null,
    actorRole: input.actorRole ?? null,
    refId: input.refId ?? null,
    chainTx: input.chainTx ?? null,
  };

  const canonical = canonicalise(eventPayload);
  const hash = createHash("sha256")
    .update(prevHash + canonical, "utf8")
    .digest("hex");

  const [inserted] = await db
    .insert(audit_events)
    .values({
      actor_id: input.actorId ?? null,
      actor_role: input.actorRole ?? null,
      type: input.type,
      ref_id: input.refId ?? null,
      chain_tx: input.chainTx ?? null,
      prev_hash: prevHash,
      hash,
    })
    .returning({ id: audit_events.id, hash: audit_events.hash });

  if (!inserted) {
    throw new Error("Failed to insert audit event");
  }

  return inserted;
}

/**
 * Verify the integrity of the entire audit hash chain.
 * Returns { valid: true } or { valid: false, firstViolationId, expected, actual }.
 */
export async function verifyAuditChain(): Promise<
  | { valid: true; checked: number }
  | {
      valid: false;
      firstViolationId: string;
      expected: string;
      actual: string;
      checked: number;
    }
> {
  const db = getDb();

  const rows = await db.select().from(audit_events).orderBy(audit_events.created_at);

  let checked = 0;

  for (const row of rows) {
    const eventPayload = {
      type: row.type,
      actorId: row.actor_id ?? null,
      actorRole: row.actor_role ?? null,
      refId: row.ref_id ?? null,
      chainTx: row.chain_tx ?? null,
    };

    const canonical = canonicalise(eventPayload);
    const expectedHash = createHash("sha256")
      .update(row.prev_hash + canonical, "utf8")
      .digest("hex");

    checked++;

    if (expectedHash !== row.hash) {
      return {
        valid: false,
        firstViolationId: row.id,
        expected: expectedHash,
        actual: row.hash,
        checked,
      };
    }
  }

  return { valid: true, checked };
}
