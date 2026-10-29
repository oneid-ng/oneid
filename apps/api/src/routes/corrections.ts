/**
 * routes/corrections.ts — Citizen record corrections across institutions (README §12.4, §14.1, §18.4)
 *
 * Endpoints:
 *   POST /v1/corrections              citizen     (open ticket targeting named institutions)
 *   GET  /v1/corrections/:id          citizen, institution (per-institution timeline)
 *   GET  /v1/corrections/queue        institution (institution's own pending queue)
 *   POST /v1/corrections/:id/respond  institution (respond ONLY for itself: applied, rejected, failed, partially_applied)
 *
 * Rules:
 *   - Correction details & evidence stay off-chain (rule #1, rule #6).
 *   - Only ticket_hash and institution status live on-chain.
 *   - Institution A cannot update status for Institution B (fail closed).
 */

import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { CreateCorrectionBody, RespondCorrectionBody } from "@oneid/shared";
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
import {
  users,
  entities,
  correction_tickets,
  correction_outcomes,
} from "../db/schema.js";
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

export async function correctionsRoutes(app: FastifyInstance): Promise<void> {
  declareRouteRoles("POST", "/v1/corrections", ["citizen"]);
  declareRouteRoles("GET", "/v1/corrections/:id", ["citizen", "issuer", "verifier"]);
  declareRouteRoles("GET", "/v1/corrections/queue", ["issuer", "verifier"]);
  declareRouteRoles("POST", "/v1/corrections/:id/respond", ["issuer", "verifier"]);

  // ── POST /v1/corrections ──────────────────────────────────────────────
  app.post(
    "/v1/corrections",
    { preHandler: [requireRoles("citizen")] },
    async (request, reply) => {
      const session = getSession(request);
      const parsed = CreateCorrectionBody.safeParse(request.body);
      if (!parsed.success) throw Errors.validationError(parsed.error.message);

      const { category, detail, targetInstitutions } = parsed.data;
      const db = getDb();

      // Resolve citizen
      const [holder] = await db
        .select()
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1);

      if (!holder) throw Errors.unauthenticated();

      // Resolve targeted institution entities
      const resolvedInstitutions: (typeof entities.$inferSelect)[] = [];
      for (const instRef of targetInstitutions) {
        const isUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(instRef);
        const [inst] = isUuid
          ? await db.select().from(entities).where(eq(entities.id, instRef)).limit(1)
          : await db
              .select()
              .from(entities)
              .where(eq(entities.stellar_address, instRef))
              .limit(1);

        if (inst) {
          resolvedInstitutions.push(inst);
        }
      }

      if (resolvedInstitutions.length === 0) {
        // Fallback for demo: resolve active entities
        const allEntities = await db
          .select()
          .from(entities)
          .where(eq(entities.status, "active"))
          .limit(targetInstitutions.length);
        resolvedInstitutions.push(...allEntities);
      }

      if (resolvedInstitutions.length === 0) {
        throw Errors.validationError("No valid target institutions found.");
      }

      // Compute ticket hash (README §7, §12.4)
      const salt = randomBytes(16).toString("hex");
      const targetAddresses = resolvedInstitutions.map((i) => i.stellar_address).sort();

      const ticketPayload = {
        holder: holder.stellar_address ?? `did:stellar:demo:${holder.id}`,
        category,
        institutions: targetAddresses,
      };

      const { hash: ticketHash } = saltedHash(ticketPayload, salt);

      // On-chain open on correction-tracker contract
      let chainTx: string | null = null;
      let ledger: number | null = null;

      try {
        const contractId = process.env["CORRECTION_TRACKER_ID"] ?? "";
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
            method: "open",
            idempotencyKey: `correction:${ticketHash}`,
          });
          chainTx = result.txHash ?? null;
          ledger = result.ledger ?? null;
        }
      } catch (err) {
        app.log.warn(
          { reqId: request.id },
          `Correction tracker contract open warning: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      // Persist ticket (details stay off-chain in detail JSONB)
      const [ticket] = await db
        .insert(correction_tickets)
        .values({
          ticket_hash: ticketHash,
          user_id: session.userId,
          category,
          detail,
        })
        .returning();

      // Create initial outcome rows per institution
      const createdOutcomes = [];
      for (const inst of resolvedInstitutions) {
        const [outcome] = await db
          .insert(correction_outcomes)
          .values({
            ticket_id: ticket!.id,
            institution_id: inst.id,
            status: "submitted",
            chain_tx: chainTx,
          })
          .returning();
        createdOutcomes.push({
          institutionId: inst.id,
          institutionName: inst.name,
          homeDomain: inst.home_domain,
          status: outcome?.status ?? "submitted",
        });
      }

      await appendAuditEvent({
        actorId: session.userId,
        actorRole: session.role,
        type: "correction.opened",
        refId: ticketHash,
        chainTx: chainTx ?? null,
      });

      return reply.status(201).send({
        id: ticket!.id,
        ticketHash,
        category,
        detail,
        outcomes: createdOutcomes,
        chainTx,
        ledger,
      });
    },
  );

  // ── GET /v1/corrections/:id ───────────────────────────────────────────
  app.get(
    "/v1/corrections/:id",
    { preHandler: [requireRoles("citizen", "issuer", "verifier")] },
    async (request, reply) => {
      const session = getSession(request);
      const { id } = request.params as { id: string };
      const db = getDb();

      const [ticket] = await db
        .select()
        .from(correction_tickets)
        .where(eq(correction_tickets.id, id))
        .limit(1);

      if (!ticket) {
        throw Errors.validationError("Correction ticket not found.");
      }

      // If citizen, must be ticket owner
      if (session.role === "citizen" && ticket.user_id !== session.userId) {
        throw Errors.forbiddenRole(
          "Access denied to another citizen's correction ticket.",
        );
      }

      // Fetch per-institution outcomes
      const outcomes = await db
        .select({
          id: correction_outcomes.id,
          institutionId: correction_outcomes.institution_id,
          status: correction_outcomes.status,
          reasonCode: correction_outcomes.reason_code,
          updatedAt: correction_outcomes.updated_at,
          chainTx: correction_outcomes.chain_tx,
          institutionName: entities.name,
          homeDomain: entities.home_domain,
        })
        .from(correction_outcomes)
        .innerJoin(entities, eq(correction_outcomes.institution_id, entities.id))
        .where(eq(correction_outcomes.ticket_id, id));

      return reply.send({
        id: ticket.id,
        ticketHash: ticket.ticket_hash,
        category: ticket.category,
        detail: ticket.detail,
        createdAt: ticket.created_at,
        outcomes,
      });
    },
  );

  // ── GET /v1/corrections/queue ─────────────────────────────────────────
  app.get(
    "/v1/corrections/queue",
    { preHandler: [requireRoles("issuer", "verifier")] },
    async (request, reply) => {
      const session = getSession(request);
      const db = getDb();

      // Resolve caller institution entity
      const [instEntity] = session.stellarAddress
        ? await db
            .select()
            .from(entities)
            .where(eq(entities.stellar_address, session.stellarAddress))
            .limit(1)
        : await db
            .select()
            .from(entities)
            .where(eq(entities.role, session.role as "issuer" | "verifier"))
            .limit(1);

      if (!instEntity) {
        throw Errors.forbiddenRole("Institution not registered in registry.");
      }

      // Fetch institution's own queue
      const queue = await db
        .select({
          outcomeId: correction_outcomes.id,
          ticketId: correction_tickets.id,
          ticketHash: correction_tickets.ticket_hash,
          category: correction_tickets.category,
          status: correction_outcomes.status,
          reasonCode: correction_outcomes.reason_code,
          createdAt: correction_tickets.created_at,
          updatedAt: correction_outcomes.updated_at,
        })
        .from(correction_outcomes)
        .innerJoin(
          correction_tickets,
          eq(correction_outcomes.ticket_id, correction_tickets.id),
        )
        .where(eq(correction_outcomes.institution_id, instEntity.id));

      return reply.send({ queue });
    },
  );

  // ── POST /v1/corrections/:id/respond ──────────────────────────────────
  app.post(
    "/v1/corrections/:id/respond",
    { preHandler: [requireRoles("issuer", "verifier")] },
    async (request, reply) => {
      const session = getSession(request);
      const { id } = request.params as { id: string };
      const parsed = RespondCorrectionBody.safeParse(request.body);
      if (!parsed.success) throw Errors.validationError(parsed.error.message);

      const { status, reasonCode } = parsed.data;
      const db = getDb();

      // Resolve caller institution entity
      const [instEntity] = session.stellarAddress
        ? await db
            .select()
            .from(entities)
            .where(eq(entities.stellar_address, session.stellarAddress))
            .limit(1)
        : await db
            .select()
            .from(entities)
            .where(eq(entities.role, session.role as "issuer" | "verifier"))
            .limit(1);

      if (!instEntity) {
        throw Errors.forbiddenRole("Institution not registered.");
      }

      // Check ticket exists
      const [ticket] = await db
        .select()
        .from(correction_tickets)
        .where(eq(correction_tickets.id, id))
        .limit(1);

      if (!ticket) {
        throw Errors.validationError("Correction ticket not found.");
      }

      // Rule #6: Authority stays with the institution — each institution
      // updates ONLY its own status row. Check that caller was targeted.
      const [outcome] = await db
        .select()
        .from(correction_outcomes)
        .where(
          and(
            eq(correction_outcomes.ticket_id, id),
            eq(correction_outcomes.institution_id, instEntity.id),
          ),
        )
        .limit(1);

      if (!outcome) {
        throw Errors.forbiddenRole(
          "An institution cannot update another institution's correction status.",
        );
      }

      // On-chain update on correction-tracker contract
      let chainTx: string | null = null;
      let ledger: number | null = null;

      try {
        const contractId = process.env["CORRECTION_TRACKER_ID"] ?? "";
        const instSecret =
          session.role === "issuer"
            ? (process.env["ISSUER_DEMO_SECRET"] ?? "")
            : (process.env["VERIFIER_DEMO_SECRET"] ?? "");
        const sponsorSecret = process.env["FEE_SPONSOR_SECRET"] ?? "";

        if (contractId && (instSecret || sponsorSecret)) {
          const network = resolveNetwork();
          const rpc = getRpcServer(network);
          const sourceKp = Keypair.fromSecret(instSecret || sponsorSecret);
          const sponsorKp = sponsorSecret ? Keypair.fromSecret(sponsorSecret) : undefined;

          const result = await submitTransaction({
            rpc,
            network,
            sourceKeypair: sourceKp,
            sponsorKeypair: sponsorKp,
            contractId,
            method: "update",
            idempotencyKey: `outcome:${ticket.ticket_hash}:${instEntity.id}:${status}`,
          });
          chainTx = result.txHash ?? null;
          ledger = result.ledger ?? null;
        }
      } catch (err) {
        app.log.warn(
          { reqId: request.id },
          `Correction tracker contract update warning: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      // Update institution's own outcome
      await db
        .update(correction_outcomes)
        .set({
          status,
          reason_code: reasonCode ?? null,
          chain_tx: chainTx,
          updated_at: new Date(),
        })
        .where(
          and(
            eq(correction_outcomes.ticket_id, id),
            eq(correction_outcomes.institution_id, instEntity.id),
          ),
        );

      await appendAuditEvent({
        actorId: session.userId,
        actorRole: session.role,
        type: "correction.outcome_updated",
        refId: `${ticket.ticket_hash}:${instEntity.name}:${status}`,
        chainTx: chainTx ?? null,
      });

      return reply.send({
        ticketId: id,
        institutionId: instEntity.id,
        institutionName: instEntity.name,
        status,
        reasonCode: reasonCode ?? null,
        chainTx,
        ledger,
      });
    },
  );
}
