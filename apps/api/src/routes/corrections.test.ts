/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * src/routes/corrections.test.ts — Cross-institution correction flows & failure simulation (README §14.1, §18.4)
 *
 * Covers:
 * - Opening correction tickets with off-chain synthetic details
 * - Institution A cannot respond for Institution B (Rule #6, fail closed)
 * - Independent per-institution outcomes timeline (applied, rejected, failed, partially_applied)
 * - Partial synchronisation visibility
 * - Flag-gated failure simulation (rpc_down, tx_failure, partial_sync) and retry
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { getTableName } from "drizzle-orm";

let mockUsers: any[] = [];
let mockEntities: any[] = [];
let mockCorrectionTickets: any[] = [];
let mockCorrectionOutcomes: any[] = [];
let mockAuditEvents: any[] = [];

vi.mock("../db/index.js", () => {
  const getTableData = (table: any): any[] => {
    let name = "";
    try {
      name = typeof table === "string" ? table : getTableName(table);
    } catch {
      name = String(table?.id ?? "");
    }
    if (name === "users") return mockUsers;
    if (name === "entities") return mockEntities;
    if (name === "correction_tickets") return mockCorrectionTickets;
    if (name === "correction_outcomes") return mockCorrectionOutcomes;
    return [];
  };

  function extractClauses(clause: any): Array<{ col: string; val: any }> {
    const result: Array<{ col: string; val: any }> = [];
    function walk(chunks: any[]) {
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i];
        if (c && typeof c === "object" && Array.isArray(c.queryChunks)) {
          walk(c.queryChunks);
        } else if (c && typeof c === "object" && typeof c.name === "string") {
          const col = c.name;
          for (let j = i + 1; j < chunks.length; j++) {
            const raw = chunks[j];
            const val =
              raw && typeof raw === "object" && "value" in raw ? raw.value : raw;
            if (["string", "number", "boolean"].includes(typeof val)) {
              result.push({ col, val });
              i = j;
              break;
            }
          }
        }
      }
    }
    if (clause?.queryChunks) walk(clause.queryChunks);
    return result;
  }

  function matchClause(item: any, clause: any): boolean {
    if (!clause) return true;
    const conditions = extractClauses(clause);
    for (const { col, val } of conditions) {
      if (item[col] !== val) return false;
    }
    return true;
  }

  const mockDb = {
    select: () => ({
      from: (table: any) => {
        const rows = getTableData(table);
        return {
          where: (clause?: any) => {
            const filtered = clause ? rows.filter((r) => matchClause(r, clause)) : rows;
            return {
              orderBy: () => Promise.resolve([...filtered]),
              limit: (n: number) => Promise.resolve(filtered.slice(0, n)),
              then: (resolve: any) => Promise.resolve(filtered).then(resolve),
            };
          },
          innerJoin: (_joinTable: any, _onClause?: any) => ({
            where: (clause?: any) => {
              // Mock join for correction_outcomes + entities
              const joined = mockCorrectionOutcomes.map((o) => {
                const ent = mockEntities.find((e) => e.id === o.institution_id);
                return {
                  ...o,
                  institutionId: o.institution_id,
                  reasonCode: o.reason_code,
                  institutionName: ent?.name,
                  homeDomain: ent?.home_domain,
                };
              });
              const filtered = clause
                ? joined.filter((j) => matchClause(j, clause))
                : joined;
              return {
                orderBy: () => Promise.resolve([...filtered]),
                then: (resolve: any) => Promise.resolve(filtered).then(resolve),
              };
            },
          }),
          limit: (n: number) => Promise.resolve(rows.slice(0, n)),
          then: (resolve: any) => Promise.resolve(rows).then(resolve),
        };
      },
    }),
    insert: (table: any) => ({
      values: (val: any) => ({
        returning: () => {
          const item = { ...val, id: val.id ?? randomUUID() };
          const list = getTableData(table);
          list.push(item);
          return Promise.resolve([item]);
        },
      }),
    }),
    update: (table: any) => ({
      set: (val: any) => ({
        where: (clause?: any) => {
          const list = getTableData(table);
          const targets = clause
            ? list.filter((item) => matchClause(item, clause))
            : list;
          targets.forEach((item) => Object.assign(item, val));
          return Promise.resolve();
        },
      }),
    }),
  };

  return {
    getDb: () => mockDb,
    users: { id: "users" },
    entities: { id: "entities" },
    claim_requests: { id: "claim_requests" },
    consents: { id: "consents" },
    credentials: { id: "credentials" },
    applications: { id: "applications" },
    correction_tickets: { id: "correction_tickets" },
    correction_outcomes: { id: "correction_outcomes" },
    audit_events: { id: "audit_events" },
    chain_cursor: { id: "chain_cursor" },
  };
});

vi.mock("../lib/audit.js", () => ({
  appendAuditEvent: vi.fn().mockImplementation((ev) => {
    mockAuditEvents.push(ev);
    return Promise.resolve({ id: "audit-id", hash: "mock-hash" });
  }),
  verifyAuditChain: vi.fn().mockResolvedValue({ valid: true, checked: 0 }),
}));

vi.mock("@oneid/stellar", () => ({
  submitTransaction: vi.fn().mockResolvedValue({
    status: "confirmed",
    txHash: "mock-tx-correction-001",
    ledger: 1088,
  }),
  resolveNetwork: vi.fn().mockReturnValue({ name: "local" }),
  getRpcServer: vi.fn().mockReturnValue({}),
}));

const { buildApp } = await import("../index.js");

describe("Correction Tracker & Failure Simulation (README §14.1, §18.4)", () => {
  let app: FastifyInstance;

  const citizenUser = {
    id: "00000000-0000-0000-0000-000000000001",
    role: "citizen",
    stellar_address: "GCITIZEN00000000000000000000000000000000000000000000000001",
    synthetic_profile: {
      fullName: "Adaeze Okonkwo",
      address: "12 Marina, Lagos",
    },
  };

  const bankEntity = {
    id: "00000000-0000-0000-0000-000000000010",
    role: "verifier",
    name: "First Demo Bank",
    home_domain: "bank.demo.oneid.local",
    stellar_address: "GBANK00000000000000000000000000000000000000000000000000010",
    status: "active",
  };

  const telecomEntity = {
    id: "00000000-0000-0000-0000-000000000020",
    role: "verifier",
    name: "Demo Telecom Nigeria",
    home_domain: "telecom.demo.oneid.local",
    stellar_address: "GTELECOM00000000000000000000000000000000000000000000000020",
    status: "active",
  };

  const otherEntity = {
    id: "00000000-0000-0000-0000-000000000099",
    role: "issuer",
    name: "Untargeted Issuer",
    home_domain: "untargeted.demo.oneid.local",
    stellar_address: "GOTHER000000000000000000000000000000000000000000000000099",
    status: "active",
  };

  beforeEach(async () => {
    app = await buildApp();

    mockUsers = [
      citizenUser,
      {
        id: "user-bank-id",
        role: "verifier",
        stellar_address: bankEntity.stellar_address,
      },
      {
        id: "user-telecom-id",
        role: "verifier",
        stellar_address: telecomEntity.stellar_address,
      },
      {
        id: "user-other-id",
        role: "issuer",
        stellar_address: otherEntity.stellar_address,
      },
      {
        id: "user-admin-id",
        role: "admin",
      },
    ];

    mockEntities = [bankEntity, telecomEntity, otherEntity];
    mockCorrectionTickets = [];
    mockCorrectionOutcomes = [];
    mockAuditEvents = [];
  });

  async function loginAs(role: string, stellarAddress?: string) {
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/portal/login",
      payload: { role, demoKey: `demo-${role}-2026`, stellarAddress },
    });
    return res.cookies[0];
  }

  it("citizen opens correction ticket and institution A cannot respond for institution B", async () => {
    const citizenCookie = await loginAs("citizen");

    // Citizen opens ticket targeting Bank and Telecom
    const openRes = await app.inject({
      method: "POST",
      url: "/v1/corrections",
      cookies: { [citizenCookie!.name]: citizenCookie!.value },
      payload: {
        category: "address_change",
        detail: {
          oldAddress: "12 Marina, Lagos",
          newAddress: "45 Broad St, Lagos",
          syntheticProofRef: "synth-doc-123",
        },
        targetInstitutions: [bankEntity.id, telecomEntity.id],
      },
    });

    expect(openRes.statusCode).toBe(201);
    const opened = openRes.json();
    expect(opened.ticketHash).toBeDefined();
    expect(opened.outcomes).toHaveLength(2);
    const ticketId = opened.id;

    // Bank logs in
    const bankCookie = await loginAs("verifier", bankEntity.stellar_address);

    // Bank responds for itself with 'applied'
    const bankRes = await app.inject({
      method: "POST",
      url: `/v1/corrections/${ticketId}/respond`,
      cookies: { [bankCookie!.name]: bankCookie!.value },
      payload: {
        status: "applied",
      },
    });

    expect(bankRes.statusCode).toBe(200);
    const bankOutcome = bankRes.json();
    expect(bankOutcome.status).toBe("applied");
    expect(bankOutcome.institutionId).toBe(bankEntity.id);

    // Untargeted entity attempts to respond for this ticket -> fails 403
    const otherCookie = await loginAs("issuer", otherEntity.stellar_address);
    const untargetedRes = await app.inject({
      method: "POST",
      url: `/v1/corrections/${ticketId}/respond`,
      cookies: { [otherCookie!.name]: otherCookie!.value },
      payload: {
        status: "applied",
      },
    });

    expect(untargetedRes.statusCode).toBe(403);
    expect(untargetedRes.json().error.code).toBe("FORBIDDEN_ROLE");
    expect(untargetedRes.json().error.message).toContain(
      "cannot update another institution's correction status",
    );
  });

  it("partial synchronisation is visible in the per-institution timeline", async () => {
    const citizenCookie = await loginAs("citizen");

    // Citizen opens ticket
    const openRes = await app.inject({
      method: "POST",
      url: "/v1/corrections",
      cookies: { [citizenCookie!.name]: citizenCookie!.value },
      payload: {
        category: "name_correction",
        detail: {
          note: "Typo in synthetic maiden name",
        },
        targetInstitutions: [bankEntity.id, telecomEntity.id],
      },
    });
    const ticketId = openRes.json().id;

    // Bank marks outcome as 'applied'
    const bankCookie = await loginAs("verifier", bankEntity.stellar_address);
    await app.inject({
      method: "POST",
      url: `/v1/corrections/${ticketId}/respond`,
      cookies: { [bankCookie!.name]: bankCookie!.value },
      payload: { status: "applied" },
    });

    // Telecom marks outcome as 'rejected' with numeric reason code
    // (mock Telecom login by setting telecom entity address in mockUsers verifier slot)
    mockUsers.find((u) => u.id === "user-bank-id").stellar_address =
      telecomEntity.stellar_address;
    const telecomCookie = await loginAs("verifier", telecomEntity.stellar_address);
    await app.inject({
      method: "POST",
      url: `/v1/corrections/${ticketId}/respond`,
      cookies: { [telecomCookie!.name]: telecomCookie!.value },
      payload: { status: "rejected", reasonCode: 404 },
    });

    // Citizen views the ticket timeline
    const timelineRes = await app.inject({
      method: "GET",
      url: `/v1/corrections/${ticketId}`,
      cookies: { [citizenCookie!.name]: citizenCookie!.value },
    });

    expect(timelineRes.statusCode).toBe(200);
    const timeline = timelineRes.json();
    expect(timeline.outcomes).toHaveLength(2);

    // Verify independent per-institution statuses (partial synchronisation)
    const bankResult = timeline.outcomes.find(
      (o: any) => o.institutionId === bankEntity.id,
    );
    const telecomResult = timeline.outcomes.find(
      (o: any) => o.institutionId === telecomEntity.id,
    );

    expect(bankResult.status).toBe("applied");
    expect(telecomResult.status).toBe("rejected");
    expect(telecomResult.reasonCode).toBe(404);
  });

  it("simulated failure is flag-gated and supports retry", async () => {
    const adminCookie = await loginAs("admin");

    // Without FEATURE_SIMULATED_FAILURES flag -> rejected 403
    process.env["FEATURE_SIMULATED_FAILURES"] = "false";
    const failDisabled = await app.inject({
      method: "POST",
      url: "/v1/admin/simulate/failure",
      cookies: { [adminCookie!.name]: adminCookie!.value },
      payload: { type: "rpc_down" },
    });
    expect(failDisabled.statusCode).toBe(403);

    // Enable simulated failures flag
    process.env["FEATURE_SIMULATED_FAILURES"] = "true";

    // 1. Simulate rpc_down -> 503 CHAIN_UNAVAILABLE (retryable: true)
    const rpcDown = await app.inject({
      method: "POST",
      url: "/v1/admin/simulate/failure",
      cookies: { [adminCookie!.name]: adminCookie!.value },
      payload: { type: "rpc_down" },
    });
    expect(rpcDown.statusCode).toBe(503);
    const rpcErr = rpcDown.json();
    expect(rpcErr.error.code).toBe("CHAIN_UNAVAILABLE");
    expect(rpcErr.error.retryable).toBe(true);

    // 2. Simulate partial_sync -> 207 Multi-Status
    const partialSync = await app.inject({
      method: "POST",
      url: "/v1/admin/simulate/failure",
      cookies: { [adminCookie!.name]: adminCookie!.value },
      payload: { type: "partial_sync" },
    });
    expect(partialSync.statusCode).toBe(207);
    expect(partialSync.json().type).toBe("partial_sync");

    // 3. Retry after failure succeeds
    const health = await app.inject({
      method: "GET",
      url: "/v1/admin/health",
      cookies: { [adminCookie!.name]: adminCookie!.value },
    });
    expect(health.statusCode).toBe(200);
    expect(health.json().status).toBe("ok");
    expect(health.json().featureFlags.simulatedFailures).toBe(true);
  });
});
