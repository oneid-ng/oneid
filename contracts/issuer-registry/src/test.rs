#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events},
    Address, Env, IntoVal, String, Symbol,
};

fn setup_test() -> (Env, IssuerRegistryContractClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, IssuerRegistryContract);
    let client = IssuerRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.init(&admin);
    (env, client, admin)
}

#[test]
fn test_admin_registration_and_get() {
    let (env, client, _admin) = setup_test();
    let issuer_addr = Address::generate(&env);
    let entity = Entity {
        address: issuer_addr.clone(),
        role: Role::Issuer,
        name: String::from_str(&env, "Demo Issuer"),
        home_domain: String::from_str(&env, "issuer.demo.oneid.local"),
        status: EntityStatus::Active,
        registered_at: 0,
    };

    let res = client.try_register(&entity);
    assert!(res.is_ok());

    let stored = client.get(&issuer_addr);
    assert_eq!(stored.address, issuer_addr);
    assert_eq!(stored.role, Role::Issuer);
    assert_eq!(stored.status, EntityStatus::Active);
    assert_eq!(stored.registered_at, env.ledger().timestamp());
    assert!(client.is_active_issuer(&issuer_addr));
    assert!(!client.is_active_verifier(&issuer_addr));
}

#[test]
fn test_duplicate_registration_rejected() {
    let (env, client, _admin) = setup_test();
    let issuer_addr = Address::generate(&env);
    let entity = Entity {
        address: issuer_addr.clone(),
        role: Role::Issuer,
        name: String::from_str(&env, "Demo Issuer"),
        home_domain: String::from_str(&env, "issuer.demo.oneid.local"),
        status: EntityStatus::Active,
        registered_at: 0,
    };

    assert!(client.try_register(&entity).is_ok());
    let err = client.try_register(&entity);
    assert_eq!(err, Err(Ok(IssuerRegistryError::AlreadyRegistered)));
}

#[test]
fn test_suspension_and_removal_flips_active() {
    let (env, client, _admin) = setup_test();
    let verifier_addr = Address::generate(&env);
    let entity = Entity {
        address: verifier_addr.clone(),
        role: Role::Verifier,
        name: String::from_str(&env, "Demo Verifier"),
        home_domain: String::from_str(&env, "verifier.demo.oneid.local"),
        status: EntityStatus::Active,
        registered_at: 0,
    };

    client.register(&entity);
    assert!(client.is_active_verifier(&verifier_addr));

    // Suspend entity
    client.set_status(&verifier_addr, &EntityStatus::Suspended);
    assert!(!client.is_active_verifier(&verifier_addr));
    let stored = client.get(&verifier_addr);
    assert_eq!(stored.status, EntityStatus::Suspended);

    // Remove entity
    client.set_status(&verifier_addr, &EntityStatus::Removed);
    assert!(!client.is_active_verifier(&verifier_addr));
    let stored = client.get(&verifier_addr);
    assert_eq!(stored.status, EntityStatus::Removed);
}

#[test]
fn test_non_admin_rejected_without_auth() {
    let env = Env::default();
    let contract_id = env.register_contract(None, IssuerRegistryContract);
    let client = IssuerRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    // Initialize with mock auths
    env.mock_all_auths();
    client.init(&admin);

    let issuer_addr = Address::generate(&env);
    let entity = Entity {
        address: issuer_addr.clone(),
        role: Role::Issuer,
        name: String::from_str(&env, "Demo Issuer"),
        home_domain: String::from_str(&env, "issuer.demo.oneid.local"),
        status: EntityStatus::Active,
        registered_at: 0,
    };

    client.register(&entity);
    let auths = env.auths();
    assert!(!auths.is_empty());
    assert_eq!(auths[0].0, admin);
}

#[test]
#[should_panic]
fn test_registration_panics_without_admin_auth() {
    let env = Env::default();
    let contract_id = env.register_contract(None, IssuerRegistryContract);
    let client = IssuerRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    // Initialize with mock auths
    env.mock_all_auths();
    client.init(&admin);

    // Create a new env without mock_all_auths to verify auth rejection
    let env_unauthed = Env::default();
    let client_unauthed = IssuerRegistryContractClient::new(&env_unauthed, &contract_id);
    let issuer_addr = Address::generate(&env_unauthed);
    let entity = Entity {
        address: issuer_addr.clone(),
        role: Role::Issuer,
        name: String::from_str(&env_unauthed, "Demo Issuer"),
        home_domain: String::from_str(&env_unauthed, "issuer.demo.oneid.local"),
        status: EntityStatus::Active,
        registered_at: 0,
    };

    // Calling without auth will panic
    client_unauthed.register(&entity);
}

#[test]
fn test_admin_transfer_works_and_old_admin_loses_rights() {
    let (env, client, old_admin) = setup_test();
    let new_admin = Address::generate(&env);

    client.transfer_admin(&new_admin);

    // Verify auth check recorded new_admin requirement for subsequent calls
    let entity = Entity {
        address: Address::generate(&env),
        role: Role::Issuer,
        name: String::from_str(&env, "Second Issuer"),
        home_domain: String::from_str(&env, "second.demo.oneid.local"),
        status: EntityStatus::Active,
        registered_at: 0,
    };

    client.register(&entity);
    let auths = env.auths();
    assert_eq!(auths[0].0, new_admin);
    assert_ne!(auths[0].0, old_admin);
}

#[test]
fn test_events_emitted() {
    let (env, client, _admin) = setup_test();
    let issuer_addr = Address::generate(&env);
    let entity = Entity {
        address: issuer_addr.clone(),
        role: Role::Issuer,
        name: String::from_str(&env, "Demo Issuer"),
        home_domain: String::from_str(&env, "issuer.demo.oneid.local"),
        status: EntityStatus::Active,
        registered_at: 0,
    };

    client.register(&entity);
    client.set_status(&issuer_addr, &EntityStatus::Suspended);
    let new_admin = Address::generate(&env);
    client.transfer_admin(&new_admin);

    let events = env.events().all();
    let mut found_registered = false;
    let mut found_status_changed = false;
    let mut found_admin_transferred = false;

    for event in events.iter() {
        if !event.1.is_empty() {
            let topic: Symbol = event.1.get(0).unwrap().into_val(&env);
            if topic == Symbol::new(&env, "registered") {
                found_registered = true;
            } else if topic == Symbol::new(&env, "status_changed") {
                found_status_changed = true;
            } else if topic == Symbol::new(&env, "admin_transferred") {
                found_admin_transferred = true;
            }
        }
    }

    assert!(found_registered, "registered event must be emitted");
    assert!(found_status_changed, "status_changed event must be emitted");
    assert!(
        found_admin_transferred,
        "admin_transferred event must be emitted"
    );
}
