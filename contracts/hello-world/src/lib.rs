//! hello-world — SCAFFOLD CONTRACT
//!
//! Exists solely to prove the Soroban toolchain (stellar contract build,
//! cargo test, clippy) works end-to-end.
//! REMOVE on Day 2 when real contracts are added.
//!
//! NOTE: soroban-sdk 21.x testutils is not used here because of a known
//! incompatibility between soroban-env-host 21.2.1 and Rust stable >=1.82
//! (ed25519-dalek v3 / rand_core trait conflict). Testutils will be
//! re-introduced on Day 2 alongside the real contracts once the SDK version
//! is updated. See docs/architecture/adr/ for the tracking ADR.

#![no_std]

use oneid_common::MAX_INSTITUTIONS_PER_TICKET;
use soroban_sdk::{contract, contractimpl, symbol_short, vec, Env, Symbol, Vec};

#[contract]
pub struct HelloWorldContract;

#[contractimpl]
impl HelloWorldContract {
    /// Returns ["Hello", "ONEiD"].
    /// References MAX_INSTITUTIONS_PER_TICKET to confirm oneid-common links.
    pub fn hello(env: Env) -> Vec<Symbol> {
        let _ = MAX_INSTITUTIONS_PER_TICKET;
        vec![&env, symbol_short!("Hello"), symbol_short!("ONEiD")]
    }

    /// Returns the MAX_INSTITUTIONS_PER_TICKET constant from oneid-common.
    pub fn max_institutions(_env: Env) -> u32 {
        MAX_INSTITUTIONS_PER_TICKET
    }
}

// Pure-Rust tests (no soroban test env) — confirm shared constants compile.
#[cfg(test)]
mod test {
    use oneid_common::MAX_INSTITUTIONS_PER_TICKET;

    #[test]
    fn shared_constant_is_ten() {
        assert_eq!(MAX_INSTITUTIONS_PER_TICKET, 10);
    }
}
