import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  loadContractIds,
  loadSeededRegistry,
  getIssuerRegistryClient,
  getCredentialStatusClient,
  isActiveIssuer,
  isActiveVerifier,
} from "./index.js";

describe("@oneid/contracts-client", () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = {
      ISSUER_REGISTRY_ID: process.env["ISSUER_REGISTRY_ID"],
      CREDENTIAL_STATUS_ID: process.env["CREDENTIAL_STATUS_ID"],
      CONSENT_REGISTRY_ID: process.env["CONSENT_REGISTRY_ID"],
      CORRECTION_TRACKER_ID: process.env["CORRECTION_TRACKER_ID"],
      STELLAR_NETWORK: process.env["STELLAR_NETWORK"],
    };
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("throws when contract IDs are missing and no deployment file exists", () => {
    delete process.env["ISSUER_REGISTRY_ID"];
    delete process.env["CREDENTIAL_STATUS_ID"];
    delete process.env["CONSENT_REGISTRY_ID"];
    delete process.env["CORRECTION_TRACKER_ID"];
    // Test with non-existent network
    expect(() => loadContractIds("non-existent-network-xyz")).toThrow(
      "Missing contract IDs",
    );
  });

  it("returns IDs when env vars are set", () => {
    process.env["ISSUER_REGISTRY_ID"] = "C_ISSUER";
    process.env["CREDENTIAL_STATUS_ID"] = "C_CRED";
    process.env["CONSENT_REGISTRY_ID"] = "C_CONSENT";
    process.env["CORRECTION_TRACKER_ID"] = "C_CORR";
    const ids = loadContractIds();
    expect(ids.issuerRegistry).toBe("C_ISSUER");
    expect(ids.credentialStatus).toBe("C_CRED");
    expect(ids.consentRegistry).toBe("C_CONSENT");
    expect(ids.correctionTracker).toBe("C_CORR");
  });

  it("instantiates client wrappers with correct options", () => {
    process.env["ISSUER_REGISTRY_ID"] = "C_ISSUER_123";
    process.env["CREDENTIAL_STATUS_ID"] = "C_CRED_456";
    process.env["CONSENT_REGISTRY_ID"] = "C_CONSENT";
    process.env["CORRECTION_TRACKER_ID"] = "C_CORR";

    const issuerClient = getIssuerRegistryClient();
    expect(issuerClient.options.contractId).toBe("C_ISSUER_123");

    const credClient = getCredentialStatusClient();
    expect(credClient.options.contractId).toBe("C_CRED_456");
  });

  it("reads seeded registry correctly", () => {
    const seeded = loadSeededRegistry("local");
    expect(seeded.network).toBe("local");
    expect(seeded.adminAddress).toBeDefined();

    const entities = Object.values(seeded.entities);
    const issuer = entities.find((e) => e.role === "Issuer");
    const verifiers = entities.filter((e) => e.role === "Verifier");

    expect(issuer).toBeDefined();
    expect(issuer?.name).toBe("ONEiD Demo Issuer");
    expect(issuer?.status).toBe("Active");

    expect(verifiers.length).toBe(2);
    expect(verifiers.some((v) => v.name === "Mock Anchor")).toBe(true);
    expect(verifiers.some((v) => v.name === "Mock Fintech")).toBe(true);
  });

  it("checks active issuer and verifier roles accurately from seeded registry", async () => {
    const seeded = loadSeededRegistry("local");
    const entities = Object.values(seeded.entities);
    const issuer = entities.find((e) => e.role === "Issuer")!;
    const verifier = entities.find((e) => e.role === "Verifier")!;

    // Demo issuer is active issuer
    expect(await isActiveIssuer(issuer.address, "local")).toBe(true);
    // Demo issuer is NOT active verifier
    expect(await isActiveVerifier(issuer.address, "local")).toBe(false);

    // Verifier is active verifier
    expect(await isActiveVerifier(verifier.address, "local")).toBe(true);
    // Verifier is NOT active issuer
    expect(await isActiveIssuer(verifier.address, "local")).toBe(false);

    // Random address is neither
    expect(await isActiveIssuer("GUNREGISTERED0000000000", "local")).toBe(false);
    expect(await isActiveVerifier("GUNREGISTERED0000000000", "local")).toBe(false);
  });
});
