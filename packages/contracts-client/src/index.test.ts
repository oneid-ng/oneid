import type * as Fs from "node:fs";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  loadContractIds,
  loadSeededRegistry,
  getIssuerRegistryClient,
  getCredentialStatusClient,
  getConsentRegistryClient,
  getCorrectionTrackerClient,
  isActiveIssuer,
  isActiveVerifier,
} from "./index.js";

// ── Synthetic seeded-local.json fixture (used in CI without a live chain) ──
const SYNTHETIC_SEEDED_LOCAL = {
  network: "local",
  adminAddress: "GADMINONEIDDEMOPLATFORMADMIN00000000000000000000000000000000",
  issuerRegistryId: "CA7QONEIDISSUERREGISTRYLOCALDEMOCONTRACTID000000000000000000",
  credentialStatusId: "CB2KONEIDCREDENTIALSTATUSLOCALDEMOCONTRACTID000000000000000",
  entities: {
    GISSUERONEIDDEMOISSUER0000000000000000000000000000000000000: {
      address: "GISSUERONEIDDEMOISSUER0000000000000000000000000000000000000",
      role: "Issuer",
      name: "ONEiD Demo Issuer",
      homeDomain: "issuer.demo.oneid.local",
      status: "Active",
      registeredAt: 1793110890,
    },
    GANCHORONEIDDEMOANCHOR0000000000000000000000000000000000000: {
      address: "GANCHORONEIDDEMOANCHOR0000000000000000000000000000000000000",
      role: "Verifier",
      name: "Mock Anchor",
      homeDomain: "anchor.demo.oneid.local",
      status: "Active",
      registeredAt: 1793110890,
    },
    GFINTECHONEIDDEMOFINTECH00000000000000000000000000000000000: {
      address: "GFINTECHONEIDDEMOFINTECH00000000000000000000000000000000000",
      role: "Verifier",
      name: "Mock Fintech",
      homeDomain: "fintech.demo.oneid.local",
      status: "Active",
      registeredAt: 1793110890,
    },
  },
};

// Mock node:fs so seeded-registry tests work in CI without a deployed chain
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof Fs>();
  return {
    ...actual,
    existsSync: (p: string) => {
      if (String(p).includes("seeded-local")) return true;
      return actual.existsSync(p);
    },
    readFileSync: (p: Parameters<typeof actual.readFileSync>[0], ...args: unknown[]) => {
      if (String(p).includes("seeded-local")) {
        return JSON.stringify(SYNTHETIC_SEEDED_LOCAL);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (actual.readFileSync as any)(p, ...args);
    },
  };
});

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

    const consentClient = getConsentRegistryClient();
    expect(consentClient.options.contractId).toBe("C_CONSENT");

    const corrClient = getCorrectionTrackerClient();
    expect(corrClient.options.contractId).toBe("C_CORR");
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

    expect(await isActiveIssuer(issuer.address, "local")).toBe(true);
    expect(await isActiveVerifier(issuer.address, "local")).toBe(false);

    expect(await isActiveVerifier(verifier.address, "local")).toBe(true);
    expect(await isActiveIssuer(verifier.address, "local")).toBe(false);

    expect(await isActiveIssuer("GUNREGISTERED0000000000", "local")).toBe(false);
    expect(await isActiveVerifier("GUNREGISTERED0000000000", "local")).toBe(false);
  });
});
