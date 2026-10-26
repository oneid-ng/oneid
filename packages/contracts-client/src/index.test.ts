import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadContractIds } from "./index.js";

describe("@oneid/contracts-client", () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = {
      ISSUER_REGISTRY_ID: process.env["ISSUER_REGISTRY_ID"],
      CREDENTIAL_STATUS_ID: process.env["CREDENTIAL_STATUS_ID"],
      CONSENT_REGISTRY_ID: process.env["CONSENT_REGISTRY_ID"],
      CORRECTION_TRACKER_ID: process.env["CORRECTION_TRACKER_ID"],
    };
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("throws when contract IDs are missing", () => {
    delete process.env["ISSUER_REGISTRY_ID"];
    expect(() => loadContractIds()).toThrow("Missing contract IDs");
  });

  it("returns IDs when all env vars are set", () => {
    process.env["ISSUER_REGISTRY_ID"] = "C_ISSUER";
    process.env["CREDENTIAL_STATUS_ID"] = "C_CRED";
    process.env["CONSENT_REGISTRY_ID"] = "C_CONSENT";
    process.env["CORRECTION_TRACKER_ID"] = "C_CORR";
    const ids = loadContractIds();
    expect(ids.issuerRegistry).toBe("C_ISSUER");
    expect(ids.correctionTracker).toBe("C_CORR");
  });
});
