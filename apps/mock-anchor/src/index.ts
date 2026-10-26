import Fastify from "fastify";
import sensible from "@fastify/sensible";

export async function buildAnchor() {
  const app = Fastify({
    logger: { level: process.env["LOG_LEVEL"] ?? "info" },
  });

  await app.register(sensible);

  app.get("/healthz", async () => ({ status: "ok", service: "mock-anchor" }));

  // SEP-1: stellar.toml — stub
  app.get("/.well-known/stellar.toml", async (_req, reply) => {
    reply.header("Content-Type", "text/plain");
    return [
      "# ONEiD Demo Anchor — stellar.toml stub",
      "# Full SEP-1 implementation arrives in Phase 3.",
      `NETWORK_PASSPHRASE="${process.env["STELLAR_NETWORK_PASSPHRASE"] ?? "Standalone Network ; February 2017"}"`,
      `SIGNING_KEY=""`,
    ].join("\n");
  });

  // SEP-10 / SEP-12 / SEP-24 stubs
  app.all("/sep/*", async (_req, reply) => {
    return reply.notImplemented(
      "NOT IMPLEMENTED YET — SEP endpoints arrive in Phase 3.",
    );
  });

  return app;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const port = Number(process.env["PORT"] ?? 4100);
  const app = await buildAnchor();
  try {
    await app.listen({ port, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
