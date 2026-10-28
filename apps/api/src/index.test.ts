/**
 * src/index.test.ts — Smoke tests for the built Fastify app (README §14.4)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";

// Minimal mocks so buildApp works in test without a DB or chain
vi.mock("./db/index.js", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    }),
    insert: () => ({
      values: () => ({
        returning: () =>
          Promise.resolve([
            {
              id: "test-id",
              role: "issuer",
              stellar_address: null,
              synthetic_profile: null,
              created_at: new Date(),
            },
          ]),
      }),
    }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    delete: () => Promise.resolve(),
  }),
  users: {},
  entities: {},
  applications: {},
  credentials: {},
  claim_requests: {},
  consents: {},
  correction_tickets: {},
  correction_outcomes: {},
  audit_events: {},
  chain_cursor: {},
}));

vi.mock("./lib/audit.js", () => ({
  appendAuditEvent: vi.fn().mockResolvedValue({ id: "a", hash: "b" }),
  verifyAuditChain: vi.fn().mockResolvedValue({ valid: true, checked: 0 }),
}));

const { buildApp } = await import("./index.js");

describe("API smoke tests", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("GET /healthz returns 200 and { status: 'ok' }", async () => {
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });

  it("GET /readyz returns 200", async () => {
    const res = await app.inject({ method: "GET", url: "/readyz" });
    expect(res.statusCode).toBe(200);
  });

  it("X-Request-ID header present on all responses", async () => {
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.headers["x-request-id"]).toMatch(/^req_/);
  });

  it("unauthenticated /v1/* returns 401 with error envelope", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/identity/me" });
    expect(res.statusCode).toBe(401);
    const body = res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });
});
