import { describe, it, expect } from "vitest";
import {
  Role,
  CredentialStatus,
  ConsentStatus,
  TicketStatus,
  EntityStatus,
  ApiErrorCode,
  MAX_INSTITUTIONS_PER_TICKET,
} from "./index.js";

describe("@oneid/shared enums", () => {
  it("Role values are stable strings", () => {
    expect(Role.Citizen).toBe("citizen");
    expect(Role.Issuer).toBe("issuer");
    expect(Role.Verifier).toBe("verifier");
    expect(Role.Admin).toBe("admin");
  });

  it("CredentialStatus covers active/revoked/expired", () => {
    expect(Object.values(CredentialStatus)).toEqual(
      expect.arrayContaining(["active", "revoked", "expired"]),
    );
  });

  it("ConsentStatus covers active/withdrawn/expired", () => {
    expect(Object.values(ConsentStatus)).toEqual(
      expect.arrayContaining(["active", "withdrawn", "expired"]),
    );
  });

  it("TicketStatus includes partially_applied", () => {
    expect(TicketStatus.PartiallyApplied).toBe("partially_applied");
  });

  it("EntityStatus includes suspended", () => {
    expect(EntityStatus.Suspended).toBe("suspended");
  });

  it("ApiErrorCode includes chain error codes", () => {
    expect(ApiErrorCode.ChainUnavailable).toBe("CHAIN_UNAVAILABLE");
    expect(ApiErrorCode.ChainTxFailed).toBe("CHAIN_TX_FAILED");
  });

  it("MAX_INSTITUTIONS_PER_TICKET is 10", () => {
    expect(MAX_INSTITUTIONS_PER_TICKET).toBe(10);
  });
});
