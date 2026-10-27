#![cfg(test)]

use super::*;
use issuer_registry::{
    Entity as RegistryEntity, EntityStatus as RegistryEntityStatus, IssuerRegistryContract,
    IssuerRegistryContractClient, Role as RegistryRole,
};
use proptest::prelude::*;
use soroban_sdk::{
    testutils::{Address as _, Events, Ledger},
    Address, BytesN, Env, IntoVal, String, Symbol,
};

fn setup_test() -> (
    Env,
    CredentialStatusContractClient<'static>,
    IssuerRegistryContractClient<'static>,
    Address,
    Address,
) {
    let env = Env::default();
    env.mock_all_auths();

    // Deploy & init issuer-registry
    let registry_id = env.register_contract(None, IssuerRegistryContract);
    let registry_client = IssuerRegistryContractClient::new(&env, &registry_id);
    let admin = Address::generate(&env);
    registry_client.init(&admin);

    // Register an active issuer
    let active_issuer = Address::generate(&env);
    registry_client.register(&RegistryEntity {
        address: active_issuer.clone(),
        role: RegistryRole::Issuer,
        name: String::from_str(&env, "Active Issuer"),
        home_domain: String::from_str(&env, "active.issuer.local"),
        status: RegistryEntityStatus::Active,
        registered_at: 0,
    });

    // Deploy & init credential-status
    let status_id = env.register_contract(None, CredentialStatusContract);
    let status_client = CredentialStatusContractClient::new(&env, &status_id);
    status_client.init(&registry_id);

    (env, status_client, registry_client, active_issuer, admin)
}

#[test]
fn test_register_and_get_has_no_claim_data() {
    let (env, client, _registry, issuer, _admin) = setup_test();
    let holder = Address::generate(&env);
    let hash = BytesN::from_array(&env, &[1u8; 32]);
    let expires_at = env.ledger().timestamp() + 3600;

    let res = client.try_register(&issuer, &hash, &holder, &expires_at);
    assert!(res.is_ok());

    let rec = client.get(&hash);
    assert_eq!(rec.credential_hash, hash);
    assert_eq!(rec.issuer, issuer);
    assert_eq!(rec.holder, holder);
    assert_eq!(rec.status, CredStatus::Active);
    assert_eq!(rec.expires_at, expires_at);
    assert_eq!(rec.revoked_at, None);

    let current_status = client.status(&hash);
    assert_eq!(current_status, CredStatus::Active);
}

#[test]
fn test_suspended_issuer_cannot_register() {
    let (env, client, registry, issuer, _admin) = setup_test();
    let holder = Address::generate(&env);
    let hash = BytesN::from_array(&env, &[2u8; 32]);
    let expires_at = env.ledger().timestamp() + 3600;

    // Suspend issuer
    registry.set_status(&issuer, &RegistryEntityStatus::Suspended);

    let err = client.try_register(&issuer, &hash, &holder, &expires_at);
    assert_eq!(err, Err(Ok(CredentialStatusError::NotActiveIssuer)));
}

#[test]
fn test_non_issuing_issuer_cannot_revoke() {
    let (env, client, registry, issuer1, _admin) = setup_test();
    let issuer2 = Address::generate(&env);
    registry.register(&RegistryEntity {
        address: issuer2.clone(),
        role: RegistryRole::Issuer,
        name: String::from_str(&env, "Issuer 2"),
        home_domain: String::from_str(&env, "issuer2.local"),
        status: RegistryEntityStatus::Active,
        registered_at: 0,
    });

    let holder = Address::generate(&env);
    let hash = BytesN::from_array(&env, &[3u8; 32]);
    let expires_at = env.ledger().timestamp() + 3600;

    client.register(&issuer1, &hash, &holder, &expires_at);

    // Revoking requires record.issuer.require_auth().
    // Inspect auth requirements
    client.revoke(&hash, &1001);
    let auths = env.auths();
    assert_eq!(auths[0].0, issuer1);
    assert_ne!(auths[0].0, issuer2);
}

#[test]
fn test_expiry_computed_correctly() {
    let (env, client, _registry, issuer, _admin) = setup_test();
    let holder = Address::generate(&env);
    let hash = BytesN::from_array(&env, &[4u8; 32]);
    let now = env.ledger().timestamp();
    let expires_at = now + 100;

    client.register(&issuer, &hash, &holder, &expires_at);
    assert_eq!(client.status(&hash), CredStatus::Active);

    // Fast-forward ledger time past expires_at
    env.ledger().set_timestamp(expires_at + 1);

    assert_eq!(client.status(&hash), CredStatus::Expired);
    let rec = client.get(&hash);
    assert_eq!(rec.status, CredStatus::Expired);
}

#[test]
fn test_duplicate_hash_rejected() {
    let (env, client, _registry, issuer, _admin) = setup_test();
    let holder = Address::generate(&env);
    let hash = BytesN::from_array(&env, &[5u8; 32]);
    let expires_at = env.ledger().timestamp() + 3600;

    assert!(client
        .try_register(&issuer, &hash, &holder, &expires_at)
        .is_ok());
    let err = client.try_register(&issuer, &hash, &holder, &expires_at);
    assert_eq!(err, Err(Ok(CredentialStatusError::AlreadyRegistered)));
}

#[test]
fn test_revoke_is_terminal_and_events_emitted() {
    let (env, client, _registry, issuer, _admin) = setup_test();
    let holder = Address::generate(&env);
    let hash = BytesN::from_array(&env, &[6u8; 32]);
    let expires_at = env.ledger().timestamp() + 3600;

    client.register(&issuer, &hash, &holder, &expires_at);
    assert_eq!(client.status(&hash), CredStatus::Active);

    // Revoke
    client.revoke(&hash, &1002);
    assert_eq!(client.status(&hash), CredStatus::Revoked);

    // Fast forward ledger time past expires_at - must remain Revoked, not Expired
    env.ledger().set_timestamp(expires_at + 1000);
    assert_eq!(client.status(&hash), CredStatus::Revoked);

    // Cannot revoke again
    let err = client.try_revoke(&hash, &1002);
    assert_eq!(err, Err(Ok(CredentialStatusError::AlreadyRevoked)));

    // Verify events
    let events = env.events().all();
    let mut found_issued = false;
    let mut found_revoked = false;

    for event in events.iter() {
        if !event.1.is_empty() {
            let topic: Symbol = event.1.get(0).unwrap().into_val(&env);
            if topic == Symbol::new(&env, "issued") {
                found_issued = true;
            } else if topic == Symbol::new(&env, "revoked") {
                found_revoked = true;
            }
        }
    }

    assert!(found_issued, "issued event must be emitted");
    assert!(found_revoked, "revoked event must be emitted");
}

proptest! {
    #[test]
    fn proptest_status_monotonicity(
        time_offsets in prop::collection::vec(0u64..10_000, 1..10),
        revoke_at_step in 0usize..10
    ) {
        let (env, client, _registry, issuer, _admin) = setup_test();
        let holder = Address::generate(&env);
        let hash = BytesN::from_array(&env, &[77u8; 32]);
        let base_time = 1_000_000u64;
        let expires_at = base_time + 5_000;

        env.ledger().set_timestamp(base_time);
        client.register(&issuer, &hash, &holder, &expires_at);

        let mut current_time = base_time;
        let mut has_been_revoked = false;

        for (step, offset) in time_offsets.iter().enumerate() {
            current_time += offset;
            env.ledger().set_timestamp(current_time);

            if step == revoke_at_step && !has_been_revoked {
                let _ = client.try_revoke(&hash, &1);
                has_been_revoked = true;
            }

            let status = client.status(&hash);
            if has_been_revoked {
                prop_assert_eq!(status, CredStatus::Revoked, "Revoked status must be terminal");
            } else if current_time >= expires_at {
                prop_assert_eq!(status, CredStatus::Expired, "Must be Expired past expires_at");
            } else {
                prop_assert_eq!(status, CredStatus::Active, "Must be Active before expiry");
            }
        }
    }
}
