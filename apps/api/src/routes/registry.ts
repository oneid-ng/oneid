/**
 * routes/registry.ts — Issuer/verifier registry endpoints (README §14.1)
 *
 *   GET  /v1/registry/entities             public (any authenticated role)
 *   POST /v1/registry/entities             admin
 *   PATCH /v1/registry/entities/:addr/status  admin
 *
 * Registry changes go through the issuer-registry Soroban contract AND
 * are mirrored in the local DB via the indexer (README §14.5).
 * Every action writes an audit event (README §15).
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
import { entities } from "../db/schema.js";
import { appendAuditEvent } from "../lib/audit.js";
import { submitTransaction, resolveNetwork, getRpcServer } from "@oneid/stellar";
import { Keypair } from "@stellar/stellar-sdk";

// ── Zod schemas ───────────────────────────────────────────────────────────

const RegisterEntityBody = z.object({
  stellarAddress: z.string().min(1),
  role: z.enum(["issuer", "verifier"]),
  name: z.string().min(1).max(256),
  homeDomain: z.string().min(1).max(253),
});

const UpdateEntityStatusBody = z.object({
  status: z.enum(["active", "suspended", "removed"]),
});

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

export async function registryRoutes(app: FastifyInstance): Promise<void> {
  declareRouteRoles("GET", "/v1/registry/entities", [
    "citizen",
    "issuer",
    "verifier",
    "admin",
  ]);
  declareRouteRoles("POST", "/v1/registry/entities", ["admin"]);
  declareRouteRoles("PATCH", "/v1/registry/entities/:addr/status", ["admin"]);

  // ── GET /v1/registry/entities ─────────────────────────────────────────
  app.get(
    "/v1/registry/entities",
    {
      preHandler: [requireRoles("citizen", "issuer", "verifier", "admin")],
    },
    async (_request, reply) => {
      const db = getDb();
      const rows = await db
        .select({
          id: entities.id,
          stellarAddress: entities.stellar_address,
          role: entities.role,
          name: entities.name,
          homeDomain: entities.home_domain,
          status: entities.status,
          createdAt: entities.created_at,
        })
        .from(entities);

      return reply.send({ entities: rows });
    },
  );

  // ── POST /v1/registry/entities ────────────────────────────────────────
  app.post(
    "/v1/registry/entities",
    { preHandler: [requireRoles("admin")] },
    async (request, reply) => {
      const session = getSession(request);
      const parsed = RegisterEntityBody.safeParse(request.body);
      if (!parsed.success) throw Errors.validationError(parsed.error.message);

      const { stellarAddress, role, name, homeDomain } = parsed.data;
      const db = getDb();

      // Insert into DB
      const [entity] = await db
        .insert(entities)
        .values({
          stellar_address: stellarAddress,
          role,
          name,
          home_domain: homeDomain,
          status: "active",
        })
        .returning();

      // Register on-chain via issuer-registry contract
      let chainTx: string | null = null;
      try {
        const network = resolveNetwork();
        const rpc = getRpcServer(network);
        const adminSecret = process.env["PLATFORM_ADMIN_SECRET"] ?? "";

        if (adminSecret) {
          const adminKp = Keypair.fromSecret(adminSecret);
          const result = await submitTransaction({
            rpc,
            network,
            sourceKeypair: adminKp,
            contractId: process.env["ISSUER_REGISTRY_ID"] ?? "",
            method: "register",
            args: {
              entity: {
                address: stellarAddress,
                role: role === "issuer" ? { Issuer: {} } : { Verifier: {} },
                name,
                home_domain: homeDomain,
                status: { Active: {} },
                registered_at: Math.floor(Date.now() / 1000),
              },
            },
          });
          chainTx = result.txHash ?? null;
        }
      } catch (err) {
        app.log.warn(
          { reqId: request.id },
          `Registry on-chain registration failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      await appendAuditEvent({
        actorId: session.userId,
        actorRole: session.role,
        type: "registry.entity.registered",
        refId: stellarAddress,
        chainTx: chainTx ?? null,
      });

      app.log.info({ reqId: request.id, stellarAddress, role }, "Entity registered");

      return reply.status(201).send({
        id: entity!.id,
        stellarAddress: entity!.stellar_address,
        role: entity!.role,
        name: entity!.name,
        status: entity!.status,
        chainTx,
      });
    },
  );

  // ── PATCH /v1/registry/entities/:addr/status ──────────────────────────
  app.patch(
    "/v1/registry/entities/:addr/status",
    { preHandler: [requireRoles("admin")] },
    async (request, reply) => {
      const session = getSession(request);
      const { addr } = request.params as { addr: string };
      const parsed = UpdateEntityStatusBody.safeParse(request.body);
      if (!parsed.success) throw Errors.validationError(parsed.error.message);

      const { status } = parsed.data;
      const db = getDb();

      const [existing] = await db
        .select()
        .from(entities)
        .where(eq(entities.stellar_address, addr))
        .limit(1);

      if (!existing) {
        throw Errors.validationError("Entity not found.");
      }

      // Update DB
      await db.update(entities).set({ status }).where(eq(entities.stellar_address, addr));

      // Update on-chain
      let chainTx: string | null = null;
      try {
        const network = resolveNetwork();
        const rpc = getRpcServer(network);
        const adminSecret = process.env["PLATFORM_ADMIN_SECRET"] ?? "";

        if (adminSecret) {
          const adminKp = Keypair.fromSecret(adminSecret);
          const sorobanStatus =
            status === "active"
              ? { Active: {} }
              : status === "suspended"
                ? { Suspended: {} }
                : { Removed: {} };

          const result = await submitTransaction({
            rpc,
            network,
            sourceKeypair: adminKp,
            contractId: process.env["ISSUER_REGISTRY_ID"] ?? "",
            method: "set_status",
            args: { addr, status: sorobanStatus },
          });
          chainTx = result.txHash ?? null;
        }
      } catch (err) {
        app.log.warn(
          { reqId: request.id },
          `Registry status update on-chain failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      await appendAuditEvent({
        actorId: session.userId,
        actorRole: session.role,
        type: `registry.entity.status_changed`,
        refId: `${addr}:${status}`,
        chainTx: chainTx ?? null,
      });

      app.log.info({ reqId: request.id, addr, status }, "Entity status updated");

      return reply.send({ stellarAddress: addr, status, chainTx });
    },
  );
}
