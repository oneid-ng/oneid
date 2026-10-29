/**
 * @oneid/shared
 *
 * Shared Zod schemas, DTOs, enums and constants.
 * No personal data lives here — only structural types and validation rules.
 */

import { z } from "zod";

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
export type CredentialStatus = (typeof CredentialStatus)[keyof typeof CredentialStatus];

export const ConsentStatus = {
  Active: "active",
  Withdrawn: "withdrawn",
  Expired: "expired",
} as const;
export type ConsentStatus = (typeof ConsentStatus)[keyof typeof ConsentStatus];

export const TicketStatus = {
  Submitted: "submitted",
  UnderReview: "under_review",
  Applied: "applied",
  Rejected: "rejected",
  Failed: "failed",
  PartiallyApplied: "partially_applied",
} as const;
export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

export const EntityStatus = {
  Active: "active",
  Suspended: "suspended",
  Removed: "removed",
} as const;
export type EntityStatus = (typeof EntityStatus)[keyof typeof EntityStatus];

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
export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

// ── Constants ──────────────────────────────────────────────────────────────

/** Maximum number of institutions per correction ticket (contract cap). */
export const MAX_INSTITUTIONS_PER_TICKET = 10;

/** Default credential validity in days. */
export const DEFAULT_CREDENTIAL_VALIDITY_DAYS = 365;

// ── Zod Schemas & DTOs (README §14) ────────────────────────────────────────

export const CreateClaimRequestBody = z.object({
  holderRef: z.string().min(1),
  purpose: z.string().min(1).max(512),
  claims: z.array(z.string().min(1)).min(1),
  expiresInSeconds: z
    .number()
    .int()
    .min(60)
    .max(86400 * 30)
    .default(600),
});
export type CreateClaimRequestBody = z.infer<typeof CreateClaimRequestBody>;

export const ConsentDecisionBody = z.object({
  requestId: z.string().uuid(),
  decisions: z.record(z.enum(["approve", "deny"])),
  expiresInSeconds: z
    .number()
    .int()
    .min(60)
    .max(86400 * 365)
    .default(86400),
});
export type ConsentDecisionBody = z.infer<typeof ConsentDecisionBody>;

export const VerifyPresentationBody = z.object({
  presentation: z.string().min(1),
  requestId: z.string().uuid().optional(),
  consentReceiptHash: z.string().optional(),
  expectedNonce: z.string().optional(),
  expectedAudience: z.string().optional(),
});
export type VerifyPresentationBody = z.infer<typeof VerifyPresentationBody>;

export const CreateCorrectionBody = z.object({
  category: z.string().min(1).max(128),
  detail: z.record(z.unknown()),
  targetInstitutions: z.array(z.string().min(1)).min(1).max(MAX_INSTITUTIONS_PER_TICKET),
});
export type CreateCorrectionBody = z.infer<typeof CreateCorrectionBody>;

export const RespondCorrectionBody = z.object({
  status: z.enum(["applied", "rejected", "failed", "partially_applied"]),
  reasonCode: z.number().int().min(0).max(65535).optional(),
  note: z.string().max(512).optional(),
});
export type RespondCorrectionBody = z.infer<typeof RespondCorrectionBody>;

export const SimulateFailureBody = z.object({
  type: z.enum(["rpc_down", "tx_failure", "partial_sync"]),
});
export type SimulateFailureBody = z.infer<typeof SimulateFailureBody>;
