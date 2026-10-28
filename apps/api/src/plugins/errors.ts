/**
 * plugins/errors.ts — Typed application error class and factory functions.
 *
 * Implements the exact error model and codes from README §14.4.
 * HTTP status codes map as documented:
 *   UNAUTHENTICATED         → 401
 *   FORBIDDEN_ROLE          → 403
 *   CONSENT_MISSING/EXPIRED/WITHDRAWN → 403
 *   CREDENTIAL_REVOKED/EXPIRED → 422
 *   ISSUER_NOT_ACTIVE       → 422
 *   CHAIN_UNAVAILABLE       → 503  (retryable)
 *   CHAIN_TX_FAILED         → 502
 *   VALIDATION_ERROR        → 400
 */

// ── Error codes (README §14.4) ────────────────────────────────────────────

export const ERROR_CODES = {
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN_ROLE: "FORBIDDEN_ROLE",
  CONSENT_MISSING: "CONSENT_MISSING",
  CONSENT_EXPIRED: "CONSENT_EXPIRED",
  CONSENT_WITHDRAWN: "CONSENT_WITHDRAWN",
  CREDENTIAL_REVOKED: "CREDENTIAL_REVOKED",
  CREDENTIAL_EXPIRED: "CREDENTIAL_EXPIRED",
  ISSUER_NOT_ACTIVE: "ISSUER_NOT_ACTIVE",
  CHAIN_UNAVAILABLE: "CHAIN_UNAVAILABLE",
  CHAIN_TX_FAILED: "CHAIN_TX_FAILED",
  VALIDATION_ERROR: "VALIDATION_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * Application-level typed error. The error handler plugin converts these into
 * the documented JSON error envelope (README §14.4).
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly httpStatus: number;
  public readonly retryable: boolean;

  constructor(code: ErrorCode, message: string, httpStatus: number, retryable = false) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.retryable = retryable;
  }
}

// ── Factory functions (one per error code) ────────────────────────────────

export const Errors = {
  unauthenticated: (msg = "Missing or invalid session"): AppError =>
    new AppError(ERROR_CODES.UNAUTHENTICATED, msg, 401),

  forbiddenRole: (msg = "Insufficient role for this action"): AppError =>
    new AppError(ERROR_CODES.FORBIDDEN_ROLE, msg, 403),

  consentMissing: (msg = "No valid consent"): AppError =>
    new AppError(ERROR_CODES.CONSENT_MISSING, msg, 403),

  consentExpired: (msg = "The consent receipt has expired."): AppError =>
    new AppError(ERROR_CODES.CONSENT_EXPIRED, msg, 403),

  consentWithdrawn: (msg = "Consent has been withdrawn."): AppError =>
    new AppError(ERROR_CODES.CONSENT_WITHDRAWN, msg, 403),

  credentialRevoked: (msg = "Credential has been revoked."): AppError =>
    new AppError(ERROR_CODES.CREDENTIAL_REVOKED, msg, 422),

  credentialExpired: (msg = "Credential has expired."): AppError =>
    new AppError(ERROR_CODES.CREDENTIAL_EXPIRED, msg, 422),

  issuerNotActive: (msg = "Issuer is suspended or unknown."): AppError =>
    new AppError(ERROR_CODES.ISSUER_NOT_ACTIVE, msg, 422),

  chainUnavailable: (msg = "Chain RPC unreachable."): AppError =>
    new AppError(ERROR_CODES.CHAIN_UNAVAILABLE, msg, 503, true),

  chainTxFailed: (msg = "Transaction failed."): AppError =>
    new AppError(ERROR_CODES.CHAIN_TX_FAILED, msg, 502),

  validationError: (msg = "Schema validation failed."): AppError =>
    new AppError(ERROR_CODES.VALIDATION_ERROR, msg, 400),
} as const;
