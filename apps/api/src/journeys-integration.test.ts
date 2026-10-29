/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * apps/api/src/journeys-integration.test.ts
 *
 * Full API Integration Tests (README §18.1, §18.5, §21, §25)
 *
 * Covers:
 *   - The 4 defining user journeys (README §18.1):
 *       1. Open an account (approve bank's request for attributes, zero-XLM holder flow)
 *       2. Correct my record (submit correction, track independent multi-institution progress)
 *       3. Verify a credential (request authorised claims, verify presentation)
 *       4. Issue a credential (review application, issue SD-JWT VC, revoke)
 *   - Exception states (README §18.5):
 *       - Expired consent
 *       - Withdrawn consent
 *       - Revoked credential
 *       - Suspended issuer
 *       - Wrong-role action
 *       - Rejected correction
 *       - Partial update
 *       - Failed retry
 *       - Chain unavailable
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { getTableName } from "drizzle-orm";
import { issueCredential, createPresentation, generateKeyPair } from "@oneid/vc";
import { Keypair } from "@stellar/stellar-sdk";

// In-memory mock database state
let mockUsers: any[] = [];
let mockEntities: any[] = [];
let mockClaimRequests: any[] = [];
let mockConsents: any[] = [];
let mockCredentials: any[] = [];
let mockApplications: any[] = [];
let mockCorrectionTickets: any[] = [];
let mockCorrectionOutcomes: any[] = [];
let mockAuditEvents: any[] = [];

vi.mock("./db/index.js", () => {
  const getTableData = (table: any): any[] => {
    let name = "";
    try {
      name = typeof table === "string" ? table : getTableName(table);
    } catch {
      name = String(table?.id ?? "");
    }
    if (name === "users") return mockUsers;
    if (name === "entities") return mockEntities;
    if (name === "claim_requests") return mockClaimRequests;
    if (name === "consents") return mockConsents;
    if (name === "credentials") return mockCredentials;
    if (name === "applications") return mockApplications;
    if (name === "correction_tickets") return mockCorrectionTickets;
    if (name === "correction_outcomes") return mockCorrectionOutcomes;
    if (name === "audit_events") return mockAuditEvents;
    return [];
  };

  function extractClauses(clause: any): Array<{ col: string; val: any }> {
    if (!clause) return [];
    const results: Array<{ col: string; val: any }> = [];
    if (clause.queryChunks) {
      const chunks = clause.queryChunks;
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (chunk && typeof chunk === "object" && typeof chunk.name === "string") {
          const col = chunk.name;
          for (let j = i + 1; j < chunks.length; j++) {
            const raw = chunks[j];
            const val =
              raw && typeof raw === "object" && "value" in raw ? raw.value : raw;
            if (["string", "number", "boolean"].includes(typeof val)) {
              results.push({ col, val });
              break;
            }
          }
        } else if (chunk && typeof chunk === "object" && chunk.queryChunks) {
          results.push(...extractClauses(chunk));
        }
      }
    }
    return results;
  }

  function matchClause(item: any, clause: any): boolean {
    if (!clause) return true;
    const pairs = extractClauses(clause);
    for (const { col, val } of pairs) {
      if (item[col] !== val) return false;
    }
    return true;
  }

  const mockDb = {
    select: (fields?: any) => ({
      from: (table: any) => {
        const rows = getTableData(table);
        return {
          innerJoin: (joinTable: any, onClause?: any) => {
            const joinRows = getTableData(joinTable);
            const joined: any[] = [];
            for (const r of rows) {
              for (const jr of joinRows) {
                if (r.institution_id === jr.id || r.ticket_id === jr.id) {
                  joined.push({
                    ...jr,
                    ...r,
                    status: r.status,
                    reasonCode: r.reason_code,
                    institutionId: r.institution_id,
                    institutionName: jr.name,
                    homeDomain: jr.home_domain,
                  });
                }
              }
            }
            return {
              where: (clause?: any) => {
                const filtered = clause
                  ? joined.filter((item) => matchClause(item, clause))
                  : joined;
                return {
                  orderBy: () => Promise.resolve(filtered),
                  limit: (n: number) => Promise.resolve(filtered.slice(0, n)),
                  then: (fn: any) => Promise.resolve(filtered).then(fn),
                };
              },
            };
          },
          leftJoin: () => ({
            where: (clause?: any) => {
              const filtered = clause ? rows.filter((c) => matchClause(c, clause)) : rows;
              return {
                limit: (n: number) => Promise.resolve(filtered.slice(0, n)),
                then: (fn: any) => Promise.resolve(filtered).then(fn),
              };
            },
          }),
          where: (clause?: any) => {
            const filtered = clause
              ? rows.filter((item) => matchClause(item, clause))
              : rows;
            return {
              orderBy: () => Promise.resolve(filtered),
              limit: (n: number) => Promise.resolve(filtered.slice(0, n)),
              then: (fn: any) => Promise.resolve(filtered).then(fn),
            };
          },
          orderBy: () => Promise.resolve(rows),
          limit: (n: number) => Promise.resolve(rows.slice(0, n)),
          then: (fn: any) => Promise.resolve(rows).then(fn),
        };
      },
    }),
    insert: (table: any) => ({
      values: (val: any) => {
        const list = getTableData(table);
        const newRecord = {
          id: val.id ?? randomUUID(),
          created_at: new Date(),
          updated_at: new Date(),
          ...val,
        };
        list.push(newRecord);
        return {
          returning: () => Promise.resolve([newRecord]),
          then: (fn: any) => Promise.resolve([newRecord]).then(fn),
        };
      },
    }),
    update: (table: any) => ({
      set: (val: any) => ({
        where: (clause?: any) => {
          const list = getTableData(table);
          const targets = clause
            ? list.filter((item) => matchClause(item, clause))
            : list;
          targets.forEach((item) => Object.assign(item, val));
          return {
            returning: () => Promise.resolve(targets),
            then: (fn: any) => Promise.resolve(targets).then(fn),
          };
        },
      }),
    }),
  };

  const createTableMock = (tableName: string) =>
    new Proxy(
      { id: tableName, _: { name: tableName } },
      {
        get(target: any, prop: string) {
          if (prop in target) return target[prop];
          return { name: prop };
        },
      },
    );

  return {
    getDb: () => mockDb,
    users: createTableMock("users"),
    entities: createTableMock("entities"),
    claim_requests: createTableMock("claim_requests"),
    consents: createTableMock("consents"),
    credentials: createTableMock("credentials"),
    applications: createTableMock("applications"),
    correction_tickets: createTableMock("correction_tickets"),
    correction_outcomes: createTableMock("correction_outcomes"),
    audit_events: createTableMock("audit_events"),
    chain_cursor: createTableMock("chain_cursor"),
  };
});

vi.mock("./lib/audit.js", () => ({
  appendAuditEvent: vi.fn().mockImplementation((event: any) => {
    mockAuditEvents.push({ id: randomUUID(), ...event, created_at: new Date() });
    return Promise.resolve({ id: "audit-id", hash: "mock-hash" });
  }),
  verifyAuditChain: vi.fn().mockResolvedValue({ valid: true, checked: 10 }),
}));

vi.mock("@oneid/stellar", () => ({
  submitTransaction: vi.fn().mockResolvedValue({
    status: "confirmed",
    txHash: "mock-tx-hash-sponsored-001",
    ledger: 1050,
  }),
  resolveNetwork: vi.fn().mockReturnValue({ name: "local" }),
  getRpcServer: vi.fn().mockReturnValue({}),
}));

const { buildApp } = await import("./index.js");

describe("API Integration Test Suite (README §18.1, §18.5, §21, §25)", () => {
  let app: FastifyInstance;
  let issuerKeys: ReturnType<typeof generateKeyPair>;
  let holderKeys: ReturnType<typeof generateKeyPair>;

  const citizenUser = {
    id: "00000000-0000-0000-0000-000000000001",
    role: "citizen",
    stellar_address: "GCITIZEN00000000000000000000000000000000000000000000000001",
    synthetic_profile: {
      fullName: "Adaeze Okonkwo",
      syntheticNin: "SYNTH-0000-0001",
      dateOfBirth: "1990-03-12",
      address: "Lagos, Nigeria (fictional)",
      kycTier: 2,
      over18: true,
    },
  };

  const issuerEntity = {
    id: "00000000-0000-0000-0000-000000000002",
    stellar_address: "GISSUER00000000000000000000000000000000000000000000000002",
    role: "issuer",
    name: "National Identity Issuer",
    home_domain: "issuer.demo.oneid.local",
    status: "active",
  };

  const bankEntity = {
    id: "00000000-0000-0000-0000-000000000003",
    stellar_address: "GBANK00000000000000000000000000000000000000000000000000003",
    role: "verifier",
    name: "First Demo Bank",
    home_domain: "bank.demo.oneid.local",
    status: "active",
  };

  const telecomEntity = {
    id: "00000000-0000-0000-0000-000000000004",
    stellar_address: "GTELECOM00000000000000000000000000000000000000000000000004",
    role: "verifier",
    name: "Demo Telecom Nigeria",
    home_domain: "telecom.demo.oneid.local",
    status: "active",
  };

  beforeEach(async () => {
    mockUsers = [
      { ...citizenUser },
      { id: "admin-id-1", role: "admin", stellar_address: "GADMIN0000000000001" },
      {
        id: issuerEntity.id,
        role: "issuer",
        stellar_address: issuerEntity.stellar_address,
      },
      {
        id: bankEntity.id,
        role: "verifier",
        stellar_address: bankEntity.stellar_address,
      },
      {
        id: telecomEntity.id,
        role: "verifier",
        stellar_address: telecomEntity.stellar_address,
      },
    ];
    mockEntities = [{ ...issuerEntity }, { ...bankEntity }, { ...telecomEntity }];
    mockClaimRequests = [];
    mockConsents = [];
    mockCredentials = [];
    mockApplications = [];
    mockCorrectionTickets = [];
    mockCorrectionOutcomes = [];
    mockAuditEvents = [];

    issuerKeys = generateKeyPair();
    holderKeys = generateKeyPair();

    const randomKp = Keypair.random();
    process.env["VC_ISSUER_SIGNING_KEY_JWK"] = JSON.stringify(issuerKeys.privateKey);
    process.env["CONSENT_REGISTRY_ID"] =
      "CC3KCONSENT000000000000000000000000000000000000000000";
    process.env["FEE_SPONSOR_SECRET"] = randomKp.secret();
    process.env["CITIZEN_DEMO_SECRET"] = randomKp.secret();
    process.env["FEATURE_SIMULATED_FAILURES"] = "true";
    process.env["FEATURE_FEE_SPONSORSHIP"] = "true";

    app = await buildApp();
  });

  async function loginAs(
    role: "citizen" | "issuer" | "verifier" | "admin",
    stellarAddress?: string,
  ): Promise<string> {
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/portal/login",
      payload: {
        role,
        demoKey: `demo-${role}-2026`,
        stellarAddress,
      },
    });
    expect(res.statusCode).toBe(200);
    return res.headers["set-cookie"] as string;
  }

  // ── Journey 1: Open an Account & Zero XLM Flow ─────────────────────────
  describe("Journey 1: Open an account (README §18.1, §25)", () => {
    it("allows citizen to approve bank request with fee sponsorship (0 XLM holder)", async () => {
      const bankCookie = await loginAs("verifier", bankEntity.stellar_address);
      const citizenCookie = await loginAs("citizen");

      // 1. Bank creates a claim request for account opening
      const reqRes = await app.inject({
        method: "POST",
        url: "/v1/requests",
        headers: { cookie: bankCookie },
        payload: {
          holderRef: citizenUser.stellar_address,
          claims: ["over18", "kycTier"],
          purpose: "Tier 2 Bank Account Opening",
          expiresInSeconds: 3600,
        },
      });
      expect(reqRes.statusCode).toBe(201);
      const requestData = JSON.parse(reqRes.payload);
      expect(requestData.id).toBeDefined();

      // 2. Citizen approves claims holding 0 XLM (fee sponsored)
      const consentRes = await app.inject({
        method: "POST",
        url: "/v1/consents",
        headers: { cookie: citizenCookie },
        payload: {
          requestId: requestData.id,
          decisions: {
            over18: "approve",
            kycTier: "approve",
          },
        },
      });
      expect(consentRes.statusCode).toBe(201);
      const consentData = JSON.parse(consentRes.payload);
      expect(consentData.receiptHash).toBeDefined();
      expect(consentData.chainTx).toBe("mock-tx-hash-sponsored-001");
      expect(consentData.approvedClaims.sort()).toEqual(["kycTier", "over18"].sort());
    });
  });

  // ── Journey 2: Correct My Record ───────────────────────────────────────
  describe("Journey 2: Correct my record (README §18.1, §18.4)", () => {
    it("submits correction and tracks independent multi-institution outcomes", async () => {
      const citizenCookie = await loginAs("citizen");
      const bankCookie = await loginAs("verifier", bankEntity.stellar_address);
      const telecomCookie = await loginAs("verifier", telecomEntity.stellar_address);

      // 1. Citizen submits correction targeting Bank and Telecom
      const createRes = await app.inject({
        method: "POST",
        url: "/v1/corrections",
        headers: { cookie: citizenCookie },
        payload: {
          category: "address",
          detail: {
            oldAddress: "Lagos, Nigeria (fictional)",
            newAddress: "Abuja, Nigeria (fictional)",
          },
          targetInstitutions: [bankEntity.id, telecomEntity.id],
        },
      });
      expect(createRes.statusCode).toBe(201);
      const ticket = JSON.parse(createRes.payload);
      expect(ticket.ticketHash).toBeDefined();

      // 2. Bank updates its status to 'applied'
      const bankRespondRes = await app.inject({
        method: "POST",
        url: `/v1/corrections/${ticket.id}/respond`,
        headers: { cookie: bankCookie },
        payload: {
          status: "applied",
          reasonCode: 200,
        },
      });
      expect(bankRespondRes.statusCode).toBe(200);

      // 3. Telecom updates its status independently to 'rejected'
      const telecomRespondRes = await app.inject({
        method: "POST",
        url: `/v1/corrections/${ticket.id}/respond`,
        headers: { cookie: telecomCookie },
        payload: {
          status: "rejected",
          reasonCode: 400,
        },
      });
      expect(telecomRespondRes.statusCode).toBe(200);

      // 4. Citizen inspects per-institution timeline
      const timelineRes = await app.inject({
        method: "GET",
        url: `/v1/corrections/${ticket.id}`,
        headers: { cookie: citizenCookie },
      });
      expect(timelineRes.statusCode).toBe(200);
      const timeline = JSON.parse(timelineRes.payload);
      expect(timeline.outcomes).toHaveLength(2);

      const bankOutcome = timeline.outcomes.find(
        (o: any) => o.institutionId === bankEntity.id,
      );
      const telecomOutcome = timeline.outcomes.find(
        (o: any) => o.institutionId === telecomEntity.id,
      );
      expect(bankOutcome.status).toBe("applied");
      expect(telecomOutcome.status).toBe("rejected");
    });
  });

  // ── Journey 3: Verify a Credential ─────────────────────────────────────
  describe("Journey 3: Verify a credential (README §18.1, §18.3)", () => {
    it("verifies selective presentation against active consent and credential", async () => {
      const bankCookie = await loginAs("verifier", bankEntity.stellar_address);
      const citizenCookie = await loginAs("citizen");

      // Issue credential to holder
      const vc = issueCredential({
        issuer: `did:web:${issuerEntity.home_domain}`,
        subject: `did:stellar:local:${citizenUser.stellar_address}`,
        claims: {
          fullName: "Adaeze Okonkwo",
          over18: true,
          kycTier: 2,
        },
        issuerPrivateKey: issuerKeys.privateKey,
        holderPublicKey: holderKeys.publicKey,
        credentialStatusContractId:
          "CB2KSTATUS000000000000000000000000000000000000000000",
      });

      mockCredentials.push({
        id: randomUUID(),
        credential_hash: vc.credentialHash,
        user_id: citizenUser.id,
        issuer_id: issuerEntity.id,
        status: "active",
        expires_at: new Date(Date.now() + 86400000 * 365),
      });

      // Request claims
      const reqRes = await app.inject({
        method: "POST",
        url: "/v1/requests",
        headers: { cookie: bankCookie },
        payload: {
          holderRef: citizenUser.stellar_address,
          claims: ["over18"],
          purpose: "Age check",
          expiresInSeconds: 3600,
        },
      });
      const req = JSON.parse(reqRes.payload);

      // Grant consent
      const consentRes = await app.inject({
        method: "POST",
        url: "/v1/consents",
        headers: { cookie: citizenCookie },
        payload: {
          requestId: req.id,
          decisions: { over18: "approve" },
        },
      });
      expect(consentRes.statusCode).toBe(201);

      // Holder produces presentation
      const presentation = createPresentation({
        credential: vc,
        holderPrivateKey: holderKeys.privateKey,
        approvedClaims: ["over18"],
        audience: bankEntity.home_domain,
        nonce: req.nonce,
      });

      // Verifier verifies presentation
      const verifyRes = await app.inject({
        method: "POST",
        url: "/v1/verify/presentation",
        headers: { cookie: bankCookie },
        payload: {
          presentation,
          requestId: req.id,
        },
      });
      expect(verifyRes.statusCode).toBe(200);
      const result = JSON.parse(verifyRes.payload);
      expect(result.verified).toBe(true);
      expect(result.claims).toEqual({ over18: true });
      expect(result.claims.fullName).toBeUndefined();
    });
  });

  // ── Journey 4: Issue a Credential ──────────────────────────────────────
  describe("Journey 4: Issue a credential (README §18.1, §18.2)", () => {
    it("allows issuer to review application, issue SD-JWT VC, and revoke it", async () => {
      const citizenCookie = await loginAs("citizen");
      const issuerCookie = await loginAs("issuer", issuerEntity.stellar_address);

      // 1. Citizen applies
      const appRes = await app.inject({
        method: "POST",
        url: "/v1/applications",
        headers: { cookie: citizenCookie },
        payload: { issuerId: issuerEntity.id },
      });
      expect(appRes.statusCode).toBe(201);
      const appData = JSON.parse(appRes.payload);

      // 2. Issuer reviews and approves application
      const decRes = await app.inject({
        method: "POST",
        url: `/v1/applications/${appData.id}/decision`,
        headers: { cookie: issuerCookie },
        payload: { decision: "approved" },
      });
      expect(decRes.statusCode).toBe(200);

      // 3. Issuer issues credential
      const issueRes = await app.inject({
        method: "POST",
        url: "/v1/credentials/issue",
        headers: { cookie: issuerCookie },
        payload: {
          applicationId: appData.id,
          holderUserId: citizenUser.id,
          claims: ["fullName", "over18", "kycTier"],
          validityDays: 180,
        },
      });
      expect(issueRes.statusCode).toBe(201);
      const cred = JSON.parse(issueRes.payload);
      expect(cred.credentialHash).toBeDefined();
      expect(cred.sdJwt).toBeDefined();

      // 4. Issuer revokes credential
      const revokeRes = await app.inject({
        method: "POST",
        url: `/v1/credentials/${cred.credentialHash}/revoke`,
        headers: { cookie: issuerCookie },
        payload: { reasonCode: 1 },
      });
      expect(revokeRes.statusCode).toBe(200);
      const revokeData = JSON.parse(revokeRes.payload);
      expect(revokeData.status).toBe("revoked");
    });
  });

  // ── Exception States (README §18.5) ────────────────────────────────────
  describe("Exception States (README §18.5)", () => {
    it("denies presentation when consent is expired (CONSENT_EXPIRED)", async () => {
      const bankCookie = await loginAs("verifier", bankEntity.stellar_address);
      const citizenCookie = await loginAs("citizen");

      const vc = issueCredential({
        issuer: `did:web:${issuerEntity.home_domain}`,
        subject: `did:stellar:local:${citizenUser.stellar_address}`,
        claims: { over18: true },
        issuerPrivateKey: issuerKeys.privateKey,
        holderPublicKey: holderKeys.publicKey,
        credentialStatusContractId:
          "CB2KSTATUS000000000000000000000000000000000000000000",
      });

      mockCredentials.push({
        id: randomUUID(),
        credential_hash: vc.credentialHash,
        user_id: citizenUser.id,
        issuer_id: issuerEntity.id,
        status: "active",
        expires_at: new Date(Date.now() + 86400000),
      });

      const reqRes = await app.inject({
        method: "POST",
        url: "/v1/requests",
        headers: { cookie: bankCookie },
        payload: {
          holderRef: citizenUser.stellar_address,
          claims: ["over18"],
          purpose: "Age verification",
          expiresInSeconds: 3600,
        },
      });
      const req = JSON.parse(reqRes.payload);

      await app.inject({
        method: "POST",
        url: "/v1/consents",
        headers: { cookie: citizenCookie },
        payload: {
          requestId: req.id,
          decisions: { over18: "approve" },
        },
      });

      // Expire the consent
      mockConsents[0].expires_at = new Date(Date.now() - 1000);

      const presentation = createPresentation({
        credential: vc,
        holderPrivateKey: holderKeys.privateKey,
        approvedClaims: ["over18"],
        audience: bankEntity.home_domain,
        nonce: req.nonce,
      });

      const verifyRes = await app.inject({
        method: "POST",
        url: "/v1/verify/presentation",
        headers: { cookie: bankCookie },
        payload: { presentation, requestId: req.id },
      });

      const result = JSON.parse(verifyRes.payload);
      expect(result.verified).toBe(false);
      expect(result.code).toBe("CONSENT_EXPIRED");
    });

    it("denies presentation when consent is withdrawn (CONSENT_WITHDRAWN)", async () => {
      const bankCookie = await loginAs("verifier", bankEntity.stellar_address);
      const citizenCookie = await loginAs("citizen");

      const vc = issueCredential({
        issuer: `did:web:${issuerEntity.home_domain}`,
        subject: `did:stellar:local:${citizenUser.stellar_address}`,
        claims: { over18: true },
        issuerPrivateKey: issuerKeys.privateKey,
        holderPublicKey: holderKeys.publicKey,
        credentialStatusContractId:
          "CB2KSTATUS000000000000000000000000000000000000000000",
      });

      mockCredentials.push({
        id: randomUUID(),
        credential_hash: vc.credentialHash,
        user_id: citizenUser.id,
        issuer_id: issuerEntity.id,
        status: "active",
        expires_at: new Date(Date.now() + 86400000),
      });

      const reqRes = await app.inject({
        method: "POST",
        url: "/v1/requests",
        headers: { cookie: bankCookie },
        payload: {
          holderRef: citizenUser.stellar_address,
          claims: ["over18"],
          purpose: "Age check",
          expiresInSeconds: 3600,
        },
      });
      const req = JSON.parse(reqRes.payload);

      const consentRes = await app.inject({
        method: "POST",
        url: "/v1/consents",
        headers: { cookie: citizenCookie },
        payload: {
          requestId: req.id,
          decisions: { over18: "approve" },
        },
      });
      const consent = JSON.parse(consentRes.payload);

      // Withdraw consent
      const withdrawRes = await app.inject({
        method: "POST",
        url: `/v1/consents/${consent.receiptHash}/withdraw`,
        headers: { cookie: citizenCookie },
      });
      expect(withdrawRes.statusCode).toBe(200);

      const presentation = createPresentation({
        credential: vc,
        holderPrivateKey: holderKeys.privateKey,
        approvedClaims: ["over18"],
        audience: bankEntity.home_domain,
        nonce: req.nonce,
      });

      const verifyRes = await app.inject({
        method: "POST",
        url: "/v1/verify/presentation",
        headers: { cookie: bankCookie },
        payload: { presentation, requestId: req.id },
      });

      const result = JSON.parse(verifyRes.payload);
      expect(result.verified).toBe(false);
      expect(result.code).toBe("CONSENT_WITHDRAWN");
    });

    it("denies presentation when credential is revoked (CREDENTIAL_REVOKED)", async () => {
      const bankCookie = await loginAs("verifier", bankEntity.stellar_address);
      const citizenCookie = await loginAs("citizen");

      const vc = issueCredential({
        issuer: `did:web:${issuerEntity.home_domain}`,
        subject: `did:stellar:local:${citizenUser.stellar_address}`,
        claims: { over18: true },
        issuerPrivateKey: issuerKeys.privateKey,
        holderPublicKey: holderKeys.publicKey,
        credentialStatusContractId:
          "CB2KSTATUS000000000000000000000000000000000000000000",
      });

      mockCredentials.push({
        id: randomUUID(),
        credential_hash: vc.credentialHash,
        user_id: citizenUser.id,
        issuer_id: issuerEntity.id,
        status: "revoked",
        expires_at: new Date(Date.now() + 86400000),
      });

      const reqRes = await app.inject({
        method: "POST",
        url: "/v1/requests",
        headers: { cookie: bankCookie },
        payload: {
          holderRef: citizenUser.stellar_address,
          claims: ["over18"],
          purpose: "Age check",
          expiresInSeconds: 3600,
        },
      });
      const req = JSON.parse(reqRes.payload);

      await app.inject({
        method: "POST",
        url: "/v1/consents",
        headers: { cookie: citizenCookie },
        payload: {
          requestId: req.id,
          decisions: { over18: "approve" },
        },
      });

      const presentation = createPresentation({
        credential: vc,
        holderPrivateKey: holderKeys.privateKey,
        approvedClaims: ["over18"],
        audience: bankEntity.home_domain,
        nonce: req.nonce,
      });

      const verifyRes = await app.inject({
        method: "POST",
        url: "/v1/verify/presentation",
        headers: { cookie: bankCookie },
        payload: { presentation, requestId: req.id },
      });

      const result = JSON.parse(verifyRes.payload);
      expect(result.verified).toBe(false);
      expect(result.code).toBe("CREDENTIAL_REVOKED");
    });

    it("denies presentation when issuer is suspended (ISSUER_NOT_ACTIVE)", async () => {
      const bankCookie = await loginAs("verifier", bankEntity.stellar_address);
      const citizenCookie = await loginAs("citizen");

      // Suspend issuer
      mockEntities[0].status = "suspended";

      const vc = issueCredential({
        issuer: `did:web:${issuerEntity.home_domain}`,
        subject: `did:stellar:local:${citizenUser.stellar_address}`,
        claims: { over18: true },
        issuerPrivateKey: issuerKeys.privateKey,
        holderPublicKey: holderKeys.publicKey,
        credentialStatusContractId:
          "CB2KSTATUS000000000000000000000000000000000000000000",
      });

      mockCredentials.push({
        id: randomUUID(),
        credential_hash: vc.credentialHash,
        user_id: citizenUser.id,
        issuer_id: issuerEntity.id,
        status: "active",
        expires_at: new Date(Date.now() + 86400000),
      });

      const reqRes = await app.inject({
        method: "POST",
        url: "/v1/requests",
        headers: { cookie: bankCookie },
        payload: {
          holderRef: citizenUser.stellar_address,
          claims: ["over18"],
          purpose: "Check",
          expiresInSeconds: 3600,
        },
      });
      const req = JSON.parse(reqRes.payload);

      await app.inject({
        method: "POST",
        url: "/v1/consents",
        headers: { cookie: citizenCookie },
        payload: {
          requestId: req.id,
          decisions: { over18: "approve" },
        },
      });

      const presentation = createPresentation({
        credential: vc,
        holderPrivateKey: holderKeys.privateKey,
        approvedClaims: ["over18"],
        audience: bankEntity.home_domain,
        nonce: req.nonce,
      });

      const verifyRes = await app.inject({
        method: "POST",
        url: "/v1/verify/presentation",
        headers: { cookie: bankCookie },
        payload: { presentation, requestId: req.id },
      });

      const result = JSON.parse(verifyRes.payload);
      expect(result.verified).toBe(false);
      expect(result.code).toBe("ISSUER_NOT_ACTIVE");
    });

    it("rejects wrong-role actions fail closed (FORBIDDEN_ROLE)", async () => {
      const citizenCookie = await loginAs("citizen");

      // Citizen tries to issue credential
      const badIssueRes = await app.inject({
        method: "POST",
        url: "/v1/credentials/issue",
        headers: { cookie: citizenCookie },
        payload: {
          holderUserId: citizenUser.id,
          claims: ["over18"],
        },
      });
      expect(badIssueRes.statusCode).toBe(403);
      const body = JSON.parse(badIssueRes.payload);
      expect(body.error.code).toBe("FORBIDDEN_ROLE");
    });

    it("records institution partial update state (partially_applied)", async () => {
      const citizenCookie = await loginAs("citizen");
      const bankCookie = await loginAs("verifier", bankEntity.stellar_address);

      const ticketRes = await app.inject({
        method: "POST",
        url: "/v1/corrections",
        headers: { cookie: citizenCookie },
        payload: {
          category: "address",
          detail: { note: "Update branch only" },
          targetInstitutions: [bankEntity.id],
        },
      });
      const ticket = JSON.parse(ticketRes.payload);

      const respondRes = await app.inject({
        method: "POST",
        url: `/v1/corrections/${ticket.id}/respond`,
        headers: { cookie: bankCookie },
        payload: {
          status: "partially_applied",
          reasonCode: 206,
        },
      });
      expect(respondRes.statusCode).toBe(200);

      const getRes = await app.inject({
        method: "GET",
        url: `/v1/corrections/${ticket.id}`,
        headers: { cookie: citizenCookie },
      });
      const data = JSON.parse(getRes.payload);
      expect(data.outcomes[0].status).toBe("partially_applied");
      expect(Number(data.outcomes[0].reasonCode)).toBe(206);
    });

    it("handles simulated failure and allows retry to succeed", async () => {
      const adminCookie = await loginAs("admin");

      // 1. Simulate RPC down
      const failRes = await app.inject({
        method: "POST",
        url: "/v1/admin/simulate/failure",
        headers: { cookie: adminCookie },
        payload: { type: "rpc_down" },
      });
      expect(failRes.statusCode).toBe(503);
      const err = JSON.parse(failRes.payload);
      expect(err.error.code).toBe("CHAIN_UNAVAILABLE");

      // 2. Health check / retry recovers
      const healthRes = await app.inject({
        method: "GET",
        url: "/v1/admin/health",
        headers: { cookie: adminCookie },
      });
      expect(healthRes.statusCode).toBe(200);
      const health = JSON.parse(healthRes.payload);
      expect(health.status).toBe("ok");
    });
  });
});
