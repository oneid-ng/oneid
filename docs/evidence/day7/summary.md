# Day 7 E2E Test Evidence & Acceptance Target Verification

This report documents the end-to-end user journeys, resilience drills, and acceptance target verifications implemented in accordance with **README §21** (User Journeys) and **README §25** (Acceptance Targets).

All Playwright tests passed cleanly (24/24 passing). Evidence screenshots are captured and cataloged below.

---

## 1. Journey Screenshots & Results

| Test Name                                                   | Description                                                                                                                                                                                                                                                          | Evidence Screenshot                                                              | Result   |
| :---------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------- | :------- |
| **Journey 1: Open an account via bank request and consent** | Citizen reviews selective disclosure request from Tier-2 bank, inspects claim-by-claim checkboxes and mandatory withdrawal notice, approves disclosure, and receives on-chain consent receipt.                                                                       | [bank-account-opening.png](bank-account-opening.png)                             | **PASS** |
| **Journey 2: Multi-Party Record Correction**                | Citizen views multi-institution correction timeline across Identity Management Authority (NIMC) (_applied_), Apex Trust Bank (_rejected_), and Demo Telecom Nigeria (_partially_applied_). Demonstrates Rule #6: Authority stays with each institution.              | [multi-institution-corrections.png](multi-institution-corrections.png)           | **PASS** |
| **Journey 3: Credential Verification & Denied States**      | Tests all fail-closed exception states: `CONSENT_EXPIRED`, `CONSENT_WITHDRAWN`, `CREDENTIAL_REVOKED`, `ISSUER_NOT_ACTIVE`, `FORBIDDEN_ROLE_403`. Ensures system fails closed by default.                                                                             | [credential-verification-and-denied.png](credential-verification-and-denied.png) | **PASS** |
| **Journey 4: Issue and Revoke Credential**                  | Identity Issuer issues W3C SD-JWT credential anchored on-chain with selective disclosure hashes, and executes on-chain revocation transition to terminal state.                                                                                                      | [credential-issue-and-revoke.png](credential-issue-and-revoke.png)               | **PASS** |
| **Journey 5: Anchor Onboarding Flow (README §16)**          | Mock Anchor interactive deposit onboarding flow (SEP-1, SEP-10, SEP-12, SEP-24 demo). Verifies on-chain issuer, credential status, and consent receipt; proceeds without document upload when valid, and is blocked when consent is withdrawn or credential revoked. | [anchor-onboarding.png](anchor-onboarding.png)                                   | **PASS** |
| **Resilience Drills: FEATURE_SIMULATED_FAILURES**           | Admin chaos engineering panel tests RPC down (`CHAIN_UNAVAILABLE`), transaction failure, partial synchronisation (`partial_sync`), and retry recovery.                                                                                                               | [resilience-drills.png](resilience-drills.png)                                   | **PASS** |
| **Section 25 Acceptance Targets Verification**              | Formal verification against all six acceptance targets in README §25: consent privacy, role permissions, credential invalidation, sovereign corrections, reliability, and cryptographic evidence.                                                                    | [acceptance-targets.png](acceptance-targets.png)                                 | **PASS** |

---

## 2. README Section 25 Acceptance Target Audit

- **Target 1: Consent** — No claim disclosed before explicit approval. Verified by Playwright selective disclosure assertion and `CONSENT_EXPIRED` / `CONSENT_WITHDRAWN` enforcement.
- **Target 2: Permissions** — Wrong-role actions are rejected in API and contracts. Verified by `RoleGuard` fail-closed 403 test.
- **Target 3: Credentials** — Expired or revoked credentials fail checks on-chain. Verified by `CREDENTIAL_REVOKED` on Soroban contract.
- **Target 4: Corrections** — Each institution updates only its own outcome in `correction-tracker`. Verified by heterogeneous outcomes across NIMC, Bank, and Telecom.
- **Target 5: Reliability** — Local demo covers denial, RPC failure, partial sync, and retry.
- **Target 6: Evidence** — All logs, screenshots, and test artifacts persisted and verified in `docs/evidence/day7/`.
