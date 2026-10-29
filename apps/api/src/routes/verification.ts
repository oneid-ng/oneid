/**
 * routes/verification.ts — Verifier presentation verification & status checks (README §13.3, §14.1, §18.3)
 *
 *   POST /v1/verify/presentation              verifier (verify SD-JWT presentation & chain state)
 *   GET  /v1/verify/credential/:hash/status   verifier (status lookup on credential-status)
 */

import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { VerifyPresentationBody } from "@oneid/shared";
import { verifyPresentation } from "@oneid/vc";
import { isActiveIssuer } from "@oneid/contracts-client";
import { Errors } from "../plugins/errors.js";
import {
  declareRouteRoles,
  requireRoles,
  type SessionUser,
} from "../plugins/role-guard.js";
import { getDb } from "../db/index.js";
import { entities, claim_requests, consents, credentials } from "../db/schema.js";
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

export async function verificationRoutes(app: FastifyInstance): Promise<void> {
  declareRouteRoles("POST", "/v1/verify/presentation", ["verifier"]);
  declareRouteRoles("GET", "/v1/verify/credential/:hash/status", ["verifier"]);

  // ── POST /v1/verify/presentation ──────────────────────────────────────
  app.post(
    "/v1/verify/presentation",
    { preHandler: [requireRoles("verifier")] },
    async (request, reply) => {
      const session = getSession(request);
      const parsed = VerifyPresentationBody.safeParse(request.body);
      if (!parsed.success) throw Errors.validationError(parsed.error.message);

      const {
        presentation,
        requestId,
        consentReceiptHash,
        expectedNonce: bodyNonce,
        expectedAudience: bodyAudience,
      } = parsed.data;
      const db = getDb();

      // Resolve verifier entity
      const [verifierEntity] = session.stellarAddress
        ? await db
            .select()
            .from(entities)
            .where(eq(entities.stellar_address, session.stellarAddress))
            .limit(1)
        : await db.select().from(entities).where(eq(entities.role, "verifier")).limit(1);

      if (!verifierEntity) {
        throw Errors.forbiddenRole("Verifier entity not registered.");
      }

      // Check request & consent records if requestId is provided
      let expectedNonce = bodyNonce ?? "default-nonce";
      let expectedAudience = bodyAudience ?? verifierEntity.home_domain;
      let targetConsentRecord: typeof consents.$inferSelect | null = null;

      if (requestId) {
        const [claimReq] = await db
          .select()
          .from(claim_requests)
          .where(eq(claim_requests.id, requestId))
          .limit(1);

        if (!claimReq) {
          throw Errors.validationError("Claim request not found.");
        }

        if (claimReq.verifier_id !== verifierEntity.id) {
          throw Errors.forbiddenRole("Access denied to another verifier's request.");
        }

        expectedNonce = claimReq.nonce;
        expectedAudience = verifierEntity.home_domain;

        // Look up consent receipt
        const [consent] = await db
          .select()
          .from(consents)
          .where(eq(consents.request_id, requestId))
          .limit(1);

        if (!consent) {
          return reply.send({
            verified: false,
            code: "CONSENT_MISSING",
            reason: "Consent receipt is missing for this claim request.",
          });
        }

        if (consent.status === "withdrawn") {
          return reply.send({
            verified: false,
            code: "CONSENT_WITHDRAWN",
            reason: "Consent receipt has been withdrawn by the citizen.",
          });
        }

        if (consent.status === "expired" || new Date() > consent.expires_at) {
          return reply.send({
            verified: false,
            code: "CONSENT_EXPIRED",
            reason: "Consent receipt has expired.",
          });
        }

        targetConsentRecord = consent;
      } else if (consentReceiptHash) {
        const [consent] = await db
          .select()
          .from(consents)
          .where(eq(consents.receipt_hash, consentReceiptHash))
          .limit(1);

        if (!consent) {
          return reply.send({
            verified: false,
            code: "CONSENT_MISSING",
            reason: "Consent receipt not found.",
          });
        }

        if (consent.status === "withdrawn") {
          return reply.send({
            verified: false,
            code: "CONSENT_WITHDRAWN",
            reason: "Consent receipt has been withdrawn.",
          });
        }

        if (consent.status === "expired" || new Date() > consent.expires_at) {
          return reply.send({
            verified: false,
            code: "CONSENT_EXPIRED",
            reason: "Consent receipt has expired.",
          });
        }

        targetConsentRecord = consent;
      }

      // Load issuer public key
      const issuerSigningJwk = process.env["VC_ISSUER_SIGNING_KEY_JWK"];
      let issuerPublicKey: unknown;
      if (issuerSigningJwk) {
        try {
          const parsedKey = JSON.parse(issuerSigningJwk) as Record<string, unknown>;
          issuerPublicKey = parsedKey;
        } catch {
          // ignore
        }
      }

      // In-order verification pipeline (README §13.3)
      // 1. Signature
      // 2. Holder binding
      // 3. Nonce & audience
      // 4. Issuer is ACTIVE in issuer-registry
      // 5. Credential-status is Active
      // 6. Consent receipt is Active and matches request
      const verifyResult = await verifyPresentation(presentation, {
        expectedNonce,
        expectedAudience,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        issuerPublicKey: (issuerPublicKey as any) ?? {},
        checkIssuerActive: async (issuerDidOrAddress: string) => {
          // Extract address or domain
          const addr = issuerDidOrAddress.replace(
            /^did:web:|^did:stellar:testnet:|^did:stellar:local:/,
            "",
          );
          const [entityRecord] = await db
            .select()
            .from(entities)
            .where(eq(entities.home_domain, addr))
            .limit(1);

          if (entityRecord) {
            return entityRecord.status === "active";
          }
          return isActiveIssuer(addr);
        },
        checkCredentialStatus: async (_contractId: string, credentialHash: string) => {
          const [cred] = await db
            .select()
            .from(credentials)
            .where(eq(credentials.credential_hash, credentialHash))
            .limit(1);

          if (!cred) return false;
          if (cred.status !== "active") return false;
          if (new Date() > cred.expires_at) return false;
          return true;
        },
        checkConsentActive: async (receiptHash: string) => {
          const [cons] = await db
            .select()
            .from(consents)
            .where(eq(consents.receipt_hash, receiptHash))
            .limit(1);

          if (!cons) return false;
          if (cons.status !== "active") return false;
          if (new Date() > cons.expires_at) return false;
          return true;
        },
        consentReceiptHash: targetConsentRecord?.receipt_hash,
      });

      if (!verifyResult.verified) {
        // Map codes strictly to specified reason codes
        let code = verifyResult.code as string;
        if (code === "CONSENT_NOT_ACTIVE") {
          code =
            targetConsentRecord?.status === "withdrawn"
              ? "CONSENT_WITHDRAWN"
              : "CONSENT_EXPIRED";
        }

        await appendAuditEvent({
          actorId: session.userId,
          actorRole: session.role,
          type: "verification.denied",
          refId: requestId ?? consentReceiptHash ?? "unknown",
        });

        // Fail-closed: DENIED CLAIMS ARE NEVER DISCLOSED
        return reply.send({
          verified: false,
          code,
          reason: verifyResult.reason,
        });
      }

      // Check that NO denied claims are disclosed
      if (targetConsentRecord && targetConsentRecord.decisions) {
        const decisions = targetConsentRecord.decisions as Record<string, string>;
        const revealed = verifyResult.claims ?? {};
        for (const claimKey of Object.keys(revealed)) {
          if (decisions[claimKey] !== "approve") {
            return reply.send({
              verified: false,
              code: "CONSENT_MISSING",
              reason: `Claim '${claimKey}' was denied in consent receipt but disclosed in presentation.`,
            });
          }
        }
      }

      await appendAuditEvent({
        actorId: session.userId,
        actorRole: session.role,
        type: "verification.success",
        refId: requestId ?? targetConsentRecord?.receipt_hash ?? "unknown",
      });

      return reply.send({
        verified: true,
        code: "VALID",
        claims: verifyResult.claims,
        holder: verifyResult.holder,
        issuer: verifyResult.issuer,
        credentialHash: verifyResult.credentialHash,
      });
    },
  );

  // ── GET /v1/verify/credential/:hash/status ────────────────────────────
  app.get(
    "/v1/verify/credential/:hash/status",
    { preHandler: [requireRoles("verifier")] },
    async (request, reply) => {
      const { hash } = request.params as { hash: string };
      const db = getDb();

      const [cred] = await db
        .select({
          id: credentials.id,
          credentialHash: credentials.credential_hash,
          status: credentials.status,
          expiresAt: credentials.expires_at,
          ledger: credentials.ledger,
          createdAt: credentials.created_at,
        })
        .from(credentials)
        .where(eq(credentials.credential_hash, hash))
        .limit(1);

      if (!cred) {
        return reply.status(404).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Credential status record not found.",
          },
        });
      }

      const isExpired = new Date() > cred.expiresAt;
      const status = isExpired && cred.status === "active" ? "expired" : cred.status;

      return reply.send({
        credentialHash: cred.credentialHash,
        status,
        expiresAt: cred.expiresAt.toISOString(),
        ledger: cred.ledger,
      });
    },
  );
}
