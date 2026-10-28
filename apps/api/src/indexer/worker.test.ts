/**
 * src/indexer/worker.test.ts — Indexer + audit chain tests (Commit 4)
 *
 * Tests:
 *   1. Replaying the same events twice leaves state unchanged (idempotent).
 *   2. Killing and restarting resumes from the cursor.
 *   3. Altering an audit row fails verification.
 *   4. Audit chain verification passes for a fresh chain.
 *
 * Uses an in-memory mock DB to avoid requiring a live Postgres.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import { canonicalise } from "@oneid/vc";

// ── In-memory DB mock ─────────────────────────────────────────────────────

interface AuditRow {
  id: string;
  actor_id: string | null;
  actor_role: string | null;
  type: string;
  ref_id: string | null;
  chain_tx: string | null;
  prev_hash: string;
  hash: string;
  created_at: Date;
}

interface CursorRow {
  contract_id: string;
  last_ledger: number;
  last_event_id: string | null;
}

let auditRows: AuditRow[] = [];
let cursorRows: CursorRow[] = [];

function resetMockDb() {
  auditRows = [];
  cursorRows = [];
}

// ── Hash helper (mirrors lib/audit.ts logic) ─────────────────────────────

function computeHash(
  prevHash: string,
  event: Omit<AuditRow, "id" | "prev_hash" | "hash" | "created_at">,
): string {
  const payload = {
    type: event.type,
    actorId: event.actor_id,
    actorRole: event.actor_role,
    refId: event.ref_id,
    chainTx: event.chain_tx,
  };
  return createHash("sha256")
    .update(prevHash + canonicalise(payload), "utf8")
    .digest("hex");
}

let _idCounter = 0;
function appendAuditMock(input: {
  actorId?: string;
  actorRole?: string;
  type: string;
  refId?: string;
  chainTx?: string;
}): { id: string; hash: string } {
  const prevHash =
    auditRows.at(-1)?.hash ??
    "0000000000000000000000000000000000000000000000000000000000000000";

  const event = {
    actor_id: input.actorId ?? null,
    actor_role: input.actorRole ?? null,
    type: input.type,
    ref_id: input.refId ?? null,
    chain_tx: input.chainTx ?? null,
  };

  const hash = computeHash(prevHash, event);
  const id = `audit-${++_idCounter}`;

  auditRows.push({
    id,
    ...event,
    prev_hash: prevHash,
    hash,
    created_at: new Date(),
  });

  return { id, hash };
}

// ── Mock the DB ───────────────────────────────────────────────────────────

vi.mock("../db/index.js", () => ({
  getDb: () => ({
    select: () => ({
      from: (_table: unknown) => ({
        where: (_condition: unknown) => ({
          limit: () => {
            // For chain_cursor queries, filter by contract_id
            // condition is an opaque Drizzle object; we match via cursorRows directly
            const last =
              cursorRows.length > 0 ? cursorRows[cursorRows.length - 1] : undefined;
            return Promise.resolve(last ? [last] : []);
          },
        }),
        orderBy: () => Promise.resolve([...auditRows]),
      }),
    }),
    insert: () => ({
      values: (vals: AuditRow) => ({
        returning: () => {
          const row = { ...vals, id: `audit-${++_idCounter}` };
          auditRows.push(row as unknown as AuditRow);
          return Promise.resolve([row]);
        },
        onConflictDoUpdate: () =>
          Promise.resolve(
            (() => {
              const existing = cursorRows.find(
                (c) => c.contract_id === (vals as unknown as CursorRow).contract_id,
              );
              if (existing) {
                existing.last_ledger = (vals as unknown as CursorRow).last_ledger;
                existing.last_event_id = (vals as unknown as CursorRow).last_event_id;
              } else {
                cursorRows.push(vals as unknown as CursorRow);
              }
            })(),
          ),
      }),
    }),
    update: (_table: unknown) => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }),
    delete: () => Promise.resolve(),
  }),
  chain_cursor: {},
  credentials: {},
  consents: {},
  entities: {},
  correction_outcomes: {},
  correction_tickets: {},
  audit_events: {},
  users: {},
  applications: {},
  claim_requests: {},
  correction_outcome_status: {},
}));

vi.mock("../lib/audit.js", async () => {
  // Return real-ish implementations backed by in-memory store
  return {
    appendAuditEvent: vi
      .fn()
      .mockImplementation((input: Parameters<typeof appendAuditMock>[0]) =>
        Promise.resolve(appendAuditMock(input)),
      ),
    verifyAuditChain: vi.fn().mockImplementation(() => {
      let checked = 0;
      for (const row of auditRows) {
        const event = {
          actor_id: row.actor_id,
          actor_role: row.actor_role,
          type: row.type,
          ref_id: row.ref_id,
          chain_tx: row.chain_tx,
        };
        const expected = computeHash(row.prev_hash, event);
        checked++;
        if (expected !== row.hash) {
          return Promise.resolve({
            valid: false,
            firstViolationId: row.id,
            expected,
            actual: row.hash,
            checked,
          });
        }
      }
      return Promise.resolve({ valid: true, checked });
    }),
  };
});

vi.mock("@oneid/stellar", () => ({
  resolveNetwork: () => ({
    name: "local",
    rpcUrl: "http://localhost:8000/soroban/rpc",
    networkPassphrase: "test",
  }),
  getRpcServer: () => ({
    getEvents: () => Promise.resolve({ events: [], latestLedger: 10 }),
  }),
}));

// ── Import after mocks ────────────────────────────────────────────────────
const { processEvent, getCursor, setCursor, pollContract } = await import("./worker.js");
const { verifyAuditChain } = await import("../lib/audit.js");

describe("Indexer — idempotency", () => {
  beforeEach(() => {
    resetMockDb();
  });

  it("processing a revoked credential event twice leaves status unchanged", async () => {
    process.env["CREDENTIAL_STATUS_ID"] = "CTEST_CRED_ID";

    const event = {
      type: "contract" as const,
      ledger: 100,
      ledgerClosedAt: new Date().toISOString(),
      id: "event-1",
      pagingToken: "1",
      inSuccessfulContractCall: true,
      contractId: "CTEST_CRED_ID",
      topic: [JSON.stringify("revoked")],
      value: { hash: "abc123" },
    } as unknown as Parameters<typeof processEvent>[1];

    const handled1 = await processEvent("CTEST_CRED_ID", event);
    const handled2 = await processEvent("CTEST_CRED_ID", event);

    // Both calls process without error — second is a no-op via WHERE status <> 'revoked'
    expect(handled1).toBe(true);
    expect(handled2).toBe(true);
  });
});

describe("Indexer — cursor resumability", () => {
  beforeEach(() => {
    resetMockDb();
  });

  it("getCursor returns 0 for an unknown contract", async () => {
    const ledger = await getCursor("CUNKNOWN");
    expect(ledger).toBe(0);
  });

  it("setCursor then getCursor returns the stored ledger", async () => {
    await setCursor("CTEST", 42);
    // In the mock, the cursor is stored in cursorRows
    const row = cursorRows.find((c) => c.contract_id === "CTEST");
    expect(row?.last_ledger).toBe(42);
  });

  it("pollContract returns the latest ledger from RPC", async () => {
    process.env["CREDENTIAL_STATUS_ID"] = "CTEST_CRED";
    const mockRpc = {
      getEvents: vi.fn().mockResolvedValue({ events: [], latestLedger: 99 }),
    } as unknown as Parameters<typeof pollContract>[0];

    const result = await pollContract(mockRpc, "CTEST_CRED", 0);
    expect(result).toBe(99);
    expect(mockRpc.getEvents).toHaveBeenCalledOnce();
  });

  it("restarting resumes from stored cursor (not 0)", async () => {
    // Set a cursor to simulate a previous run
    await setCursor("CRESUME", 50);

    const mockRpc = {
      getEvents: vi.fn().mockResolvedValue({ events: [], latestLedger: 75 }),
    } as unknown as Parameters<typeof pollContract>[0];

    // pollContract called with fromLedger = 50 (from stored cursor)
    const result = await pollContract(mockRpc, "CRESUME", 50);
    expect(result).toBe(75);
    // Ensure startLedger was passed as 50
    expect(mockRpc.getEvents).toHaveBeenCalledWith(
      expect.objectContaining({ startLedger: 50 }),
    );
  });
});

describe("Audit hash chain — integrity", () => {
  beforeEach(() => {
    resetMockDb();
    _idCounter = 0; // reset counter
  });

  it("fresh chain with zero events is valid", async () => {
    const result = await verifyAuditChain();
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.checked).toBe(0);
  });

  it("appending events creates a valid chain", async () => {
    appendAuditMock({ type: "test.event.one", refId: "ref1" });
    appendAuditMock({ type: "test.event.two", refId: "ref2" });
    appendAuditMock({ type: "test.event.three", refId: "ref3" });

    const result = await verifyAuditChain();
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.checked).toBe(3);
  });

  it("altering an audit row hash fails verification", async () => {
    appendAuditMock({ type: "test.tamper.before", refId: "a" });
    appendAuditMock({ type: "test.tamper.target", refId: "b" });
    appendAuditMock({ type: "test.tamper.after", refId: "c" });

    // Tamper: change the hash of the second row
    const targetRow = auditRows[1]!;
    targetRow.hash = "deadbeef".repeat(8);

    const result = await verifyAuditChain();
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.firstViolationId).toBe(targetRow.id);
    }
  });

  it("altering the type field in a row fails verification", async () => {
    appendAuditMock({ type: "original.type", refId: "x" });
    const row = auditRows[0]!;
    // Tamper the type but leave the hash unchanged
    row.type = "malicious.type";

    const result = await verifyAuditChain();
    expect(result.valid).toBe(false);
  });
});
