import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildFintech } from "./index.js";
import type { FastifyInstance } from "fastify";

describe("@oneid/mock-fintech health", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildFintech();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /healthz returns 200", async () => {
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ service: string }>().service).toBe("mock-fintech");
  });

  it("GET /verify/anything returns 501", async () => {
    const res = await app.inject({ method: "GET", url: "/verify/status" });
    expect(res.statusCode).toBe(501);
  });
});
