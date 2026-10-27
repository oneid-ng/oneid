/**
 * @oneid/vc
 *
 * W3C VC Data Model 2.0 / SD-JWT VC helpers.
 * RFC 8785 JSON Canonicalization Scheme (JCS) and salted SHA-256 hashing.
 * Selective disclosure with holder binding via cnf and key-binding JWT.
 */

import {
  createHash,
  createPublicKey,
  createPrivateKey,
  generateKeyPairSync,
  randomBytes,
  sign as cryptoSign,
  verify as cryptoVerify,
  type KeyLike,
  type JsonWebKey,
} from "node:crypto";

// ── RFC 8785 JSON Canonicalization Scheme (JCS) ─────────────────────────────

/**
 * Escape a string strictly per RFC 8785 §3.2.2.2
 */
function escapeJcsString(str: string): string {
  let result = '"';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    switch (code) {
      case 0x22:
        result += '\\"';
        break;
      case 0x5c:
        result += "\\\\";
        break;
      case 0x08:
        result += "\\b";
        break;
      case 0x09:
        result += "\\t";
        break;
      case 0x0a:
        result += "\\n";
        break;
      case 0x0c:
        result += "\\f";
        break;
      case 0x0d:
        result += "\\r";
        break;
      default:
        if (code < 0x20) {
          result += "\\u" + code.toString(16).padStart(4, "0");
        } else {
          result += str[i];
        }
    }
  }
  result += '"';
  return result;
}

/**
 * Canonicalise arbitrary JSON data per RFC 8785 (JCS).
 * Keys are sorted lexicographically by UTF-16 code units.
 * No whitespace is preserved outside string literals.
 */
export function canonicalise(data: unknown): string {
  if (data === null) return "null";
  if (typeof data === "boolean") return data ? "true" : "false";
  if (typeof data === "number") {
    if (!Number.isFinite(data)) {
      throw new TypeError(
        "RFC 8785 JCS does not permit non-finite numbers (NaN/Infinity)",
      );
    }
    // IEEE 754 -0 must canonicalise to 0 per RFC 8785 §3.2.2.3
    if (Object.is(data, -0)) return "0";
    return JSON.stringify(data);
  }
  if (typeof data === "string") {
    return escapeJcsString(data);
  }
  if (Array.isArray(data)) {
    return "[" + data.map((item) => canonicalise(item)).join(",") + "]";
  }
  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return (
      "{" +
      keys.map((k) => escapeJcsString(k) + ":" + canonicalise(obj[k])).join(",") +
      "}"
    );
  }
  throw new TypeError(`Cannot canonicalise data of type ${typeof data}`);
}

// ── Salted SHA-256 Hashing (README §7) ──────────────────────────────────────

export interface SaltedHashResult {
  hash: string;
  salt: string;
  canonicalJson: string;
}

/**
 * Compute SHA-256 with a random salt over canonical RFC 8785 JSON (README §7).
 * Deterministic for identical input and salt.
 */
export function saltedHash(data: unknown, salt?: string): SaltedHashResult {
  const chosenSalt = salt ?? randomBytes(16).toString("hex");
  const canonicalJson = canonicalise({ data, salt: chosenSalt });
  const hash = createHash("sha256").update(canonicalJson, "utf8").digest("hex");
  return { hash, salt: chosenSalt, canonicalJson };
}

// ── Base64URL Helpers ───────────────────────────────────────────────────────

export function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64url");
}

export function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

// ── Key Pair & Signature Utilities ──────────────────────────────────────────

export interface KeyPairResult {
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
  publicKeyPem: string;
  privateKeyPem: string;
}

/**
 * Generate a standard Ed25519 key pair for synthetic issuers and holders.
 */
export function generateKeyPair(): KeyPairResult {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicKey: publicKey.export({ format: "jwk" }),
    privateKey: privateKey.export({ format: "jwk" }),
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
    privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  };
}

function toPublicKeyObject(key: KeyLike | JsonWebKey): KeyLike {
  if (typeof key === "object" && key !== null && "kty" in key) {
    return createPublicKey({ key: key as JsonWebKey, format: "jwk" });
  }
  return key as KeyLike;
}

function toPrivateKeyObject(key: KeyLike | JsonWebKey): KeyLike {
  if (typeof key === "object" && key !== null && "kty" in key) {
    return createPrivateKey({ key: key as JsonWebKey, format: "jwk" });
  }
  return key as KeyLike;
}

function signJwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  privateKey: KeyLike | JsonWebKey,
): string {
  const encHeader = base64UrlEncode(canonicalise(header));
  const encPayload = base64UrlEncode(canonicalise(payload));
  const signingInput = `${encHeader}.${encPayload}`;

  const keyObj = toPrivateKeyObject(privateKey);
  const sig = cryptoSign(null, Buffer.from(signingInput, "utf8"), keyObj);
  return `${signingInput}.${base64UrlEncode(sig)}`;
}

function verifyJwt(
  jwt: string,
  publicKey: KeyLike | JsonWebKey,
): { valid: boolean; header: Record<string, unknown>; payload: Record<string, unknown> } {
  const parts = jwt.split(".");
  if (parts.length !== 3) {
    return { valid: false, header: {}, payload: {} };
  }
  const [encHeader, encPayload, encSig] = parts as [string, string, string];
  const signingInput = `${encHeader}.${encPayload}`;
  const sig = Buffer.from(encSig, "base64url");

  let valid = false;
  try {
    const keyObj = toPublicKeyObject(publicKey);
    valid = cryptoVerify(null, Buffer.from(signingInput, "utf8"), keyObj, sig);
  } catch {
    valid = false;
  }

  try {
    const header = JSON.parse(base64UrlDecode(encHeader)) as Record<string, unknown>;
    const payload = JSON.parse(base64UrlDecode(encPayload)) as Record<string, unknown>;
    return { valid, header, payload };
  } catch {
    return { valid: false, header: {}, payload: {} };
  }
}

// ── Types ───────────────────────────────────────────────────────────────────

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

export interface IssueCredentialOptions {
  issuer: string; // e.g. "did:web:issuer.demo.oneid.local"
  subject: string; // e.g. "did:stellar:testnet:GBHOLDER..."
  claims: Record<string, unknown>;
  issuerPrivateKey: KeyLike | JsonWebKey;
  holderPublicKey: KeyLike | JsonWebKey;
  credentialStatusContractId: string;
  validFrom?: string;
  validUntil?: string;
  type?: string[];
  salt?: string;
}

export interface IssuedCredential {
  rawSdJwt: string; // Compact SD-JWT: <issuerJwt>~<d1>~<d2>...~
  issuerJwt: string;
  disclosures: Record<string, string>; // claimKey -> base64url disclosure
  claims: Record<string, unknown>;
  credentialHash: string; // SHA-256 hex registered in credential-status
  payload: Record<string, unknown>;
}

export interface CreatePresentationOptions {
  credential: IssuedCredential;
  approvedClaims: string[];
  holderPrivateKey: KeyLike | JsonWebKey;
  nonce: string;
  audience: string;
  expiresInSeconds?: number;
}

export type VerificationErrorCode =
  | "VALID"
  | "MALFORMED_PRESENTATION"
  | "INVALID_ISSUER_SIGNATURE"
  | "INVALID_HOLDER_BINDING"
  | "CREDENTIAL_EXPIRED"
  | "NONCE_MISMATCH"
  | "AUDIENCE_MISMATCH"
  | "TAMPERED_DISCLOSURE"
  | "TAMPERED_PRESENTATION"
  | "ISSUER_NOT_ACTIVE"
  | "CREDENTIAL_REVOKED"
  | "CONSENT_NOT_ACTIVE";

export interface VerifyPresentationOptions {
  expectedNonce: string;
  expectedAudience: string;
  issuerPublicKey: KeyLike | JsonWebKey;
  now?: number; // unix epoch in seconds
  consentReceiptHash?: string;
  checkIssuerActive?: (issuer: string) => Promise<boolean>;
  checkCredentialStatus?: (
    contractId: string,
    credentialHash: string,
  ) => Promise<boolean>;
  checkConsentActive?: (receiptHash: string) => Promise<boolean>;
}

export interface VerifyPresentationResult {
  verified: boolean;
  reason?: string;
  code: VerificationErrorCode;
  claims?: Record<string, unknown>;
  holder?: string;
  issuer?: string;
  credentialHash?: string | undefined;
}

// ── SD-JWT VC Issuance (README §13.1, §13.2) ─────────────────────────────────

/**
 * Issue a W3C VC 2.0 as SD-JWT VC with selective disclosure and holder binding.
 * Disclosures are generated for each subject claim.
 * CredentialStatus points to the credential-status contract on Soroban.
 */
export function issueCredential(options: IssueCredentialOptions): IssuedCredential {
  const validFrom = options.validFrom ?? new Date().toISOString();
  const validUntil = options.validUntil;

  // 1. Create individual disclosures for each claim
  const disclosures: Record<string, string> = {};
  const sdDigests: string[] = [];

  for (const [key, value] of Object.entries(options.claims)) {
    const claimSalt = randomBytes(16).toString("base64url");
    // Disclosure array: [salt, claimName, claimValue]
    const disclosureArr = [claimSalt, key, value];
    const disclosureStr = base64UrlEncode(canonicalise(disclosureArr));
    disclosures[key] = disclosureStr;

    // Digest: base64url(sha256(disclosureStr))
    const digest = createHash("sha256").update(disclosureStr, "utf8").digest("base64url");
    sdDigests.push(digest);
  }

  // Deterministically sort digests
  sdDigests.sort();

  // 2. Compute credential hash for Soroban credential-status contract
  // RFC 8785 canonical hash over core identity (issuer + subject + validFrom + salt)
  const salt = options.salt ?? randomBytes(16).toString("hex");
  const credIdentity = {
    issuer: options.issuer,
    subject: options.subject,
    validFrom,
    salt,
  };
  const { hash: credentialHash } = saltedHash(credIdentity, salt);

  // 3. Build W3C VC 2.0 SD-JWT VC payload
  const iat = Math.floor(Date.parse(validFrom) / 1000);
  const exp = validUntil ? Math.floor(Date.parse(validUntil) / 1000) : undefined;

  const payload: Record<string, unknown> = {
    "@context": ["https://www.w3.org/ns/credentials/v2"],
    type: options.type ?? ["VerifiableCredential", "OneIdKycCredential"],
    iss: options.issuer,
    issuer: options.issuer,
    sub: options.subject,
    iat,
    nbf: iat,
    validFrom,
    cnf: {
      jwk: options.holderPublicKey,
    },
    credentialStatus: {
      type: "StellarSorobanStatus2026",
      contract: options.credentialStatusContractId,
      id: credentialHash,
    },
    _sd: sdDigests,
    _sd_alg: "sha-256",
  };

  if (exp !== undefined) {
    payload["exp"] = exp;
    payload["validUntil"] = validUntil;
  }

  // 4. Sign Issuer JWT
  const issuerJwt = signJwt(
    { typ: "vc+sd-jwt", alg: "EdDSA" },
    payload,
    options.issuerPrivateKey,
  );

  // 5. Compact SD-JWT
  const disclosureList = Object.values(disclosures);
  const rawSdJwt = `${issuerJwt}~${disclosureList.join("~")}~`;

  return {
    rawSdJwt,
    issuerJwt,
    disclosures,
    claims: options.claims,
    credentialHash,
    payload,
  };
}

// ── Presentation Creation (README §13.3) ────────────────────────────────────

/**
 * Build an SD-JWT presentation that discloses ONLY approved claims.
 * Appends a Key-Binding JWT (KB-JWT) bound to the verifier's nonce and audience.
 */
export function createPresentation(options: CreatePresentationOptions): string {
  const { credential, approvedClaims, holderPrivateKey, nonce, audience } = options;

  // Filter ONLY disclosures for approved claims
  const presentedDisclosures: string[] = [];
  for (const claim of approvedClaims) {
    const disclosure = credential.disclosures[claim];
    if (disclosure) {
      presentedDisclosures.push(disclosure);
    }
  }

  // Presentation string before KB-JWT: <issuerJwt>~<d1>~<d2>~...~
  const disclosedPart = `${credential.issuerJwt}~${presentedDisclosures.join("~")}~`;

  // Compute sd_hash for key binding
  const sdHash = createHash("sha256").update(disclosedPart, "utf8").digest("base64url");

  // Create Key-Binding JWT (KB-JWT)
  const now = Math.floor(Date.now() / 1000);
  const kbPayload = {
    iat: now,
    exp: now + (options.expiresInSeconds ?? 300),
    nonce,
    aud: audience,
    sd_hash: sdHash,
  };

  const kbJwt = signJwt({ typ: "kb+jwt", alg: "EdDSA" }, kbPayload, holderPrivateKey);

  return `${disclosedPart}${kbJwt}`;
}

/** Alias for createPresentation per scaffold compatibility */
export const presentCredential = (
  credential: IssuedCredential,
  approvedClaims: string[],
  holderPrivateKey: KeyLike | JsonWebKey,
  nonce = "default-nonce",
  audience = "default-audience",
): string => {
  return createPresentation({
    credential,
    approvedClaims,
    holderPrivateKey,
    nonce,
    audience,
  });
};

// ── Verification (README §13.3) ─────────────────────────────────────────────

/**
 * Verify an SD-JWT presentation against cryptographic integrity and chain status.
 * Checks:
 * - Issuer signature
 * - Credential expiry
 * - Revealed disclosure digests match _sd entries
 * - Undisclosed claims are not revealed
 * - Holder key binding (KB-JWT signature, nonce, audience, sd_hash)
 * - Chain callbacks: active issuer, active credential, active consent
 */
export async function verifyPresentation(
  presentation: string,
  options: VerifyPresentationOptions,
): Promise<VerifyPresentationResult> {
  const parts = presentation.split("~");
  if (parts.length < 2) {
    return {
      verified: false,
      code: "MALFORMED_PRESENTATION",
      reason: "Malformed SD-JWT presentation structure",
    };
  }

  const issuerJwt = parts[0] as string;
  const kbJwt = parts[parts.length - 1] as string;
  const rawDisclosures = parts.slice(1, parts.length - 1).filter((d) => d.length > 0);

  // 1. Verify Issuer JWT
  const issuerJwtVerification = verifyJwt(issuerJwt, options.issuerPublicKey);
  if (!issuerJwtVerification.valid) {
    return {
      verified: false,
      code: "INVALID_ISSUER_SIGNATURE",
      reason: "Issuer signature is invalid or tampered",
    };
  }

  const payload = issuerJwtVerification.payload;
  const now = options.now ?? Math.floor(Date.now() / 1000);

  // 2. Check Credential Expiry
  if (typeof payload["exp"] === "number" && now > (payload["exp"] as number)) {
    return {
      verified: false,
      code: "CREDENTIAL_EXPIRED",
      reason: "Credential has expired",
    };
  }
  if (typeof payload["validUntil"] === "string") {
    const validUntilSec = Math.floor(Date.parse(payload["validUntil"] as string) / 1000);
    if (now > validUntilSec) {
      return {
        verified: false,
        code: "CREDENTIAL_EXPIRED",
        reason: "Credential has passed its validUntil timestamp",
      };
    }
  }

  // 3. Verify Disclosures against _sd array
  const sdArray = Array.isArray(payload["_sd"]) ? (payload["_sd"] as string[]) : [];
  const revealedClaims: Record<string, unknown> = {};

  for (const rawDisclosure of rawDisclosures) {
    const digest = createHash("sha256").update(rawDisclosure, "utf8").digest("base64url");
    if (!sdArray.includes(digest)) {
      return {
        verified: false,
        code: "TAMPERED_DISCLOSURE",
        reason: `Disclosure digest ${digest} does not exist in credential _sd array`,
      };
    }

    try {
      const decodedJson = base64UrlDecode(rawDisclosure);
      const parsed = JSON.parse(decodedJson) as [string, string, unknown];
      if (Array.isArray(parsed) && parsed.length >= 3) {
        const [, claimName, claimValue] = parsed;
        revealedClaims[claimName] = claimValue;
      }
    } catch {
      return {
        verified: false,
        code: "TAMPERED_DISCLOSURE",
        reason: "Failed to parse disclosure contents",
      };
    }
  }

  // 4. Verify Holder Binding (KB-JWT)
  const cnf = payload["cnf"] as { jwk?: JsonWebKey } | undefined;
  if (!cnf || !cnf.jwk) {
    return {
      verified: false,
      code: "INVALID_HOLDER_BINDING",
      reason: "Credential lacks holder confirmation key (cnf.jwk)",
    };
  }

  if (!kbJwt || kbJwt.trim().length === 0) {
    return {
      verified: false,
      code: "INVALID_HOLDER_BINDING",
      reason: "Missing Key-Binding JWT",
    };
  }

  const kbVerification = verifyJwt(kbJwt, cnf.jwk);
  if (!kbVerification.valid) {
    return {
      verified: false,
      code: "INVALID_HOLDER_BINDING",
      reason: "Key-Binding JWT signature does not match holder confirmation key",
    };
  }

  const kbPayload = kbVerification.payload;

  // Check Nonce
  if (kbPayload["nonce"] !== options.expectedNonce) {
    return {
      verified: false,
      code: "NONCE_MISMATCH",
      reason: `Presentation nonce '${kbPayload["nonce"]}' does not match expected nonce '${options.expectedNonce}'`,
    };
  }

  // Check Audience
  if (kbPayload["aud"] !== options.expectedAudience) {
    return {
      verified: false,
      code: "AUDIENCE_MISMATCH",
      reason: `Presentation audience '${kbPayload["aud"]}' does not match expected audience '${options.expectedAudience}'`,
    };
  }

  // Check sd_hash
  const disclosedPart = presentation.slice(0, presentation.lastIndexOf("~") + 1);
  const expectedSdHash = createHash("sha256")
    .update(disclosedPart, "utf8")
    .digest("base64url");

  if (kbPayload["sd_hash"] !== expectedSdHash) {
    return {
      verified: false,
      code: "TAMPERED_PRESENTATION",
      reason: "Presentation sd_hash does not match disclosed claims",
    };
  }

  // 5. Injected Chain Callbacks
  const issuer = String(payload["issuer"] || payload["iss"] || "");
  const credentialStatus = payload["credentialStatus"] as
    | { contract: string; id: string }
    | undefined;

  if (options.checkIssuerActive) {
    const isIssuerActive = await options.checkIssuerActive(issuer);
    if (!isIssuerActive) {
      return {
        verified: false,
        code: "ISSUER_NOT_ACTIVE",
        reason: `Issuer ${issuer} is suspended or not registered in issuer-registry`,
      };
    }
  }

  if (options.checkCredentialStatus && credentialStatus) {
    const isCredActive = await options.checkCredentialStatus(
      credentialStatus.contract,
      credentialStatus.id,
    );
    if (!isCredActive) {
      return {
        verified: false,
        code: "CREDENTIAL_REVOKED",
        reason:
          "Credential is not active on credential-status contract (revoked or expired)",
      };
    }
  }

  if (options.checkConsentActive && options.consentReceiptHash) {
    const isConsentActive = await options.checkConsentActive(options.consentReceiptHash);
    if (!isConsentActive) {
      return {
        verified: false,
        code: "CONSENT_NOT_ACTIVE",
        reason: "Consent receipt has been withdrawn or is expired on consent-registry",
      };
    }
  }

  // All checks passed
  return {
    verified: true,
    code: "VALID",
    claims: revealedClaims,
    holder: String(payload["sub"] || ""),
    issuer,
    credentialHash: credentialStatus?.id,
  };
}
