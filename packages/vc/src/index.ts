/**
 * @oneid/vc
 *
 * W3C VC Data Model 2.0 / SD-JWT VC helpers.
 * Library choice for SD-JWT VC will be confirmed in an ADR before Phase 3.
 * This scaffold exports types and placeholder stubs only.
 *
 * NOT IMPLEMENTED YET — full implementation arrives in the credentials workstream.
 */

// ── W3C VC 2.0 skeleton types ──────────────────────────────────────────────

export interface VerifiableCredential {
  "@context": string[];
  type: string[];
  issuer: string;
  validFrom: string;
  validUntil?: string;
  credentialSubject: Record<string, unknown>;
  credentialStatus?: {
    type: string;
    contract: string;
    id: string;
  };
}

export interface VerifiablePresentation {
  "@context": string[];
  type: string[];
  holder: string;
  verifiableCredential: VerifiableCredential[];
}

// ── Placeholder stubs ──────────────────────────────────────────────────────

/** NOT IMPLEMENTED YET — issue a W3C VC 2.0 / SD-JWT VC */
export function issueCredential(
  _payload: Omit<VerifiableCredential, "@context" | "type">,
  _signingKeyJwk: string,
): never {
  throw new Error(
    "NOT IMPLEMENTED YET — VC issuance arrives in the credentials workstream (Phase 3).",
  );
}

/** NOT IMPLEMENTED YET — build a selective-disclosure presentation */
export function presentCredential(
  _credential: VerifiableCredential,
  _disclosedClaims: string[],
  _holderKeyJwk: string,
): never {
  throw new Error(
    "NOT IMPLEMENTED YET — SD-JWT presentation arrives in the credentials workstream (Phase 3).",
  );
}

/** NOT IMPLEMENTED YET — verify a presentation */
export function verifyPresentation(
  _presentation: VerifiablePresentation,
): never {
  throw new Error(
    "NOT IMPLEMENTED YET — VC verification arrives in the credentials workstream (Phase 3).",
  );
}
