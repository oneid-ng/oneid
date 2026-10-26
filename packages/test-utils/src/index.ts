/**
 * @oneid/test-utils
 *
 * Fixtures, synthetic data generators and chain test harness.
 * All data here is 100% synthetic — no real NINs, BVNs or personal data.
 */

// ── Synthetic citizen profiles ─────────────────────────────────────────────

export interface SyntheticProfile {
  id: string;
  /** Synthetic full name — fictional only */
  fullName: string;
  /** Synthetic NIN — does NOT match any real NIN format intentionally */
  syntheticNin: string;
  /** Synthetic date of birth */
  dateOfBirth: string;
  /** Fictional address */
  address: string;
  kycTier: 1 | 2;
  over18: boolean;
}

/** A fixed set of synthetic profiles for deterministic tests. */
export const SYNTHETIC_PROFILES: SyntheticProfile[] = [
  {
    id: "profile-001",
    fullName: "Adaeze Okonkwo",
    syntheticNin: "SYNTH-0000-0001",
    dateOfBirth: "1990-03-12",
    address: "Lagos, Nigeria (fictional)",
    kycTier: 2,
    over18: true,
  },
  {
    id: "profile-002",
    fullName: "Emeka Nwosu",
    syntheticNin: "SYNTH-0000-0002",
    dateOfBirth: "1985-07-22",
    address: "Abuja, Nigeria (fictional)",
    kycTier: 1,
    over18: true,
  },
  {
    id: "profile-003",
    fullName: "Fatima Bello",
    syntheticNin: "SYNTH-0000-0003",
    dateOfBirth: "1998-11-04",
    address: "Kano, Nigeria (fictional)",
    kycTier: 2,
    over18: true,
  },
];

/** Return a synthetic profile by index (wraps around). */
export function getSyntheticProfile(index = 0): SyntheticProfile {
  const profile = SYNTHETIC_PROFILES[index % SYNTHETIC_PROFILES.length];
  if (!profile) throw new Error("No synthetic profiles defined");
  return profile;
}

// ── Chain test harness stub ────────────────────────────────────────────────
// NOT IMPLEMENTED YET — full chain test harness arrives with the API integration
// tests workstream (Phase 3 / 4). These are typed stubs so dependent tests compile.

export interface ChainTestHarness {
  /** Deploy contracts to a local test network and return contract IDs. */
  deploy(): Promise<Record<string, string>>;
  /** Reset chain state between tests. */
  reset(): Promise<void>;
}

export function createChainTestHarness(): ChainTestHarness {
  throw new Error(
    "NOT IMPLEMENTED YET — chain test harness arrives in Phase 3.",
  );
}
