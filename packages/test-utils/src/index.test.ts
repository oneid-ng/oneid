import { describe, it, expect } from "vitest";
import {
  SYNTHETIC_PROFILES,
  getSyntheticProfile,
  createChainTestHarness,
} from "./index.js";

describe("@oneid/test-utils synthetic profiles", () => {
  it("SYNTHETIC_PROFILES has at least 3 entries", () => {
    expect(SYNTHETIC_PROFILES.length).toBeGreaterThanOrEqual(3);
  });

  it("getSyntheticProfile returns first profile by default", () => {
    const p = getSyntheticProfile();
    expect(p.id).toBe("profile-001");
  });

  it("getSyntheticProfile wraps around", () => {
    const len = SYNTHETIC_PROFILES.length;
    const p = getSyntheticProfile(len);
    expect(p.id).toBe(SYNTHETIC_PROFILES[0]!.id);
  });

  it("all profiles have SYNTH- prefixed NINs (never real NIN format)", () => {
    for (const p of SYNTHETIC_PROFILES) {
      expect(p.syntheticNin).toMatch(/^SYNTH-/);
    }
  });
});

describe("@oneid/test-utils chain harness stub", () => {
  it("createChainTestHarness throws NOT IMPLEMENTED YET", () => {
    expect(() => createChainTestHarness()).toThrow("NOT IMPLEMENTED YET");
  });
});
