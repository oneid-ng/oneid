# ONEiD

**One identity. More possibilities.**
Reusable, consent-based KYC for Nigeria, built on the Stellar network.

![Status](https://img.shields.io/badge/status-proposal%20%2F%20MVP-orange)
![Network](https://img.shields.io/badge/network-Stellar%20Testnet-blue)
![Contracts](https://img.shields.io/badge/contracts-Soroban%20(Rust)-black)
![Data](https://img.shields.io/badge/data-synthetic%20only-green)
![License](https://img.shields.io/badge/license-TBD-lightgrey)

---

## Table of contents

1. [Overview](#1-overview)
2. [The problem](#2-the-problem)
3. [The solution](#3-the-solution)
4. [Scope](#4-scope)
5. [Design principles](#5-design-principles)
6. [System architecture](#6-system-architecture)
7. [What goes on-chain and what does not](#7-what-goes-on-chain-and-what-does-not)
8. [Monorepo layout](#8-monorepo-layout)
9. [Tech stack](#9-tech-stack)
10. [Getting started](#10-getting-started)
11. [Environment variables](#11-environment-variables)
12. [Smart contracts (Soroban)](#12-smart-contracts-soroban)
13. [Credentials and selective disclosure](#13-credentials-and-selective-disclosure)
14. [Backend API](#14-backend-api)
15. [Database schema](#15-database-schema)
16. [Stellar ecosystem integration (SEPs)](#16-stellar-ecosystem-integration-seps)
17. [Frontend applications](#17-frontend-applications)
18. [User journeys and sequence diagrams](#18-user-journeys-and-sequence-diagrams)
19. [Roles and permissions](#19-roles-and-permissions)
20. [Security and privacy](#20-security-and-privacy)
21. [Testing strategy](#21-testing-strategy)
22. [CI/CD and DevOps](#22-cicd-and-devops)
23. [Deployment](#23-deployment)
24. [Six-phase SDLC and roadmap](#24-six-phase-sdlc-and-roadmap)
25. [Acceptance criteria](#25-acceptance-criteria)
26. [Team and ownership](#26-team-and-ownership)
27. [Contributing](#27-contributing)
28. [Troubleshooting](#28-troubleshooting)
29. [Risks and open questions](#29-risks-and-open-questions)
30. [Glossary](#30-glossary)
31. [References](#31-references)
32. [License](#32-license)

---

## 1. Overview

ONEiD lets a person complete identity verification **once** with a recognised issuer, hold the resulting credential in their own wallet, and then **share only the specific claims** a service needs (for example "NIN verified", "over 18", "KYC tier 2") with **explicit, purpose-bound, expiring consent**.

Stellar provides the shared **trust, status and audit layer**:

- Who is an authorised issuer or verifier (on-chain registry).
- Whether a credential is currently valid (on-chain status).
- Proof that a citizen consented to a specific disclosure (on-chain consent receipt, hash only).
- A traceable, per-institution status trail for record corrections.

**No personal data is ever written to the blockchain.**

---

## 2. The problem

A user in Nigeria typically repeats KYC at every bank, fintech, wallet and stablecoin on/off-ramp.

| Pain point | Effect |
|---|---|
| Disconnected databases | NIN, banks, telecoms and fintechs each hold separate identity records |
| Repeated verification | Users re-upload the same documents and repeat the same checks for every service |
| Duplicated sensitive data | Every provider stores a copy of documents, multiplying breach exposure |
| Conflicting information | A correction at one institution is not reflected at others |
| High onboarding cost | Providers pay repeatedly to verify the same person |

**Opportunity:** consent-led disclosure plus traceable updates.

---

## 3. The solution

ONEiD is a **complementary coordination layer**, not a replacement for NIMC/NINAuth or any authoritative record.

- **Citizens** get a wallet to hold credentials, approve or deny claim requests attribute by attribute, withdraw future permission, submit corrections and track their outcome per institution.
- **Issuers** (demo authorities) review applications, issue W3C Verifiable Credentials, and revoke them.
- **Verifiers** (demo banks, telecoms, anchors, fintechs) request named claims and check credential status without collecting unnecessary data.
- **Administrators** govern the issuer/verifier registry and monitor system health.
- **Stellar (Soroban)** anchors registry, status, consent receipts and correction tickets as tamper-evident public records of *state*, never of *identity data*.

### Key capabilities

- Synthetic identity registration and mock NIN checks
- Credential issuance, verification, revocation and expiry
- Claim-by-claim consent with purpose, requester and expiry
- Consent withdrawal for future sharing
- Correction requests with independent, per-institution outcomes
- Role-based portals (citizen, issuer, verifier, admin)
- Tamper-evident audit timeline
- SEP-12-style KYC endpoint and SEP-24 style on/off-ramp onboarding demo
- Passkey-based smart accounts and fee sponsorship (no seed phrases, no fees for citizens)

---

## 4. Scope

### In scope (MVP demonstration)

- Stellar **Testnet** and **local Stellar Quickstart** network
- Synthetic citizen profiles and mock NIN checks (including simulated face check)
- One demo issuer, two demo verifiers (a mock anchor and a mock fintech) and one platform admin
- Soroban contracts: issuer registry, credential status, consent registry, correction tracker
- Attribute-by-attribute consent approval or denial
- Correction submission and per-institution responses
- Role-based UI, audit events, loading, retry and exception states
- Fully reproducible local demo with no mandatory external dependencies

### Out of scope

- Live NIMC, NINAuth, BVN, bank or telecom integrations
- Real NIN, biometric or other sensitive citizen data
- Actual changes to any institution's records
- **Mainnet** deployment
- Government authorisation, production assurance, or any compliance claim
- National-scale operations

### Future vision

- Formal issuer and verifier onboarding with trust policies
- Approved identity provider integration
- Zero-knowledge proofs for age or tier checks
- Independent institutional update notifications
- Mainnet pilot with a regulated partner after legal review and a contract audit

---

## 5. Design principles

1. **Control is explicit.** Nothing is disclosed without review and confirmation.
2. **Progress is visible.** Every request, consent and correction has a visible status and history.
3. **Data minimisation.** Collect, share and store the least data possible. Chain stores hashes and status only.
4. **Authority stays with the authority.** Each institution decides and applies changes to its own records.
5. **Fail closed.** Invalid consent, expired or revoked credentials, or wrong roles are denied by default.
6. **Failures are visible.** Rejections, partial updates and failed retries are shown, never hidden.
7. **Reliable local demo.** Everything runs offline against a local Stellar network.
8. **Honest claims.** Document what is proposed versus what is implemented and tested.

---

## 6. System architecture

### 6.1 Conceptual responsibilities

| Responsibility | Description |
|---|---|
| **Identifiers** | Synthetic profiles, DID references, Stellar account/contract addresses |
| **Credentials** | Issuance, verification, status (W3C VC 2.0, SD-JWT VC) |
| **Messaging** | Consent requests, APIs, updates, notifications |
| **Governance** | Trust registry, permissions, disputes, audit |

Flow: **Citizen consent → Authorised institution → Independent processing → Auditable outcome**

### 6.2 Component diagram

```mermaid
flowchart LR
    subgraph Citizen["Citizen / Holder"]
        W[Wallet Web App<br/>Passkey smart account]
        VS[(Encrypted credential store<br/>device / IndexedDB)]
        W --- VS
    end

    subgraph ONEiD["ONEiD Demo Services"]
        API[API Gateway<br/>Fastify + TypeScript]
        KYC[SEP-12-style KYC service]
        ISS[Issuance service]
        CON[Consent service]
        COR[Correction service]
        IDX[Chain indexer]
        DB[(PostgreSQL<br/>synthetic demo data)]
        API --> KYC & ISS & CON & COR
        KYC & ISS & CON & COR --> DB
        IDX --> DB
    end

    subgraph Institutions["Issuer / Verifier workspaces"]
        IP[Issuer Portal]
        VP[Verifier Portal]
        AP[Admin Console]
    end

    subgraph Stellar["Stellar network (Testnet or local)"]
        SC1[issuer-registry]
        SC2[credential-status]
        SC3[consent-registry]
        SC4[correction-tracker]
        RPC[Soroban RPC]
        RPC --- SC1 & SC2 & SC3 & SC4
    end

    W <--> API
    IP & VP & AP <--> API
    API <--> RPC
    IDX --> RPC
    W -. direct claim presentation .-> VP
```

### 6.3 Trust boundary

> ONEiD coordinates requests and records demo outcomes. **Authoritative records remain with their respective institutions.**

---

## 7. What goes on-chain and what does not

> **Rule #1: no personal data on-chain, ever.** This also respects erasure and minimisation concerns under the Nigeria Data Protection Act 2023, since public ledgers are immutable.

### On Stellar (Soroban)

| Contract | Stores | Never stores |
|---|---|---|
| `issuer-registry` | Issuer/verifier address, role, name, domain, status | Any citizen data |
| `credential-status` | Credential hash, issuer, status (active / revoked / expired), expiry timestamp | Claims, names, NINs |
| `consent-registry` | Consent receipt hash, holder, requester, expiry, status (active / withdrawn / expired) | Claim values, purpose text (hash only) |
| `correction-tracker` | Ticket hash, holder, per-institution status trail | Correction details or evidence |

### Off-chain

- W3C VC 2.0 credentials, encrypted in the holder's wallet
- Claim exchange directly between holder and verifier
- Correction details and supporting evidence (synthetic)
- Issuer records (authoritative)
- Audit event detail (the chain holds hashes and status transitions)

### Hashing rules

- Canonicalise JSON using **RFC 8785 (JCS)** before hashing.
- Hash with **SHA-256**.
- Include a random **salt** in every consent and credential preimage so low-entropy values cannot be guessed from a hash.

---

## 8. Monorepo layout

```text
oneid/
├── apps/
│   ├── web/                    # Next.js: citizen wallet + issuer/verifier/admin portals
│   ├── api/                    # Fastify API: KYC, issuance, consent, corrections, indexer hooks
│   ├── mock-anchor/            # Demo anchor (SEP-1/10/12/24 style) for on/off-ramp onboarding
│   └── mock-fintech/           # Demo fintech verifier app
├── contracts/                  # Rust workspace (Soroban)
│   ├── Cargo.toml
│   ├── common/                 # Shared types, errors, auth helpers
│   ├── issuer-registry/
│   ├── credential-status/
│   ├── consent-registry/
│   └── correction-tracker/
├── packages/
│   ├── contracts-client/       # Generated TypeScript bindings + typed wrappers
│   ├── shared/                 # Zod schemas, DTOs, enums, constants
│   ├── vc/                     # VC 2.0 / SD-JWT VC issue, present, verify helpers
│   ├── stellar/                # Network config, account utils, fee-bump / sponsorship helpers
│   ├── ui/                     # Shared React component library + design tokens
│   ├── eslint-config/
│   ├── tsconfig/
│   └── test-utils/             # Fixtures, synthetic data generators, chain test harness
├── infra/
│   ├── docker/
│   │   ├── docker-compose.yml  # Local stack: quickstart, postgres, api, web, mocks
│   │   └── Dockerfile.*
│   └── scripts/                # Bootstrap, seed, deploy, reset scripts
├── docs/
│   ├── architecture/           # Diagrams, ADRs
│   ├── api/                    # OpenAPI spec
│   ├── contracts/              # Contract specs and storage layouts
│   ├── runbooks/               # Demo script, failure drills
│   ├── privacy/                # Data inventory, retention rules, NDPA review notes
│   └── design/                 # UX flows, screens, branding
├── .github/
│   └── workflows/
├── .env.example
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── rust-toolchain.toml
├── CONTRIBUTING.md
├── SECURITY.md
└── README.md
```

---

## 9. Tech stack

| Layer | Technology | Notes |
|---|---|---|
| Monorepo tooling | **pnpm workspaces + Turborepo** (JS/TS), **Cargo workspace** (Rust) | Single repo, cached builds |
| Smart contracts | **Rust + Soroban SDK** | Compiled to WASM |
| Chain tooling | **Stellar CLI**, **Soroban RPC**, **stellar/quickstart** Docker image | Local network with Friendbot |
| Chain SDK | **@stellar/stellar-sdk** | Transactions, RPC, auth entries |
| Backend | **Node.js 20+, TypeScript, Fastify**, Zod validation | Replaces the earlier Kotlin-under-assessment idea; Kotlin may be revisited by ADR |
| Database | **PostgreSQL** + **Drizzle ORM** (or Prisma) | Synthetic demo data only |
| Frontend | **Next.js (React), TypeScript, Tailwind CSS** | Responsive, accessible |
| Auth (users) | Passkeys (WebAuthn) for wallet; session tokens for portals | Demo roles |
| Smart accounts | Soroban passkey smart accounts (e.g. passkey-kit style) | Evaluate current tooling at build time |
| Credentials | **W3C VC Data Model 2.0**, **SD-JWT VC** for selective disclosure | Library choice via ADR |
| Testing | Vitest, Playwright, Testing Library, `cargo test`, Soroban test env | See [testing](#21-testing-strategy) |
| Lint / format | ESLint, Prettier, `cargo fmt`, `cargo clippy` | Enforced in CI |
| CI/CD | GitHub Actions | Lint, types, tests, build, optional preview |
| Containers | Docker, Docker Compose | Reliable local demo |

> Stack decisions are tracked as ADRs in `docs/architecture/adr/`. Anything marked "evaluate" must be confirmed in an ADR before Phase 3.

---

## 10. Getting started

### 10.1 Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Node.js | 20 LTS or newer | Apps and packages |
| pnpm | 9+ | Workspace manager |
| Rust | stable (pinned in `rust-toolchain.toml`) | Contracts |
| `wasm32v1-none` or `wasm32-unknown-unknown` target | per current Stellar docs | Soroban WASM build |
| Stellar CLI | latest | Build, deploy, bindings |
| Docker + Docker Compose | recent | Local Stellar network, Postgres |
| Git | recent | |

```bash
# Rust toolchain and WASM target (check current Stellar docs for the exact target name)
rustup target add wasm32v1-none

# Stellar CLI (see https://developers.stellar.org for current install options)
cargo install --locked stellar-cli

# pnpm
corepack enable && corepack prepare pnpm@latest --activate
```

### 10.2 Clone and install

```bash
git clone https://github.com/<your-org>/oneid.git
cd oneid
cp .env.example .env
pnpm install
```

### 10.3 One-command local demo

```bash
pnpm demo:up
```

This runs, in order:

1. `docker compose up -d` — Stellar Quickstart (local network with Soroban RPC and Friendbot), PostgreSQL
2. `pnpm contracts:build` — builds all Soroban contracts to WASM
3. `pnpm contracts:deploy:local` — deploys contracts and writes addresses to `.env.local`
4. `pnpm contracts:bindings` — generates TypeScript bindings into `packages/contracts-client`
5. `pnpm db:migrate && pnpm db:seed` — applies schema and loads synthetic profiles
6. `pnpm chain:seed` — registers the demo issuer, verifiers and admin on-chain
7. `pnpm dev` — starts `web`, `api`, `mock-anchor`, `mock-fintech`

Then open:

| App | URL |
|---|---|
| Citizen wallet and portals (`web`) | http://localhost:3000 |
| API | http://localhost:4000 (docs at `/docs`) |
| Mock anchor | http://localhost:4100 |
| Mock fintech | http://localhost:4200 |
| Stellar local RPC | http://localhost:8000 |
| Stellar Lab (if enabled) | http://localhost:8000/lab |

Reset everything:

```bash
pnpm demo:reset     # wipes DB and local chain state, redeploys, reseeds
pnpm demo:down      # stops containers
```

### 10.4 Manual, step-by-step setup

<details>
<summary>Expand for step-by-step commands</summary>

**1. Start the local Stellar network**

```bash
docker run --rm -it \
  -p 8000:8000 \
  --name stellar \
  stellar/quickstart:latest \
  --local \
  --enable rpc,lab
```

(Flags can change between Quickstart releases. Check the image's README if this fails.)

**2. Configure the network in the Stellar CLI**

```bash
stellar network add local \
  --rpc-url http://localhost:8000/soroban/rpc \
  --network-passphrase "Standalone Network ; February 2017"

stellar keys generate admin --network local --fund
stellar keys generate issuer-demo --network local --fund
stellar keys generate verifier-anchor --network local --fund
stellar keys generate verifier-fintech --network local --fund
```

**3. Build and deploy contracts**

```bash
cd contracts
stellar contract build

stellar contract deploy \
  --wasm target/wasm32v1-none/release/issuer_registry.wasm \
  --source admin --network local
# repeat for credential_status, consent_registry, correction_tracker
```

**4. Generate TypeScript bindings**

```bash
stellar contract bindings typescript \
  --contract-id <ISSUER_REGISTRY_ID> \
  --output-dir ../packages/contracts-client/src/generated/issuer-registry \
  --network local
```

**5. Run the apps**

```bash
pnpm --filter @oneid/api dev
pnpm --filter @oneid/web dev
```

</details>

### 10.5 Running against Stellar Testnet

```bash
# .env
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
STELLAR_FRIENDBOT_URL=https://friendbot.stellar.org

pnpm contracts:deploy:testnet
pnpm chain:seed
```

> Testnet is periodically reset. Keep deployment scripts idempotent and never depend on testnet state for the demo fallback. The local network is the source of truth for demos.

### 10.6 Useful scripts

| Script | Description |
|---|---|
| `pnpm dev` | Run all apps in watch mode |
| `pnpm build` | Build all packages and apps (Turborepo) |
| `pnpm lint` | ESLint across the repo |
| `pnpm typecheck` | `tsc --noEmit` across all packages |
| `pnpm test` | All unit and integration tests |
| `pnpm test:e2e` | Playwright end-to-end tests |
| `pnpm contracts:build` | Build all contracts |
| `pnpm contracts:test` | `cargo test` for the workspace |
| `pnpm contracts:fmt` | `cargo fmt --check` and `clippy` |
| `pnpm contracts:deploy:local` | Deploy to local network |
| `pnpm contracts:deploy:testnet` | Deploy to Testnet |
| `pnpm contracts:bindings` | Regenerate TS bindings |
| `pnpm db:migrate` / `db:seed` / `db:studio` | Database lifecycle |
| `pnpm chain:seed` | Register demo issuer, verifiers, admin on-chain |
| `pnpm demo:up` / `demo:down` / `demo:reset` | Demo lifecycle |
| `pnpm docs:api` | Regenerate OpenAPI docs |

---

## 11. Environment variables

Copy `.env.example` to `.env`. **Never commit real secrets.** The example file contains placeholders only.

```dotenv
# ---------- General ----------
NODE_ENV=development
APP_BASE_URL=http://localhost:3000
API_BASE_URL=http://localhost:4000

# ---------- Stellar ----------
STELLAR_NETWORK=local                      # local | testnet
STELLAR_RPC_URL=http://localhost:8000/soroban/rpc
STELLAR_NETWORK_PASSPHRASE="Standalone Network ; February 2017"
STELLAR_HORIZON_URL=http://localhost:8000
STELLAR_FRIENDBOT_URL=http://localhost:8000/friendbot

# ---------- Contract addresses (written by deploy scripts) ----------
ISSUER_REGISTRY_ID=
CREDENTIAL_STATUS_ID=
CONSENT_REGISTRY_ID=
CORRECTION_TRACKER_ID=

# ---------- Service accounts (TESTNET / LOCAL ONLY) ----------
PLATFORM_ADMIN_SECRET=                     # S... demo key only
FEE_SPONSOR_SECRET=                        # pays fees via fee-bump transactions
ISSUER_DEMO_SECRET=
VERIFIER_ANCHOR_SECRET=
VERIFIER_FINTECH_SECRET=

# ---------- Database ----------
DATABASE_URL=postgres://oneid:oneid@localhost:5432/oneid

# ---------- Auth ----------
SESSION_SECRET=change-me
WEBAUTHN_RP_ID=localhost
WEBAUTHN_RP_NAME=ONEiD Demo
WEBAUTHN_ORIGIN=http://localhost:3000

# ---------- Credentials ----------
VC_ISSUER_SIGNING_KEY_JWK=                 # demo Ed25519 JWK for credential signing
VC_DEFAULT_VALIDITY_DAYS=365

# ---------- Mock anchor / SEP ----------
ANCHOR_HOME_DOMAIN=localhost:4100
ANCHOR_SIGNING_SECRET=
ANCHOR_JWT_SECRET=change-me

# ---------- Feature flags ----------
FEATURE_SEP24_DEMO=true
FEATURE_FEE_SPONSORSHIP=true
FEATURE_SIMULATED_FAILURES=true            # enables retry / partial-sync drills
```

**Secret handling rules**

- Secret keys in `.env` are **demo keys for local/testnet only**.
- `.env`, `.env.local` and any `*.secret` file are git-ignored. CI uses repository secrets.
- Run `gitleaks` (or equivalent) in CI and as a pre-commit hook.

---

## 12. Smart contracts (Soroban)

All contracts live under `contracts/` in a single Cargo workspace. Every state-changing function **requires authorisation** from the appropriate account via `require_auth()`.

### 12.1 `issuer-registry`

Tracks authorised issuers and verifiers and links them to a domain (verified off-chain through `stellar.toml`).

```rust
#[contracttype]
pub enum Role { Issuer, Verifier }

#[contracttype]
pub enum EntityStatus { Active, Suspended, Removed }

#[contracttype]
pub struct Entity {
    pub address: Address,
    pub role: Role,
    pub name: String,
    pub home_domain: String,       // matched against stellar.toml off-chain
    pub status: EntityStatus,
    pub registered_at: u64,
}
```

| Function | Auth | Description |
|---|---|---|
| `init(admin)` | deployer | One-time initialisation |
| `register(entity)` | admin | Register issuer or verifier |
| `set_status(addr, status)` | admin | Suspend or remove |
| `get(addr) -> Entity` | public | Read entity |
| `is_active_issuer(addr) -> bool` | public | Check used by other contracts |
| `is_active_verifier(addr) -> bool` | public | Check used by other contracts |
| `transfer_admin(new_admin)` | admin | Governance handover (multi-sig recommended) |

Events: `registered`, `status_changed`, `admin_transferred`.

### 12.2 `credential-status`

```rust
#[contracttype]
pub enum CredStatus { Active, Revoked, Expired }

#[contracttype]
pub struct CredentialRecord {
    pub credential_hash: BytesN<32>,
    pub issuer: Address,
    pub holder: Address,
    pub status: CredStatus,
    pub issued_at: u64,
    pub expires_at: u64,
    pub revoked_at: Option<u64>,
}
```

| Function | Auth | Description |
|---|---|---|
| `register(hash, holder, expires_at)` | active issuer | Anchor a new credential |
| `revoke(hash, reason_code)` | issuing issuer | Revoke; reason is a code, not free text |
| `status(hash) -> CredStatus` | public | Computed, returns `Expired` if past `expires_at` |
| `get(hash) -> CredentialRecord` | public | Read record |

Events: `issued`, `revoked`.

### 12.3 `consent-registry`

```rust
#[contracttype]
pub enum ConsentStatus { Active, Withdrawn, Expired }

#[contracttype]
pub struct ConsentReceipt {
    pub receipt_hash: BytesN<32>,  // SHA-256(JCS{holder, requester, claims, purpose, nonce, expiry, salt})
    pub holder: Address,
    pub requester: Address,        // must be an active verifier
    pub expires_at: u64,
    pub status: ConsentStatus,
    pub created_at: u64,
    pub withdrawn_at: Option<u64>,
}
```

| Function | Auth | Description |
|---|---|---|
| `grant(receipt_hash, requester, expires_at)` | holder | Record consent. Fails if requester is not an active verifier |
| `withdraw(receipt_hash)` | holder | Withdraw for **future** sharing |
| `status(receipt_hash) -> ConsentStatus` | public | Computed with expiry |
| `get(receipt_hash) -> ConsentReceipt` | public | Read receipt |

Events: `granted`, `withdrawn`.

> **Important:** withdrawing consent does not erase data a verifier already received. The UI must say so before the user approves.

### 12.4 `correction-tracker`

```rust
#[contracttype]
pub enum TicketStatus { Submitted, UnderReview, Applied, Rejected, Failed, PartiallyApplied }

#[contracttype]
pub struct InstitutionOutcome {
    pub institution: Address,
    pub status: TicketStatus,
    pub updated_at: u64,
    pub reason_code: Option<u32>,
}

#[contracttype]
pub struct Ticket {
    pub ticket_hash: BytesN<32>,
    pub holder: Address,
    pub created_at: u64,
    pub outcomes: Vec<InstitutionOutcome>,
}
```

| Function | Auth | Description |
|---|---|---|
| `open(ticket_hash, institutions)` | holder | Open a ticket targeting specific institutions |
| `update(ticket_hash, status, reason_code)` | that institution only | Each institution updates **its own** status |
| `get(ticket_hash) -> Ticket` | public | Read the trail |

Events: `opened`, `outcome_updated`.

### 12.5 Cross-cutting contract rules

- **Storage:** use persistent storage for registry, status, consent and tickets. Extend TTL on read/write paths and run a scheduled TTL-bump job for long-lived records.
- **Errors:** use `#[contracterror]` enums, one set per contract in `contracts/common`.
- **Upgradeability:** keep contracts non-upgradeable for the MVP, or guard upgrades behind admin multi-sig. Record the decision in an ADR.
- **No unbounded loops or growing vectors in hot paths.** Cap institutions per ticket.
- **Time:** use ledger timestamp, never user-supplied time.
- **Gas/resource budgets:** track CPU and memory per function in tests.

### 12.6 Build, test, deploy

```bash
cd contracts
cargo fmt --all -- --check
cargo clippy --all-targets -- -D warnings
cargo test --workspace
stellar contract build
```

Deployed contract IDs are written to `deployments/<network>.json` and consumed by `packages/contracts-client`.

---

## 13. Credentials and selective disclosure

### 13.1 Credential model

- Format: **W3C Verifiable Credentials Data Model 2.0**, secured as **SD-JWT VC** so the holder can disclose individual claims.
- **Issuer identifier:** DID or Stellar-address-based identifier mapped in the issuer registry (`did:web` on the issuer's `home_domain` is recommended, since it ties to `stellar.toml`).
- **Holder binding:** the credential is bound to the holder's key (`cnf` claim) so a stolen credential cannot be replayed.

### 13.2 Example credential (synthetic)

```json
{
  "@context": ["https://www.w3.org/ns/credentials/v2"],
  "type": ["VerifiableCredential", "OneIdKycCredential"],
  "issuer": "did:web:issuer.demo.oneid.local",
  "validFrom": "2026-01-15T00:00:00Z",
  "validUntil": "2027-01-15T00:00:00Z",
  "credentialSubject": {
    "id": "did:stellar:testnet:G...HOLDER",
    "fullName": "Adaeze Okonkwo",
    "dateOfBirth": "1990-03-12",
    "nin": "1234 5678 9012",
    "address": "Lagos, Nigeria",
    "kycTier": 2,
    "over18": true
  },
  "credentialStatus": {
    "type": "StellarSorobanStatus2026",
    "contract": "C...CREDENTIAL_STATUS",
    "id": "<credential_hash_hex>"
  }
}
```

> All values above are fictional. The NIN is a placeholder pattern, not a real number.

### 13.3 Presentation and verification

1. Verifier sends a **presentation request** (claims, purpose, expiry, nonce).
2. Wallet shows the **consent screen**: requester, purpose, exact claims, expiry, and the "withdrawal does not erase" notice.
3. On approval the wallet records a **consent receipt** on-chain and builds an **SD-JWT presentation** that discloses only approved claims.
4. Verifier checks: issuer signature, issuer is an **active issuer** in the registry, `credential-status` is **Active**, consent receipt is **Active** and matches the request, and nonce/audience match.
5. Any failed check results in a **denied** outcome with a visible reason.

### 13.4 Future: zero-knowledge proofs

Replace `over18` / `kycTier` disclosure with ZK proofs (for example "age ≥ 18" without revealing date of birth). Tracked in the roadmap and in `docs/architecture/adr/`.

---

## 14. Backend API

Base URL: `http://localhost:4000/v1`. OpenAPI/Swagger UI at `/docs`. All inputs are validated with Zod schemas from `packages/shared`.

### 14.1 Endpoint overview

| Area | Method and path | Role | Description |
|---|---|---|---|
| **Auth** | `POST /auth/register/options` | public | WebAuthn registration options |
| | `POST /auth/register/verify` | public | Verify attestation, create account |
| | `POST /auth/login/options` / `verify` | public | WebAuthn login |
| | `POST /auth/portal/login` | institution | Demo portal login |
| **Identity** | `POST /identity/mock-nin/verify` | citizen | Validate a synthetic NIN |
| | `POST /identity/face-check/simulate` | citizen | Simulated face check |
| | `GET /identity/me` | citizen | Profile (synthetic) |
| **Issuance** | `POST /applications` | citizen | Submit credential application |
| | `GET /applications` | issuer | List applications |
| | `POST /applications/:id/decision` | issuer | Approve or reject |
| | `POST /credentials/issue` | issuer | Issue credential and register status on-chain |
| | `POST /credentials/:hash/revoke` | issuer | Revoke credential on-chain |
| | `GET /credentials` | citizen | List own credentials |
| **Requests** | `POST /requests` | verifier | Request named claims for a purpose |
| | `GET /requests/pending` | citizen | Pending requests |
| | `GET /requests/:id` | citizen, verifier | Request detail and status |
| **Consent** | `POST /consents` | citizen | Approve or deny claim by claim; records receipt on-chain |
| | `POST /consents/:hash/withdraw` | citizen | Withdraw future sharing |
| | `GET /consents` | citizen | History |
| **Verification** | `POST /verify/presentation` | verifier | Verify SD-JWT presentation and chain state |
| | `GET /verify/credential/:hash/status` | verifier | Status lookup |
| **Corrections** | `POST /corrections` | citizen | Open ticket (opens on-chain) |
| | `GET /corrections/:id` | citizen | Per-institution trail |
| | `GET /corrections/queue` | institution | Institution's own queue |
| | `POST /corrections/:id/respond` | institution | Apply, reject, fail (updates own on-chain status) |
| **Registry** | `GET /registry/entities` | public | Issuers and verifiers |
| | `POST /registry/entities` | admin | Register |
| | `PATCH /registry/entities/:addr/status` | admin | Suspend or remove |
| **Audit** | `GET /audit/timeline` | citizen | Own audit timeline |
| | `GET /audit/events` | admin | System-wide audit events |
| **Admin** | `GET /admin/health` | admin | System overview and indexer lag |
| | `POST /admin/simulate/failure` | admin | Trigger simulated failures (flag-gated) |

### 14.2 Example: create a claim request

```http
POST /v1/requests
Authorization: Bearer <verifier-session>
Content-Type: application/json

{
  "holderRef": "adaeze.okonkwo@demo.oneid",
  "purpose": "Account opening",
  "claims": ["fullName", "dateOfBirth", "nin", "address"],
  "expiresInSeconds": 600
}
```

```json
{
  "id": "req_01J...",
  "status": "pending_consent",
  "nonce": "n-7f3a...",
  "claims": ["fullName", "dateOfBirth", "nin", "address"],
  "expiresAt": "2026-01-15T10:34:00Z"
}
```

### 14.3 Example: consent decision

```http
POST /v1/consents
{
  "requestId": "req_01J...",
  "decisions": {
    "fullName": "approve",
    "dateOfBirth": "approve",
    "nin": "approve",
    "address": "deny"
  },
  "expiresInSeconds": 86400
}
```

Response includes the on-chain `receiptHash`, transaction hash and ledger number.

### 14.4 Error model

```json
{
  "error": {
    "code": "CONSENT_EXPIRED",
    "message": "The consent receipt has expired.",
    "requestId": "7c1f...",
    "retryable": false
  }
}
```

| Code | HTTP | Meaning |
|---|---|---|
| `UNAUTHENTICATED` | 401 | Missing or invalid session |
| `FORBIDDEN_ROLE` | 403 | Wrong role for action (fail closed) |
| `CONSENT_MISSING` / `CONSENT_EXPIRED` / `CONSENT_WITHDRAWN` | 403 | No valid consent |
| `CREDENTIAL_REVOKED` / `CREDENTIAL_EXPIRED` | 422 | Credential not valid |
| `ISSUER_NOT_ACTIVE` | 422 | Issuer suspended or unknown |
| `CHAIN_UNAVAILABLE` | 503 | RPC unreachable (retryable) |
| `CHAIN_TX_FAILED` | 502 | Transaction failed (see details) |
| `VALIDATION_ERROR` | 400 | Schema validation failed |

### 14.5 Chain transaction handling

- Transactions are built with the Stellar SDK, simulated, assembled, signed (by the correct party), and submitted via Soroban RPC.
- **Fee sponsorship:** citizen transactions are wrapped in **fee-bump transactions** paid by the sponsor account, so citizens hold no XLM for fees.
- **Retries** use exponential backoff with an idempotency key per operation. Outcomes (`pending`, `confirmed`, `failed`) are stored and shown in the UI.
- **Indexer:** a background worker polls Soroban RPC events for the four contracts and updates the database, so UI reads are fast and the DB can be rebuilt from chain events.

---

## 15. Database schema

PostgreSQL stores **synthetic demo data** and operational state. On-chain data is the source of truth for registry, status, consent and ticket state; the DB mirrors it via the indexer.

```mermaid
erDiagram
    USERS ||--o{ CREDENTIALS : holds
    USERS ||--o{ CONSENTS : grants
    USERS ||--o{ CORRECTION_TICKETS : opens
    ENTITIES ||--o{ CREDENTIALS : issues
    ENTITIES ||--o{ CLAIM_REQUESTS : makes
    CLAIM_REQUESTS ||--o| CONSENTS : resolves
    CORRECTION_TICKETS ||--o{ CORRECTION_OUTCOMES : tracks
    ENTITIES ||--o{ CORRECTION_OUTCOMES : decides
    USERS ||--o{ AUDIT_EVENTS : generates
```

| Table | Key columns |
|---|---|
| `users` | `id`, `role`, `stellar_address`, `passkey_credential_id`, `synthetic_profile` (JSONB), `created_at` |
| `entities` | `id`, `stellar_address`, `role` (issuer / verifier / admin), `name`, `home_domain`, `status` |
| `applications` | `id`, `user_id`, `issuer_id`, `status`, `submitted_at`, `decided_at` |
| `credentials` | `id`, `credential_hash`, `user_id`, `issuer_id`, `status`, `expires_at`, `chain_tx`, `ledger` |
| `claim_requests` | `id`, `verifier_id`, `holder_id`, `claims` (text[]), `purpose`, `nonce`, `status`, `expires_at` |
| `consents` | `id`, `request_id`, `receipt_hash`, `decisions` (JSONB), `status`, `expires_at`, `chain_tx`, `ledger` |
| `correction_tickets` | `id`, `ticket_hash`, `user_id`, `category`, `detail` (synthetic), `created_at` |
| `correction_outcomes` | `ticket_id`, `institution_id`, `status`, `reason_code`, `updated_at`, `chain_tx` |
| `audit_events` | `id`, `actor_id`, `actor_role`, `type`, `ref_id`, `chain_tx`, `prev_hash`, `hash`, `created_at` |
| `chain_cursor` | `contract_id`, `last_ledger`, `last_event_id` |

**Audit hash chain:** each `audit_events` row stores `hash = SHA-256(prev_hash || canonical_event)`, giving tamper-evident off-chain logs. Periodically, the latest hash can be anchored on-chain.

**Retention (demo policy):** synthetic data is purged by `demo:reset`; production-style retention and deletion rules are documented in `docs/privacy/retention.md`.

---

## 16. Stellar ecosystem integration (SEPs)

> SEP names are used as **design references**. Where the MVP implements only a subset, it is labelled "style" or "demo". Verify against current SEP specs before claiming conformance.

| SEP | Use in ONEiD | MVP status |
|---|---|---|
| **SEP-1** (`stellar.toml`) | Issuers and verifiers publish `stellar.toml` at their `home_domain`. Registry entries are verified against it | Implemented in mock anchor and demo issuer |
| **SEP-10** (Web authentication) | Challenge-response login using a Stellar account for anchor/portal sessions | Implemented in mock anchor |
| **SEP-12** (KYC API) | ONEiD acts as a reusable KYC source. The anchor requests fields, the user consents, and ONEiD returns only approved fields | "SEP-12-style" endpoints |
| **SEP-24** (Interactive deposit/withdraw) | Mock anchor onboards a user for naira ↔ stablecoin using a ONEiD credential rather than repeat document uploads | Demo flow, no real money |
| **Passkey smart accounts** | WebAuthn-backed Soroban smart account for citizens, no seed phrase | Evaluated and prototyped |
| **Fee-bump / sponsored reserves** | Citizens pay nothing; sponsor covers fees and reserves | Implemented via fee-bump |

### Reusable-KYC flow with the mock anchor

1. User starts a deposit in the mock anchor (SEP-24 interactive flow).
2. Anchor authenticates the user (SEP-10) and requests KYC fields (SEP-12 style).
3. Anchor redirects to ONEiD consent. User approves claims one by one.
4. ONEiD records a consent receipt on-chain and releases only approved claims.
5. Anchor verifies issuer status and credential status on-chain, then proceeds without a document upload.

---

## 17. Frontend applications

`apps/web` is a single Next.js app with role-based route groups:

```text
apps/web/src/app/
├── (public)/            # welcome, onboarding
├── (citizen)/           # home, credentials, share, requests, corrections, profile
├── (issuer)/            # dashboard, applications, issue-credential, reports
├── (verifier)/          # dashboard, new-verification, results, audit-log
├── (bank)/              # update queue, customer search (demo)
├── (telecom)/           # subscriber verification (demo)
└── (admin)/             # operations dashboard, registry, incidents, audit logs
```

### Screens (from the UI/UX samples)

**Citizen:** Welcome → Onboard (verify identity, create wallet, set preferences) → Home → Digital ID (identity card, QR) → Review information → Confirm → Request an identity update → My Requests (all, updates, sharing, verifications).

**Institutional:** Issuer application review → Credential issuance → Verifier request → Verifier result → Bank update queue → Telecom verification → Admin monitoring.

### New screens required by the Stellar refactor

- **Consent receipt** screen with transaction hash and ledger link
- **On-chain status** badge on credentials (Active / Revoked / Expired)
- **Registry viewer** showing active issuers and verifiers
- **Per-institution correction timeline**
- **Recovery** screen (add a second passkey / recovery contact)

### Branding

Rebrand all mockups from "Blockchain ID" to **ONEiD**. Tokens (colour, type, spacing) live in `packages/ui`. Palette follows the deck: deep navy, teal, warm gold accent on warm off-white.

### Frontend standards

- Accessible (WCAG 2.1 AA target), keyboard navigable, screen-reader labels
- Responsive from 360px upwards
- Every async action has loading, success, error and retry states
- No secrets in the browser; no personal data in URLs, logs, or analytics
- Strict Content Security Policy

---

## 18. User journeys and sequence diagrams

### 18.1 Four defining journeys

| # | Journey | Story |
|---|---|---|
| 1 | **Open an account** | As a citizen, I want to approve a bank's request for specific identity attributes so I can avoid repetitive verification and control disclosure. |
| 2 | **Correct my record** | As a citizen, I want to submit a correction and track processing at each institution so I know which records have changed. |
| 3 | **Verify a credential** | As a verifier, I want to request authorised claims and check credential status without collecting unnecessary personal data. |
| 4 | **Issue a credential** | As an authorised demo issuer, I want to review an application, issue a credential and change its status so a verifier can check its validity. |

### 18.2 Issue and register

```mermaid
sequenceDiagram
    actor C as Citizen
    participant W as Wallet
    participant A as ONEiD API
    actor I as Issuer
    participant S as credential-status (Soroban)

    C->>W: Start application (synthetic NIN + simulated face check)
    W->>A: POST /applications
    I->>A: Review application
    I->>A: POST /credentials/issue
    A->>A: Build and sign SD-JWT VC, compute credential hash
    A->>S: register(hash, holder, expires_at) as issuer
    S-->>A: tx hash, ledger
    A-->>W: Encrypted credential delivered to wallet
```

### 18.3 Request, consent, verify

```mermaid
sequenceDiagram
    participant V as Verifier
    participant A as ONEiD API
    actor C as Citizen
    participant W as Wallet
    participant R as consent-registry
    participant IR as issuer-registry
    participant S as credential-status

    V->>A: POST /requests (claims, purpose, nonce)
    A-->>W: Notify citizen
    W->>C: Show purpose, requester, claims, expiry, notice
    C->>W: Approve / deny each claim
    W->>R: grant(receipt_hash, requester, expires_at)
    R-->>W: confirmed
    W->>V: SD-JWT presentation (approved claims only)
    V->>A: POST /verify/presentation
    A->>IR: is_active_issuer(issuer)?
    A->>S: status(credential_hash)?
    A->>R: status(receipt_hash)?
    A-->>V: valid / denied (with reason)
```

### 18.4 Correction across institutions

```mermaid
sequenceDiagram
    actor C as Citizen
    participant A as ONEiD API
    participant T as correction-tracker
    participant B as Bank
    participant TL as Telecom
    participant N as Authority

    C->>A: POST /corrections (e.g. address change)
    A->>T: open(ticket_hash, [Authority, Bank, Telecom])
    N->>T: update(Applied)
    B->>T: update(Rejected, reason_code)
    TL->>T: update(Failed)
    Note over T: Each institution independently applies or rejects
    A-->>C: Timeline: Authority applied, Bank rejected, Telecom failed (retry available)
```

### 18.5 Exception states that must always be visible

Expired consent · Withdrawn consent · Invalid or revoked credential · Suspended issuer · Wrong-role action · Rejected correction · Partial update · Failed retry · Chain unavailable

---

## 19. Roles and permissions

| Capability | Citizen | Issuer | Verifier | Admin |
|---|:--:|:--:|:--:|:--:|
| Register synthetic identity | ✅ | | | |
| Apply for credential | ✅ | | | |
| Review applications | | ✅ | | |
| Issue / revoke credentials | | ✅ (own only) | | |
| Request claims | | | ✅ | |
| Approve / deny / withdraw consent | ✅ (own only) | | | |
| Verify presentation / check status | | | ✅ | |
| Submit correction | ✅ | | | |
| Respond to correction | | ✅ / institution (own status only) | ✅ / institution (own status only) | |
| Manage registry | | | | ✅ |
| View system-wide audit | | | | ✅ |
| View own audit timeline | ✅ | | | |

Enforcement happens in **three places**: API middleware, database row-level checks, and **contract `require_auth`**. A request denied in any layer fails closed.

---

## 20. Security and privacy

### 20.1 Privacy by design

- Chain holds **hashes and status only**.
- **Selective disclosure** by default; verifiers request only named claims.
- **Purpose binding** and **expiry** on every consent.
- Salted hashes to resist guessing.
- Define retention and deletion rules for every off-chain store.
- Honest UX: withdrawing consent affects **future** sharing only.

### 20.2 Threat model summary

| Threat | Mitigation |
|---|---|
| Rogue issuer issues false credentials | On-chain registry, admin governance, suspension, domain verification via `stellar.toml`. Note: chain proves *who signed*, not *that they verified honestly* |
| Verifier over-collects data | Claim-level consent, purpose binding, audit trail, registry suspension |
| Replay of presentation | Nonce, audience binding, short expiry, holder key binding |
| Stolen credential | Holder binding (`cnf`), status revocation |
| Key loss | Passkeys, second-device passkey, social/institutional recovery (design in Phase 2) |
| RPC outage or reorg | Retry with idempotency, indexer rebuild from events |
| Front-running or tampering with consent | Consent signed by holder via `require_auth`; receipt hash binds all fields |
| Supply-chain attack | Lockfiles, pinned dependency versions, `cargo audit`, `pnpm audit`, Dependabot |
| Secret leakage | Secret scanning, `.env` ignored, demo keys only |
| XSS / CSRF | Strict CSP, SameSite cookies, CSRF tokens on portals |

### 20.3 Regulatory and standards review (no compliance claims)

Reviewed against, **but not claimed compliant with**:

- Nigeria Data Protection Act 2023 and data-subject rights (Nigeria Data Protection Commission)
- W3C Verifiable Credentials Data Model v2.0
- CBN KYC tiering and virtual-asset rules (legal review required before any real pilot)

See `docs/privacy/` for the data inventory and review notes.

### 20.4 Responsible disclosure

See `SECURITY.md`. Report vulnerabilities privately to the maintainers before public disclosure.

---

## 21. Testing strategy

> No test results are asserted in this README. Targets below are acceptance criteria to be evidenced in Phase 4.

| Level | Tools | Scope |
|---|---|---|
| **Contract unit tests** | `cargo test`, Soroban test env | Auth, state transitions, expiry, event emission, error codes, resource budgets |
| **Contract property tests** | `proptest` | Status monotonicity, no revoke-then-reactivate, expiry correctness |
| **Package unit tests** | Vitest | Hashing, canonicalisation, VC issue/verify, schema validation |
| **API integration tests** | Vitest + Supertest + local Quickstart | Full flow against a real local chain |
| **E2E tests** | Playwright | Citizen and institution journeys, responsive layouts |
| **Accessibility** | axe, Lighthouse CI | Role permissions, labels, contrast, keyboard use |
| **Resilience** | Fault injection (`FEATURE_SIMULATED_FAILURES`) | RPC down, tx failure, partial sync, retry |
| **Security** | `cargo audit`, `pnpm audit`, `gitleaks`, ZAP baseline | Dependencies, secrets, basic web scan |

### Test matrix (from the deck)

| Area | Cases |
|---|---|
| **Identity** | Valid / invalid synthetic NIN; simulated face check |
| **Consent** | Approve, deny, expire; no premature disclosure |
| **Credential** | Issue, verify, revoke, reject |
| **Corrections** | Authority review and supporting evidence |
| **Sync** | Applied, rejected, failed, partially synchronised |
| **Access and UX** | Role permissions, responsive layouts, accessibility |

Each test links to **evidence** (screenshots, logs, tx hashes) stored in `docs/evidence/`.

```bash
pnpm test               # unit + integration
pnpm contracts:test     # Rust contract tests
pnpm test:e2e           # Playwright
pnpm test:a11y          # accessibility checks
```

---

## 22. CI/CD and DevOps

### 22.1 Pipeline gates (GitHub Actions)

| Workflow | Triggers | Steps |
|---|---|---|
| `ci.yml` | PR, push to `main` | install → lint → typecheck → unit tests → build (Turborepo cache) |
| `contracts.yml` | changes in `contracts/**` | `cargo fmt --check` → `clippy -D warnings` → `cargo test` → `stellar contract build` → upload WASM artifacts |
| `e2e.yml` | PR (labelled) / nightly | spin up Quickstart service → deploy contracts → seed → Playwright |
| `security.yml` | PR, weekly | `cargo audit`, `pnpm audit`, `gitleaks`, dependency review |
| `preview.yml` | PR (optional) | Deploy hosted preview (if configured) |
| `release.yml` | tag `v*` | Build, generate changelog, publish artifacts |

### 22.2 Conventions

- **Branching:** trunk-based with short-lived feature branches; protected `main`.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `test:`).
- **PRs:** require passing CI, one review, and updated docs/tests.
- **Versioning:** Changesets for packages; semantic version tags for releases.
- **Pre-commit hooks** (Husky + lint-staged): format, lint, secret scan.

### 22.3 Environments

| Environment | Network | Purpose |
|---|---|---|
| Local | Quickstart (Docker) | Primary demo, no external dependency |
| Preview | Testnet | Optional hosted preview per PR or branch |
| Staging | Testnet | Rehearsal of the demo |
| Production | **Not applicable** | No mainnet in this project's scope |

### 22.4 Observability

- Structured JSON logs (pino) with request IDs, **no personal data**
- Health endpoints: `/healthz`, `/readyz`
- Indexer lag, RPC latency and tx failure rate surfaced on the admin dashboard
- Optional OpenTelemetry traces

---

## 23. Deployment

### 23.1 Local (recommended for demos)

```bash
pnpm demo:up
```

Fallback if hosted preview fails: everything required runs locally with no internet connection.

### 23.2 Optional hosted preview

| Component | Suggested host |
|---|---|
| `web` | Vercel / Netlify / any Node host |
| `api`, `mock-anchor`, `mock-fintech` | Fly.io / Railway / Render / container host |
| PostgreSQL | Managed Postgres |
| Chain | Stellar **Testnet** |

Steps: set environment variables, run `pnpm contracts:deploy:testnet`, run migrations, run `pnpm chain:seed`, deploy apps. Store secrets in the host's secret manager.

### 23.3 Docker Compose services

| Service | Image / build | Port |
|---|---|---|
| `stellar` | `stellar/quickstart` | 8000 |
| `postgres` | `postgres:16` | 5432 |
| `api` | `infra/docker/Dockerfile.api` | 4000 |
| `web` | `infra/docker/Dockerfile.web` | 3000 |
| `mock-anchor` | `infra/docker/Dockerfile.anchor` | 4100 |
| `mock-fintech` | `infra/docker/Dockerfile.fintech` | 4200 |

---

## 24. Six-phase SDLC and roadmap

The project follows a **waterfall-inspired, requirements-led** plan. Agree and sign off each phase's deliverables before progressing. Record risks and changes throughout in `docs/risks.md` and `CHANGELOG.md`.

> No delivery dates are invented here. Populate the schedule after the team agrees the plan.

| # | Phase | Key deliverables | Gate (exit criteria) |
|---|---|---|---|
| 1 | **Requirements** | Personas, user stories, functional and non-functional requirements, acceptance criteria, scope sign-off | Agreed scope and acceptance criteria |
| 2 | **Design** | Screen flows, role model, data flows, contract specs, storage layouts, ADRs, privacy data inventory | Reviewed UI, roles and data flows |
| 3 | **Implementation** | Contracts, API, wallet and portals, mock anchor and fintech, seed data | Demonstrable mock end-to-end journeys |
| 4 | **Testing** | Executed test matrix, bug log, accessibility and resilience results | Recorded pass / fail evidence |
| 5 | **Deployment** | Docker stack, CI/CD, optional Testnet preview, runbooks | Repeatable local setup; preview if ready |
| 6 | **Maintenance** | Defect triage, monitoring, next-iteration backlog | Defect log, ownership and next iteration |

### Implementation workstreams

| Workstream | Output |
|---|---|
| **UI/UX** | Reviewed screen flows, rebranded mockups, new consent-receipt and on-chain status screens |
| **Frontend** | Testable citizen and institution views with synthetic data journeys |
| **Backend and contracts** | Soroban contracts, SEP-12-style service, demo endpoints, status simulation |
| **DevOps** | Docker local network, CI gates, preview, resilience drills |

### Suggested milestone breakdown (no dates)

- **M0 – Foundations:** monorepo scaffold, CI, local Quickstart, one "hello contract" deployed
- **M1 – Registry and credentials:** `issuer-registry`, `credential-status`, issuance and verification
- **M2 – Consent:** `consent-registry`, wallet consent UX, selective disclosure presentation
- **M3 – Corrections:** `correction-tracker`, per-institution queues and timelines
- **M4 – Anchor demo:** SEP-1/10/12-style/24 flow with fee sponsorship
- **M5 – Hardening:** accessibility, resilience drills, security checks, evidence pack
- **M6 – Demo readiness:** rehearsal, runbook, final documentation

---

## 25. Acceptance criteria

### Proposed targets

| Area | Target |
|---|---|
| **Consent** | No claim is disclosed before explicit approval |
| **Permissions** | Wrong-role actions are rejected (API and contract) |
| **Credentials** | Expired or revoked demo credentials fail checks |
| **Corrections** | Each institution shows its own independent outcome |
| **Reliability** | Local demo covers denial, failure and retry |
| **Evidence** | Screenshots and results are linked to each test |

### Additional Stellar-specific criteria

- No personal data is present in any contract storage, event or transaction memo (verified by an automated scan of indexer data).
- A suspended issuer cannot register new credentials, and existing credentials from that issuer are flagged at verification.
- A consent receipt cannot be created for a requester who is not an active verifier.
- A institution cannot update another institution's correction status.
- Citizens can complete the full flow holding **zero XLM** (fee sponsorship works).
- Local environment can be rebuilt from scratch with `pnpm demo:reset` and passes the E2E suite.

---

## 26. Team and ownership

| # | Name | Role | Primary ownership in this repo |
|---|---|---|---|
| 01 | Friday Abah | Project Lead | Scope, risks, regulatory review, release sign-off |
| 02 | Daniel Omodiagbe | Backend Developer | `contracts/`, `apps/api`, `packages/contracts-client`, `packages/vc` |
| 03 | Hassan Magaji | Product Manager | Requirements, personas, acceptance criteria, roadmap |
| 04 | Yasin Muhammad Ahmad | Support | Testing support, bug triage, documentation |
| 05 | Zayyad Muhammad Mukhtar | Frontend / DevOps | `apps/web`, `infra/`, CI/CD, Docker local network |
| 06 | Hassana Abdullahi | UI/UX Designer | `docs/design`, `packages/ui`, screen flows, rebranding |
| 07 | Ahmad Amin | Team Support | Test data, demo runbook, documentation, QA support |

Use `CODEOWNERS` to route reviews to the owners above.

---

## 27. Contributing

1. Read `CONTRIBUTING.md` and `SECURITY.md`.
2. Create a branch from `main`: `feat/<area>-<short-description>`.
3. Make changes, add or update tests and docs.
4. Run locally: `pnpm lint && pnpm typecheck && pnpm test && pnpm contracts:test`.
5. Open a PR with: what changed, why, screenshots for UI, test evidence, and any ADR links.
6. A reviewer from the relevant ownership area approves.

### Definition of done

- Code, tests and docs updated
- CI green
- No new lint, type or clippy warnings
- No secrets or real personal data committed
- Accessibility checked for UI changes
- Any new on-chain data reviewed against the "no personal data on-chain" rule

### Architecture decision records

Significant decisions (stack, SD-JWT library, passkey tooling, upgradeability, DID method) go in `docs/architecture/adr/NNNN-title.md` using a short *Context / Decision / Consequences* template.

---

## 28. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `pnpm demo:up` hangs at chain startup | Quickstart still syncing | Wait for RPC health: `curl localhost:8000/soroban/rpc` or check container logs |
| `tx_bad_auth` / auth errors | Wrong signer or missing `require_auth` entry | Re-simulate, ensure correct source account and signed auth entries |
| `tx_insufficient_fee` / resource limit errors | Fee or resource estimate too low | Use simulation result and add a safety margin |
| Contract call returns "entry archived" or expired state | Storage TTL elapsed | Extend TTL and restore the entry; run the TTL-bump job |
| Bindings out of date | Contract changed | `pnpm contracts:bindings` |
| Friendbot fails on Testnet | Rate limit or outage | Retry later; use local network for the demo |
| Passkey registration fails on localhost | Wrong RP ID or origin | Match `WEBAUTHN_RP_ID` and `WEBAUTHN_ORIGIN` to the URL in the browser |
| Indexer lag keeps growing | RPC event retention window passed | Rebuild from the last known ledger or reseed local chain |
| Testnet state disappeared | Testnet reset | Redeploy: `pnpm contracts:deploy:testnet && pnpm chain:seed` |

---

## 29. Risks and open questions

| Risk | Impact | Mitigation / next step |
|---|---|---|
| **Regulation** (CBN KYC tiers, NDPA 2023, virtual-asset rules) | Blocks any real pilot | Legal review; never claim compliance; synthetic data only |
| **Key recovery** | Users lose access to credentials | Multiple passkeys, recovery design in Phase 2 |
| **Issuer trust** | Chain proves who signed, not that verification was honest | Governance of the registry (multi-sig, onboarding policy, audits) |
| **Contract risk** | Bugs in contracts | Extensive tests, external audit before any mainnet use |
| **Privacy leakage via metadata** | Linkability from addresses and timing | Per-relationship pseudonymous addresses, batching, ZK roadmap |
| **Public ledger vs erasure rights** | Conflict with data-subject rights | Hash-only on-chain design, salts, off-chain deletion |
| **Tooling churn** (Soroban, passkey libraries, Quickstart flags) | Build breakage | Pin versions, ADRs, upgrade windows |
| **Scope creep** | Missed demo | Phase gates, strict "out of scope" list |

**Open questions**

- Which DID method (`did:web`, `did:stellar`-style) do we adopt?
- Which SD-JWT VC library, and does it run well in the browser wallet?
- Where do encrypted credentials live (IndexedDB only, or encrypted backup)?
- Do we need ZK proofs inside the MVP, or only as a roadmap item?
- Who governs the registry admin key in the demo (single key vs multi-sig)?

---

## 30. Glossary

| Term | Meaning |
|---|---|
| **Anchor** | A Stellar service that bridges off-chain money (e.g. naira) and on-chain assets |
| **Credential hash** | SHA-256 of a canonicalised, salted credential identifier used for on-chain status |
| **Consent receipt** | Hash-anchored record that a holder approved a specific disclosure |
| **DID** | Decentralised Identifier |
| **Fee-bump transaction** | Stellar transaction wrapper that lets another account pay the fee |
| **Holder** | The citizen who owns and presents credentials |
| **Issuer** | Authorised entity that signs credentials |
| **JCS (RFC 8785)** | JSON Canonicalisation Scheme for deterministic hashing |
| **KYC** | Know Your Customer |
| **NIN** | National Identification Number (synthetic only in this project) |
| **NINAuth** | NIMC's digital ID authentication service |
| **SD-JWT VC** | Selective-disclosure JWT form of a Verifiable Credential |
| **SEP** | Stellar Ecosystem Proposal |
| **Soroban** | Stellar's smart contract platform |
| **TTL** | Time-to-live of Soroban ledger entries, which must be extended to keep them live |
| **Verifier** | Entity that requests and checks claims |
| **VC** | Verifiable Credential (W3C) |

---

## 31. References

1. NIMC / NINAuth official portal: existing digital identity authentication, NIN verification and sharing
2. NIMC / NINAuth launch announcement: existing service context
3. Nigeria Data Protection Commission: Nigeria Data Protection Act 2023 and data-subject rights
4. W3C Verifiable Credentials Data Model v2.0 (W3C Recommendation, 15 May 2025)
5. Stellar developer documentation: Soroban smart contracts, Stellar CLI, Soroban RPC, Quickstart
6. Stellar Ecosystem Proposals: SEP-1, SEP-10, SEP-12, SEP-24
7. IETF SD-JWT and SD-JWT VC specifications
8. RFC 8785: JSON Canonicalization Scheme

---

## 32. License

License  MIT 

<p align="center"><b>ONEiD</b> · Your identity. Your control.</p>
