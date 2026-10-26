/**
 * @oneid/shared
 *
 * Shared Zod schemas, DTOs, enums and constants.
 * No personal data lives here — only structural types and validation rules.
 */

// ── Enums ──────────────────────────────────────────────────────────────────

export const Role = {
  Citizen: "citizen",
  Issuer: "issuer",
  Verifier: "verifier",
  Admin: "admin",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const CredentialStatus = {
  Active: "active",
  Revoked: "revoked",
  Expired: "expired",
} as const;
export type CredentialStatus =
  (typeof CredentialStatus)[keyof typeof CredentialStatus];

export const ConsentStatus = {
  Active: "active",
  Withdrawn: "withdrawn",
  Expired: "expired",
} as const;
export type ConsentStatus =
  (typeof ConsentStatus)[keyof typeof ConsentStatus];

export const TicketStatus = {
  Submitted: "submitted",
  UnderReview: "under_review",
  Applied: "applied",
  Rejected: "rejected",
  Failed: "failed",
  PartiallyApplied: "partially_applied",
} as const;
export type TicketStatus =
  (typeof TicketStatus)[keyof typeof TicketStatus];

export const EntityStatus = {
  Active: "active",
  Suspended: "suspended",
  Removed: "removed",
} as const;
export type EntityStatus =
  (typeof EntityStatus)[keyof typeof EntityStatus];

// ── Error codes (mirrors contract error enums) ─────────────────────────────

export const ApiErrorCode = {
  Unauthenticated: "UNAUTHENTICATED",
  ForbiddenRole: "FORBIDDEN_ROLE",
  ConsentMissing: "CONSENT_MISSING",
  ConsentExpired: "CONSENT_EXPIRED",
  ConsentWithdrawn: "CONSENT_WITHDRAWN",
  CredentialRevoked: "CREDENTIAL_REVOKED",
  CredentialExpired: "CREDENTIAL_EXPIRED",
  IssuerNotActive: "ISSUER_NOT_ACTIVE",
  ChainUnavailable: "CHAIN_UNAVAILABLE",
  ChainTxFailed: "CHAIN_TX_FAILED",
  ValidationError: "VALIDATION_ERROR",
} as const;
export type ApiErrorCode =
  (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

// ── Constants ──────────────────────────────────────────────────────────────

/** Maximum number of institutions per correction ticket (contract cap). */
export const MAX_INSTITUTIONS_PER_TICKET = 10;

/** Default credential validity in days. */
export const DEFAULT_CREDENTIAL_VALIDITY_DAYS = 365;
