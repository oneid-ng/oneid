import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "./index.js";
import type { FastifyInstance } from "fastify";

describe("@oneid/api health routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /healthz returns 200 ok", async () => {
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });

  it("GET /readyz returns 200 ok", async () => {
    const res = await app.inject({ method: "GET", url: "/readyz" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });

  it("GET /v1/anything returns 501 not implemented", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/requests" });
    expect(res.statusCode).toBe(501);
  });
});
