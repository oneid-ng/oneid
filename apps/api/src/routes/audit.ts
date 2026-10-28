/**
 * routes/audit.ts — Audit timeline endpoints (README §14.1)
 *
 *   GET /v1/audit/timeline   citizen  (own events only)
 *   GET /v1/audit/events     admin    (system-wide)
 */

import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { Errors } from "../plugins/errors.js";
import {
  declareRouteRoles,
  requireRoles,
  type SessionUser,
} from "../plugins/role-guard.js";
import { getDb } from "../db/index.js";
import { audit_events } from "../db/schema.js";
import { verifyAuditChain } from "../lib/audit.js";

// ── Helper ────────────────────────────────────────────────────────────────

function getSession(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request: any,
): SessionUser {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user: SessionUser | undefined = (request as any).session?.user;
  if (!user) throw Errors.unauthenticated();
  return user;
}

// ── Route registration ────────────────────────────────────────────────────

export async function auditRoutes(app: FastifyInstance): Promise<void> {
  declareRouteRoles("GET", "/v1/audit/timeline", ["citizen"]);
  declareRouteRoles("GET", "/v1/audit/events", ["admin"]);

  // ── GET /v1/audit/timeline ────────────────────────────────────────────
  app.get(
    "/v1/audit/timeline",
    { preHandler: [requireRoles("citizen")] },
    async (request, reply) => {
      const session = getSession(request);
      const db = getDb();

      const events = await db
        .select({
          id: audit_events.id,
          type: audit_events.type,
          refId: audit_events.ref_id,
          chainTx: audit_events.chain_tx,
          hash: audit_events.hash,
          createdAt: audit_events.created_at,
        })
        .from(audit_events)
        .where(eq(audit_events.actor_id, session.userId))
        .orderBy(audit_events.created_at);

      return reply.send({ events });
    },
  );

  // ── GET /v1/audit/events ──────────────────────────────────────────────
  app.get(
    "/v1/audit/events",
    { preHandler: [requireRoles("admin")] },
    async (_request, reply) => {
      const db = getDb();

      const events = await db
        .select()
        .from(audit_events)
        .orderBy(audit_events.created_at);

      // Also return chain integrity status
      const integrity = await verifyAuditChain();

      return reply.send({ events, integrity });
    },
  );
}
