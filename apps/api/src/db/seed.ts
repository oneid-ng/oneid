/**
 * db/seed.ts — Load SYNTHETIC demo data into PostgreSQL.
 *
 * IMPORTANT: All values in this file are OBVIOUSLY FICTIONAL.
 * - NIN values are documented placeholder patterns from README §13.2 only.
 * - No real person's data is used. No real NIN, BVN or biometrics.
 * - This data is for local/testnet demo only (README §4, rule #2).
 *
 * Idempotent: uses ON CONFLICT DO NOTHING so re-running is safe.
 */

import postgres from "postgres";

const url = process.env["DATABASE_URL"];
if (!url) {
  console.error("ERROR: DATABASE_URL environment variable is not set.");
  process.exit(1);
}

const client = postgres(url, { max: 1 });
// db instance not used directly — raw postgres client used below

// ── Synthetic citizen profiles ────────────────────────────────────────────
//
// All NINs are PLACEHOLDER values documented in README §13.2.
// The pattern "DDDD DDDD DDDD" is the documented placeholder only.
// ALLOWED_SYNTHETIC_NINS in validate-seed.ts mirrors this list.
//
const SYNTHETIC_CITIZENS = [
  {
    role: "citizen" as const,
    stellar_address: null,
    passkey_credential_id: null,
    synthetic_profile: {
      fullName: "Adaeze Okonkwo",
      nin: "1234 5678 9012", // README §13.2 example — SYNTHETIC PLACEHOLDER
      dateOfBirth: "1990-03-12",
      address: "Lagos, Nigeria",
      kycTier: 2,
      over18: true,
      _demo_note: "SYNTHETIC DATA — not a real person",
    },
  },
  {
    role: "citizen" as const,
    stellar_address: null,
    passkey_credential_id: null,
    synthetic_profile: {
      fullName: "Chidi Okeke",
      nin: "9876 5432 1098", // SYNTHETIC PLACEHOLDER
      dateOfBirth: "1985-07-22",
      address: "Abuja, Nigeria",
      kycTier: 1,
      over18: true,
      _demo_note: "SYNTHETIC DATA — not a real person",
    },
  },
  {
    role: "citizen" as const,
    stellar_address: null,
    passkey_credential_id: null,
    synthetic_profile: {
      fullName: "Ngozi Eze",
      nin: "1111 2222 3333", // SYNTHETIC PLACEHOLDER
      dateOfBirth: "1995-11-05",
      address: "Port Harcourt, Nigeria",
      kycTier: 1,
      over18: true,
      _demo_note: "SYNTHETIC DATA — not a real person",
    },
  },
] as const;

// ── Demo entity records ───────────────────────────────────────────────────
//
// Stellar addresses are PLACEHOLDER strings (not valid Stellar public keys).
// Real keys are populated at deployment time by chain:seed (infra/scripts/chain-seed.sh).
//
const DEMO_ENTITIES = [
  {
    stellar_address: "GDEMO_ISSUER_PLACEHOLDER",
    role: "issuer" as const,
    name: "Demo Issuer Authority",
    home_domain: "issuer.demo.oneid.local",
    status: "active" as const,
  },
  {
    stellar_address: "GDEMO_ANCHOR_PLACEHOLDER",
    role: "verifier" as const,
    name: "Mock Anchor Bank",
    home_domain: "anchor.demo.oneid.local",
    status: "active" as const,
  },
  {
    stellar_address: "GDEMO_FINTECH_PLACEHOLDER",
    role: "verifier" as const,
    name: "Demo Fintech App",
    home_domain: "fintech.demo.oneid.local",
    status: "active" as const,
  },
] as const;

// ── Seed execution ────────────────────────────────────────────────────────

let citizensSeeded = 0;
let entitiesSeeded = 0;

for (const citizen of SYNTHETIC_CITIZENS) {
  // Idempotent: skip if already exists by NIN inside synthetic_profile
  const nin = (citizen.synthetic_profile as { nin: string }).nin;

  // Use a cast-friendly upsert via raw insert ignore
  const result = await client`
    INSERT INTO users (role, stellar_address, passkey_credential_id, synthetic_profile)
    VALUES (
      ${citizen.role},
      ${citizen.stellar_address},
      ${citizen.passkey_credential_id},
      ${JSON.stringify(citizen.synthetic_profile)}::jsonb
    )
    ON CONFLICT DO NOTHING
    RETURNING id
  `;

  if (result.length > 0) {
    citizensSeeded++;
    console.warn(
      `  ✓ Seeded citizen: ${citizen.synthetic_profile.fullName} (NIN: ${nin})`,
    );
  } else {
    console.warn(`  - Skipped (exists): ${citizen.synthetic_profile.fullName}`);
  }
}

for (const entity of DEMO_ENTITIES) {
  const result = await client`
    INSERT INTO entities (stellar_address, role, name, home_domain, status)
    VALUES (
      ${entity.stellar_address},
      ${entity.role},
      ${entity.name},
      ${entity.home_domain},
      ${entity.status}
    )
    ON CONFLICT (stellar_address) DO NOTHING
    RETURNING id
  `;

  if (result.length > 0) {
    entitiesSeeded++;
    console.warn(`  ✓ Seeded entity: ${entity.name} (${entity.role})`);
  } else {
    console.warn(`  - Skipped (exists): ${entity.name}`);
  }
}

console.warn(
  `\nSeed complete: ${citizensSeeded} citizens, ${entitiesSeeded} entities added.`,
);

await client.end();
process.exit(0);
