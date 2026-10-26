import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildAnchor } from "./index.js";
import type { FastifyInstance } from "fastify";

describe("@oneid/mock-anchor health", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildAnchor();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /healthz returns 200", async () => {
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ service: string }>().service).toBe("mock-anchor");
  });

  it("GET /.well-known/stellar.toml returns text", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/.well-known/stellar.toml",
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("stellar.toml stub");
  });

  it("GET /sep/anything returns 501", async () => {
    const res = await app.inject({ method: "GET", url: "/sep/auth" });
    expect(res.statusCode).toBe(501);
  });
});
