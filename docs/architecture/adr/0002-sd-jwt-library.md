# ADR-0002: SD-JWT VC selective disclosure implementation

**Status:** Accepted  
**Date:** 2026-10-27  
**Owners:** Daniel Omodiagbe, Hassana Abdullahi, Ahmad Amin

## Context

ONEiD requires W3C Verifiable Credentials Data Model v2.0 issued as SD-JWT VC
(IETF SD-JWT / selective disclosure JWT) per README §7 and §13.
The credential model must satisfy:

1. Selective claim disclosure: the holder can present individual approved claims
   (e.g., `fullName` and `over18`) while hiding others (`nin`, `dateOfBirth`, `address`).
2. Holder binding: the credential is bound to the holder's key via a `cnf` (confirmation)
   claim, preventing credential replay or theft.
3. Cryptographic integrity and tamper-evidence: any modification of claims or disclosures
   must fail verification.
4. Deterministic hashing: RFC 8785 JSON Canonicalization Scheme (JCS) and SHA-256 with
   random salt for consent receipts and credential status registry.
5. Zero mandatory external dependencies: all issuing, presentation, and verification
   helpers must run offline and locally without cloud API dependencies (Rule 10).

## Decision

We adopt a native, spec-compliant implementation of IETF SD-JWT and W3C VC 2.0 in
`packages/vc` built on Node.js native `node:crypto` (Ed25519 / ES256 / SHA-256) and
RFC 8785 JCS canonicalization.

Key technical specifications implemented:

1. **Canonicalization & Hashing:**
   - RFC 8785 (JCS) deterministic JSON canonicalization.
   - SHA-256 with cryptographically secure random salt (`crypto.randomBytes`).
2. **SD-JWT Format:**
   - Disclosures are structured as `[salt, claimName, claimValue]` and base64url encoded.
   - Digests in the JWT payload are `base64url(sha256(disclosure))`.
   - Undisclosed claims are replaced with selective disclosure digests in `_sd`.
3. **Holder Binding (`cnf`):**
   - The credential binds the holder's public key in the `cnf` claim.
   - Key-Binding JWT (`kb+jwt`) binds verifier `nonce`, `aud` (audience), and `sd_hash`.
4. **Chain Callback Integration:**
   - Verification performs synchronous cryptographic checks (signature, claims, digests,
     nonce, audience, expiry) and invokes injected async callbacks for Soroban on-chain
     checks (`checkIssuerActive`, `checkCredentialStatus`, `checkConsentActive`).

## Consequences

- No external third-party supply-chain bloat or vulnerable dependencies.
- 100% deterministic and runnable offline in local and testnet environments.
- Fully compatible with W3C VC 2.0 data model and IETF SD-JWT specification.
