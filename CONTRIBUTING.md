# Contributing to ONEiD

Thank you for contributing. Please read this document before opening a PR.

## Prerequisites

- Node.js 20 LTS, pnpm 9+, Rust stable, Stellar CLI, Docker (for the demo stack)
- Run `pnpm install` — this installs Husky hooks automatically via the `prepare` script.

## Branch naming

Create branches from `main`:

```
feat/<area>-<short-description>
fix/<area>-<short-description>
docs/<area>-<short-description>
chore/<area>-<short-description>
```

Examples: `feat/consent-registry-contract`, `fix/api-health-route`, `docs/adr-sdk-version`

## Commit messages — Conventional Commits

All commits must follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <short description in lower-case>

[optional body]

[optional footer(s)]
```

Allowed types: `feat` `fix` `docs` `style` `refactor` `perf` `test` `chore` `ci` `build` `revert`

The `commit-msg` Husky hook enforces this automatically.

## Before pushing

```bash
pnpm lint          # ESLint across all packages
pnpm typecheck     # tsc --noEmit
pnpm test          # Vitest unit + integration
pnpm build         # Turborepo full build

# Contracts only
pnpm contracts:fmt    # cargo fmt --check + clippy -D warnings
pnpm contracts:test   # cargo test --workspace
pnpm contracts:build  # stellar contract build
```

The `pre-commit` Husky hook runs lint-staged (format + lint) on staged files automatically.

## Pull request checklist

- [ ] Code, tests and docs updated
- [ ] CI is green (lint, typecheck, test, build)
- [ ] No new lint, type or clippy warnings
- [ ] No secrets or real personal data committed (`.env` is git-ignored)
- [ ] Accessibility checked for any UI changes (WCAG 2.1 AA)
- [ ] Any new on-chain data reviewed: no personal data on-chain (hashes/status only)
- [ ] ADR created in `docs/architecture/adr/` for any significant design decision

## Definition of done

A task is done when all of the above checklist items pass and the PR has been
reviewed by the relevant CODEOWNER (see `.github/CODEOWNERS`).

## Architecture decision records (ADRs)

Significant decisions (stack choices, SD-JWT library, passkey tooling, contract
upgradeability, DID method) go in `docs/architecture/adr/NNNN-title.md` using
the short *Context / Decision / Consequences* template from ADR-0001.

## Non-negotiable rules

1. **No personal data on-chain.** Contracts, events and memos store hashes,
   addresses, status codes and timestamps only.
2. **Synthetic data only.** Never commit real NIN, BVN, biometrics or real
   personal data anywhere in the repo.
3. **Stellar local / testnet only.** No mainnet references.
4. **Fail closed.** Invalid consent, expired/revoked credentials, suspended
   issuers and wrong roles must be denied — in the API **and** in the contracts.
5. **No scope creep.** If a task conflicts with the README, stop and raise it
   before implementing. Propose an ADR if needed.

## Questions?

Open a GitHub Discussion or ping the relevant CODEOWNER in Slack/Teams.
