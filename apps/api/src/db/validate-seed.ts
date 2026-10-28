/**
 * db/validate-seed.ts — Assert no seed NIN value is a real-looking identifier.
 *
 * This script MUST be run after db:seed as part of CI (README §4, rule #2).
 * It exits 0 on success and 1 with an error message on any violation.
 *
 * Rules:
 * 1. Every NIN in synthetic_profile must be in ALLOWED_SYNTHETIC_NINS.
 * 2. No email-like field may use a real domain (must end in .demo / .example /
 *    .test / .local).
 * 3. Every profile must have the _demo_note marker.
 */

import postgres from "postgres";

// ── Allowed synthetic NIN values (documented in README §13.2) ────────────
const ALLOWED_SYNTHETIC_NINS = new Set([
  "1234 5678 9012",
  "9876 5432 1098",
  "1111 2222 3333",
]);

// ── Allowed fictional email domains ──────────────────────────────────────
const ALLOWED_EMAIL_SUFFIXES = [".demo", ".example", ".test", ".local"];

function looksLikeEmail(value: string): boolean {
  return typeof value === "string" && value.includes("@") && value.includes(".");
}

function isAllowedEmail(value: string): boolean {
  const lower = value.toLowerCase();
  return ALLOWED_EMAIL_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

// ── Main ──────────────────────────────────────────────────────────────────

const url = process.env["DATABASE_URL"];
if (!url) {
  console.error("ERROR: DATABASE_URL environment variable is not set.");
  process.exit(1);
}

const client = postgres(url, { max: 1 });

let violations = 0;

const rows = await client<
  Array<{ id: string; synthetic_profile: Record<string, unknown> | null }>
>`SELECT id, synthetic_profile FROM users WHERE role = 'citizen'`;

if (rows.length === 0) {
  console.warn("WARNING: No citizen rows found — run db:seed first.");
  await client.end();
  process.exit(0);
}

for (const row of rows) {
  const profile = row.synthetic_profile;
  if (!profile) continue;

  // ── Check NIN ──────────────────────────────────────────────────────────
  if ("nin" in profile) {
    const nin = String(profile["nin"]);
    if (!ALLOWED_SYNTHETIC_NINS.has(nin)) {
      console.error(
        `VIOLATION [user ${row.id}]: NIN "${nin}" is not in the allowed synthetic set.`,
      );
      violations++;
    }
  }

  // ── Check _demo_note marker ────────────────────────────────────────────
  if (!("_demo_note" in profile)) {
    console.error(
      `VIOLATION [user ${row.id}]: synthetic_profile is missing the _demo_note marker.`,
    );
    violations++;
  }

  // ── Check email-like fields ────────────────────────────────────────────
  for (const [key, value] of Object.entries(profile)) {
    if (typeof value === "string" && looksLikeEmail(value)) {
      if (!isAllowedEmail(value)) {
        console.error(
          `VIOLATION [user ${row.id}]: field "${key}" contains an email with a real-looking domain: "${value}"`,
        );
        violations++;
      }
    }
  }
}

await client.end();

if (violations > 0) {
  console.error(
    `\nSeed validation FAILED: ${violations} violation(s) found. Fix seed.ts.`,
  );
  process.exit(1);
} else {
  console.warn(
    `Seed validation passed: all ${rows.length} citizen profiles use synthetic placeholder values only.`,
  );
  process.exit(0);
}
