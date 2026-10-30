import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildFintech, DEMO_FINTECH_ADDRESS } from "./index.js";
import { mockStatusOverrides } from "@oneid/contracts-client";
import type { FastifyInstance } from "fastify";

describe("@oneid/mock-fintech (README §16)", () => {
  let app: FastifyInstance;

  const DEMO_ISSUER = "GISSUERONEIDDEMOISSUER0000000000000000000000000000000000000";
  const TEST_ACCOUNT = "GBDEMOFINTECHUSER0000000000000000000000000000000000000000001";
  const TEST_CRED_HASH = "cred_hash_fintech_00000000000000000000000000000000000000000000";
  const TEST_RECEIPT_HASH =
    "receipt_hash_fintech_000000000000000000000000000000000000000000";

  beforeAll(async () => {
    app = await buildFintech();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockStatusOverrides.reset();
    mockStatusOverrides.issuers.set(DEMO_ISSUER, true);
    mockStatusOverrides.credentials.set(TEST_CRED_HASH, "Active");
    mockStatusOverrides.consents.set(TEST_RECEIPT_HASH, "Active");
  });

  it("GET /healthz returns 200 with service and fintech address", async () => {
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);
    const json = res.json<{ service: string; notice: string; fintechAddress: string }>();
    expect(json.service).toBe("mock-fintech");
    expect(json.fintechAddress).toBe(DEMO_FINTECH_ADDRESS);
  });

  it("GET /.well-known/stellar.toml publishes SEP-1 verifier info", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/.well-known/stellar.toml",
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.body).toContain("ONEiD Demo Fintech");
    expect(res.body).toContain(`SIGNING_KEY="${DEMO_FINTECH_ADDRESS}"`);
  });

  it("POST /fintech/account/request initiates account opening request with required claims", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/fintech/account/request",
      payload: { account: TEST_ACCOUNT },
    });

    expect(res.statusCode).toBe(200);
    const json = res.json<{
      requestId: string;
      requiredClaims: string[];
      consentUrl: string;
    }>();
    expect(json.requestId).toBeDefined();
    expect(json.requiredClaims).toContain("first_name");
    expect(json.requiredClaims).toContain("phone_number");
    expect(json.consentUrl).toContain("/consent?requestId=");
  });

  it("POST /fintech/account/open opens account when credentials and consent are valid on-chain", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/fintech/account/open",
      payload: {
        account: TEST_ACCOUNT,
        credential_hash: TEST_CRED_HASH,
        consent_receipt_hash: TEST_RECEIPT_HASH,
        issuer_address: DEMO_ISSUER,
        claims: {
          first_name: "Chinedu",
          last_name: "Okafor",
          date_of_birth: "1994-06-15",
          phone_number: "+2348012345678",
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const json = res.json<{
      status: string;
      accountNumber: string;
      customer: { name: string };
      verifiedClaims: string[];
    }>();

    expect(json.status).toBe("OPEN");
    expect(json.accountNumber).toMatch(/^\d{10}$/);
    expect(json.customer.name).toBe("Chinedu Okafor");
    expect(json.verifiedClaims).toContain("first_name");

    // Test GET /fintech/account/:accountNumber
    const getRes = await app.inject({
      method: "GET",
      url: `/fintech/account/${json.accountNumber}`,
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json<{ status: string }>().status).toBe("OPEN");
  });

  it("POST /fintech/account/open is blocked when credential is revoked on-chain", async () => {
    const revokedHash =
      "revoked_cred_fintech_00000000000000000000000000000000000000000000";
    mockStatusOverrides.credentials.set(revokedHash, "Revoked");

    const res = await app.inject({
      method: "POST",
      url: "/fintech/account/open",
      payload: {
        account: TEST_ACCOUNT,
        credential_hash: revokedHash,
        consent_receipt_hash: TEST_RECEIPT_HASH,
        issuer_address: DEMO_ISSUER,
        claims: { first_name: "Chinedu" },
      },
    });

    expect(res.statusCode).toBe(403);
    const json = res.json<{ status: string; code: string; error: string }>();
    expect(json.status).toBe("REJECTED");
    expect(json.code).toBe("CREDENTIAL_REVOKED");
  });

  it("POST /fintech/account/open is blocked when consent is withdrawn on-chain", async () => {
    const withdrawnHash =
      "withdrawn_receipt_fintech_00000000000000000000000000000000000000";
    mockStatusOverrides.consents.set(withdrawnHash, "Withdrawn");

    const res = await app.inject({
      method: "POST",
      url: "/fintech/account/open",
      payload: {
        account: TEST_ACCOUNT,
        credential_hash: TEST_CRED_HASH,
        consent_receipt_hash: withdrawnHash,
        issuer_address: DEMO_ISSUER,
        claims: { first_name: "Chinedu" },
      },
    });

    expect(res.statusCode).toBe(403);
    const json = res.json<{ status: string; code: string; error: string }>();
    expect(json.status).toBe("REJECTED");
    expect(json.code).toBe("CONSENT_WITHDRAWN");
  });
});
