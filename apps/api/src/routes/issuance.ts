/**
 * routes/issuance.ts — Credential issuance and revocation (README §14.1, §13)
 *
 *   POST /v1/credentials/issue         issuer
 *   POST /v1/credentials/:hash/revoke  issuer (own credentials only)
 *
 * Issuance flow (README §18.2):
 *   1. Load citizen synthetic_profile (off-chain only).
 *   2. Build SD-JWT VC via @oneid/vc issueCredential().
 *   3. credentialHash computed internally by issueCredential (salted SHA-256).
 *   4. Register hash on credential-status contract via fee-bump (README §16).
 *   5. Store hash + chain reference in DB — NOT the full VC (see ADR-0003).
 *   6. Return SD-JWT to caller once; holder stores it encrypted.
 *   7. Write audit event.
 *
 * Security rules (README §19, §21):
 *   - Suspended issuer cannot issue (ISSUER_NOT_ACTIVE 422).
 *   - Issuer can only revoke its OWN credentials (FORBIDDEN_ROLE 403).
 *   - Citizens and verifiers cannot call these routes (FORBIDDEN_ROLE 403).
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { Errors } from "../plugins/errors.js";
import {
  declareRouteRoles,
  requireRoles,
  type SessionUser,
} from "../plugins/role-guard.js";
import { getDb } from "../db/index.js";
import { users, entities, credentials } from "../db/schema.js";
import { appendAuditEvent } from "../lib/audit.js";
import { issueCredential } from "@oneid/vc";
import { submitTransaction, resolveNetwork, getRpcServer } from "@oneid/stellar";
import { Keypair } from "@stellar/stellar-sdk";

// ── Zod schemas ───────────────────────────────────────────────────────────

const IssueCredentialBody = z.object({
  applicationId: z.string().uuid().optional(),
  holderUserId: z.string().uuid(),
  claims: z.array(z.string()).min(1),
  validityDays: z
    .number()
    .int()
    .min(1)
    .max(3650)
    .default(Number(process.env["VC_DEFAULT_VALIDITY_DAYS"] ?? "365")),
});

const RevokeCredentialBody = z.object({
  reasonCode: z.number().int().min(0).max(255).default(0),
});

// ── Session helper ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSession(request: any): SessionUser {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user: SessionUser | undefined = (request as any).session?.user;
  if (!user) throw Errors.unauthenticated();
  return user;
}

// ── Issuer entity resolver ────────────────────────────────────────────────

async function resolveIssuerEntity(
  session: SessionUser,
): Promise<typeof entities.$inferSelect> {
  const db = getDb();
  const [entity] = session.stellarAddress
    ? await db
        .select()
        .from(entities)
        .where(eq(entities.stellar_address, session.stellarAddress))
        .limit(1)
    : await db.select().from(entities).where(eq(entities.role, "issuer")).limit(1);

  if (!entity) throw Errors.issuerNotActive("Issuer entity record not found.");
  if (entity.status !== "active")
    throw Errors.issuerNotActive(`Issuer is ${entity.status}.`);
  return entity;
}

// ── Route registration ────────────────────────────────────────────────────

export async function issuanceRoutes(app: FastifyInstance): Promise<void> {
  declareRouteRoles("POST", "/v1/credentials/issue", ["issuer"]);
  declareRouteRoles("POST", "/v1/credentials/:hash/revoke", ["issuer"]);

  // ── POST /v1/credentials/issue ────────────────────────────────────────
  app.post(
    "/v1/credentials/issue",
    { preHandler: [requireRoles("issuer")] },
    async (request, reply) => {
      const session = getSession(request);
      const parsed = IssueCredentialBody.safeParse(request.body);
      if (!parsed.success) throw Errors.validationError(parsed.error.message);

      const { holderUserId, claims, validityDays } = parsed.data;
      const db = getDb();

      // Resolve and guard the issuer
      const issuerEntity = await resolveIssuerEntity(session);

      // Load citizen profile (off-chain only)
      const [holder] = await db
        .select()
        .from(users)
        .where(eq(users.id, holderUserId))
        .limit(1);

      if (!holder) throw Errors.validationError("Holder user not found.");

      const profile = holder.synthetic_profile as Record<string, unknown> | null;
      if (!profile)
        throw Errors.validationError(
          "Holder has no synthetic profile. Complete identity verification first.",
        );

      // Select only the requested claims from the profile
      const claimValues: Record<string, unknown> = {};
      for (const claim of claims) {
        if (Object.prototype.hasOwnProperty.call(profile, claim)) {
          claimValues[claim] = profile[claim];
        }
      }

      // Load issuer signing key
      const signingKeyJwk = process.env["VC_ISSUER_SIGNING_KEY_JWK"];
      if (!signingKeyJwk)
        throw new Error("VC_ISSUER_SIGNING_KEY_JWK not set. Run chain:seed.");

      const issuerPrivateKey = JSON.parse(signingKeyJwk) as Record<string, unknown>;
      const expiresAt = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);

      // Issue SD-JWT VC (README §13.1). holderPublicKey = issuer key for MVP demo;
      // real holder binding via cnf is a Phase 3 enhancement tracked in ADR-0003.
      const vc = issueCredential({
        issuer: `did:web:${issuerEntity.home_domain}`,
        subject: `did:stellar:local:${holder.stellar_address ?? holderUserId}`,
        claims: claimValues,
        issuerPrivateKey: issuerPrivateKey as Parameters<
          typeof issueCredential
        >[0]["issuerPrivateKey"],
        holderPublicKey: issuerPrivateKey as Parameters<
          typeof issueCredential
        >[0]["holderPublicKey"],
        credentialStatusContractId: process.env["CREDENTIAL_STATUS_ID"] ?? "UNSET",
        validFrom: new Date().toISOString(),
        validUntil: expiresAt.toISOString(),
      });

      const credentialHash = vc.credentialHash;

      // Register hash on credential-status contract (fee-bump sponsored)
      let chainTx: string | null = null;
      let ledger: number | null = null;

      try {
        const issuerSecret = process.env["ISSUER_DEMO_SECRET"] ?? "";
        const sponsorSecret = process.env["FEE_SPONSOR_SECRET"] ?? "";
        const contractId = process.env["CREDENTIAL_STATUS_ID"] ?? "";

        if (issuerSecret && contractId) {
          const network = resolveNetwork();
          const rpc = getRpcServer(network);
          const issuerKp = Keypair.fromSecret(issuerSecret);
          const sponsorKp = sponsorSecret ? Keypair.fromSecret(sponsorSecret) : undefined;

          const result = await submitTransaction({
            rpc,
            network,
            sourceKeypair: issuerKp,
            sponsorKeypair: sponsorKp,
            contractId,
            method: "register",
            idempotencyKey: `issue:${credentialHash}`,
          });
          chainTx = result.txHash ?? null;
          ledger = result.ledger ?? null;
        }
      } catch (err) {
        app.log.warn(
          { reqId: request.id },
          `Chain registration failed (will retry): ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      // Store only the hash reference — NOT the full VC (ADR-0003)
      const [credRecord] = await db
        .insert(credentials)
        .values({
          credential_hash: credentialHash,
          user_id: holderUserId,
          issuer_id: issuerEntity.id,
          status: "active",
          expires_at: expiresAt,
          chain_tx: chainTx,
          ledger,
        })
        .returning();

      await appendAuditEvent({
        actorId: session.userId,
        actorRole: session.role,
        type: "credential.issued",
        refId: credentialHash,
        chainTx: chainTx ?? null,
      });

      app.log.info({ reqId: request.id, credentialHash, ledger }, "Credential issued");

      // Return the SD-JWT to the caller ONCE. Holder stores it encrypted (ADR-0003).
      return reply.status(201).send({
        id: credRecord!.id,
        credentialHash,
        sdJwt: vc.rawSdJwt,
        expiresAt,
        chainTx,
        ledger,
        _adr: "ADR-0003: full VC returned to holder once, not retained server-side",
      });
    },
  );

  // ── POST /v1/credentials/:hash/revoke ─────────────────────────────────
  app.post(
    "/v1/credentials/:hash/revoke",
    { preHandler: [requireRoles("issuer")] },
    async (request, reply) => {
      const session = getSession(request);
      const { hash } = request.params as { hash: string };
      const parsed = RevokeCredentialBody.safeParse(request.body ?? {});
      if (!parsed.success) throw Errors.validationError(parsed.error.message);

      const { reasonCode } = parsed.data;
      const db = getDb();

      // Resolve and guard the issuer
      const issuerEntity = await resolveIssuerEntity(session);

      // Load the credential record
      const [credRecord] = await db
        .select()
        .from(credentials)
        .where(eq(credentials.credential_hash, hash))
        .limit(1);

      if (!credRecord) throw Errors.validationError("Credential not found.");

      // An issuer may only revoke its OWN credentials (README §19, §21 test)
      if (credRecord.issuer_id !== issuerEntity.id) {
        throw Errors.forbiddenRole("An issuer may only revoke credentials it issued.");
      }

      if (credRecord.status === "revoked") {
        throw Errors.credentialRevoked("Credential is already revoked.");
      }

      // Revoke on-chain
      let chainTx: string | null = null;
      let ledger: number | null = null;

      try {
        const issuerSecret = process.env["ISSUER_DEMO_SECRET"] ?? "";
        const sponsorSecret = process.env["FEE_SPONSOR_SECRET"] ?? "";
        const contractId = process.env["CREDENTIAL_STATUS_ID"] ?? "";

        if (issuerSecret && contractId) {
          const network = resolveNetwork();
          const rpc = getRpcServer(network);
          const issuerKp = Keypair.fromSecret(issuerSecret);
          const sponsorKp = sponsorSecret ? Keypair.fromSecret(sponsorSecret) : undefined;

          const result = await submitTransaction({
            rpc,
            network,
            sourceKeypair: issuerKp,
            sponsorKeypair: sponsorKp,
            contractId,
            method: "revoke",
            idempotencyKey: `revoke:${hash}`,
          });
          chainTx = result.txHash ?? null;
          ledger = result.ledger ?? null;
        }
      } catch (err) {
        app.log.warn(
          { reqId: request.id },
          `Chain revocation failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      await db
        .update(credentials)
        .set({ status: "revoked", chain_tx: chainTx, ledger })
        .where(eq(credentials.credential_hash, hash));

      await appendAuditEvent({
        actorId: session.userId,
        actorRole: session.role,
        type: "credential.revoked",
        refId: hash,
        chainTx: chainTx ?? null,
      });

      app.log.info({ reqId: request.id, hash, reasonCode }, "Credential revoked");

      return reply.send({ hash, status: "revoked", reasonCode, chainTx, ledger });
    },
  );
}
