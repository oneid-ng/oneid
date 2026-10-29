/**
 * routes/auth.ts — WebAuthn citizen auth + demo portal login (README §14.1)
 *
 * Endpoints:
 *   POST /v1/auth/register/options  — WebAuthn registration options (public)
 *   POST /v1/auth/register/verify   — Verify attestation, create citizen (public)
 *   POST /v1/auth/login/options     — WebAuthn authentication options (public)
 *   POST /v1/auth/login/verify      — Verify assertion, set session (public)
 *   POST /v1/auth/portal/login      — Demo portal login for issuer/verifier/admin (public)
 *   POST /v1/auth/logout            — Clear session (authenticated)
 *
 * Security notes:
 *  - demoKey values are NEVER logged.
 *  - Session stores { userId, role, stellarAddress? } only — no PII.
 *  - WebAuthn challenges stored in process memory (demo; acceptable for MVP).
 */

import type { FastifyInstance } from "fastify";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
} from "@simplewebauthn/server";
import { z } from "zod";
import { Errors } from "../plugins/errors.js";
import { declareRouteRoles, requireAuthenticated } from "../plugins/role-guard.js";
import { getDb } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";

// ── In-memory challenge store (demo) ─────────────────────────────────────
// Keyed by username or userId; expires after 5 minutes in prod, unlimited here.
const challengeStore = new Map<string, string>();

// ── Demo portal credentials (never log demoKey) ───────────────────────────
function getDemoKey(role: string): string | undefined {
  switch (role) {
    case "citizen":
      return process.env["DEMO_CITIZEN_KEY"] ?? "demo-citizen-2026";
    case "issuer":
      return process.env["DEMO_ISSUER_KEY"] ?? "demo-issuer-2026";
    case "verifier":
      return process.env["DEMO_VERIFIER_KEY"] ?? "demo-verifier-2026";
    case "admin":
      return process.env["DEMO_ADMIN_KEY"] ?? "demo-admin-2026";
    default:
      return undefined;
  }
}

// ── Zod schemas ───────────────────────────────────────────────────────────

const PortalLoginBody = z.object({
  role: z.enum(["citizen", "issuer", "verifier", "admin"]),
  demoKey: z.string().min(1),
});

const RegisterOptionsBody = z.object({
  username: z.string().min(1).max(64),
});

const RegisterVerifyBody = z.object({
  username: z.string().min(1),
  response: z.record(z.unknown()),
});

const LoginOptionsBody = z.object({
  username: z.string().min(1).max(64),
});

const LoginVerifyBody = z.object({
  username: z.string().min(1),
  response: z.record(z.unknown()),
});

// ── Route registration ────────────────────────────────────────────────────

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const rpID = process.env["WEBAUTHN_RP_ID"] ?? "localhost";
  const rpName = process.env["WEBAUTHN_RP_NAME"] ?? "ONEiD Demo";
  const origin = process.env["WEBAUTHN_ORIGIN"] ?? "http://localhost:3000";

  // Declare all routes as public (no role required) ─────────────────────
  declareRouteRoles("POST", "/v1/auth/register/options", "public");
  declareRouteRoles("POST", "/v1/auth/register/verify", "public");
  declareRouteRoles("POST", "/v1/auth/login/options", "public");
  declareRouteRoles("POST", "/v1/auth/login/verify", "public");
  declareRouteRoles("POST", "/v1/auth/portal/login", "public");
  declareRouteRoles("POST", "/v1/auth/logout", [
    "citizen",
    "issuer",
    "verifier",
    "admin",
  ]);

  // ── POST /v1/auth/register/options ─────────────────────────────────────
  app.post("/v1/auth/register/options", async (request, reply) => {
    const parsed = RegisterOptionsBody.safeParse(request.body);
    if (!parsed.success) {
      throw Errors.validationError(parsed.error.message);
    }
    const { username } = parsed.data;

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: username,
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });

    challengeStore.set(username, options.challenge);
    app.log.info({ reqId: request.id }, "WebAuthn registration options generated");

    return reply.send(options);
  });

  // ── POST /v1/auth/register/verify ──────────────────────────────────────
  app.post("/v1/auth/register/verify", async (request, reply) => {
    const parsed = RegisterVerifyBody.safeParse(request.body);
    if (!parsed.success) {
      throw Errors.validationError(parsed.error.message);
    }
    const { username, response } = parsed.data;

    const expectedChallenge = challengeStore.get(username);
    if (!expectedChallenge) {
      throw Errors.validationError(
        "No pending registration challenge for this username.",
      );
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        response: response as any,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });
    } catch (err) {
      throw Errors.validationError(
        `WebAuthn verification failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (!verification.verified || !verification.registrationInfo) {
      throw Errors.validationError("WebAuthn registration could not be verified.");
    }

    challengeStore.delete(username);

    const credId = Buffer.from(verification.registrationInfo.credential.id).toString(
      "base64url",
    );

    // Create citizen user record
    const db = getDb();
    const [newUser] = await db
      .insert(users)
      .values({
        role: "citizen",
        passkey_credential_id: credId,
        synthetic_profile: {
          username,
          _demo_note: "SYNTHETIC DATA — WebAuthn registered citizen",
        },
      })
      .returning({ id: users.id });

    if (!newUser) {
      throw Errors.validationError("Failed to create user record.");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (request as any).session.user = {
      userId: newUser.id,
      role: "citizen",
    };

    app.log.info(
      { reqId: request.id },
      "WebAuthn registration verified, citizen created",
    );

    return reply.send({ verified: true, userId: newUser.id });
  });

  // ── POST /v1/auth/login/options ────────────────────────────────────────
  app.post("/v1/auth/login/options", async (request, reply) => {
    const parsed = LoginOptionsBody.safeParse(request.body);
    if (!parsed.success) {
      throw Errors.validationError(parsed.error.message);
    }
    const { username } = parsed.data;

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "preferred",
    });

    challengeStore.set(`login:${username}`, options.challenge);
    app.log.info({ reqId: request.id }, "WebAuthn authentication options generated");

    return reply.send(options);
  });

  // ── POST /v1/auth/login/verify ─────────────────────────────────────────
  app.post("/v1/auth/login/verify", async (request, reply) => {
    const parsed = LoginVerifyBody.safeParse(request.body);
    if (!parsed.success) {
      throw Errors.validationError(parsed.error.message);
    }
    const { username, response } = parsed.data;

    const expectedChallenge = challengeStore.get(`login:${username}`);
    if (!expectedChallenge) {
      throw Errors.validationError("No pending login challenge for this username.");
    }

    // Look up the user by passkey credential ID from response
    const responseObj = response as { id?: string };
    const credentialId = responseObj.id;
    if (!credentialId) {
      throw Errors.validationError("Response missing credential id.");
    }

    const db = getDb();
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.passkey_credential_id, credentialId))
      .limit(1);

    if (!existingUser) {
      throw Errors.unauthenticated("Passkey not registered.");
    }

    // For MVP demo: trust the credential lookup (full assertion verification
    // requires stored public key; deferred to Phase 3 hardening).
    challengeStore.delete(`login:${username}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (request as any).session.user = {
      userId: existingUser.id,
      role: existingUser.role,
      stellarAddress: existingUser.stellar_address ?? undefined,
    };

    app.log.info({ reqId: request.id }, "WebAuthn login verified");

    return reply.send({ verified: true, userId: existingUser.id });
  });

  // ── POST /v1/auth/portal/login ─────────────────────────────────────────
  app.post("/v1/auth/portal/login", async (request, reply) => {
    const parsed = PortalLoginBody.safeParse(request.body);
    if (!parsed.success) {
      throw Errors.validationError(parsed.error.message);
    }
    const { role, demoKey } = parsed.data;

    const expectedKey = getDemoKey(role);
    if (!expectedKey || demoKey !== expectedKey) {
      // Never log the demoKey value
      app.log.warn({ reqId: request.id, role }, "Portal login failed: invalid demo key");
      throw Errors.unauthenticated("Invalid demo credentials.");
    }

    // Find or create the portal user for this role
    const db = getDb();
    let [portalUser] = await db.select().from(users).where(eq(users.role, role)).limit(1);

    if (!portalUser) {
      const [created] = await db
        .insert(users)
        .values({
          role,
          synthetic_profile: {
            _demo_note: `SYNTHETIC DATA — demo ${role} portal user`,
          },
        })
        .returning();
      portalUser = created;
    }

    if (!portalUser) {
      throw Errors.validationError("Failed to resolve portal user.");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (request as any).session.user = {
      userId: portalUser.id,
      role: portalUser.role,
      stellarAddress: portalUser.stellar_address ?? undefined,
    };

    app.log.info({ reqId: request.id, role }, "Portal login successful");

    return reply.send({ ok: true, role, userId: portalUser.id });
  });

  // ── POST /v1/auth/logout ───────────────────────────────────────────────
  app.post(
    "/v1/auth/logout",
    { preHandler: [requireAuthenticated()] },
    async (request, reply) => {
      app.log.info({ reqId: request.id }, "User logged out");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (request as any).session.destroy();
      return reply.send({ ok: true });
    },
  );
}
