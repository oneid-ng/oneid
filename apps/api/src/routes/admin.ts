/**
 * routes/admin.ts — Admin health and simulation endpoints (README §14.1)
 *
 *   GET  /v1/admin/health            admin
 *   POST /v1/admin/simulate/failure  admin (FEATURE_SIMULATED_FAILURES flag)
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Errors } from "../plugins/errors.js";
import { declareRouteRoles, requireRoles } from "../plugins/role-guard.js";
import { getDb } from "../db/index.js";
import { chain_cursor } from "../db/schema.js";

// ── Zod schemas ───────────────────────────────────────────────────────────

const SimulateFailureBody = z.object({
  type: z.enum(["rpc_down", "tx_failure", "partial_sync"]),
});

// ── Route registration ────────────────────────────────────────────────────

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  declareRouteRoles("GET", "/v1/admin/health", ["admin"]);
  declareRouteRoles("POST", "/v1/admin/simulate/failure", ["admin"]);

  // ── GET /v1/admin/health ──────────────────────────────────────────────
  app.get(
    "/v1/admin/health",
    { preHandler: [requireRoles("admin")] },
    async (_request, reply) => {
      const db = getDb();

      // Indexer lag: fetch chain_cursor state
      const cursors = await db.select().from(chain_cursor);

      const indexerStatus = cursors.map((c) => ({
        contractId: c.contract_id,
        lastLedger: c.last_ledger,
        lastEventId: c.last_event_id,
      }));

      return reply.send({
        status: "ok",
        indexer: indexerStatus,
        featureFlags: {
          sep24Demo: process.env["FEATURE_SEP24_DEMO"] === "true",
          feeSponsorship: process.env["FEATURE_FEE_SPONSORSHIP"] === "true",
          simulatedFailures: process.env["FEATURE_SIMULATED_FAILURES"] === "true",
        },
      });
    },
  );

  // ── POST /v1/admin/simulate/failure ───────────────────────────────────
  app.post(
    "/v1/admin/simulate/failure",
    { preHandler: [requireRoles("admin")] },
    async (request, reply) => {
      if (process.env["FEATURE_SIMULATED_FAILURES"] !== "true") {
        throw Errors.forbiddenRole(
          "Simulated failures are disabled. Set FEATURE_SIMULATED_FAILURES=true.",
        );
      }

      const parsed = SimulateFailureBody.safeParse(request.body);
      if (!parsed.success) throw Errors.validationError(parsed.error.message);

      const { type } = parsed.data;

      switch (type) {
        case "rpc_down":
          throw Errors.chainUnavailable("[SIMULATED] RPC is down.");
        case "tx_failure":
          throw Errors.chainTxFailed("[SIMULATED] Transaction failed.");
        case "partial_sync":
          return reply.status(207).send({
            _simulated: true,
            type: "partial_sync",
            message: "Simulated partial sync: some institutions updated, some failed.",
          });
        default:
          throw Errors.validationError("Unknown simulation type.");
      }
    },
  );
}
