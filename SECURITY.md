# Security Policy — ONEiD

## Supported versions

This project is an **MVP / demo** on Stellar Testnet and local network only.
There is no production deployment. The table below will be updated when a
formal release exists.

| Version | Supported |
|---------|-----------|
| `main` (demo) | ✅ |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report privately to the maintainers:

1. Email **friday.abah@[your-org-domain]** with subject `[ONEiD SECURITY] <brief title>`.
2. Include: description, steps to reproduce, potential impact, and any suggested fix.
3. You will receive an acknowledgement within **48 hours** and a status update within **7 days**.

We follow a **coordinated disclosure** model. Please allow us reasonable time to
investigate and remediate before any public disclosure.

## Scope

| In scope | Out of scope |
|---|---|
| Soroban contract logic (auth bypass, data leak, reentrancy) | Third-party infrastructure (Stellar network itself) |
| API authentication and authorisation flaws | Physical attacks |
| Consent enforcement bypass | Social engineering of team members |
| Personal data leakage via on-chain events or memos | Theoretical attacks with no practical path |
| Dependency vulnerabilities with a known exploit | |

## What we will NOT accept

- Findings against the **real NIMC, NINAuth, CBN or any live government system**.
  ONEiD uses **synthetic data only** and has no connection to any production
  identity system.
- Reports claiming compliance gaps — ONEiD makes **no compliance claims**.

## Security design principles (summary)

- No personal data on-chain (hashes and status only).
- Selective disclosure — verifiers receive only approved claims.
- Purpose-bound, expiring consent anchored on-chain.
- Salted SHA-256 (RFC 8785 JCS) hashes.
- Passkey (WebAuthn) authentication — no seed phrases for citizens.
- Fee sponsorship — citizens hold no XLM.
- Fail-closed by default at API and contract level.

Full threat model: README §20.2.

## Dependency scanning

- `cargo audit` runs in CI weekly (`.github/workflows/security.yml`).
- `pnpm audit` runs in CI weekly.
- `gitleaks` runs on every PR to prevent secret leakage.
- Dependabot is enabled for both npm and Cargo.

## Acknowledgements

We thank security researchers who responsibly disclose vulnerabilities. Credits
will be added here (with permission) after a fix is released.
