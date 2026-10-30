# Data Retention & Deletion Policy (README §20)

> **Important Regulatory Notice:**
> This retention and deletion specification has been prepared in alignment with **Nigeria Data Protection Act 2023 (NDPA 2023)** data lifecycle standards and **W3C Verifiable Credentials Data Model v2.0** best practices.
> **NO CLAIM OF FORMAL STATUTORY COMPLIANCE OR AFFILIATION** is made with NIMC, NINAuth, NDPC, CBN, or any government body.

---

## 1. Core Lifecycle Rules

1. **On-Chain Immutability with Zero Personal Data:**
   Because blockchain ledgers cannot be deleted, Soroban smart contracts store strictly salted cryptographic hashes and state enums. Even in the event of ledger longevity, no personal identifiable information (PII) exists on-chain to violate the citizen's right to erasure.

2. **Citizen-Driven Erasure (Off-Chain Right to Forget):**
   A citizen may at any time request full deletion of their off-chain account and synthetic demo profile:

   - Calling account deletion purges the citizen row from `users`.
   - Associated entries in `credentials` (including SD-JWT payloads) are purged.
   - Associated entries in `consents` have active permissions cancelled and payloads wiped.
   - Any future presentation of the citizen's credentials fails closed on-chain because status verification fails.

3. **Consent Expiry & Withdrawal:**
   - Consent receipts default to a finite lifetime (1 to 24 hours).
   - Once expired, relying parties are denied access by both off-chain API guards and on-chain contract checks.
   - Citizens can withdraw consent at any time. Per README Rule #7, the UI clearly discloses: _"Withdrawing consent affects FUTURE sharing only; it does not erase data already received by another institution."_

---

## 2. Retention Schedules by Store

| Store                                 | Data Classification           | Standard Retention Window          | Trigger for Deletion                                         | Deletion Action                                          |
| :------------------------------------ | :---------------------------- | :--------------------------------- | :----------------------------------------------------------- | :------------------------------------------------------- |
| **User Account & Synthetic Profile**  | Synthetic Profile             | Account active duration            | User request or demo reset (`pnpm demo:reset`)               | Hard delete (`DELETE FROM users WHERE id = $1`)          |
| **Issued Credentials (`raw_sd_jwt`)** | Synthetic Credential          | Validity duration (up to 365 days) | Revocation, credential expiry, or user deletion              | Immediate wipe of raw JWT and selective disclosure salts |
| **Consent Records**                   | Transaction Authorization     | 30 days post-expiry                | 30-day tombstone expiration                                  | Hard delete of off-chain record                          |
| **Claim Requests (`claim_requests`)** | Verification Nonce & Claims   | 24 hours                           | 24 hours elapsed or completion                               | Automated cron cleanup                                   |
| **Correction Tickets**                | Institutional Update Tracking | 90 days post-terminal status       | 90 days after all institutions reach `applied` or `rejected` | Database purge                                           |
| **Tamper-Evident Audit Chain**        | Operational Event Log         | 365 days                           | Rolling 1-year archive window                                | Export to compressed archive; no PII stored              |
| **WebAuthn Challenges (Memory)**      | Cryptographic Nonce           | 5 minutes                          | Verification or 5-minute timeout                             | Memory map key deletion                                  |
| **Auth Rate Limiting (Memory)**       | IP Hit Counter                | 60 seconds                         | 60-second sliding window reset                               | Automatic garbage collection                             |

---

## 3. Automated Deletion & Verification Procedures

- Automated database cleanup jobs run periodically to purge expired claim requests and expired consent records.
- In local development and demo testing, running `pnpm demo:reset` drops and recreates the PostgreSQL database and resets the contract deployments, guaranteeing zero residual state.
- Automated tests in `apps/api/src/pii-scan.test.ts` continuously verify that no personal data leaks into on-chain events, memos, or contract storage.
