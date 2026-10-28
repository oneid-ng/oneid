/**
 * @oneid/api — PostgreSQL schema (README §15)
 *
 * All tables hold SYNTHETIC demo data and operational state only.
 * On-chain Soroban contracts are the source of truth for registry,
 * credential status, consent and correction state. This DB mirrors
 * them via the indexer and stores off-chain operational records.
 *
 * NO personal data is written to the blockchain (README §7, rule #1).
 * The synthetic_profile column in `users` is the only field that may
 * hold citizen attributes and it lives solely off-chain here.
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ── Enums ─────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", [
  "citizen",
  "issuer",
  "verifier",
  "admin",
]);

export const entityRoleEnum = pgEnum("entity_role", ["issuer", "verifier", "admin"]);

export const entityStatusEnum = pgEnum("entity_status", [
  "active",
  "suspended",
  "removed",
]);

export const applicationStatusEnum = pgEnum("application_status", [
  "pending",
  "approved",
  "rejected",
]);

export const credentialStatusEnum = pgEnum("credential_status_db", [
  "active",
  "revoked",
  "expired",
]);

export const claimRequestStatusEnum = pgEnum("claim_request_status", [
  "pending_consent",
  "approved",
  "denied",
  "expired",
]);

export const consentStatusEnum = pgEnum("consent_status_db", [
  "active",
  "withdrawn",
  "expired",
]);

export const correctionOutcomeStatusEnum = pgEnum("correction_outcome_status", [
  "submitted",
  "under_review",
  "applied",
  "rejected",
  "failed",
  "partially_applied",
]);

// ── Tables ────────────────────────────────────────────────────────────────

/**
 * users — citizen wallets and institution portal accounts.
 * synthetic_profile (JSONB) holds citizen identity attributes for demo only.
 */
export const users = pgTable("users", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  role: userRoleEnum("role").notNull(),
  stellar_address: text("stellar_address").unique(),
  passkey_credential_id: text("passkey_credential_id").unique(),
  synthetic_profile: jsonb("synthetic_profile"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * entities — authorised issuers, verifiers and the platform admin.
 * Mirrors the on-chain issuer-registry (README §12.1).
 */
export const entities = pgTable("entities", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  stellar_address: text("stellar_address").unique().notNull(),
  role: entityRoleEnum("role").notNull(),
  name: text("name").notNull(),
  home_domain: text("home_domain").notNull(),
  status: entityStatusEnum("status").notNull().default("active"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * applications — citizen credential applications under review by an issuer.
 */
export const applications = pgTable("applications", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id),
  issuer_id: uuid("issuer_id")
    .notNull()
    .references(() => entities.id),
  status: applicationStatusEnum("status").notNull().default("pending"),
  submitted_at: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  decided_at: timestamp("decided_at", { withTimezone: true }),
});

/**
 * credentials — issued W3C VC references (hash, not the full VC).
 * The full encrypted VC lives in the holder's wallet (README §13.3, ADR-0003).
 * credential_hash is the salted SHA-256 registered on credential-status contract.
 */
export const credentials = pgTable("credentials", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  credential_hash: text("credential_hash").unique().notNull(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id),
  issuer_id: uuid("issuer_id")
    .notNull()
    .references(() => entities.id),
  status: credentialStatusEnum("status").notNull().default("active"),
  expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
  chain_tx: text("chain_tx"),
  ledger: integer("ledger"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * claim_requests — verifier requests for named claims from a citizen holder.
 */
export const claim_requests = pgTable("claim_requests", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  verifier_id: uuid("verifier_id")
    .notNull()
    .references(() => entities.id),
  holder_id: uuid("holder_id")
    .notNull()
    .references(() => users.id),
  claims: text("claims").array().notNull(),
  purpose: text("purpose").notNull(),
  nonce: text("nonce").notNull(),
  status: claimRequestStatusEnum("status").notNull().default("pending_consent"),
  expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * consents — consent receipts (hash anchored on consent-registry contract).
 * decisions JSONB: { claimName: 'approve'|'deny', ... }
 */
export const consents = pgTable("consents", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  request_id: uuid("request_id").references(() => claim_requests.id),
  receipt_hash: text("receipt_hash").unique().notNull(),
  decisions: jsonb("decisions").notNull(),
  status: consentStatusEnum("status").notNull().default("active"),
  expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
  chain_tx: text("chain_tx"),
  ledger: integer("ledger"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * correction_tickets — citizen-initiated record correction requests.
 * detail JSONB holds synthetic correction context — never stored on-chain.
 */
export const correction_tickets = pgTable("correction_tickets", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  ticket_hash: text("ticket_hash").unique().notNull(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id),
  category: text("category").notNull(),
  detail: jsonb("detail").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * correction_outcomes — per-institution status for each correction ticket.
 * Each institution updates only its own row (README §12.4, rule #6).
 */
export const correction_outcomes = pgTable("correction_outcomes", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  ticket_id: uuid("ticket_id")
    .notNull()
    .references(() => correction_tickets.id),
  institution_id: uuid("institution_id")
    .notNull()
    .references(() => entities.id),
  status: correctionOutcomeStatusEnum("status").notNull().default("submitted"),
  reason_code: integer("reason_code"),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  chain_tx: text("chain_tx"),
});

/**
 * audit_events — tamper-evident off-chain audit log.
 * hash = SHA-256(prev_hash || canonical_event) (README §15)
 * Periodically the latest hash can be anchored on-chain.
 */
export const audit_events = pgTable("audit_events", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  actor_id: uuid("actor_id"),
  actor_role: text("actor_role"),
  type: text("type").notNull(),
  ref_id: text("ref_id"),
  chain_tx: text("chain_tx"),
  // 64 zero characters = SHA-256 of empty string for the genesis event
  prev_hash: text("prev_hash")
    .notNull()
    .default("0000000000000000000000000000000000000000000000000000000000000000"),
  hash: text("hash").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * chain_cursor — indexer position per contract.
 * Allows resumable, idempotent event polling (README §14.5).
 */
export const chain_cursor = pgTable("chain_cursor", {
  contract_id: text("contract_id").primaryKey(),
  last_ledger: integer("last_ledger").notNull().default(0),
  last_event_id: text("last_event_id"),
});
