# ONEiD Integration Test Evidence (README §18.1, §18.5, §21, §25)

## 1. Summary of Execution

- **Date**: 2026-10-29
- **Scope**: API integration test suite, 4 defining journeys, exception states, fee sponsorship (0 XLM holder flow), automated on-chain PII scan.
- **Result**: ALL TESTS PASSED (66/66 API tests, 14/14 monorepo packages green).

## 2. Four Defining Journeys (§18.1)

1. **Journey 1: Open an account**
   - Bank requests specific identity attributes (`over18`, `kycTier`).
   - Citizen approves request holding **zero XLM**; fee sponsorship via `FEE_SPONSOR_SECRET` submits on-chain consent receipt.
   - Verified: no premature disclosure, only approved claims disclosed.
2. **Journey 2: Correct my record**
   - Citizen submits correction ticket targeting Bank and Telecom.
   - Bank updates its status to `applied`; Telecom updates its status independently to `rejected`.
   - Verified: authority stays with the institution; citizen views independent multi-institution outcomes.
3. **Journey 3: Verify a credential**
   - Verifier requests claims, citizen provides consent receipt.
   - Holder builds presentation with selective disclosure and KB-JWT.
   - In-order verification pipeline checks signature, holder binding, nonce/audience, active issuer, active credential, active consent receipt.
4. **Journey 4: Issue a credential**
   - Citizen applies; issuer reviews application.
   - Issuer issues SD-JWT VC, registers credential hash in `credential-status` contract.
   - Issuer revokes credential; subsequent verification fails closed with `CREDENTIAL_REVOKED`.

## 3. Exception States Coverage (§18.5)

- **Expired consent**: `CONSENT_EXPIRED` (403).
- **Withdrawn consent**: `CONSENT_WITHDRAWN` (403), with plain-language notice that withdrawing consent does not erase past received data.
- **Revoked credential**: `CREDENTIAL_REVOKED` (422).
- **Suspended issuer**: `ISSUER_NOT_ACTIVE` (422).
- **Wrong-role action**: `FORBIDDEN_ROLE` (403) fail closed.
- **Rejected correction**: Institution records `rejected` outcome with reason code.
- **Partial update**: Institution records `partially_applied` outcome with reason code.
- **Failed retry**: Simulation triggers error; subsequent health/retry recovers.
- **Chain unavailable**: `CHAIN_UNAVAILABLE` (503) retryable error.

## 4. Automated On-Chain PII Scan (§20.1, §25)

- Automated scanner in `src/pii-scan.test.ts` scans all contract storage keys, storage values, event topics, event data, and transaction memos.
- Verified: Zero personal data (names, synthetic NINs, dates of birth, addresses) exists on-chain.
- Synthetic PII injection test confirms scanner fails closed if any PII appears in memos or events.
