/**
 * plugins/role-guard.ts — Fail-closed role-based access control.
 *
 * Implements the EXACT permission matrix from README §19:
 *
 *   citizen  → register identity, apply for credential, approve/deny/withdraw
 *              consent, submit correction, view own audit timeline
 *   issuer   → review applications, issue/revoke credentials (own only),
 *              respond to corrections (own status only)
 *   verifier → request claims, verify presentations, respond to corrections
 *              (own status only)
 *   admin    → manage registry, view system-wide audit
 *   public   → no auth required (auth endpoints)
 *
 * FAIL-CLOSED design (README §5, rule #5):
 * - A route with no declared roles is REJECTED at startup.
 * - Missing session → UNAUTHENTICATED (401).
 * - Wrong role → FORBIDDEN_ROLE (403).
 */

import fp from "fastify-plugin";
import type {
  FastifyInstance,
  FastifyRequest,
  FastifyReply,
  preHandlerHookHandler,
} from "fastify";
import { Errors } from "./errors.js";

// ── Session type ────────────────────────────────────────────────────────

export interface SessionUser {
  userId: string;
  role: string;
  stellarAddress?: string;
}

// ── Public sentinel ──────────────────────────────────────────────────────

export const PUBLIC = "public" as const;
export type RouteAccess = typeof PUBLIC | string[];

// ── Route registry (startup validation) ─────────────────────────────────

const _routeRegistry = new Map<string, RouteAccess>();

/**
 * Declare the allowed roles for a route.
 * Call before registering the route.
 */
export function declareRouteRoles(
  method: string,
  path: string,
  access: RouteAccess,
): void {
  const key = `${method.toUpperCase()}:${path}`;
  _routeRegistry.set(key, access);
}

/** Expose for tests */
export function getRouteRegistry(): Map<string, RouteAccess> {
  return _routeRegistry;
}

// ── requireRoles hook factory ────────────────────────────────────────────

/**
 * Returns a preHandler that enforces role access.
 *
 *   app.get('/v1/foo', { preHandler: requireRoles('issuer', 'admin') }, handler)
 */
export function requireRoles(...roles: string[]): preHandlerHookHandler {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user: SessionUser | undefined = (request as any).session?.user;

    if (!user) {
      throw Errors.unauthenticated();
    }

    if (!roles.includes(user.role)) {
      throw Errors.forbiddenRole(
        `Role '${user.role}' is not allowed. Required: ${roles.join(", ")}.`,
      );
    }
  };
}

/**
 * Returns a preHandler that only requires any valid session.
 * Used for routes like POST /v1/auth/logout.
 */
export function requireAuthenticated(): preHandlerHookHandler {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user: SessionUser | undefined = (request as any).session?.user;
    if (!user) {
      throw Errors.unauthenticated();
    }
  };
}

// ── Startup validator plugin ─────────────────────────────────────────────

/**
 * After all routes are registered, verify every /v1/* route has a declared
 * access policy. Throws at startup if any route is undeclared.
 */
export const roleGuardPlugin = fp(
  async (app: FastifyInstance) => {
    app.addHook("onReady", async () => {
      const routeLines = app.printRoutes({ commonPrefix: false });

      const undeclared: string[] = [];

      for (const line of routeLines.split("\n")) {
        // Match lines like "GET    /v1/foo"
        const match = line.match(
          /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b\s+(\/v1\/[^\s]+)/,
        );
        if (!match) continue;

        const method = match[1]!;
        const path = match[2]!;
        const key = `${method}:${path}`;

        if (!_routeRegistry.has(key)) {
          undeclared.push(key);
        }
      }

      if (undeclared.length > 0) {
        throw new Error(
          `[role-guard] FAIL-CLOSED: /v1/* routes with no declared access policy:\n` +
            undeclared.map((r) => `  ${r}`).join("\n") +
            `\n→ Call declareRouteRoles() before registering each route.`,
        );
      }
    });
  },
  { name: "role-guard" },
);
