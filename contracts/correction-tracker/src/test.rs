#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events},
    vec, Address, BytesN, Env, IntoVal, Symbol,
};

fn setup_test() -> (Env, CorrectionTrackerContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, CorrectionTrackerContract);
    let client = CorrectionTrackerContractClient::new(&env, &contract_id);
    (env, client)
}

#[test]
fn test_open_ticket_and_get() {
    let (env, client) = setup_test();
    let holder = Address::generate(&env);
    let inst_a = Address::generate(&env);
    let inst_b = Address::generate(&env);
    let ticket_hash = BytesN::from_array(&env, &[21u8; 32]);

    let institutions = vec![&env, inst_a.clone(), inst_b.clone()];
    client.open(&holder, &ticket_hash, &institutions);

    let ticket = client.get(&ticket_hash);
    assert_eq!(ticket.ticket_hash, ticket_hash);
    assert_eq!(ticket.holder, holder);
    assert_eq!(ticket.outcomes.len(), 2);

    let outcome_a = ticket.outcomes.get(0).unwrap();
    assert_eq!(outcome_a.institution, inst_a);
    assert_eq!(outcome_a.status, TicketStatus::Submitted);
    assert_eq!(outcome_a.reason_code, None);

    let outcome_b = ticket.outcomes.get(1).unwrap();
    assert_eq!(outcome_b.institution, inst_b);
    assert_eq!(outcome_b.status, TicketStatus::Submitted);
}

#[test]
fn test_independent_outcomes_coexist_and_auth() {
    let (env, client) = setup_test();
    let holder = Address::generate(&env);
    let inst_a = Address::generate(&env);
    let inst_b = Address::generate(&env);
    let ticket_hash = BytesN::from_array(&env, &[22u8; 32]);

    let institutions = vec![&env, inst_a.clone(), inst_b.clone()];
    client.open(&holder, &ticket_hash, &institutions);

    // Institution A updates its outcome to UnderReview
    client.update(
        &inst_a,
        &ticket_hash,
        &TicketStatus::UnderReview,
        &Some(101),
    );

    // Verify auth was required for inst_a
    let auths = env.auths();
    assert_eq!(auths[0].0, inst_a);

    // Verify only Inst A was updated, Inst B is still Submitted
    let ticket1 = client.get(&ticket_hash);
    let out_a = ticket1
        .outcomes
        .iter()
        .find(|o| o.institution == inst_a)
        .unwrap();
    let out_b = ticket1
        .outcomes
        .iter()
        .find(|o| o.institution == inst_b)
        .unwrap();
    assert_eq!(out_a.status, TicketStatus::UnderReview);
    assert_eq!(out_a.reason_code, Some(101));
    assert_eq!(out_b.status, TicketStatus::Submitted);
    assert_eq!(out_b.reason_code, None);

    // Institution B updates its outcome to Applied
    client.update(&inst_b, &ticket_hash, &TicketStatus::Applied, &None);

    let ticket2 = client.get(&ticket_hash);
    let out_a2 = ticket2
        .outcomes
        .iter()
        .find(|o| o.institution == inst_a)
        .unwrap();
    let out_b2 = ticket2
        .outcomes
        .iter()
        .find(|o| o.institution == inst_b)
        .unwrap();
    assert_eq!(out_a2.status, TicketStatus::UnderReview);
    assert_eq!(out_b2.status, TicketStatus::Applied);
}

#[test]
fn test_unlisted_institution_rejected() {
    let (env, client) = setup_test();
    let holder = Address::generate(&env);
    let inst_a = Address::generate(&env);
    let unlisted = Address::generate(&env);
    let ticket_hash = BytesN::from_array(&env, &[23u8; 32]);

    let institutions = vec![&env, inst_a.clone()];
    client.open(&holder, &ticket_hash, &institutions);

    // Unlisted institution attempts to update
    let err = client.try_update(&unlisted, &ticket_hash, &TicketStatus::Applied, &None);
    assert_eq!(err, Err(Ok(CorrectionTrackerError::NotTargetedInstitution)));
}

#[test]
fn test_institution_a_cannot_change_institution_b_status() {
    let (env, client) = setup_test();
    let holder = Address::generate(&env);
    let inst_a = Address::generate(&env);
    let inst_b = Address::generate(&env);
    let ticket_hash = BytesN::from_array(&env, &[24u8; 32]);

    let institutions = vec![&env, inst_a.clone(), inst_b.clone()];
    client.open(&holder, &ticket_hash, &institutions);

    // Institution A updates with inst_a auth
    client.update(&inst_a, &ticket_hash, &TicketStatus::Rejected, &Some(404));

    // Verify inst_b's status was untouched
    let ticket = client.get(&ticket_hash);
    let out_b = ticket
        .outcomes
        .iter()
        .find(|o| o.institution == inst_b)
        .unwrap();
    assert_eq!(out_b.status, TicketStatus::Submitted);
    assert_ne!(out_b.status, TicketStatus::Rejected);
}

#[test]
fn test_cap_enforced() {
    let (env, client) = setup_test();
    let holder = Address::generate(&env);
    let ticket_hash = BytesN::from_array(&env, &[25u8; 32]);

    // Create 11 institutions (MAX is 10)
    let mut institutions = Vec::new(&env);
    for _ in 0..11 {
        institutions.push_back(Address::generate(&env));
    }

    let err = client.try_open(&holder, &ticket_hash, &institutions);
    assert_eq!(err, Err(Ok(CorrectionTrackerError::TooManyInstitutions)));

    // Empty list rejected
    let empty_insts = Vec::new(&env);
    let err_empty = client.try_open(&holder, &ticket_hash, &empty_insts);
    assert_eq!(
        err_empty,
        Err(Ok(CorrectionTrackerError::EmptyInstitutions))
    );
}

#[test]
fn test_events_emitted() {
    let (env, client) = setup_test();
    let holder = Address::generate(&env);
    let inst_a = Address::generate(&env);
    let ticket_hash = BytesN::from_array(&env, &[26u8; 32]);

    let institutions = vec![&env, inst_a.clone()];
    client.open(&holder, &ticket_hash, &institutions);
    client.update(&inst_a, &ticket_hash, &TicketStatus::UnderReview, &Some(1));

    let events = env.events().all();
    let mut found_opened = false;
    let mut found_outcome_updated = false;

    for event in events.iter() {
        if !event.1.is_empty() {
            let topic: Symbol = event.1.get(0).unwrap().into_val(&env);
            if topic == Symbol::new(&env, "opened") {
                found_opened = true;
            } else if topic == Symbol::new(&env, "outcome_updated") {
                found_outcome_updated = true;
            }
        }
    }

    assert!(found_opened, "opened event must be emitted");
    assert!(
        found_outcome_updated,
        "outcome_updated event must be emitted"
    );
}
