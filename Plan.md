# ONEiD Implementation & Delivery Plan

This document serves as the implementation tracking, weighted progress roadmap, and anti-drift audit plan for ONEiD, with **README.md** as the absolute Single Source of Truth.

---

## 1. Project Scope & Architecture

ONEiD is reusable, consent-based KYC for Nigeria on the Stellar network. A user verifies once with an issuer, holds a W3C VC 2.0 / SD-JWT VC credential in a wallet, and shares only approved claims with explicit, purpose-bound, expiring consent. Soroban contracts hold registry, credential status, consent receipts, and correction tickets (hashes and status only).

---

## 2. Roadmap Phases, Weighted Progress & Completion Arithmetic

Progress is weighted across four distinct development and delivery phases:

| Phase                               | Description                                                                                                                                                                                                                                                     |  Weight  | Progress | Weighted Score |
| :---------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------: | :------: | :------------: |
| **Phase 0: Foundations**            | Monorepo layout, toolchains, base contracts, cryptographic primitives, test harness, CI workflows, and documentation.                                                                                                                                           | **25%**  |   100%   |     25.0%      |
| **Phase 1: Testnet MVP**            | Soroban contracts deployed on local/testnet, Fastify API, passkey WebAuthn auth, selective disclosure SD-JWT issuance & verification, citizen wallet UI, institutional portals.                                                                                 | **35%**  |   100%   |     35.0%      |
| **Phase 2: Pilot & Demos**          | Multi-party correction workflow (3 institutions: NIMC Authority, Bank, Telecom), SEP-1 / SEP-10 / SEP-12 / SEP-24 mock anchor onboarding flow, mock fintech verifier, resilience drills (`FEATURE_SIMULATED_FAILURES`), privacy inventory and retention policy. | **30%**  |   100%   |     30.0%      |
| **Phase 3: Production & Expansion** | Production bank core banking integrations, statutory regulatory licensing, third-party contract security audit, and FIDO MDS attestation chaining.                                                                                                              | **10%**  |    0%    |      0.0%      |
| **TOTAL**                           |                                                                                                                                                                                                                                                                 | **100%** |          |   **90.0%**    |

### 2.1 Completion Percentage Arithmetic

$$\text{Final Completion} = (25\% \times 1.0) + (35\% \times 1.0) + (30\% \times 1.0) + (10\% \times 0.0) = \mathbf{90.0\%}$$

### 2.2 Items Making Up the Remaining 10% (Phase 3 Deferred Scope)

The remaining **10.0%** is explicitly deferred to Phase 3 and requires legal, regulatory, and external commercial engagement:

1. **Live Production Banking Adapters (3.0%):** Replacement of mock banking adapters with live ISO 20022 / Open Banking Nigeria production core banking integrations.
2. **Statutory Regulatory Accreditation (3.0%):** Formal legal compliance reviews, data protection impact assessments (DPIA), and statutory licensing with NIMC (NINAuth), CBN, and NDPC (strictly prohibited in MVP per Rule #4).
3. **Independent Third-Party Smart Contract Security Audit (2.5%):** Comprehensive formal verification and penetration audit by an external blockchain security firm prior to mainnet consideration.
4. **FIDO Alliance MDS Hardware Attestation Chaining (1.5%):** Strict hardware-backed passkey root-of-trust verification via FIDO Alliance Metadata Service (MDS).

---

## 3. Rehearsal Verification Suite & Command Sequence

A clean rehearsal executes the following sequence:

1. `cp .env.example .env`
2. `pnpm install`
3. `pnpm demo:reset`
4. `pnpm demo:up`
5. `pnpm test`
6. `pnpm contracts:test`
7. `pnpm test:e2e`

---

## 4. Operational Readiness

- Fastify API running on port 4000 with role-based fail-closed guards.
- Next.js Web application running on port 3000 with strict CSP headers.
- Stellar Soroban local/testnet contracts compiled and deployed.
- Synthetic profile generators producing zero real personal data.

---

## 5. Drift Audit & Non-Negotiable Rules Verification

### 5.1 Non-Negotiable Rules Compliance

| Rule        | Requirement                                                                                     | Status        | Verification Mechanism                                                     |
| :---------- | :---------------------------------------------------------------------------------------------- | :------------ | :------------------------------------------------------------------------- |
| **Rule 1**  | NO personal data on-chain. Hashes, addresses, status codes, timestamps only.                    | **COMPLIANT** | `pii-scan.test.ts` scans events, memos, storage.                           |
| **Rule 2**  | Synthetic data only. Never real NIN, BVN, biometrics or real people.                            | **COMPLIANT** | Synthetic profile generators only; explicit warnings in UI.                |
| **Rule 3**  | Stellar LOCAL network and TESTNET only. No mainnet.                                             | **COMPLIANT** | Local quickstart / testnet configuration only.                             |
| **Rule 4**  | No claims of compliance or affiliation with NIMC, CBN, NDPC, banks, or SDF.                     | **COMPLIANT** | Global persistent disclaimers across all portal headers and docs.          |
| **Rule 5**  | Fail closed: invalid consent, expired/revoked credentials, suspended issuers denied by default. | **COMPLIANT** | Enforced in Soroban contracts and API role-guard plugin.                   |
| **Rule 6**  | Authority stays with the institution: each updates only its own correction status.              | **COMPLIANT** | `correction-tracker` contract requires institution keypair `require_auth`. |
| **Rule 7**  | Withdrawing consent affects FUTURE sharing only; UI explicitly discloses this.                  | **COMPLIANT** | Present in consent review modal, receipt screen, and tests.                |
| **Rule 8**  | Hash rules: RFC 8785 (JCS) canonical JSON, SHA-256, random salt.                                | **COMPLIANT** | Implemented in `@oneid/stellar` and `@oneid/vc`.                           |
| **Rule 9**  | Use ONLY the stack in README §8 and monorepo layout in §9.                                      | **COMPLIANT** | Pnpm, Turborepo, Rust/Soroban, TypeScript, Fastify, Next.js, Postgres.     |
| **Rule 10** | Demo must run locally with no mandatory external dependency.                                    | **COMPLIANT** | Fully self-contained local chain fallbacks and in-memory test profiles.    |
| **Rule 11** | Every async UI action has loading, success, error, and retry states.                            | **COMPLIANT** | Verified across all portals in Playwright E2E suite.                       |

---

### 5.2 Single Source of Truth (README) Anti-Drift Audit

| README Section | Documented Specification                                                                                      | Implementation State                                                         | Drift Detected |
| :------------- | :------------------------------------------------------------------------------------------------------------ | :--------------------------------------------------------------------------- | :------------: |
| **§1-§4**      | Vision, scope boundaries, local/testnet network, synthetic data policy                                        | Implemented across documentation, UI banners, and scripts                    |    **None**    |
| **§5-§7**      | Architecture diagrams, actor roles, W3C SD-JWT VC format                                                      | Implemented in `@oneid/vc` and contracts                                     |    **None**    |
| **§8-§9**      | Technology stack and monorepo directory layout                                                                | Implemented in Turborepo workspaces                                          |    **None**    |
| **§10-§13**    | Soroban contracts (common, issuer-registry, credential-status, consent-registry, correction-tracker)          | Implemented in Rust wasm contracts with full test coverage                   |    **None**    |
| **§14**        | Fastify backend API, error envelopes, and role guards                                                         | Implemented in `apps/api` with typed Fastify plugins                         |    **None**    |
| **§15**        | TypeScript libraries (`@oneid/stellar`, `@oneid/vc`, `@oneid/contracts-client`, `@oneid/shared`, `@oneid/ui`) | Implemented and published across packages/                                   |    **None**    |
| **§16**        | Mock Anchor (SEP-1, SEP-10, SEP-12, SEP-24 demo) and Mock Fintech Verifier                                    | Implemented in `apps/mock-anchor`, `apps/mock-fintech`, and `/anchor` web UI |    **None**    |
| **§17-§19**    | Institutional portals, citizen wallet UI, accessibility, and design system                                    | Implemented in `apps/web` with WCAG AA compliance                            |    **None**    |
| **§20**        | Security, privacy by design, threat model, and regulatory notes                                               | Implemented in `docs/privacy/` and `docs/risks.md`                           |    **None**    |
| **§21**        | End-to-end user journeys 1 through 5                                                                          | Implemented in Playwright E2E suite (`journeys.spec.ts`, `anchor.spec.ts`)   |    **None**    |
| **§22-§24**    | Resilience drills, failure simulation, fee bumps, and dev scripts                                             | Implemented via `FEATURE_SIMULATED_FAILURES` and `pnpm demo:*`               |    **None**    |
| **§25**        | Acceptance targets (consent, permissions, credentials, corrections, reliability, evidence)                    | Verified 100% green with screenshots in `docs/evidence/day7/`                |    **None**    |
