# ADR-0003: Credential plaintext not stored on server

**Status:** Accepted
**Date:** 2026-10-28
**Author:** Daniel Omodiagbe (backend)

---

## Context

When the issuer issues a W3C SD-JWT VC, the server must decide whether to retain
the full credential payload in the database after returning it to the holder.

The credential payload contains selective-disclosure claims from the citizen's
synthetic profile (fullName, dateOfBirth, nin, kycTier, etc.). Storing it in
plaintext on the server would:

1. Duplicate PII in an additional off-chain store beyond the holder's wallet.
2. Increase the attack surface: a DB breach would expose the full credential
   for every issued credential in the system.
3. Conflict with README §7 ("data minimisation") and §20.1 ("collect, share and
   store the least data possible").

## Decision

**The API server stores only the salted credential hash, issuer, holder ID,
expiry, chain transaction reference, and status in the `credentials` table.
The full SD-JWT VC string is returned to the caller exactly once (in the issue
response) and is NOT persisted beyond that response.**

The holder's wallet is responsible for storing the credential, encrypted, in
IndexedDB or equivalent device storage.

The server retains:

- `credential_hash` (for on-chain status lookup and revocation)
- `issuer_id` (for own-only revocation guard)
- `user_id` (for `/v1/credentials` list endpoint)
- `expires_at`, `chain_tx`, `ledger`, `status`

The server does NOT store:

- The SD-JWT string
- The credential claims in plaintext
- The salt (returned once to the caller for verification purposes)

## Consequences

- The `/v1/credentials` list endpoint returns metadata (hash, status, expiry)
  only, not the full credential. Callers must hold their own copy.
- Revoking by hash works via `credentials.credential_hash` — no plaintext needed.
- Verification by verifiers uses the SD-JWT presentation submitted by the holder
  directly; the server never needs the plaintext credential to verify.
- If a citizen loses their device and credential, they must re-apply.
  Key recovery design is deferred to Phase 2 (README §29).

## Alternatives considered

1. **Store encrypted ciphertext**: Adds key management complexity with no
   significant benefit for MVP demo. Deferred as a Phase 3 enhancement.
2. **Store plaintext for convenience**: Rejected — violates data minimisation,
   increases breach scope.

## References

- README §7 (no personal data on-chain, data minimisation)
- README §13.3 (presentation and verification flow — holder delivers credential)
- README §20.1 (privacy by design)
- README §15 (DB schema — credentials table)
