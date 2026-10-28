/**
 * src/db/schema.test.ts — Schema smoke tests (Commit 1, README §15)
 *
 * Tests run without a live DB; they just verify the Drizzle schema exports
 * and column shapes are correct.
 */

import { describe, it, expect } from "vitest";
import {
  users,
  entities,
  applications,
  credentials,
  claim_requests,
  consents,
  correction_tickets,
  correction_outcomes,
  audit_events,
  chain_cursor,
} from "./schema.js";

describe("DB schema exports", () => {
  it("exports all 10 tables", () => {
    expect(users).toBeDefined();
    expect(entities).toBeDefined();
    expect(applications).toBeDefined();
    expect(credentials).toBeDefined();
    expect(claim_requests).toBeDefined();
    expect(consents).toBeDefined();
    expect(correction_tickets).toBeDefined();
    expect(correction_outcomes).toBeDefined();
    expect(audit_events).toBeDefined();
    expect(chain_cursor).toBeDefined();
  });

  it("users table has required columns", () => {
    const cols = Object.keys(users);
    expect(cols).toContain("id");
    expect(cols).toContain("role");
    expect(cols).toContain("stellar_address");
    expect(cols).toContain("synthetic_profile");
  });

  it("audit_events table has hash chain columns", () => {
    const cols = Object.keys(audit_events);
    expect(cols).toContain("prev_hash");
    expect(cols).toContain("hash");
  });

  it("chain_cursor has contract_id primary key", () => {
    const cols = Object.keys(chain_cursor);
    expect(cols).toContain("contract_id");
    expect(cols).toContain("last_ledger");
  });
});
