import { describe, it, expect } from "vitest";
import {
  canonicalise,
  saltedHash,
  generateKeyPair,
  issueCredential,
  createPresentation,
  verifyPresentation,
} from "./index.js";

describe("@oneid/vc", () => {
  // Synthetic test fixture per README §13.2
  const SYNTHETIC_SUBJECT =
    "did:stellar:testnet:GBHOLDEREXAMPLE0000000000000000000000000000000000000000";
  const SYNTHETIC_ISSUER = "did:web:issuer.demo.oneid.local";
  const SYNTHETIC_CLAIMS = {
    fullName: "Adaeze Okonkwo",
    dateOfBirth: "1990-03-12",
    nin: "1234 5678 9012", // Placeholder pattern per Rule 2
    address: "Lagos, Nigeria",
    kycTier: 2,
    over18: true,
  };

  const issuerKeys = generateKeyPair();
  const holderKeys = generateKeyPair();
  const attackerKeys = generateKeyPair();

  const credentialStatusContractId =
    "CB2KONEIDCREDENTIALSTATUSLOCALDEMOCONTRACTID000000000000000";

  describe("RFC 8785 JSON Canonicalization Scheme (JCS)", () => {
    it("canonicalises object keys in lexicographical UTF-16 code unit order", () => {
      const obj1 = { z: 1, a: 2, m: 3 };
      const obj2 = { a: 2, m: 3, z: 1 };
      expect(canonicalise(obj1)).toBe('{"a":2,"m":3,"z":1}');
      expect(canonicalise(obj1)).toBe(canonicalise(obj2));
    });

    it("strips whitespace outside string literals", () => {
      const complex = {
        name: "Adaeze Okonkwo",
        nested: { innerKey: "with space value", array: [1, 2, "three"] },
      };
      const canon = canonicalise(complex);
      expect(canon).toBe(
        '{"name":"Adaeze Okonkwo","nested":{"array":[1,2,"three"],"innerKey":"with space value"}}',
      );
    });

    it("handles -0 as 0 per RFC 8785 §3.2.2.3", () => {
      expect(canonicalise(-0)).toBe("0");
    });

    it("rejects non-finite numbers (NaN, Infinity)", () => {
      expect(() => canonicalise(NaN)).toThrow(TypeError);
      expect(() => canonicalise(Infinity)).toThrow(TypeError);
      expect(() => canonicalise({ bad: -Infinity })).toThrow(TypeError);
    });
  });

  describe("saltedHash (README §7)", () => {
    it("returns deterministic hashes for identical input and salt", () => {
      const input = { subject: "Adaeze", tier: 2 };
      const fixedSalt = "abcd1234ef567890";

      const res1 = saltedHash(input, fixedSalt);
      const res2 = saltedHash(input, fixedSalt);

      expect(res1.hash).toBe(res2.hash);
      expect(res1.salt).toBe(fixedSalt);
      expect(res1.canonicalJson).toBe(res2.canonicalJson);
    });

    it("generates different hashes for different salts", () => {
      const input = { subject: "Adaeze", tier: 2 };
      const res1 = saltedHash(input, "saltA");
      const res2 = saltedHash(input, "saltB");

      expect(res1.hash).not.toBe(res2.hash);
    });

    it("automatically generates random salt when omitted", () => {
      const input = { subject: "Adaeze" };
      const res1 = saltedHash(input);
      const res2 = saltedHash(input);

      expect(res1.salt).toBeDefined();
      expect(res2.salt).toBeDefined();
      expect(res1.salt).not.toBe(res2.salt);
    });
  });

  describe("Selective Disclosure & SD-JWT VC Flow", () => {
    const issuedCredential = issueCredential({
      issuer: SYNTHETIC_ISSUER,
      subject: SYNTHETIC_SUBJECT,
      claims: SYNTHETIC_CLAIMS,
      issuerPrivateKey: issuerKeys.privateKeyPem,
      holderPublicKey: holderKeys.publicKey,
      credentialStatusContractId,
      validFrom: "2026-01-15T00:00:00Z",
      validUntil: "2027-01-15T00:00:00Z",
    });

    it("issues credential with valid W3C VC 2.0 structure and digests in _sd", () => {
      expect(issuedCredential.credentialHash).toBeDefined();
      expect(issuedCredential.payload["_sd"]).toBeInstanceOf(Array);
      // All 6 claims have digests in _sd
      expect((issuedCredential.payload["_sd"] as string[]).length).toBe(6);
      expect(issuedCredential.payload["cnf"]).toEqual({ jwk: holderKeys.publicKey });
    });

    it("discloses ONLY approved claims and undisclosed claims are not recoverable", async () => {
      const nonce = "nonce-test-1001";
      const audience = "https://anchor.demo.oneid.local";

      // Disclose ONLY fullName and over18 (hide nin, dateOfBirth, address, kycTier)
      const approvedClaims = ["fullName", "over18"];
      const presentation = createPresentation({
        credential: issuedCredential,
        approvedClaims,
        holderPrivateKey: holderKeys.privateKeyPem,
        nonce,
        audience,
      });

      // Verify that undisclosed claim texts (like NIN or address) do NOT appear in the presentation string
      expect(presentation).not.toContain("1234 5678 9012");
      expect(presentation).not.toContain("Lagos, Nigeria");
      expect(presentation).not.toContain("1990-03-12");

      const result = await verifyPresentation(presentation, {
        expectedNonce: nonce,
        expectedAudience: audience,
        issuerPublicKey: issuerKeys.publicKeyPem,
      });

      expect(result.verified).toBe(true);
      expect(result.code).toBe("VALID");
      expect(result.claims).toEqual({
        fullName: "Adaeze Okonkwo",
        over18: true,
      });
      // Undisclosed claims are undefined in verified result
      expect(result.claims?.["nin"]).toBeUndefined();
      expect(result.claims?.["address"]).toBeUndefined();
    });

    it("rejects wrong or replayed nonce", async () => {
      const presentation = createPresentation({
        credential: issuedCredential,
        approvedClaims: ["fullName"],
        holderPrivateKey: holderKeys.privateKeyPem,
        nonce: "fresh-nonce-123",
        audience: "https://fintech.demo.oneid.local",
      });

      const result = await verifyPresentation(presentation, {
        expectedNonce: "replayed-or-different-nonce-999",
        expectedAudience: "https://fintech.demo.oneid.local",
        issuerPublicKey: issuerKeys.publicKeyPem,
      });

      expect(result.verified).toBe(false);
      expect(result.code).toBe("NONCE_MISMATCH");
    });

    it("rejects wrong audience", async () => {
      const presentation = createPresentation({
        credential: issuedCredential,
        approvedClaims: ["fullName"],
        holderPrivateKey: holderKeys.privateKeyPem,
        nonce: "test-nonce",
        audience: "https://anchor.demo.oneid.local",
      });

      const result = await verifyPresentation(presentation, {
        expectedNonce: "test-nonce",
        expectedAudience: "https://impostor-site.example.com",
        issuerPublicKey: issuerKeys.publicKeyPem,
      });

      expect(result.verified).toBe(false);
      expect(result.code).toBe("AUDIENCE_MISMATCH");
    });

    it("rejects tampered credential signature", async () => {
      const presentation = createPresentation({
        credential: issuedCredential,
        approvedClaims: ["fullName"],
        holderPrivateKey: holderKeys.privateKeyPem,
        nonce: "test-nonce",
        audience: "https://anchor.demo.oneid.local",
      });

      // Tamper with issuer JWT part
      const parts = presentation.split("~");
      const jwtParts = parts[0]!.split(".");
      // Tamper byte 0 of signature
      const sigBytes = Buffer.from(jwtParts[2]!, "base64url");
      sigBytes[0] = ((sigBytes[0] ?? 0) + 1) % 256;
      jwtParts[2] = sigBytes.toString("base64url");
      parts[0] = jwtParts.join(".");
      const tamperedPresentation = parts.join("~");

      const result = await verifyPresentation(tamperedPresentation, {
        expectedNonce: "test-nonce",
        expectedAudience: "https://anchor.demo.oneid.local",
        issuerPublicKey: issuerKeys.publicKeyPem,
      });

      expect(result.verified).toBe(false);
      expect(result.code).toBe("INVALID_ISSUER_SIGNATURE");
    });

    it("rejects tampered disclosure claim value", async () => {
      const presentation = createPresentation({
        credential: issuedCredential,
        approvedClaims: ["fullName"],
        holderPrivateKey: holderKeys.privateKeyPem,
        nonce: "test-nonce",
        audience: "https://anchor.demo.oneid.local",
      });

      const parts = presentation.split("~");
      // Replace disclosure with a fake forged disclosure
      const fakeDisclosure = Buffer.from(
        JSON.stringify(["fakeSalt", "fullName", "Impostor Name"]),
      ).toString("base64url");
      parts[1] = fakeDisclosure;
      const tamperedPresentation = parts.join("~");

      const result = await verifyPresentation(tamperedPresentation, {
        expectedNonce: "test-nonce",
        expectedAudience: "https://anchor.demo.oneid.local",
        issuerPublicKey: issuerKeys.publicKeyPem,
      });

      expect(result.verified).toBe(false);
      expect(result.code).toBe("TAMPERED_DISCLOSURE");
    });

    it("rejects invalid holder binding when presentation is signed by an attacker key", async () => {
      const presentation = createPresentation({
        credential: issuedCredential,
        approvedClaims: ["fullName"],
        holderPrivateKey: attackerKeys.privateKeyPem, // Attacker trying to present stolen credential
        nonce: "test-nonce",
        audience: "https://anchor.demo.oneid.local",
      });

      const result = await verifyPresentation(presentation, {
        expectedNonce: "test-nonce",
        expectedAudience: "https://anchor.demo.oneid.local",
        issuerPublicKey: issuerKeys.publicKeyPem,
      });

      expect(result.verified).toBe(false);
      expect(result.code).toBe("INVALID_HOLDER_BINDING");
    });

    it("rejects expired credential", async () => {
      const expiredCred = issueCredential({
        issuer: SYNTHETIC_ISSUER,
        subject: SYNTHETIC_SUBJECT,
        claims: { fullName: "Adaeze Okonkwo" },
        issuerPrivateKey: issuerKeys.privateKeyPem,
        holderPublicKey: holderKeys.publicKey,
        credentialStatusContractId,
        validFrom: "2020-01-01T00:00:00Z",
        validUntil: "2021-01-01T00:00:00Z",
      });

      const presentation = createPresentation({
        credential: expiredCred,
        approvedClaims: ["fullName"],
        holderPrivateKey: holderKeys.privateKeyPem,
        nonce: "test-nonce",
        audience: "https://anchor.demo.oneid.local",
      });

      const result = await verifyPresentation(presentation, {
        expectedNonce: "test-nonce",
        expectedAudience: "https://anchor.demo.oneid.local",
        issuerPublicKey: issuerKeys.publicKeyPem,
        now: Math.floor(Date.parse("2026-01-01T00:00:00Z") / 1000), // Verification time is after 2021
      });

      expect(result.verified).toBe(false);
      expect(result.code).toBe("CREDENTIAL_EXPIRED");
    });

    it("invokes and enforces injected chain checks (issuer, credential, consent)", async () => {
      const presentation = createPresentation({
        credential: issuedCredential,
        approvedClaims: ["fullName"],
        holderPrivateKey: holderKeys.privateKeyPem,
        nonce: "test-nonce",
        audience: "https://anchor.demo.oneid.local",
      });

      // 1. Inactive issuer callback fails
      const resIssuer = await verifyPresentation(presentation, {
        expectedNonce: "test-nonce",
        expectedAudience: "https://anchor.demo.oneid.local",
        issuerPublicKey: issuerKeys.publicKeyPem,
        checkIssuerActive: async () => false,
      });
      expect(resIssuer.verified).toBe(false);
      expect(resIssuer.code).toBe("ISSUER_NOT_ACTIVE");

      // 2. Revoked credential callback fails
      const resCred = await verifyPresentation(presentation, {
        expectedNonce: "test-nonce",
        expectedAudience: "https://anchor.demo.oneid.local",
        issuerPublicKey: issuerKeys.publicKeyPem,
        checkIssuerActive: async () => true,
        checkCredentialStatus: async () => false,
      });
      expect(resCred.verified).toBe(false);
      expect(resCred.code).toBe("CREDENTIAL_REVOKED");

      // 3. Withdrawn consent callback fails
      const resConsent = await verifyPresentation(presentation, {
        expectedNonce: "test-nonce",
        expectedAudience: "https://anchor.demo.oneid.local",
        issuerPublicKey: issuerKeys.publicKeyPem,
        consentReceiptHash: "dummy-receipt-hash",
        checkIssuerActive: async () => true,
        checkCredentialStatus: async () => true,
        checkConsentActive: async () => false,
      });
      expect(resConsent.verified).toBe(false);
      expect(resConsent.code).toBe("CONSENT_NOT_ACTIVE");

      // 4. All callbacks return true -> success
      const resSuccess = await verifyPresentation(presentation, {
        expectedNonce: "test-nonce",
        expectedAudience: "https://anchor.demo.oneid.local",
        issuerPublicKey: issuerKeys.publicKeyPem,
        consentReceiptHash: "dummy-receipt-hash",
        checkIssuerActive: async () => true,
        checkCredentialStatus: async () => true,
        checkConsentActive: async () => true,
      });
      expect(resSuccess.verified).toBe(true);
      expect(resSuccess.code).toBe("VALID");
    });
  });
});
