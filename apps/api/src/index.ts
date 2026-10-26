import Fastify from "fastify";
import sensible from "@fastify/sensible";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env["LOG_LEVEL"] ?? "info",
      // Structured JSON logs — no personal data
      serializers: {
        req(request) {
          return { method: request.method, url: request.url };
        },
      },
    },
  });

  await app.register(sensible);

  // ── Health / readiness ───────────────────────────────────────────────────

  app.get("/healthz", async () => {
    return { status: "ok" };
  });

  app.get("/readyz", async () => {
    return { status: "ok" };
  });

  // ── v1 stub ──────────────────────────────────────────────────────────────
  // Full routes arrive with each workstream. Placeholder returns 501 clearly.

  app.all("/v1/*", async (_req, reply) => {
    return reply.notImplemented(
      "NOT IMPLEMENTED YET — API routes arrive in Phase 3.",
    );
  });

  return app;
}

// ── Entry point ──────────────────────────────────────────────────────────

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
