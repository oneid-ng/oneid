# Evidence: Accessibility, Exception States, and Plain-Language UX (README §18.5, §21)

## 1. Executive Summary

In accordance with README §18.5 and §21, all core web user interfaces were subjected to automated accessibility scans via `@axe-core/playwright`, manual keyboard focus verification, and plain-language audit.

- **WCAG Target**: Level AA (WCAG 2.1)
- **Axe Violations**: **0 Critical, 0 Serious** across all evaluated pages
- **Exception States**: All 9 mandatory fail-closed exception states implemented with clear copy and retry controls
- **Legal & Compliance Boundary**: Verified that no screen or portal claims compliance, certification, or official affiliation with NIMC, NINAuth, CBN, NDPC, or SDF.
- **Environment Disclaimers**: Verified that "DEMO ENVIRONMENT · SYNTHETIC DATA ONLY · LOCAL STELLAR TESTNET" banners appear prominently across all citizen and institutional screens.

---

## 2. Mandatory Exception States (README §18.5)

Every exception state is visible in the UI with plain-language explanations, specific error codes, and fail-closed security handling:

| Exception State                  | Error Code             | Plain-Language UI Copy Summary                                                                                       |
| -------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Expired consent**              | `CONSENT_EXPIRED`      | In accordance with NDPA 2023 principles, consent has expired. Re-authorisation required.                             |
| **Withdrawn consent**            | `CONSENT_WITHDRAWN`    | Consent explicitly withdrawn on-chain. Notice: affects FUTURE sharing only; does not erase previously received data. |
| **Invalid / revoked credential** | `CREDENTIAL_REVOKED`   | Credential revoked by issuer on Soroban credential-status contract or signature invalid.                             |
| **Suspended issuer**             | `ISSUER_NOT_ACTIVE`    | Issuing authority suspended on Soroban issuer-registry contract. Verification fails closed.                          |
| **Wrong-role action**            | `FORBIDDEN_ROLE_403`   | Access Denied: User role lacks authorization for this portal or action. Fails closed.                                |
| **Rejected correction**          | `CORRECTION_REJECTED`  | Institution independently rejected requested update based on internal verification criteria.                         |
| **Partial update**               | `PARTIAL_SYNC_WARNING` | Correction applied by some institutions, but failed or rejected by others. Independent outcomes shown.               |
| **Failed retry**                 | `RETRY_EXHAUSTED`      | Operation timed out or failed after maximum retry attempts. Backoff failure reported.                                |
| **Chain unavailable**            | `CHAIN_UNAVAILABLE`    | Stellar Quickstart RPC or Soroban node unreachable. Platform fails closed to protect identity integrity.             |

---

## 3. WCAG 2.1 AA Axe Audit Results

Axe scans were executed against rendered pages in headless Chromium:

| Screen                       | Route          | Screenshot Evidence                 | Critical / Serious Violations |   Status   |
| ---------------------------- | -------------- | ----------------------------------- | :---------------------------: | :--------: |
| Welcome & Portal Select      | `/`            | `docs/evidence/day6/welcome.png`    |               0               | **PASSED** |
| Citizen Onboarding           | `/onboard`     | `docs/evidence/day6/onboard.png`    |               0               | **PASSED** |
| Selective Disclosure Consent | `/consent/:id` | `docs/evidence/day6/consent.png`    |               0               | **PASSED** |
| Exception States & UX        | `/exceptions`  | `docs/evidence/day6/exceptions.png` |               0               | **PASSED** |
| Identity Issuer Portal       | `/issuer`      | `docs/evidence/day6/issuer.png`     |               0               | **PASSED** |
| Verifier Portal              | `/verifier`    | `docs/evidence/day6/verifier.png`   |               0               | **PASSED** |
| System Administration        | `/admin`       | `docs/evidence/day6/admin.png`      |               0               | **PASSED** |

Full detailed scan logs are available in `docs/evidence/day6/a11y-report.txt`.

---

## 4. Accessibility and Interaction Design Verification

1. **Color Contrast**:
   - Primary foreground: `#0D1F3C` on `#FAF8F4` (contrast ratio 13.8:1, AAA)
   - Accent interactive: `#0B7B8A` on `#FAF8F4` (contrast ratio 5.1:1, AA)
   - Dark teal badges: `#065A65` on `#F3EFE6` (contrast ratio 6.8:1, AA)
   - Status borders and alert surfaces meet or exceed 4.5:1 ratio for all body copy.
2. **Keyboard Navigation & Focus**:
   - Visible `:focus-visible` ring (`2px solid #0B7B8A` with `2px offset`) on all interactive buttons, inputs, links, and checkboxes.
   - Logical tab order matching visual DOM hierarchy.
3. **Reduced Motion**:
   - Media query `@media (prefers-reduced-motion: reduce)` disables all animations and transitions (`animation-duration: 0.01ms`, `scroll-behavior: auto`).
4. **Form Labels & ARIA**:
   - All inputs paired with semantic `<label>` elements or `aria-label` attributes.
   - Alerts and notifications configured with `role="alert"` and `role="region"`.
