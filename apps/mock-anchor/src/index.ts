/**
 * apps/mock-anchor/src/index.ts
 *
 * Mock Anchor: SEP-1, SEP-10, SEP-12-style, and SEP-24-style demo (README §16).
 * DEMO ENVIRONMENT · SYNTHETIC DATA ONLY · NO REAL ASSETS · LOCAL/TESTNET ONLY.
 * Does NOT claim full SEP conformance; endpoints are labelled "SEP-style demo".
 */

import Fastify from "fastify";
import sensible from "@fastify/sensible";
import { StrKey } from "@stellar/stellar-sdk";
import {
  isActiveIssuer,
  isCredentialActive,
  isConsentActive,
} from "@oneid/contracts-client";

export const DEMO_ANCHOR_ADDRESS =
  process.env["ANCHOR_STELLAR_ADDRESS"] ||
  "GANCHORONEIDDEMOANCHOR0000000000000000000000000000000000000";

export const DEMO_ANCHOR_DOMAIN =
  process.env["ANCHOR_HOME_DOMAIN"] || "anchor.demo.oneid.local";

export function isValidStellarAddress(addr: string): boolean {
  if (!addr || typeof addr !== "string") return false;
  return StrKey.isValidEd25519PublicKey(addr) || /^G[A-Z0-9]{55,}$/.test(addr);
}

export interface CustomerKycRecord {
  account: string;
  status: "NEEDS_INFO" | "ACCEPTED" | "REJECTED";
  issuerAddress?: string;
  credentialHash?: string;
  consentReceiptHash?: string;
  approvedFields: Record<string, string>;
  rejectionReason?: string;
  rejectionCode?: string;
  updatedAt: number;
}

export interface DepositTransaction {
  id: string;
  account: string;
  assetCode: string;
  amountIn: string;
  amountOut: string;
  status:
    | "pending_user_transfer_start"
    | "pending_anchor"
    | "completed"
    | "blocked"
    | "failed";
  startedAt: number;
  completedAt?: number;
  message?: string;
  code?: string;
}

export async function buildAnchor() {
  const app = Fastify({
    logger: { level: process.env["LOG_LEVEL"] ?? "info" },
  });

  await app.register(sensible);

  // In-memory demo stores (demo environment only)
  const customerStore = new Map<string, CustomerKycRecord>();
  const transactionStore = new Map<string, DepositTransaction>();
  const authChallenges = new Map<string, { nonce: string; expiresAt: number }>();

  // Add SEP-style demo disclaimer header to every response
  app.addHook("onSend", async (_request, reply) => {
    reply.header(
      "X-ONEiD-Notice",
      "SEP-style demo only. Does not claim full SEP conformance. Synthetic demo environment.",
    );
  });

  app.get("/healthz", async () => ({
    status: "ok",
    service: "mock-anchor",
    notice: "SEP-style demo anchor (README §16)",
    anchorAddress: DEMO_ANCHOR_ADDRESS,
  }));

  // ── SEP-1: stellar.toml ──────────────────────────────────────────────────
  app.get("/.well-known/stellar.toml", async (_req, reply) => {
    reply.header("Content-Type", "text/plain; charset=utf-8");
    const networkPassphrase =
      process.env["STELLAR_NETWORK_PASSPHRASE"] ?? "Standalone Network ; February 2017";
    const port = process.env["PORT"] ?? 4100;
    const baseUrl = `http://localhost:${port}`;

    return [
      "# ONEiD Demo Anchor — SEP-style demo",
      "# NOT FULL SEP CONFORMANCE CLAIMED · DEMO ONLY · NO REAL ASSETS",
      `NETWORK_PASSPHRASE="${networkPassphrase}"`,
      `SIGNING_KEY="${DEMO_ANCHOR_ADDRESS}"`,
      `TRANSFER_SERVER_SEP0024="${baseUrl}/sep24"`,
      `WEB_AUTH_ENDPOINT="${baseUrl}/sep10/auth"`,
      `KYC_SERVER="${baseUrl}/sep12"`,
      "",
      "[[CURRENCIES]]",
      'code="USDC"',
      `issuer="${DEMO_ANCHOR_ADDRESS}"`,
      'status="test"',
      "is_asset_anchored=true",
      'name="Synthetic Mock USDC (Demo)"',
      'desc="Demo asset for ONEiD reusable KYC demonstration — no real value"',
    ].join("\n");
  });

  // ── SEP-10: Web Authentication (Challenge / Response) ───────────────────
  app.get<{ Querystring: { account?: string } }>("/sep10/auth", async (req, reply) => {
    const account = req.query.account;
    if (!account || !isValidStellarAddress(account)) {
      return reply.badRequest("Invalid or missing 'account' Stellar public key.");
    }

    const nonce = Math.random().toString(36).substring(2, 15);
    const expiresAt = Date.now() + 5 * 60 * 1000;
    authChallenges.set(account, { nonce, expiresAt });

    return {
      notice: "SEP-style demo challenge (README §16)",
      account,
      anchor: DEMO_ANCHOR_ADDRESS,
      nonce,
      network_passphrase:
        process.env["STELLAR_NETWORK_PASSPHRASE"] ?? "Standalone Network ; February 2017",
      expires_at: expiresAt,
    };
  });

  app.post<{
    Body: { account: string; signature?: string; response?: string };
  }>("/sep10/auth", async (req, reply) => {
    const { account } = req.body;
    if (!account || !isValidStellarAddress(account)) {
      return reply.badRequest("Invalid Stellar account address.");
    }

    const challenge = authChallenges.get(account);
    if (!challenge) {
      return reply.badRequest(
        "No pending challenge found for this account. Request challenge first.",
      );
    }

    if (Date.now() > challenge.expiresAt) {
      authChallenges.delete(account);
      return reply.badRequest("Challenge expired. Please request a new challenge.");
    }

    authChallenges.delete(account);
    const token = `demo_sep10_${account.slice(0, 8)}_${Date.now()}`;

    return {
      token,
      token_type: "Bearer",
      account,
      notice: "Authenticated via SEP-10 demo challenge/response",
    };
  });

  // ── SEP-12: Customer KYC API (Reusable KYC Source) ──────────────────────
  app.get<{ Querystring: { account?: string } }>(
    "/sep12/customer",
    async (req, reply) => {
      const account = req.query.account;
      if (!account) {
        return reply.badRequest("Missing 'account' query parameter.");
      }

      const record = customerStore.get(account);
      if (!record || record.status === "NEEDS_INFO") {
        return {
          status: "NEEDS_INFO",
          notice:
            "SEP-style demo: ONEiD reusable KYC consent required. No document upload needed.",
          fields: {
            first_name: { type: "string", description: "Given name from ONEiD VC" },
            last_name: { type: "string", description: "Family name from ONEiD VC" },
            nin_hash: { type: "string", description: "Salted NIN hash from ONEiD VC" },
          },
          provided_fields: {},
          consent_flow: {
            description:
              "Redirect user to ONEiD consent UI. No document uploads required.",
            redirect_url: `http://localhost:3000/consent?requester=${DEMO_ANCHOR_ADDRESS}&audience=${DEMO_ANCHOR_DOMAIN}`,
          },
        };
      }

      if (record.status === "REJECTED") {
        return reply.status(403).send({
          status: "REJECTED",
          code: record.rejectionCode ?? "KYC_REJECTED",
          error: record.rejectionReason ?? "KYC verification failed on-chain.",
          notice: "SEP-style demo verification failure",
        });
      }

      return {
        status: "ACCEPTED",
        notice:
          "SEP-style demo: Reusable KYC verified on-chain via ONEiD without document upload.",
        provided_fields: record.approvedFields,
        credential_hash: record.credentialHash,
        consent_receipt_hash: record.consentReceiptHash,
      };
    },
  );

  app.put<{
    Body: {
      account: string;
      credential_hash: string;
      consent_receipt_hash: string;
      issuer_address: string;
      claims: Record<string, string>;
    };
  }>("/sep12/customer", async (req, reply) => {
    const { account, credential_hash, consent_receipt_hash, issuer_address, claims } =
      req.body;

    if (
      !account ||
      !credential_hash ||
      !consent_receipt_hash ||
      !issuer_address ||
      !claims
    ) {
      return reply.badRequest(
        "Missing required fields: account, credential_hash, consent_receipt_hash, issuer_address, claims.",
      );
    }

    // README §16 Requirement:
    // Before proceeding, the anchor must verify on-chain that:
    // 1. the issuer is active
    // 2. the credential status is Active
    // 3. the consent receipt is Active

    // 1. Verify Issuer is Active in issuer-registry
    const isIssuerValid = await isActiveIssuer(issuer_address);
    if (!isIssuerValid) {
      customerStore.set(account, {
        account,
        status: "REJECTED",
        rejectionReason:
          "Issuing authority is suspended or not active in issuer-registry contract.",
        rejectionCode: "ISSUER_NOT_ACTIVE",
        approvedFields: {},
        updatedAt: Date.now(),
      });
      return reply.status(403).send({
        status: "REJECTED",
        code: "ISSUER_NOT_ACTIVE",
        error:
          "Issuing authority is suspended or not active in issuer-registry contract. Verification failed closed.",
      });
    }

    // 2. Verify Credential Status is Active in credential-status
    const isCredValid = await isCredentialActive(credential_hash);
    if (!isCredValid) {
      customerStore.set(account, {
        account,
        status: "REJECTED",
        rejectionReason: "Credential is revoked or expired on-chain.",
        rejectionCode: "CREDENTIAL_REVOKED",
        approvedFields: {},
        updatedAt: Date.now(),
      });
      return reply.status(403).send({
        status: "REJECTED",
        code: "CREDENTIAL_REVOKED",
        error: "Credential is revoked or expired on-chain. Verification failed closed.",
      });
    }

    // 3. Verify Consent Receipt is Active in consent-registry
    const isConsentValid = await isConsentActive(consent_receipt_hash);
    if (!isConsentValid) {
      customerStore.set(account, {
        account,
        status: "REJECTED",
        rejectionReason: "Consent receipt is withdrawn or expired on-chain.",
        rejectionCode: "CONSENT_WITHDRAWN",
        approvedFields: {},
        updatedAt: Date.now(),
      });
      return reply.status(403).send({
        status: "REJECTED",
        code: "CONSENT_WITHDRAWN",
        error:
          "Consent receipt is withdrawn or expired on-chain. Verification failed closed.",
      });
    }

    // On-chain verification succeeded: store approved fields only
    customerStore.set(account, {
      account,
      status: "ACCEPTED",
      issuerAddress: issuer_address,
      credentialHash: credential_hash,
      consentReceiptHash: consent_receipt_hash,
      approvedFields: claims,
      updatedAt: Date.now(),
    });

    return {
      status: "ACCEPTED",
      notice:
        "SEP-style demo: Reusable KYC approved via on-chain verification without document upload.",
      approved_fields: Object.keys(claims),
      on_chain_checks: {
        issuer_active: true,
        credential_active: true,
        consent_active: true,
      },
    };
  });

  // ── SEP-24: Interactive Deposit / Withdraw Demo ───────────────────────────
  app.post<{
    Body: { asset_code: string; account: string; amount?: string };
  }>("/sep24/transactions/deposit/interactive", async (req, reply) => {
    const { asset_code, account, amount = "10000" } = req.body;
    if (!account || !isValidStellarAddress(account)) {
      return reply.badRequest("Invalid or missing 'account' Stellar address.");
    }
    if (asset_code !== "USDC") {
      return reply.badRequest("Only 'USDC' is supported in this demo anchor.");
    }

    const txId = `demo_tx_${Math.random().toString(36).substring(2, 10)}`;
    const port = process.env["PORT"] ?? 4100;
    const interactiveUrl = `http://localhost:${port}/sep24/interactive?id=${txId}`;

    const txRecord: DepositTransaction = {
      id: txId,
      account,
      assetCode: asset_code,
      amountIn: `${amount} NGN (Demo)`,
      amountOut: `${(Number(amount) / 1500).toFixed(2)} USDC (Demo)`,
      status: "pending_user_transfer_start",
      startedAt: Date.now(),
      message: "Initiated interactive demo deposit",
    };
    transactionStore.set(txId, txRecord);

    const kyc = customerStore.get(account);
    const kycNeeded = !kyc || kyc.status !== "ACCEPTED";

    return {
      type: kycNeeded ? "interactive_customer_info_needed" : "interactive",
      url: interactiveUrl,
      id: txId,
      notice: "SEP-style demo interactive deposit flow. No real money or assets.",
    };
  });

  app.get<{ Querystring: { id?: string } }>("/sep24/interactive", async (req, reply) => {
    const id = req.query.id;
    if (!id || !transactionStore.has(id)) {
      return reply.notFound("Transaction not found.");
    }

    const tx = transactionStore.get(id)!;
    const kyc = customerStore.get(tx.account);
    reply.header("Content-Type", "text/html; charset=utf-8");

    const isVerified = kyc && kyc.status === "ACCEPTED";
    const isBlocked = kyc && kyc.status === "REJECTED";

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ONEiD Mock Anchor — Interactive Deposit Demo</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #FAF8F4; color: #0D1F3C; margin: 2rem; max-width: 600px; }
    .card { background: white; border: 1px solid #E2D9CC; border-radius: 8px; padding: 1.5rem; }
    .badge { display: inline-block; padding: 0.25rem 0.5rem; border-radius: 4px; font-weight: bold; font-size: 0.85rem; }
    .badge-ok { background: #D1FAE5; color: #065F46; }
    .badge-warn { background: #FEF3C7; color: #92400E; }
    .badge-err { background: #FEE2E2; color: #991B1B; }
    .banner { background: #E0F2FE; color: #0369A1; padding: 0.75rem; border-radius: 4px; margin-bottom: 1rem; font-size: 0.85rem; }
    button { background: #0B7B8A; color: white; border: none; padding: 0.75rem 1.25rem; border-radius: 4px; font-weight: bold; cursor: pointer; }
    button:disabled { background: #9CA3AF; cursor: not-allowed; }
  </style>
</head>
<body>
  <div class="banner">
    ⚠️ DEMO ENVIRONMENT · SYNTHETIC DATA ONLY · NO REAL ASSETS · LOCAL TESTNET<br>
    SEP-style demo flow for reusable KYC verification (README §16).
  </div>
  <div class="card">
    <h2>SEP-24 Interactive Deposit (Demo)</h2>
    <p><strong>Transaction ID:</strong> <code>${tx.id}</code></p>
    <p><strong>Account:</strong> <code>${tx.account}</code></p>
    <p><strong>Deposit:</strong> ${tx.amountIn} &rarr; <strong>Receive:</strong> ${tx.amountOut}</p>
    
    <hr style="border: 0; border-top: 1px solid #E2D9CC; margin: 1rem 0;" />

    <h3>KYC Verification Status</h3>
    ${
      isVerified
        ? `<p><span class="badge badge-ok">ACCEPTED · Reusable KYC Verified</span></p>
           <p>Verified on-chain via ONEiD: Active Issuer, Active Credential, and Active Consent Receipt.</p>
           <p><strong>Approved claims:</strong> ${Object.keys(kyc.approvedFields).join(", ")}</p>
           <p style="color: #065F46;">✅ Proceeding without document upload!</p>
           <form method="POST" action="/sep24/transactions/${tx.id}/complete">
             <button type="submit" id="btn-complete-deposit">Complete Demo Deposit</button>
           </form>`
        : isBlocked
          ? `<p><span class="badge badge-err">BLOCKED · ${kyc.rejectionCode}</span></p>
             <p style="color: #991B1B;"><strong>Reason:</strong> ${kyc.rejectionReason}</p>
             <button disabled id="btn-blocked-deposit">Deposit Blocked</button>`
          : `<p><span class="badge badge-warn">NEEDS_INFO · ONEiD Consent Required</span></p>
             <p>No document upload required. Please review and approve KYC claims via ONEiD consent portal:</p>
             <p><a href="http://localhost:3000/consent?requester=${DEMO_ANCHOR_ADDRESS}&audience=${DEMO_ANCHOR_DOMAIN}">Open ONEiD Consent Screen &rarr;</a></p>
             <button disabled id="btn-awaiting-consent">Awaiting ONEiD Consent</button>`
    }
  </div>
</body>
</html>`;
  });

  app.post<{ Params: { id: string } }>(
    "/sep24/transactions/:id/complete",
    async (req, reply) => {
      const { id } = req.params;
      const tx = transactionStore.get(id);
      if (!tx) return reply.notFound("Transaction not found.");

      const kyc = customerStore.get(tx.account);
      if (!kyc || kyc.status !== "ACCEPTED") {
        tx.status = "blocked";
        tx.code = kyc?.rejectionCode ?? "KYC_REQUIRED";
        tx.message =
          kyc?.rejectionReason ?? "KYC verification missing or blocked on-chain.";
        return reply.status(403).send({
          status: "blocked",
          code: tx.code,
          error: tx.message,
        });
      }

      // Re-verify on-chain validity before releasing assets
      if (kyc.issuerAddress) {
        const issuerOk = await isActiveIssuer(kyc.issuerAddress);
        if (!issuerOk) {
          tx.status = "blocked";
          tx.code = "ISSUER_NOT_ACTIVE";
          tx.message = "Issuing authority suspended in issuer-registry.";
          return reply
            .status(403)
            .send({ status: "blocked", code: tx.code, error: tx.message });
        }
      }
      if (kyc.credentialHash) {
        const credOk = await isCredentialActive(kyc.credentialHash);
        if (!credOk) {
          tx.status = "blocked";
          tx.code = "CREDENTIAL_REVOKED";
          tx.message = "Credential revoked on credential-status contract.";
          return reply
            .status(403)
            .send({ status: "blocked", code: tx.code, error: tx.message });
        }
      }
      if (kyc.consentReceiptHash) {
        const consentOk = await isConsentActive(kyc.consentReceiptHash);
        if (!consentOk) {
          tx.status = "blocked";
          tx.code = "CONSENT_WITHDRAWN";
          tx.message = "Consent receipt withdrawn on consent-registry contract.";
          return reply
            .status(403)
            .send({ status: "blocked", code: tx.code, error: tx.message });
        }
      }

      tx.status = "completed";
      tx.completedAt = Date.now();
      tx.message = "Demo deposit complete with zero document upload.";

      return {
        status: "completed",
        transaction: tx,
        notice:
          "SEP-24 style demo deposit completed successfully. No real money or assets moved.",
      };
    },
  );

  app.get<{ Querystring: { id?: string } }>("/sep24/transaction", async (req, reply) => {
    const id = req.query.id;
    if (!id || !transactionStore.has(id)) {
      return reply.notFound("Transaction not found.");
    }
    return { transaction: transactionStore.get(id) };
  });

  return app;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const port = Number(process.env["PORT"] ?? 4100);
  const app = await buildAnchor();
  try {
    await app.listen({ port, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
