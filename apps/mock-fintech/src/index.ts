/**
 * apps/mock-fintech/src/index.ts
 *
 * Mock Fintech: Demo verifier app requesting claims for account opening (README §16).
 * DEMO ENVIRONMENT · SYNTHETIC DATA ONLY · NO REAL ASSETS · LOCAL/TESTNET ONLY.
 * Registered as verifier in issuer-registry.
 */

import Fastify from "fastify";
import sensible from "@fastify/sensible";
import { StrKey } from "@stellar/stellar-sdk";
import {
  isActiveIssuer,
  isCredentialActive,
  isConsentActive,
} from "@oneid/contracts-client";

export const DEMO_FINTECH_ADDRESS =
  process.env["FINTECH_STELLAR_ADDRESS"] ||
  "GFINTECHONEIDDEMOFINTECH00000000000000000000000000000000000";

export const DEMO_FINTECH_DOMAIN =
  process.env["FINTECH_HOME_DOMAIN"] || "fintech.demo.oneid.local";

export function isValidStellarAddress(addr: string): boolean {
  if (!addr || typeof addr !== "string") return false;
  return StrKey.isValidEd25519PublicKey(addr) || /^G[A-Z0-9]{55,}$/.test(addr);
}

export interface FintechAccount {
  accountNumber: string;
  stellarAddress: string;
  status: "OPEN" | "BLOCKED" | "PENDING";
  customerName: string;
  verifiedClaims: string[];
  openedAt: number;
  notice: string;
}

export async function buildFintech() {
  const app = Fastify({
    logger: { level: process.env["LOG_LEVEL"] ?? "info" },
  });

  await app.register(sensible);

  const accountStore = new Map<string, FintechAccount>();
  const requestStore = new Map<
    string,
    { requestId: string; account: string; nonce: string; createdAt: number }
  >();

  // Notice header on all responses
  app.addHook("onSend", async (_request, reply) => {
    reply.header(
      "X-ONEiD-Notice",
      "Demo fintech verifier. Synthetic demo environment only. No real banking operations.",
    );
  });

  app.get("/healthz", async () => ({
    status: "ok",
    service: "mock-fintech",
    notice: "Demo fintech verifier (README §16)",
    fintechAddress: DEMO_FINTECH_ADDRESS,
  }));

  // ── SEP-1: stellar.toml ──────────────────────────────────────────────────
  app.get("/.well-known/stellar.toml", async (_req, reply) => {
    reply.header("Content-Type", "text/plain; charset=utf-8");
    const networkPassphrase =
      process.env["STELLAR_NETWORK_PASSPHRASE"] ?? "Standalone Network ; February 2017";
    const port = process.env["PORT"] ?? 4200;
    const baseUrl = `http://localhost:${port}`;

    return [
      "# ONEiD Demo Fintech — Verifier",
      "# SYNTHETIC DEMO ENVIRONMENT ONLY · NO REAL BANKING LICENCE",
      `NETWORK_PASSPHRASE="${networkPassphrase}"`,
      `SIGNING_KEY="${DEMO_FINTECH_ADDRESS}"`,
      `HOME_DOMAIN="${DEMO_FINTECH_DOMAIN}"`,
      `VERIFIER_ENDPOINT="${baseUrl}/fintech"`,
    ].join("\n");
  });

  // ── Step 1: Request account opening claims ────────────────────────────────
  app.post<{ Body: { account: string } }>(
    "/fintech/account/request",
    async (req, reply) => {
      const { account } = req.body;
      if (!account || !isValidStellarAddress(account)) {
        return reply.badRequest("Invalid or missing 'account' Stellar public key.");
      }

      const requestId = `req_fintech_${Math.random().toString(36).substring(2, 10)}`;
      const nonce = Math.random().toString(36).substring(2, 12);

      requestStore.set(requestId, {
        requestId,
        account,
        nonce,
        createdAt: Date.now(),
      });

      const requiredClaims = ["first_name", "last_name", "date_of_birth", "phone_number"];

      return {
        requestId,
        nonce,
        verifierAddress: DEMO_FINTECH_ADDRESS,
        verifierDomain: DEMO_FINTECH_DOMAIN,
        requiredClaims,
        purpose: "Open a synthetic digital bank account with zero document uploads",
        consentUrl: `http://localhost:3000/consent?requestId=${requestId}&requester=${DEMO_FINTECH_ADDRESS}&audience=${DEMO_FINTECH_DOMAIN}`,
        notice:
          "ONEiD reusable KYC flow: user approves required claims via explicit consent.",
      };
    },
  );

  // ── Step 2: Open account using approved ONEiD claims & on-chain verification ─
  app.post<{
    Body: {
      requestId?: string;
      account: string;
      credential_hash: string;
      consent_receipt_hash: string;
      issuer_address: string;
      claims: Record<string, string>;
    };
  }>("/fintech/account/open", async (req, reply) => {
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

    // 1. Check Issuer is Active on-chain
    const issuerValid = await isActiveIssuer(issuer_address);
    if (!issuerValid) {
      return reply.status(403).send({
        status: "REJECTED",
        code: "ISSUER_NOT_ACTIVE",
        error:
          "Issuing authority is suspended or not active in issuer-registry contract.",
      });
    }

    // 2. Check Credential is Active on-chain
    const credValid = await isCredentialActive(credential_hash);
    if (!credValid) {
      return reply.status(403).send({
        status: "REJECTED",
        code: "CREDENTIAL_REVOKED",
        error: "Credential is revoked or expired on-chain. Account opening blocked.",
      });
    }

    // 3. Check Consent is Active on-chain
    const consentValid = await isConsentActive(consent_receipt_hash);
    if (!consentValid) {
      return reply.status(403).send({
        status: "REJECTED",
        code: "CONSENT_WITHDRAWN",
        error:
          "Consent receipt has been withdrawn or expired on-chain. Account opening blocked.",
      });
    }

    // Generate synthetic 10-digit NUBAN-style account number
    const randDigits = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    const customerName = `${claims["first_name"] ?? "Jane"} ${claims["last_name"] ?? "Doe"}`;

    const newAccount: FintechAccount = {
      accountNumber: randDigits,
      stellarAddress: account,
      status: "OPEN",
      customerName,
      verifiedClaims: Object.keys(claims),
      openedAt: Date.now(),
      notice: "Synthetic demo account opened with zero document uploads via ONEiD.",
    };

    accountStore.set(randDigits, newAccount);

    return {
      status: "OPEN",
      accountNumber: randDigits,
      customer: {
        name: customerName,
        stellarAddress: account,
      },
      verifiedClaims: Object.keys(claims),
      onChainVerification: {
        issuerActive: true,
        credentialActive: true,
        consentActive: true,
      },
      message:
        "Account opened successfully via ONEiD reusable KYC without document uploads.",
    };
  });

  // ── Step 3: View account ──────────────────────────────────────────────────
  app.get<{ Params: { accountNumber: string } }>(
    "/fintech/account/:accountNumber",
    async (req, reply) => {
      const { accountNumber } = req.params;
      const acc = accountStore.get(accountNumber);
      if (!acc) return reply.notFound("Account not found.");
      return acc;
    },
  );

  return app;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const port = Number(process.env["PORT"] ?? 4200);
  const app = await buildFintech();
  try {
    await app.listen({ port, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
