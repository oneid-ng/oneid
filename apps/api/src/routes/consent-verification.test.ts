/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * src/routes/consent-verification.test.ts — Consent & Verification route tests (README §13.3, §14.1, §18.3)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { getTableName } from "drizzle-orm";
import { issueCredential, createPresentation, generateKeyPair } from "@oneid/vc";

// In-memory mock database state
let mockUsers: any[] = [];
let mockEntities: any[] = [];
let mockClaimRequests: any[] = [];
let mockConsents: any[] = [];
let mockCredentials: any[] = [];

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
    if (name === "claim_requests") return mockClaimRequests;
    if (name === "consents") return mockConsents;
    if (name === "credentials") return mockCredentials;
    return [];
  };

  function matchClause(item: any, clause: any): boolean {
    if (!clause || !clause.queryChunks) return true;
    const chunks = clause.queryChunks;
    for (let i = 0; i < chunks.length - 1; i++) {
      const chunk = chunks[i];
      if (chunk && typeof chunk === "object" && typeof chunk.name === "string") {
        const col = chunk.name;
        for (let j = i + 1; j < chunks.length; j++) {
          const raw = chunks[j];
          const val = raw && typeof raw === "object" && "value" in raw ? raw.value : raw;
          if (["string", "number", "boolean"].includes(typeof val)) {
            if (item[col] !== val) return false;
            break;
          }
        }
      }
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
          innerJoin: (otherTable: any) => ({
            where: (clause?: any) => ({
              orderBy: () => Promise.resolve([...mockConsents]),
              then: (resolve: any) => Promise.resolve(mockClaimRequests).then(resolve),
            }),
            innerJoin: () => ({
              where: () => ({
                orderBy: () => Promise.resolve([...mockConsents]),
                then: (resolve: any) => Promise.resolve(mockConsents).then(resolve),
              }),
            }),
          }),
          leftJoin: () => ({
            where: (clause?: any) => {
              const filtered = clause
                ? mockConsents.filter((c) => matchClause(c, clause))
                : mockConsents;
              return {
                limit: (n: number) => Promise.resolve(filtered.slice(0, n)),
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

vi.mock("../lib/audit.js", () => ({
  appendAuditEvent: vi.fn().mockResolvedValue({ id: "audit-id", hash: "mock-hash" }),
  verifyAuditChain: vi.fn().mockResolvedValue({ valid: true, checked: 0 }),
}));

vi.mock("@oneid/stellar", () => ({
  submitTransaction: vi.fn().mockResolvedValue({
    status: "confirmed",
    txHash: "mock-tx-hash-001",
    ledger: 1042,
  }),
  resolveNetwork: vi.fn().mockReturnValue({ name: "local" }),
  getRpcServer: vi.fn().mockReturnValue({}),
}));

const { buildApp } = await import("../index.js");

describe("Consent & Verification Flows (README §13.3, §14.1, §18.3)", () => {
  let app: FastifyInstance;
  let issuerKeys: ReturnType<typeof generateKeyPair>;
  let holderKeys: ReturnType<typeof generateKeyPair>;

  const citizenUser = {
    id: "00000000-0000-0000-0000-000000000001",
    role: "citizen",
    stellar_address: "GCITIZEN00000000000000000000000000000000000000000000000001",
    synthetic_profile: {
      fullName: "Adaeze Okonkwo",
      dateOfBirth: "1990-03-12",
      nin: "1234 5678 9012",
      address: "Lagos, Nigeria",
    },
  };

  const verifierEntity = {
    id: "00000000-0000-0000-0000-000000000002",
    role: "verifier",
    name: "First Demo Bank",
    home_domain: "bank.demo.oneid.local",
    stellar_address: "GVERIFIER000000000000000000000000000000000000000000000002",
    status: "active",
  };

  const issuerEntity = {
    id: "00000000-0000-0000-0000-000000000003",
    role: "issuer",
    name: "ONEiD Demo Issuer",
    home_domain: "issuer.demo.oneid.local",
    stellar_address: "GISSUER0000000000000000000000000000000000000000000000003",
    status: "active",
  };

  beforeEach(async () => {
    app = await buildApp();
    issuerKeys = generateKeyPair();
    holderKeys = generateKeyPair();

    process.env["VC_ISSUER_SIGNING_KEY_JWK"] = JSON.stringify(issuerKeys.privateKey);

    mockUsers = [
      citizenUser,
      {
        id: "user-verifier-id",
        role: "verifier",
        stellar_address: verifierEntity.stellar_address,
      },
      {
        id: "user-issuer-id",
        role: "issuer",
        stellar_address: issuerEntity.stellar_address,
      },
    ];
    mockEntities = [verifierEntity, issuerEntity];
    mockClaimRequests = [];
    mockConsents = [];
    mockCredentials = [];
  });

  async function loginAs(role: string) {
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/portal/login",
      payload: { role, demoKey: `demo-${role}-2026` },
    });
    return res.cookies[0];
  }

  it("fails closed on wrong roles: citizen cannot create request, verifier cannot grant consent", async () => {
    const citizenCookie = await loginAs("citizen");

    // Citizen tries to POST /v1/requests -> 403 FORBIDDEN_ROLE
    const res1 = await app.inject({
      method: "POST",
      url: "/v1/requests",
      cookies: { [citizenCookie!.name]: citizenCookie!.value },
      payload: {
        holderRef: citizenUser.id,
        purpose: "KYC Check",
        claims: ["fullName"],
      },
    });
    expect(res1.statusCode).toBe(403);
    const err1 = res1.json();
    expect(err1.error.code).toBe("FORBIDDEN_ROLE");

    const verifierCookie = await loginAs("verifier");

    // Verifier tries to POST /v1/consents -> 403 FORBIDDEN_ROLE
    const res2 = await app.inject({
      method: "POST",
      url: "/v1/consents",
      cookies: { [verifierCookie!.name]: verifierCookie!.value },
      payload: {
        requestId: "00000000-0000-0000-0000-000000000099",
        decisions: { fullName: "approve" },
      },
    });
    expect(res2.statusCode).toBe(403);
    expect(res2.json().error.code).toBe("FORBIDDEN_ROLE");
  });

  it("no disclosure before approval: verification fails with CONSENT_MISSING before citizen consents", async () => {
    const verifierCookie = await loginAs("verifier");

    // Verifier creates request
    const reqRes = await app.inject({
      method: "POST",
      url: "/v1/requests",
      cookies: { [verifierCookie!.name]: verifierCookie!.value },
      payload: {
        holderRef: citizenUser.id,
        purpose: "Account opening",
        claims: ["fullName", "dateOfBirth", "nin"],
        expiresInSeconds: 600,
      },
    });
    expect(reqRes.statusCode, JSON.stringify(reqRes.json())).toBe(201);
    const createdReq = reqRes.json();
    expect(createdReq.status).toBe("pending_consent");

    // Issue a synthetic credential to holder
    const issued = issueCredential({
      issuer: `did:web:${issuerEntity.home_domain}`,
      subject: `did:stellar:local:${citizenUser.stellar_address}`,
      claims: citizenUser.synthetic_profile,
      issuerPrivateKey: issuerKeys.privateKey,
      holderPublicKey: holderKeys.publicKey,
      credentialStatusContractId: "CB2KSTATUS000000000000000000000000000000000000000000",
    });

    mockCredentials.push({
      id: "cred-01",
      credential_hash: issued.credentialHash,
      user_id: citizenUser.id,
      issuer_id: issuerEntity.id,
      status: "active",
      expires_at: new Date(Date.now() + 86400000),
    });

    // Holder creates presentation
    const presentation = createPresentation({
      credential: issued,
      approvedClaims: ["fullName"],
      holderPrivateKey: holderKeys.privateKey,
      nonce: createdReq.nonce,
      audience: verifierEntity.home_domain,
    });

    // Verifier attempts to verify presentation before citizen approves consent
    const verifyRes = await app.inject({
      method: "POST",
      url: "/v1/verify/presentation",
      cookies: { [verifierCookie!.name]: verifierCookie!.value },
      payload: {
        presentation,
        requestId: createdReq.id,
      },
    });

    expect(verifyRes.statusCode).toBe(200);
    const result = verifyRes.json();
    expect(result.verified).toBe(false);
    expect(result.code).toBe("CONSENT_MISSING");
    expect(result.claims).toBeUndefined(); // NO DISCLOSURE
  });

  it("partial approval discloses only approved claims; denied claims are never disclosed", async () => {
    const verifierCookie = await loginAs("verifier");

    // Verifier creates claim request
    const reqRes = await app.inject({
      method: "POST",
      url: "/v1/requests",
      cookies: { [verifierCookie!.name]: verifierCookie!.value },
      payload: {
        holderRef: citizenUser.id,
        purpose: "Fintech Onboarding",
        claims: ["fullName", "dateOfBirth", "nin", "address"],
        expiresInSeconds: 600,
      },
    });
    expect(reqRes.statusCode, JSON.stringify(reqRes.json())).toBe(201);
    const createdReq = reqRes.json();

    // Citizen logs in and consents
    const citizenCookie = await loginAs("citizen");

    const consentRes = await app.inject({
      method: "POST",
      url: "/v1/consents",
      cookies: { [citizenCookie!.name]: citizenCookie!.value },
      payload: {
        requestId: createdReq.id,
        decisions: {
          fullName: "approve",
          dateOfBirth: "approve",
          nin: "deny",
          address: "deny",
        },
        expiresInSeconds: 3600,
      },
    });
    expect(consentRes.statusCode).toBe(201);
    const consentJson = consentRes.json();
    expect(consentJson.status).toBe("active");
    expect(consentJson.receiptHash).toBeDefined();
    expect(consentJson.approvedClaims).toEqual(["dateOfBirth", "fullName"]);

    // Issue VC
    const issued = issueCredential({
      issuer: `did:web:${issuerEntity.home_domain}`,
      subject: `did:stellar:local:${citizenUser.stellar_address}`,
      claims: citizenUser.synthetic_profile,
      issuerPrivateKey: issuerKeys.privateKey,
      holderPublicKey: holderKeys.publicKey,
      credentialStatusContractId: "CB2KSTATUS000000000000000000000000000000000000000000",
    });

    mockCredentials.push({
      id: "cred-01",
      credential_hash: issued.credentialHash,
      user_id: citizenUser.id,
      issuer_id: issuerEntity.id,
      status: "active",
      expires_at: new Date(Date.now() + 86400000),
    });

    // Presentation with ONLY approved claims
    const approvedPresentation = createPresentation({
      credential: issued,
      approvedClaims: ["fullName", "dateOfBirth"],
      holderPrivateKey: holderKeys.privateKey,
      nonce: createdReq.nonce,
      audience: verifierEntity.home_domain,
    });

    const verifyRes = await app.inject({
      method: "POST",
      url: "/v1/verify/presentation",
      cookies: { [verifierCookie!.name]: verifierCookie!.value },
      payload: {
        presentation: approvedPresentation,
        requestId: createdReq.id,
      },
    });

    expect(verifyRes.statusCode).toBe(200);
    const verifiedData = verifyRes.json();
    expect(verifiedData.verified).toBe(true);
    expect(verifiedData.code).toBe("VALID");
    // Verify exact selective disclosure:
    expect(verifiedData.claims).toBeDefined();
    expect(verifiedData.claims.fullName).toBe("Adaeze Okonkwo");
    expect(verifiedData.claims.dateOfBirth).toBe("1990-03-12");
    expect(verifiedData.claims.nin).toBeUndefined();
    expect(verifiedData.claims.address).toBeUndefined();

    // Adversarial presentation attempts to reveal a DENIED claim (nin)
    const tamperedPresentation = createPresentation({
      credential: issued,
      approvedClaims: ["fullName", "nin"],
      holderPrivateKey: holderKeys.privateKey,
      nonce: createdReq.nonce,
      audience: verifierEntity.home_domain,
    });

    const tamperedRes = await app.inject({
      method: "POST",
      url: "/v1/verify/presentation",
      cookies: { [verifierCookie!.name]: verifierCookie!.value },
      payload: {
        presentation: tamperedPresentation,
        requestId: createdReq.id,
      },
    });

    expect(tamperedRes.statusCode).toBe(200);
    const tamperedData = tamperedRes.json();
    expect(tamperedData.verified).toBe(false);
    expect(tamperedData.code).toBe("CONSENT_MISSING");
    expect(tamperedData.claims).toBeUndefined();
  });

  it("withdrawn consent blocks later verification (CONSENT_WITHDRAWN)", async () => {
    const verifierCookie = await loginAs("verifier");

    const reqRes = await app.inject({
      method: "POST",
      url: "/v1/requests",
      cookies: { [verifierCookie!.name]: verifierCookie!.value },
      payload: {
        holderRef: citizenUser.id,
        purpose: "Telecom SIM registration",
        claims: ["fullName"],
      },
    });
    const createdReq = reqRes.json();

    const citizenCookie = await loginAs("citizen");

    // Citizen approves
    const consentRes = await app.inject({
      method: "POST",
      url: "/v1/consents",
      cookies: { [citizenCookie!.name]: citizenCookie!.value },
      payload: {
        requestId: createdReq.id,
        decisions: { fullName: "approve" },
      },
    });
    const consentJson = consentRes.json();
    const receiptHash = consentJson.receiptHash;

    const issued = issueCredential({
      issuer: `did:web:${issuerEntity.home_domain}`,
      subject: `did:stellar:local:${citizenUser.stellar_address}`,
      claims: citizenUser.synthetic_profile,
      issuerPrivateKey: issuerKeys.privateKey,
      holderPublicKey: holderKeys.publicKey,
      credentialStatusContractId: "CB2KSTATUS000000000000000000000000000000000000000000",
    });

    mockCredentials.push({
      id: "cred-01",
      credential_hash: issued.credentialHash,
      user_id: citizenUser.id,
      issuer_id: issuerEntity.id,
      status: "active",
      expires_at: new Date(Date.now() + 86400000),
    });

    // Citizen withdraws consent
    const withdrawRes = await app.inject({
      method: "POST",
      url: `/v1/consents/${receiptHash}/withdraw`,
      cookies: { [citizenCookie!.name]: citizenCookie!.value },
    });
    expect(withdrawRes.statusCode).toBe(200);
    expect(withdrawRes.json().status).toBe("withdrawn");
    expect(withdrawRes.json().notice).toContain(
      "Withdrawing consent affects FUTURE sharing only",
    );

    // Presentation now fails verification with CONSENT_WITHDRAWN
    const presentation = createPresentation({
      credential: issued,
      approvedClaims: ["fullName"],
      holderPrivateKey: holderKeys.privateKey,
      nonce: createdReq.nonce,
      audience: verifierEntity.home_domain,
    });

    const verifyRes = await app.inject({
      method: "POST",
      url: "/v1/verify/presentation",
      cookies: { [verifierCookie!.name]: verifierCookie!.value },
      payload: {
        presentation,
        requestId: createdReq.id,
      },
    });

    expect(verifyRes.statusCode).toBe(200);
    const data = verifyRes.json();
    expect(data.verified).toBe(false);
    expect(data.code).toBe("CONSENT_WITHDRAWN");
    expect(data.claims).toBeUndefined();
  });

  it("revoked credential fails verification (CREDENTIAL_REVOKED)", async () => {
    const verifierCookie = await loginAs("verifier");

    const reqRes = await app.inject({
      method: "POST",
      url: "/v1/requests",
      cookies: { [verifierCookie!.name]: verifierCookie!.value },
      payload: {
        holderRef: citizenUser.id,
        purpose: "Loan application",
        claims: ["fullName"],
      },
    });
    const createdReq = reqRes.json();

    const citizenCookie = await loginAs("citizen");

    await app.inject({
      method: "POST",
      url: "/v1/consents",
      cookies: { [citizenCookie!.name]: citizenCookie!.value },
      payload: {
        requestId: createdReq.id,
        decisions: { fullName: "approve" },
      },
    });

    const issued = issueCredential({
      issuer: `did:web:${issuerEntity.home_domain}`,
      subject: `did:stellar:local:${citizenUser.stellar_address}`,
      claims: citizenUser.synthetic_profile,
      issuerPrivateKey: issuerKeys.privateKey,
      holderPublicKey: holderKeys.publicKey,
      credentialStatusContractId: "CB2KSTATUS000000000000000000000000000000000000000000",
    });

    // Mark credential as REVOKED
    mockCredentials.push({
      id: "cred-01",
      credential_hash: issued.credentialHash,
      user_id: citizenUser.id,
      issuer_id: issuerEntity.id,
      status: "revoked",
      expires_at: new Date(Date.now() + 86400000),
    });

    const presentation = createPresentation({
      credential: issued,
      approvedClaims: ["fullName"],
      holderPrivateKey: holderKeys.privateKey,
      nonce: createdReq.nonce,
      audience: verifierEntity.home_domain,
    });

    const verifyRes = await app.inject({
      method: "POST",
      url: "/v1/verify/presentation",
      cookies: { [verifierCookie!.name]: verifierCookie!.value },
      payload: {
        presentation,
        requestId: createdReq.id,
      },
    });

    expect(verifyRes.statusCode).toBe(200);
    const data = verifyRes.json();
    expect(data.verified).toBe(false);
    expect(data.code).toBe("CREDENTIAL_REVOKED");
    expect(data.claims).toBeUndefined();
  });
});
