import Fastify from "fastify";
import sensible from "@fastify/sensible";

export async function buildFintech() {
  const app = Fastify({
    logger: { level: process.env["LOG_LEVEL"] ?? "info" },
  });

  await app.register(sensible);

  app.get("/healthz", async () => ({ status: "ok", service: "mock-fintech" }));

  // Verifier endpoints — stub
  app.all("/verify/*", async (_req, reply) => {
    return reply.notImplemented(
      "NOT IMPLEMENTED YET — fintech verifier endpoints arrive in Phase 3.",
    );
  });

  return app;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const port = Number(process.env["PORT"] ?? 4200);
  const app = await buildFintech();
  try {
    await app.listen({ port, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
