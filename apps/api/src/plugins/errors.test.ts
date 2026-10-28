/**
 * src/plugins/errors.test.ts — Error model tests (Commit 2, README §14.4)
 */

import { describe, it, expect } from "vitest";
import { AppError, Errors, ERROR_CODES } from "./errors.js";

describe("AppError", () => {
  it("is an instance of Error", () => {
    const e = Errors.unauthenticated();
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(AppError);
  });

  it("UNAUTHENTICATED → 401, not retryable", () => {
    const e = Errors.unauthenticated();
    expect(e.code).toBe("UNAUTHENTICATED");
    expect(e.httpStatus).toBe(401);
    expect(e.retryable).toBe(false);
  });

  it("FORBIDDEN_ROLE → 403, not retryable", () => {
    const e = Errors.forbiddenRole();
    expect(e.code).toBe("FORBIDDEN_ROLE");
    expect(e.httpStatus).toBe(403);
    expect(e.retryable).toBe(false);
  });

  it("CONSENT_EXPIRED → 403, not retryable", () => {
    const e = Errors.consentExpired();
    expect(e.code).toBe("CONSENT_EXPIRED");
    expect(e.httpStatus).toBe(403);
    expect(e.retryable).toBe(false);
  });

  it("CREDENTIAL_REVOKED → 422, not retryable", () => {
    const e = Errors.credentialRevoked();
    expect(e.code).toBe("CREDENTIAL_REVOKED");
    expect(e.httpStatus).toBe(422);
    expect(e.retryable).toBe(false);
  });

  it("ISSUER_NOT_ACTIVE → 422, not retryable", () => {
    const e = Errors.issuerNotActive();
    expect(e.code).toBe("ISSUER_NOT_ACTIVE");
    expect(e.httpStatus).toBe(422);
    expect(e.retryable).toBe(false);
  });

  it("CHAIN_UNAVAILABLE → 503, retryable", () => {
    const e = Errors.chainUnavailable();
    expect(e.code).toBe("CHAIN_UNAVAILABLE");
    expect(e.httpStatus).toBe(503);
    expect(e.retryable).toBe(true);
  });

  it("CHAIN_TX_FAILED → 502, not retryable", () => {
    const e = Errors.chainTxFailed();
    expect(e.code).toBe("CHAIN_TX_FAILED");
    expect(e.httpStatus).toBe(502);
    expect(e.retryable).toBe(false);
  });

  it("VALIDATION_ERROR → 400, not retryable", () => {
    const e = Errors.validationError();
    expect(e.code).toBe("VALIDATION_ERROR");
    expect(e.httpStatus).toBe(400);
    expect(e.retryable).toBe(false);
  });

  it("all codes defined in ERROR_CODES", () => {
    const codes = Object.values(ERROR_CODES);
    expect(codes).toContain("UNAUTHENTICATED");
    expect(codes).toContain("CHAIN_UNAVAILABLE");
    expect(codes).toContain("VALIDATION_ERROR");
  });
});
