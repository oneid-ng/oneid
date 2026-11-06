/**
 * src/lib/identity-providers.test.ts
 *
 * Tests for the extensible IdentityVerificationProvider & LivenessVerificationProvider
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  SyntheticIdentityVerificationProvider,
  SyntheticLivenessProvider,
  NimcNinAuthProvider,
  ExternalBiometricProvider,
  getIdentityProvider,
  getLivenessProvider,
} from "./identity-providers.js";

describe("Identity and Liveness Providers", () => {
  let savedEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    savedEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  describe("SyntheticIdentityVerificationProvider (Default, Rule #2)", () => {
    const provider = new SyntheticIdentityVerificationProvider();

    it("verifies known synthetic NIN successfully", async () => {
      const res = await provider.verifyNin("1234 5678 9012");
      expect(res.verified).toBe(true);
      expect(res.provider).toBe("synthetic");
      expect(res.profile?.fullName).toBe("Adaeze Okonkwo");
      expect(res.profile?.kycTier).toBe(2);
    });

    it("rejects unknown NIN", async () => {
      const res = await provider.verifyNin("0000 0000 0000");
      expect(res.verified).toBe(false);
      expect(res.profile).toBeUndefined();
    });
  });

  describe("SyntheticLivenessProvider", () => {
    const provider = new SyntheticLivenessProvider();

    it("passes simulated face check with confidence score", async () => {
      const res = await provider.verifyLiveness("test-image-ref");
      expect(res.verified).toBe(true);
      expect(res.confidence).toBeGreaterThan(0.9);
      expect(res._demo).toBe(true);
    });
  });

  describe("Provider Factory Resolution", () => {
    it("defaults to synthetic providers when no live credentials configured", () => {
      delete process.env["IDENTITY_PROVIDER"];
      delete process.env["NIMC_API_KEY"];
      delete process.env["LIVENESS_PROVIDER"];
      delete process.env["BIOMETRIC_API_KEY"];

      const idProvider = getIdentityProvider();
      const liveProvider = getLivenessProvider();

      expect(idProvider).toBeInstanceOf(SyntheticIdentityVerificationProvider);
      expect(liveProvider).toBeInstanceOf(SyntheticLivenessProvider);
    });

    it("resolves NimcNinAuthProvider when configured", () => {
      process.env["IDENTITY_PROVIDER"] = "nimc";
      process.env["NIMC_API_KEY"] = "test-nimc-key";
      process.env["NIMC_API_ENDPOINT"] = "https://mock.nimc.gov.ng";

      const idProvider = getIdentityProvider();
      expect(idProvider).toBeInstanceOf(NimcNinAuthProvider);
    });

    it("resolves ExternalBiometricProvider when configured", () => {
      process.env["LIVENESS_PROVIDER"] = "biometric";
      process.env["BIOMETRIC_API_KEY"] = "test-bio-key";
      process.env["BIOMETRIC_API_ENDPOINT"] = "https://mock.biometrics.ai";

      const liveProvider = getLivenessProvider();
      expect(liveProvider).toBeInstanceOf(ExternalBiometricProvider);
    });
  });
});
