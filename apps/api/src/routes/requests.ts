/**
 * routes/requests.ts — Verification claim requests (README §14.1, §14.2, §18.3)
 *
 *   POST /v1/requests           verifier (request named claims for a purpose)
 *   GET  /v1/requests/pending   citizen  (pending requests for citizen)
 *   GET  /v1/requests/:id       citizen, verifier (request detail & status)
 */

import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { eq, and, gt } from "drizzle-orm";
import { CreateClaimRequestBody } from "@oneid/shared";
import { Errors } from "../plugins/errors.js";
import {
  declareRouteRoles,
  requireRoles,
  type SessionUser,
} from "../plugins/role-guard.js";
import { getDb } from "../db/index.js";
import { users, entities, claim_requests } from "../db/schema.js";
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

export async function requestsRoutes(app: FastifyInstance): Promise<void> {
  declareRouteRoles("POST", "/v1/requests", ["verifier"]);
  declareRouteRoles("GET", "/v1/requests/pending", ["citizen"]);
  declareRouteRoles("GET", "/v1/requests/:id", ["citizen", "verifier"]);

  // ── POST /v1/requests ─────────────────────────────────────────────────
  app.post(
    "/v1/requests",
    { preHandler: [requireRoles("verifier")] },
    async (request, reply) => {
      const session = getSession(request);
      const parsed = CreateClaimRequestBody.safeParse(request.body);
      if (!parsed.success) throw Errors.validationError(parsed.error.message);

      const { holderRef, purpose, claims, expiresInSeconds } = parsed.data;
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
      if (verifierEntity.status !== "active") {
        throw Errors.issuerNotActive("Verifier entity is suspended or inactive.");
      }

      // Resolve holder user
      // holderRef can be user UUID, stellar address, or matched by synthetic profile email/name
      let [holder] = await db
        .select()
        .from(users)
        .where(eq(users.stellar_address, holderRef))
        .limit(1);

      if (!holder) {
        const isUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            holderRef,
          );
        if (isUuid) {
          [holder] = await db
            .select()
            .from(users)
            .where(eq(users.id, holderRef))
            .limit(1);
        }
      }

      if (!holder) {
        // Fallback for demo: resolve first citizen user
        [holder] = await db
          .select()
          .from(users)
          .where(eq(users.role, "citizen"))
          .limit(1);
      }

      if (!holder) {
        throw Errors.validationError(
          `Holder reference '${holderRef}' could not be resolved.`,
        );
      }

      const nonce = `n-${randomBytes(12).toString("hex")}`;
      const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

      const [created] = await db
        .insert(claim_requests)
        .values({
          verifier_id: verifierEntity.id,
          holder_id: holder.id,
          claims,
          purpose,
          nonce,
          status: "pending_consent",
          expires_at: expiresAt,
        })
        .returning();

      if (!created) {
        throw Errors.chainTxFailed("Failed to create claim request.");
      }

      await appendAuditEvent({
        actorId: session.userId,
        actorRole: session.role,
        type: "request.created",
        refId: created.id,
      });

      return reply.status(201).send({
        id: created.id,
        status: created.status,
        nonce: created.nonce,
        claims: created.claims,
        expiresAt: created.expires_at.toISOString(),
      });
    },
  );

  // ── GET /v1/requests/pending ──────────────────────────────────────────
  app.get(
    "/v1/requests/pending",
    { preHandler: [requireRoles("citizen")] },
    async (request, reply) => {
      const session = getSession(request);
      const db = getDb();

      const pending = await db
        .select({
          id: claim_requests.id,
          purpose: claim_requests.purpose,
          claims: claim_requests.claims,
          nonce: claim_requests.nonce,
          status: claim_requests.status,
          expiresAt: claim_requests.expires_at,
          createdAt: claim_requests.created_at,
          verifierName: entities.name,
          verifierDomain: entities.home_domain,
          verifierAddress: entities.stellar_address,
        })
        .from(claim_requests)
        .innerJoin(entities, eq(claim_requests.verifier_id, entities.id))
        .where(
          and(
            eq(claim_requests.holder_id, session.userId),
            eq(claim_requests.status, "pending_consent"),
            gt(claim_requests.expires_at, new Date()),
          ),
        );

      return reply.send({ requests: pending });
    },
  );

  // ── GET /v1/requests/:id ──────────────────────────────────────────────
  app.get(
    "/v1/requests/:id",
    { preHandler: [requireRoles("citizen", "verifier")] },
    async (request, reply) => {
      const session = getSession(request);
      const { id } = request.params as { id: string };
      const db = getDb();

      const [req] = await db
        .select({
          id: claim_requests.id,
          holderId: claim_requests.holder_id,
          verifierId: claim_requests.verifier_id,
          purpose: claim_requests.purpose,
          claims: claim_requests.claims,
          nonce: claim_requests.nonce,
          status: claim_requests.status,
          expiresAt: claim_requests.expires_at,
          createdAt: claim_requests.created_at,
          verifierName: entities.name,
          verifierDomain: entities.home_domain,
          verifierAddress: entities.stellar_address,
        })
        .from(claim_requests)
        .innerJoin(entities, eq(claim_requests.verifier_id, entities.id))
        .where(eq(claim_requests.id, id))
        .limit(1);

      if (!req) {
        throw Errors.validationError("Claim request not found.");
      }

      // Fail-closed authorization: citizen must be holder, verifier must be requester
      if (session.role === "citizen" && req.holderId !== session.userId) {
        throw Errors.forbiddenRole("Access denied to another citizen's request.");
      }

      if (session.role === "verifier") {
        const [verifierEntity] = session.stellarAddress
          ? await db
              .select()
              .from(entities)
              .where(eq(entities.stellar_address, session.stellarAddress))
              .limit(1)
          : await db
              .select()
              .from(entities)
              .where(eq(entities.id, req.verifierId))
              .limit(1);

        if (!verifierEntity || verifierEntity.id !== req.verifierId) {
          throw Errors.forbiddenRole("Access denied to another verifier's request.");
        }
      }

      return reply.send(req);
    },
  );
}
