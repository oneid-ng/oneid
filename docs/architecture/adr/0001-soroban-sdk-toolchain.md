# ADR-0001: Soroban SDK version and Rust toolchain

**Status:** Accepted (Day 1 scaffold)  
**Date:** 2026-10-26  
**Owners:** Daniel Omodiagbe, Zayyad Muhammad Mukhtar

## Context

`stellar-cli 28` ships with Protocol 21/22 support. `soroban-sdk 21.7.7` is the
latest SDK version compatible with that protocol. However, `soroban-env-host
21.2.1` (a transitive dependency of `soroban-sdk 21.7.7 testutils`) depends on
`ed25519-dalek v3.0.0`, which requires a `CryptoRng` trait implementation
(`rand_core::TryRng`) that changed in `rand_core 0.9`. On Rust stable ≥1.82
this causes a compile-time trait-bound error when `testutils` is enabled.

## Decision

1. **soroban-sdk** is pinned to `21.7.7` in the workspace.
2. **`rust-toolchain.toml`** stays on `channel = "stable"` (currently 1.96.0).
3. **testutils** (the `soroban-sdk` test-environment feature) is **not used** in
   the Day 1 scaffold. Contract unit tests use pure-Rust assertions only.
4. When the real contracts are introduced (Day 2), the team will evaluate:
   - Upgrading to `soroban-sdk ≥22.x` that resolves the dep conflict, or
   - Adding a `[patch.crates-io]` override for `ed25519-dalek` to unblock
     testutils on the current toolchain.
5. `stellar contract build` (WASM, no testutils) works correctly today.

## Consequences

- Contract integration tests that need the Soroban test environment are deferred
  to Day 2. The scaffold proves the toolchain compiles and deploys.
- No changes to `rust-toolchain.toml` or installed toolchain required.
