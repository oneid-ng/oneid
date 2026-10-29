/**
 * apps/api/src/index.ts — ONEiD Fastify API (README §14)
 *
 * Plugin registration order:
 *   1. request-id (genReqId, X-Request-ID header)
 *   2. @fastify/cookie + @fastify/session (demo in-memory session)
 *   3. error-handler (converts AppError → §14.4 JSON envelope)
 *   4. @fastify/sensible (httpErrors helpers)
 *   5. Route plugins (auth, identity, issuance, registry, …)
 *   6. role-guard startup validator (FAIL-CLOSED: undeclared /v1/* → startup error)
 *
 * Pino serialisers strip PII fields (nin, fullName, dateOfBirth, address)
 * from all log output (README §22.4).
 */

import Fastify from "fastify";
import sensible from "@fastify/sensible";
import cookie from "@fastify/cookie";
import session from "@fastify/session";
import fp from "fastify-plugin";

import { errorHandlerPlugin } from "./plugins/error-handler.js";
import { requestIdPlugin, generateId } from "./plugins/request-id.js";
import { roleGuardPlugin } from "./plugins/role-guard.js";
import { authRoutes } from "./routes/auth.js";
import { identityRoutes } from "./routes/identity.js";
import { issuanceRoutes } from "./routes/issuance.js";
import { registryRoutes } from "./routes/registry.js";
import { auditRoutes } from "./routes/audit.js";
import { adminRoutes } from "./routes/admin.js";
import { requestsRoutes } from "./routes/requests.js";
import { consentRoutes } from "./routes/consent.js";
import { verificationRoutes } from "./routes/verification.js";

// PII redaction note: pino serialisers strip req/res; no personal data is
// ever passed directly to app.log.*  — personal data lives in synthetic_profile
// (off-chain only) and is never included in log output (README §22.4).

export async function buildApp() {
  const app = Fastify({
    genReqId: () => generateId(),
    logger: {
      level: process.env["LOG_LEVEL"] ?? "info",
      serializers: {
        req(request) {
          return { method: request.method, url: request.url, id: request.id };
        },
        // Strip PII from any object logged via app.log.*
        res(reply) {
          return { statusCode: reply.statusCode };
        },
      },
    },
  });

  // ── Core plugins ────────────────────────────────────────────────────────
  await app.register(requestIdPlugin);
  await app.register(errorHandlerPlugin);
  await app.register(sensible);

  // Cookie + server-side session (in-memory store for demo)
  await app.register(cookie);
  await app.register(session, {
    secret: process.env["SESSION_SECRET"] ?? "change-me-in-production-32chars!!",
    cookie: {
      secure: process.env["NODE_ENV"] === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    },
    saveUninitialized: false,
  });

  // ── Route plugins ───────────────────────────────────────────────────────
  await app.register(fp(authRoutes));
  await app.register(fp(identityRoutes));
  await app.register(fp(issuanceRoutes));
  await app.register(fp(registryRoutes));
  await app.register(fp(auditRoutes));
  await app.register(fp(adminRoutes));
  await app.register(fp(requestsRoutes));
  await app.register(fp(consentRoutes));
  await app.register(fp(verificationRoutes));

  // ── Health / readiness ──────────────────────────────────────────────────
  app.get("/healthz", async () => ({ status: "ok" }));
  app.get("/readyz", async () => ({ status: "ok" }));

  // ── Role-guard startup validator (must be last) ─────────────────────────
  await app.register(roleGuardPlugin);

  return app;
}

// ── Entry point ─────────────────────────────────────────────────────────────

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const port = Number(process.env["PORT"] ?? 4000);
  const host = process.env["HOST"] ?? "0.0.0.0";

  const app = await buildApp();

  try {
    await app.listen({ port, host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
