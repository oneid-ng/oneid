/**
 * routes/identity.ts — Identity and application endpoints (README §14.1)
 *
 *   POST /v1/identity/mock-nin/verify   citizen
 *   POST /v1/identity/face-check/simulate  citizen
 *   GET  /v1/identity/me                citizen
 *   POST /v1/applications               citizen
 *   GET  /v1/applications               issuer
 *   POST /v1/applications/:id/decision  issuer
 *   GET  /v1/credentials                citizen
 *
 * Mock NIN check: only synthetic placeholder NINs pass (rule #2).
 * Every action writes an audit event (README §15, §19).
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
import { users, entities, applications, credentials } from "../db/schema.js";
import { appendAuditEvent } from "../lib/audit.js";

// ── Synthetic NIN allowlist (README §13.2, rule #2) ───────────────────────
const SYNTHETIC_NINS = new Set(["1234 5678 9012", "9876 5432 1098", "1111 2222 3333"]);

// ── Zod schemas ───────────────────────────────────────────────────────────

const MockNinVerifyBody = z.object({
  nin: z.string().regex(/^\d{4} \d{4} \d{4}$/, "NIN must be in format DDDD DDDD DDDD"),
});

const FaceCheckBody = z.object({
  imageRef: z.string().min(1).max(256).optional(),
});

const CreateApplicationBody = z.object({
  issuerId: z.string().uuid(),
});

const ApplicationDecisionBody = z.object({
  decision: z.enum(["approved", "rejected"]),
  note: z.string().max(512).optional(),
});

// ── Helper ────────────────────────────────────────────────────────────────

function getSession(
  request: Parameters<typeof requireRoles>[0] extends never
    ? never // trick
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any,
): SessionUser {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user: SessionUser | undefined = (request as any).session?.user;
  if (!user) throw Errors.unauthenticated();
  return user;
}

// ── Route registration ────────────────────────────────────────────────────

export async function identityRoutes(app: FastifyInstance): Promise<void> {
  declareRouteRoles("POST", "/v1/identity/mock-nin/verify", ["citizen"]);
  declareRouteRoles("POST", "/v1/identity/face-check/simulate", ["citizen"]);
  declareRouteRoles("GET", "/v1/identity/me", ["citizen"]);
  declareRouteRoles("POST", "/v1/applications", ["citizen"]);
  declareRouteRoles("GET", "/v1/applications", ["issuer"]);
  declareRouteRoles("POST", "/v1/applications/:id/decision", ["issuer"]);
  declareRouteRoles("GET", "/v1/credentials", ["citizen"]);

  // ── POST /v1/identity/mock-nin/verify ─────────────────────────────────
  app.post(
    "/v1/identity/mock-nin/verify",
    { preHandler: [requireRoles("citizen")] },
    async (request, reply) => {
      const session = getSession(request);
      const parsed = MockNinVerifyBody.safeParse(request.body);
      if (!parsed.success) throw Errors.validationError(parsed.error.message);

      const { nin } = parsed.data;

      // Only synthetic placeholder NINs are accepted (rule #2)
      const verified = SYNTHETIC_NINS.has(nin);

      await appendAuditEvent({
        actorId: session.userId,
        actorRole: session.role,
        type: "identity.mock_nin.verify",
        refId: `nin_check:${verified ? "pass" : "fail"}`,
      });

      // Never log or return the NIN value
      app.log.info(
        { reqId: request.id },
        `Mock NIN check: ${verified ? "pass" : "fail"}`,
      );

      return reply.send({
        verified,
        message: verified ? "NIN verified (synthetic)" : "NIN not recognised",
      });
    },
  );

  // ── POST /v1/identity/face-check/simulate ─────────────────────────────
  app.post(
    "/v1/identity/face-check/simulate",
    { preHandler: [requireRoles("citizen")] },
    async (request, reply) => {
      const session = getSession(request);
      const parsed = FaceCheckBody.safeParse(request.body);
      if (!parsed.success) throw Errors.validationError(parsed.error.message);

      // Simulated face check — always passes in demo (no real biometrics, rule #2)
      const result = {
        verified: true,
        confidence: 0.97,
        message: "Simulated face check passed (no real biometrics used)",
        _demo: true,
      };

      await appendAuditEvent({
        actorId: session.userId,
        actorRole: session.role,
        type: "identity.face_check.simulate",
        refId: "face:simulated",
      });

      return reply.send(result);
    },
  );

  // ── GET /v1/identity/me ───────────────────────────────────────────────
  app.get(
    "/v1/identity/me",
    { preHandler: [requireRoles("citizen")] },
    async (request, reply) => {
      const session = getSession(request);
      const db = getDb();

      const [user] = await db
        .select({
          id: users.id,
          role: users.role,
          stellar_address: users.stellar_address,
          created_at: users.created_at,
          synthetic_profile: users.synthetic_profile,
        })
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1);

      if (!user) throw Errors.unauthenticated("User not found.");

      // Return profile — NIN is part of synthetic_profile but that's intentional
      // for the demo citizen wallet; it is never logged or put on-chain.
      return reply.send({
        id: user.id,
        role: user.role,
        stellarAddress: user.stellar_address,
        createdAt: user.created_at,
        profile: user.synthetic_profile,
      });
    },
  );

  // ── POST /v1/applications ─────────────────────────────────────────────
  app.post(
    "/v1/applications",
    { preHandler: [requireRoles("citizen")] },
    async (request, reply) => {
      const session = getSession(request);
      const parsed = CreateApplicationBody.safeParse(request.body);
      if (!parsed.success) throw Errors.validationError(parsed.error.message);

      const db = getDb();

      // Verify issuer exists and is active
      const [issuer] = await db
        .select()
        .from(entities)
        .where(eq(entities.id, parsed.data.issuerId))
        .limit(1);

      if (!issuer || issuer.role !== "issuer") {
        throw Errors.issuerNotActive("Issuer not found.");
      }
      if (issuer.status !== "active") {
        throw Errors.issuerNotActive(`Issuer is ${issuer.status}.`);
      }

      const [app_record] = await db
        .insert(applications)
        .values({
          user_id: session.userId,
          issuer_id: parsed.data.issuerId,
          status: "pending",
        })
        .returning();

      await appendAuditEvent({
        actorId: session.userId,
        actorRole: session.role,
        type: "application.submitted",
        refId: app_record!.id,
      });

      app.log.info(
        { reqId: request.id, applicationId: app_record!.id },
        "Application submitted",
      );

      return reply.status(201).send({
        id: app_record!.id,
        status: app_record!.status,
        submittedAt: app_record!.submitted_at,
      });
    },
  );

  // ── GET /v1/applications ──────────────────────────────────────────────
  app.get(
    "/v1/applications",
    { preHandler: [requireRoles("issuer")] },
    async (request, reply) => {
      const session = getSession(request);
      const db = getDb();

      // Find the entity record for this issuer
      const [issuerEntity] = await db
        .select()
        .from(entities)
        .where(eq(entities.stellar_address, session.stellarAddress ?? ""))
        .limit(1);

      // If no stellar_address linked, return all applications for demo
      const rows = issuerEntity
        ? await db
            .select()
            .from(applications)
            .where(eq(applications.issuer_id, issuerEntity.id))
        : await db.select().from(applications);

      return reply.send({ applications: rows });
    },
  );

  // ── POST /v1/applications/:id/decision ───────────────────────────────
  app.post(
    "/v1/applications/:id/decision",
    { preHandler: [requireRoles("issuer")] },
    async (request, reply) => {
      const session = getSession(request);
      const { id } = request.params as { id: string };
      const parsed = ApplicationDecisionBody.safeParse(request.body);
      if (!parsed.success) throw Errors.validationError(parsed.error.message);

      const db = getDb();
      const [existing] = await db
        .select()
        .from(applications)
        .where(eq(applications.id, id))
        .limit(1);

      if (!existing) {
        throw Errors.validationError("Application not found.");
      }

      const [updated] = await db
        .update(applications)
        .set({
          status: parsed.data.decision,
          decided_at: new Date(),
        })
        .where(eq(applications.id, id))
        .returning();

      await appendAuditEvent({
        actorId: session.userId,
        actorRole: session.role,
        type: `application.${parsed.data.decision}`,
        refId: id,
      });

      app.log.info(
        { reqId: request.id, applicationId: id, decision: parsed.data.decision },
        "Application decision recorded",
      );

      return reply.send({
        id: updated!.id,
        status: updated!.status,
        decidedAt: updated!.decided_at,
      });
    },
  );

  // ── GET /v1/credentials ───────────────────────────────────────────────
  app.get(
    "/v1/credentials",
    { preHandler: [requireRoles("citizen")] },
    async (request, reply) => {
      const session = getSession(request);
      const db = getDb();

      const rows = await db
        .select({
          id: credentials.id,
          credentialHash: credentials.credential_hash,
          status: credentials.status,
          expiresAt: credentials.expires_at,
          chainTx: credentials.chain_tx,
          ledger: credentials.ledger,
          createdAt: credentials.created_at,
        })
        .from(credentials)
        .where(eq(credentials.user_id, session.userId));

      return reply.send({ credentials: rows });
    },
  );
}
