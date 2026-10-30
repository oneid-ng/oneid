import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildAnchor, DEMO_ANCHOR_ADDRESS } from "./index.js";
import { mockStatusOverrides } from "@oneid/contracts-client";
import type { FastifyInstance } from "fastify";

describe("@oneid/mock-anchor (README §16)", () => {
  let app: FastifyInstance;

  const DEMO_ISSUER = "GISSUERONEIDDEMOISSUER0000000000000000000000000000000000000";
  const TEST_ACCOUNT = "GBDEMOACCOUNT0000000000000000000000000000000000000000000001";
  const TEST_CRED_HASH =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const TEST_RECEIPT_HASH =
    "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";

  beforeAll(async () => {
    app = await buildAnchor();
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

  it("GET /healthz returns 200 with service and anchor notice", async () => {
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);
    const json = res.json<{ service: string; notice: string }>();
    expect(json.service).toBe("mock-anchor");
    expect(json.notice).toContain("README §16");
  });

  it("GET /.well-known/stellar.toml publishes SEP-1 file with notice", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/.well-known/stellar.toml",
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.body).toContain("SEP-style demo");
    expect(res.body).toContain(`SIGNING_KEY="${DEMO_ANCHOR_ADDRESS}"`);
    expect(res.body).toContain('code="USDC"');
  });

  it("SEP-10 challenge and response flow", async () => {
    // 1. Request challenge
    const chalRes = await app.inject({
      method: "GET",
      url: `/sep10/auth?account=${TEST_ACCOUNT}`,
    });
    expect(chalRes.statusCode).toBe(200);
    const chalJson = chalRes.json<{ nonce: string }>();
    expect(chalJson.nonce).toBeDefined();

    // 2. Submit response
    const authRes = await app.inject({
      method: "POST",
      url: "/sep10/auth",
      payload: { account: TEST_ACCOUNT },
    });
    expect(authRes.statusCode).toBe(200);
    const authJson = authRes.json<{ token: string }>();
    expect(authJson.token).toContain("demo_sep10");
  });

  it("SEP-12: returns NEEDS_INFO with redirect URL when no KYC has been provided", async () => {
    const freshAccount = "GBDEMOACCOUNT0000000000000000000000000000000000000000000002";
    const res = await app.inject({
      method: "GET",
      url: `/sep12/customer?account=${freshAccount}`,
    });
    expect(res.statusCode).toBe(200);
    const json = res.json<{
      status: string;
      fields: Record<string, unknown>;
      consent_flow: { redirect_url: string };
    }>();
    expect(json.status).toBe("NEEDS_INFO");
    expect(json.fields).toHaveProperty("first_name");
    expect(json.consent_flow.redirect_url).toContain("/consent?");
  });

  it("SEP-12: proceeds without document upload when consent and credential are valid on-chain", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/sep12/customer",
      payload: {
        account: TEST_ACCOUNT,
        credential_hash: TEST_CRED_HASH,
        consent_receipt_hash: TEST_RECEIPT_HASH,
        issuer_address: DEMO_ISSUER,
        claims: {
          first_name: "Amina",
          last_name: "Bello",
          nin_hash: "0x1234abcd",
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const json = res.json<{
      status: string;
      on_chain_checks: {
        issuer_active: boolean;
        credential_active: boolean;
        consent_active: boolean;
      };
    }>();
    expect(json.status).toBe("ACCEPTED");
    expect(json.on_chain_checks.issuer_active).toBe(true);
    expect(json.on_chain_checks.credential_active).toBe(true);
    expect(json.on_chain_checks.consent_active).toBe(true);

    // Verify subsequent GET returns ACCEPTED with approved fields
    const checkRes = await app.inject({
      method: "GET",
      url: `/sep12/customer?account=${TEST_ACCOUNT}`,
    });
    expect(checkRes.statusCode).toBe(200);
    expect(checkRes.json<{ status: string }>().status).toBe("ACCEPTED");
  });

  it("SEP-12: is blocked with visible reason when credential is revoked on-chain", async () => {
    const revokedAccount = "GBDEMOACCOUNT0000000000000000000000000000000000000000000003";
    const revokedCredHash =
      "revoked_cred_hash_000000000000000000000000000000000000000000000";

    // Credential is revoked
    mockStatusOverrides.credentials.set(revokedCredHash, "Revoked");

    const res = await app.inject({
      method: "PUT",
      url: "/sep12/customer",
      payload: {
        account: revokedAccount,
        credential_hash: revokedCredHash,
        consent_receipt_hash: TEST_RECEIPT_HASH,
        issuer_address: DEMO_ISSUER,
        claims: { first_name: "Amina" },
      },
    });

    expect(res.statusCode).toBe(403);
    const json = res.json<{ status: string; code: string; error: string }>();
    expect(json.status).toBe("REJECTED");
    expect(json.code).toBe("CREDENTIAL_REVOKED");
    expect(json.error).toContain("revoked");
  });

  it("SEP-12: is blocked with visible reason when consent is withdrawn on-chain", async () => {
    const withdrawnAccount =
      "GBDEMOACCOUNT0000000000000000000000000000000000000000000004";
    const withdrawnReceiptHash =
      "withdrawn_receipt_hash_0000000000000000000000000000000000000000";

    // Consent is withdrawn
    mockStatusOverrides.consents.set(withdrawnReceiptHash, "Withdrawn");

    const res = await app.inject({
      method: "PUT",
      url: "/sep12/customer",
      payload: {
        account: withdrawnAccount,
        credential_hash: TEST_CRED_HASH,
        consent_receipt_hash: withdrawnReceiptHash,
        issuer_address: DEMO_ISSUER,
        claims: { first_name: "Amina" },
      },
    });

    expect(res.statusCode).toBe(403);
    const json = res.json<{ status: string; code: string; error: string }>();
    expect(json.status).toBe("REJECTED");
    expect(json.code).toBe("CONSENT_WITHDRAWN");
    expect(json.error).toContain("withdrawn");
  });

  it("SEP-24 interactive deposit: completes with zero document upload when KYC is verified", async () => {
    // 1. Initiate deposit
    const initRes = await app.inject({
      method: "POST",
      url: "/sep24/transactions/deposit/interactive",
      payload: {
        asset_code: "USDC",
        account: TEST_ACCOUNT,
        amount: "15000",
      },
    });
    expect(initRes.statusCode).toBe(200);
    const { id, url } = initRes.json<{ id: string; url: string }>();
    expect(id).toBeDefined();
    expect(url).toContain("/sep24/interactive?id=");

    // 2. Fetch interactive HTML UI
    const uiRes = await app.inject({
      method: "GET",
      url: `/sep24/interactive?id=${id}`,
    });
    expect(uiRes.statusCode).toBe(200);
    expect(uiRes.body).toContain("ACCEPTED · Reusable KYC Verified");
    expect(uiRes.body).toContain("Proceeding without document upload!");
    expect(uiRes.body).toContain("Complete Demo Deposit");

    // 3. Complete demo deposit
    const completeRes = await app.inject({
      method: "POST",
      url: `/sep24/transactions/${id}/complete`,
    });
    expect(completeRes.statusCode).toBe(200);
    const compJson = completeRes.json<{
      status: string;
      transaction: { status: string };
    }>();
    expect(compJson.status).toBe("completed");
    expect(compJson.transaction.status).toBe("completed");
  });
});
