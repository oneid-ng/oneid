# ONEiD End-to-End System Verification & Release Report

**Project**: ONEiD (Reusable, Consent-Based KYC for Nigeria on Stellar)  
**Verification Date**: 2026-10-29  
**Source of Truth**: `README.md`

---

## 1. Monorepo Verification Matrix

| Pipeline Stage                  | Scope                            | Execution Command                    |            Result             |
| ------------------------------- | -------------------------------- | ------------------------------------ | :---------------------------: |
| **Lint**                        | All 12 packages & apps           | `pnpm lint`                          |  **14/14 PASSED (0 errors)**  |
| **Typecheck**                   | All TypeScript projects          | `pnpm typecheck`                     |  **14/14 PASSED (0 errors)**  |
| **Unit & Integration Tests**    | Vitest across packages & apps    | `pnpm test`                          | **14/14 PASSED (66+ tests)**  |
| **Production Build**            | Fastify API + Next.js App Router | `pnpm build`                         |  **8/8 PASSED (17 routes)**   |
| **Accessibility (WCAG 2.1 AA)** | Playwright + Axe audit           | `pnpm --filter @oneid/web test:a11y` | **7/7 PASSED (0 violations)** |
| **PII On-Chain Audit**          | Storage, events, memos           | `apps/api/src/pii-scan.test.ts`      |     **PASSED (0 leaks)**      |

---

## 2. Non-Negotiable Rules Compliance

1. **Rule 1: No Personal Data On-Chain**
   - Soroban contract storage keys, values, and transaction memos store only salted hashes, timestamps, addresses, and status codes. Verified by automated PII regex scanner `apps/api/src/pii-scan.test.ts`.
2. **Rule 2: Synthetic Data Only**
   - All tests, seed scripts, and UI samples use synthetic NIN (`100...`), synthetic BVN, and mock profiles. No real personal records are stored or referenced.
3. **Rule 3: Stellar Local / Testnet Only**
   - All network calls are locked to `http://localhost:8000` / Stellar Testnet horizon and Soroban RPC.
4. **Rule 4: Zero Compliance or Affiliation Claims**
   - UI footers and banners display explicit disclaimers: no claims of compliance, certification, or affiliation with NIMC, NINAuth, CBN, NDPC, or SDF.
5. **Rule 5: Fail-Closed Security**
   - Unauthenticated sessions, expired/withdrawn consent, revoked credentials, suspended issuers, and wrong roles return immediate 403 / denied states. Verified by `apps/web/tests/role-guard.spec.ts`.
6. **Rule 6: Institutional Sovereignty**
   - Each institution updates only its own correction ticket outcome using its dedicated keypair (`POST /v1/corrections/:id/respond`). Verified in `apps/api/src/routes/corrections.test.ts` and `apps/web/src/app/(bank)/bank/page.tsx`.
7. **Rule 7: Withdrawn Consent Scope**
   - Withdrawn consent affects FUTURE sharing only. Stated prominently across consent dialogs and the exceptions UX.
8. **Rule 8: RFC 8785 Canonical Hashing**
   - All hashes are computed using RFC 8785 (JCS) canonical JSON, SHA-256, and random salt.
9. **Rule 9: Architecture & Monorepo Layout**
   - Strictly adheres to the stack in README sections 8 and 9 (pnpm, Turborepo, Rust/Soroban, TypeScript, Fastify, Next.js, PostgreSQL, Zod, Vitest, Playwright, Docker).
10. **Rule 10: Zero-XLM Citizen Flow**
    - Citizens with zero XLM balance successfully issue consent and complete selective disclosure via relayer fee sponsorship. Verified by integration test in `apps/api/src/journeys-integration.test.ts`.
11. **Rule 11: Async UI States**
    - Every asynchronous action implements loading, success, error, and retry states.

---

## 3. Evidence Artifacts

- **Day 5 API Integration & Zero-XLM Evidence**: `docs/evidence/day5/summary.md` and `docs/evidence/day5/integration-results.txt`
- **Day 6 Accessibility & Exception UX Evidence**: `docs/evidence/day6/summary.md`, `docs/evidence/day6/a11y-report.txt`, and screenshots:
  - `docs/evidence/day6/welcome.png`
  - `docs/evidence/day6/onboard.png`
  - `docs/evidence/day6/consent.png`
  - `docs/evidence/day6/exceptions.png`
  - `docs/evidence/day6/issuer.png`
  - `docs/evidence/day6/verifier.png`
  - `docs/evidence/day6/admin.png`
