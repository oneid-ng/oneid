/**
 * routes/consent.ts — Citizen consent decisions & withdrawal (README §13.3, §14.1, §14.3, §18.3)
 *
 *   POST /v1/consents                 citizen (claim-by-claim approve/deny, records receipt on-chain)
 *   POST /v1/consents/:hash/withdraw  citizen (withdraws future sharing)
 *   GET  /v1/consents                 citizen (consent history)
 */

import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { eq, desc } from "drizzle-orm";
import { ConsentDecisionBody } from "@oneid/shared";
import { saltedHash } from "@oneid/vc";
import { submitTransaction, resolveNetwork, getRpcServer } from "@oneid/stellar";
import { Keypair } from "@stellar/stellar-sdk";
import { Errors } from "../plugins/errors.js";
import {
  declareRouteRoles,
  requireRoles,
  type SessionUser,
} from "../plugins/role-guard.js";
import { getDb } from "../db/index.js";
import { users, entities, claim_requests, consents } from "../db/schema.js";
import { appendAuditEvent } from "../lib/audit.js";

function getSession(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request: any,
): SessionUser {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user: SessionUser | undefined = (request as any).session?.user;
  if (!user) throw Errors.unauthenticated();
  return user;
}

export async function consentRoutes(app: FastifyInstance): Promise<void> {
  declareRouteRoles("POST", "/v1/consents", ["citizen"]);
  declareRouteRoles("POST", "/v1/consents/:hash/withdraw", ["citizen"]);
  declareRouteRoles("GET", "/v1/consents", ["citizen"]);

  // ── POST /v1/consents ─────────────────────────────────────────────────
  app.post(
    "/v1/consents",
    { preHandler: [requireRoles("citizen")] },
    async (request, reply) => {
      const session = getSession(request);
      const parsed = ConsentDecisionBody.safeParse(request.body);
      if (!parsed.success) throw Errors.validationError(parsed.error.message);

      const { requestId, decisions, expiresInSeconds } = parsed.data;
      const db = getDb();

      // Find claim request
      const [claimReq] = await db
        .select()
        .from(claim_requests)
        .where(eq(claim_requests.id, requestId))
        .limit(1);

      if (!claimReq) {
        throw Errors.validationError("Claim request not found.");
      }

      // Fail-closed: only the targeted holder can grant consent
      if (claimReq.holder_id !== session.userId) {
        throw Errors.forbiddenRole("Cannot grant consent for another citizen's request.");
      }

      if (claimReq.status !== "pending_consent") {
        throw Errors.validationError(`Request is already ${claimReq.status}.`);
      }

      const now = new Date();
      if (now > claimReq.expires_at) {
        throw Errors.consentExpired("Claim request has expired.");
      }

      // Load holder and verifier records
      const [holder] = await db
        .select()
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1);

      const [verifierEntity] = await db
        .select()
        .from(entities)
        .where(eq(entities.id, claimReq.verifier_id))
        .limit(1);

      if (!verifierEntity || verifierEntity.status !== "active") {
        throw Errors.issuerNotActive("Verifier is not active in issuer-registry.");
      }

      // Approved claims
      const approvedClaims = Object.entries(decisions)
        .filter(([, decision]) => decision === "approve")
        .map(([claim]) => claim)
        .sort();

      // Salt & canonical receipt hash computation (README §7, §12.3)
      const salt = randomBytes(16).toString("hex");
      const expiryTs = Math.floor(now.getTime() / 1000) + expiresInSeconds;
      const holderAddress =
        holder?.stellar_address ?? `did:stellar:demo:${session.userId}`;
      const requesterAddress = verifierEntity.stellar_address;

      const consentPayload = {
        holder: holderAddress,
        requester: requesterAddress,
        approvedClaims,
        purpose: claimReq.purpose,
        nonce: claimReq.nonce,
        expiry: expiryTs,
      };

      const { hash: receiptHash } = saltedHash(consentPayload, salt);

      // Record on consent-registry contract via fee sponsorship
      let chainTx: string | null = null;
      let ledger: number | null = null;

      try {
        const contractId = process.env["CONSENT_REGISTRY_ID"] ?? "";
        const citizenSecret =
          process.env["CITIZEN_DEMO_SECRET"] || process.env["FEE_SPONSOR_SECRET"] || "";
        const sponsorSecret = process.env["FEE_SPONSOR_SECRET"] ?? "";

        if (contractId && citizenSecret) {
          const network = resolveNetwork();
          const rpc = getRpcServer(network);
          const citizenKp = Keypair.fromSecret(citizenSecret);
          const sponsorKp = sponsorSecret ? Keypair.fromSecret(sponsorSecret) : undefined;

          const result = await submitTransaction({
            rpc,
            network,
            sourceKeypair: citizenKp,
            sponsorKeypair: sponsorKp,
            contractId,
            method: "grant",
            idempotencyKey: `consent:${receiptHash}`,
          });
          chainTx = result.txHash ?? null;
          ledger = result.ledger ?? null;
        }
      } catch (err) {
        app.log.warn(
          { reqId: request.id },
          `Consent registry contract grant warning: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      // Persist consent record
      const expiresAt = new Date(expiryTs * 1000);
      const [consentRecord] = await db
        .insert(consents)
        .values({
          request_id: claimReq.id,
          receipt_hash: receiptHash,
          decisions,
          status: "active",
          expires_at: expiresAt,
          chain_tx: chainTx,
          ledger,
        })
        .returning();

      // Update claim request status
      const updatedStatus = approvedClaims.length > 0 ? "approved" : "denied";
      await db
        .update(claim_requests)
        .set({ status: updatedStatus })
        .where(eq(claim_requests.id, requestId));

      await appendAuditEvent({
        actorId: session.userId,
        actorRole: session.role,
        type: "consent.decision",
        refId: receiptHash,
        chainTx: chainTx ?? null,
      });

      return reply.status(201).send({
        id: consentRecord!.id,
        requestId,
        receiptHash,
        status: "active",
        expiresAt: expiresAt.toISOString(),
        chainTx,
        ledger,
        decisions,
        approvedClaims,
        salt,
      });
    },
  );

  // ── POST /v1/consents/:hash/withdraw ──────────────────────────────────
  app.post(
    "/v1/consents/:hash/withdraw",
    { preHandler: [requireRoles("citizen")] },
    async (request, reply) => {
      const session = getSession(request);
      const { hash } = request.params as { hash: string };
      const db = getDb();

      const [consent] = await db
        .select({
          id: consents.id,
          receiptHash: consents.receipt_hash,
          requestId: consents.request_id,
          status: consents.status,
          expiresAt: consents.expires_at,
          holderId: claim_requests.holder_id,
        })
        .from(consents)
        .leftJoin(claim_requests, eq(consents.request_id, claim_requests.id))
        .where(eq(consents.receipt_hash, hash))
        .limit(1);

      if (!consent) {
        throw Errors.validationError("Consent receipt not found.");
      }

      if (consent.holderId && consent.holderId !== session.userId) {
        throw Errors.forbiddenRole("Cannot withdraw another citizen's consent receipt.");
      }

      if (consent.status === "withdrawn") {
        return reply.send({
          receiptHash: hash,
          status: "withdrawn",
          notice:
            "Withdrawing consent affects FUTURE sharing only; it does not erase data already received by another institution.",
        });
      }

      // On-chain withdraw on consent-registry
      let chainTx: string | null = null;
      let ledger: number | null = null;

      try {
        const contractId = process.env["CONSENT_REGISTRY_ID"] ?? "";
        const citizenSecret =
          process.env["CITIZEN_DEMO_SECRET"] || process.env["FEE_SPONSOR_SECRET"] || "";
        const sponsorSecret = process.env["FEE_SPONSOR_SECRET"] ?? "";

        if (contractId && citizenSecret) {
          const network = resolveNetwork();
          const rpc = getRpcServer(network);
          const citizenKp = Keypair.fromSecret(citizenSecret);
          const sponsorKp = sponsorSecret ? Keypair.fromSecret(sponsorSecret) : undefined;

          const result = await submitTransaction({
            rpc,
            network,
            sourceKeypair: citizenKp,
            sponsorKeypair: sponsorKp,
            contractId,
            method: "withdraw",
            idempotencyKey: `withdraw:${hash}`,
          });
          chainTx = result.txHash ?? null;
          ledger = result.ledger ?? null;
        }
      } catch (err) {
        app.log.warn(
          { reqId: request.id },
          `Consent registry contract withdraw warning: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      await db
        .update(consents)
        .set({ status: "withdrawn", chain_tx: chainTx, ledger })
        .where(eq(consents.receipt_hash, hash));

      await appendAuditEvent({
        actorId: session.userId,
        actorRole: session.role,
        type: "consent.withdrawn",
        refId: hash,
        chainTx: chainTx ?? null,
      });

      return reply.send({
        receiptHash: hash,
        status: "withdrawn",
        chainTx,
        ledger,
        notice:
          "Withdrawing consent affects FUTURE sharing only; it does not erase data already received by another institution.",
      });
    },
  );

  // ── GET /v1/consents ──────────────────────────────────────────────────
  app.get(
    "/v1/consents",
    { preHandler: [requireRoles("citizen")] },
    async (request, reply) => {
      const session = getSession(request);
      const db = getDb();

      const userConsents = await db
        .select({
          id: consents.id,
          receiptHash: consents.receipt_hash,
          requestId: consents.request_id,
          decisions: consents.decisions,
          status: consents.status,
          expiresAt: consents.expires_at,
          chainTx: consents.chain_tx,
          ledger: consents.ledger,
          createdAt: consents.created_at,
          purpose: claim_requests.purpose,
          claims: claim_requests.claims,
          verifierName: entities.name,
          verifierDomain: entities.home_domain,
        })
        .from(consents)
        .innerJoin(claim_requests, eq(consents.request_id, claim_requests.id))
        .innerJoin(entities, eq(claim_requests.verifier_id, entities.id))
        .where(eq(claim_requests.holder_id, session.userId))
        .orderBy(desc(consents.created_at));

      return reply.send({ consents: userConsents });
    },
  );
}
