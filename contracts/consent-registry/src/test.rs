#![cfg(test)]

use super::*;
use issuer_registry::{
    Entity as RegistryEntity, EntityStatus as RegistryEntityStatus, IssuerRegistryContract,
    IssuerRegistryContractClient, Role as RegistryRole,
};
use soroban_sdk::{
    testutils::{Address as _, Events, Ledger},
    Address, BytesN, Env, IntoVal, String, Symbol,
};

fn setup_test() -> (
    Env,
    ConsentRegistryContractClient<'static>,
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

    // Register active verifier
    let active_verifier = Address::generate(&env);
    registry_client.register(&RegistryEntity {
        address: active_verifier.clone(),
        role: RegistryRole::Verifier,
        name: String::from_str(&env, "Mock Verifier"),
        home_domain: String::from_str(&env, "verifier.local"),
        status: RegistryEntityStatus::Active,
        registered_at: 0,
    });

    // Deploy & init consent-registry
    let consent_id = env.register_contract(None, ConsentRegistryContract);
    let consent_client = ConsentRegistryContractClient::new(&env, &consent_id);
    consent_client.init(&registry_id);

    (env, consent_client, registry_client, active_verifier, admin)
}

#[test]
fn test_grant_and_get_has_no_claim_data() {
    let (env, client, _registry, verifier, _admin) = setup_test();
    let holder = Address::generate(&env);
    let receipt_hash = BytesN::from_array(&env, &[11u8; 32]);
    let expires_at = env.ledger().timestamp() + 3600;

    let res = client.try_grant(&holder, &receipt_hash, &verifier, &expires_at);
    assert!(res.is_ok());

    let receipt = client.get(&receipt_hash);
    assert_eq!(receipt.receipt_hash, receipt_hash);
    assert_eq!(receipt.holder, holder);
    assert_eq!(receipt.requester, verifier);
    assert_eq!(receipt.status, ConsentStatus::Active);
    assert_eq!(receipt.expires_at, expires_at);
    assert_eq!(receipt.withdrawn_at, None);

    assert_eq!(client.status(&receipt_hash), ConsentStatus::Active);
}

#[test]
fn test_non_active_requester_rejected() {
    let (env, client, registry, verifier, _admin) = setup_test();
    let holder = Address::generate(&env);
    let receipt_hash = BytesN::from_array(&env, &[12u8; 32]);
    let expires_at = env.ledger().timestamp() + 3600;

    // Suspend verifier
    registry.set_status(&verifier, &RegistryEntityStatus::Suspended);

    let err = client.try_grant(&holder, &receipt_hash, &verifier, &expires_at);
    assert_eq!(err, Err(Ok(ConsentRegistryError::NotActiveVerifier)));

    // Unknown address
    let unknown_requester = Address::generate(&env);
    let err2 = client.try_grant(&holder, &receipt_hash, &unknown_requester, &expires_at);
    assert_eq!(err2, Err(Ok(ConsentRegistryError::NotActiveVerifier)));
}

#[test]
fn test_only_holder_can_withdraw() {
    let (env, client, _registry, verifier, _admin) = setup_test();
    let holder = Address::generate(&env);
    let non_holder = Address::generate(&env);
    let receipt_hash = BytesN::from_array(&env, &[13u8; 32]);
    let expires_at = env.ledger().timestamp() + 3600;

    client.grant(&holder, &receipt_hash, &verifier, &expires_at);

    // Call withdraw and inspect required auth
    client.withdraw(&receipt_hash);
    let auths = env.auths();
    assert_eq!(auths[0].0, holder);
    assert_ne!(auths[0].0, non_holder);
}

#[test]
fn test_withdrawn_is_terminal() {
    let (env, client, _registry, verifier, _admin) = setup_test();
    let holder = Address::generate(&env);
    let receipt_hash = BytesN::from_array(&env, &[14u8; 32]);
    let expires_at = env.ledger().timestamp() + 100;

    client.grant(&holder, &receipt_hash, &verifier, &expires_at);
    assert_eq!(client.status(&receipt_hash), ConsentStatus::Active);

    // Withdraw consent
    client.withdraw(&receipt_hash);
    assert_eq!(client.status(&receipt_hash), ConsentStatus::Withdrawn);

    // Past expires_at — must remain Withdrawn, not Expired
    env.ledger().set_timestamp(expires_at + 1000);
    assert_eq!(client.status(&receipt_hash), ConsentStatus::Withdrawn);

    // Cannot withdraw twice
    let err = client.try_withdraw(&receipt_hash);
    assert_eq!(err, Err(Ok(ConsentRegistryError::AlreadyWithdrawn)));
}

#[test]
fn test_expiry_computed_correctly() {
    let (env, client, _registry, verifier, _admin) = setup_test();
    let holder = Address::generate(&env);
    let receipt_hash = BytesN::from_array(&env, &[15u8; 32]);
    let now = env.ledger().timestamp();
    let expires_at = now + 500;

    client.grant(&holder, &receipt_hash, &verifier, &expires_at);
    assert_eq!(client.status(&receipt_hash), ConsentStatus::Active);

    // Fast-forward past expiry
    env.ledger().set_timestamp(expires_at + 1);
    assert_eq!(client.status(&receipt_hash), ConsentStatus::Expired);
    let rec = client.get(&receipt_hash);
    assert_eq!(rec.status, ConsentStatus::Expired);
}

#[test]
fn test_duplicate_receipt_rejected() {
    let (env, client, _registry, verifier, _admin) = setup_test();
    let holder = Address::generate(&env);
    let receipt_hash = BytesN::from_array(&env, &[16u8; 32]);
    let expires_at = env.ledger().timestamp() + 3600;

    assert!(client
        .try_grant(&holder, &receipt_hash, &verifier, &expires_at)
        .is_ok());
    let err = client.try_grant(&holder, &receipt_hash, &verifier, &expires_at);
    assert_eq!(err, Err(Ok(ConsentRegistryError::AlreadyGranted)));
}

#[test]
fn test_events_emitted() {
    let (env, client, _registry, verifier, _admin) = setup_test();
    let holder = Address::generate(&env);
    let receipt_hash = BytesN::from_array(&env, &[17u8; 32]);
    let expires_at = env.ledger().timestamp() + 3600;

    client.grant(&holder, &receipt_hash, &verifier, &expires_at);
    client.withdraw(&receipt_hash);

    let events = env.events().all();
    let mut found_granted = false;
    let mut found_withdrawn = false;

    for event in events.iter() {
        if !event.1.is_empty() {
            let topic: Symbol = event.1.get(0).unwrap().into_val(&env);
            if topic == Symbol::new(&env, "granted") {
                found_granted = true;
            } else if topic == Symbol::new(&env, "withdrawn") {
                found_withdrawn = true;
            }
        }
    }

    assert!(found_granted, "granted event must be emitted");
    assert!(found_withdrawn, "withdrawn event must be emitted");
}
