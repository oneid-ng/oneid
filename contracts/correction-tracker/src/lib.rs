//! correction-tracker — tracks identity correction requests across institutions (README §12.4).
//! Stores ticket hashes, status and numeric reason codes only, never correction details or evidence.

#![no_std]

use oneid_common::{CorrectionTrackerError, MAX_INSTITUTIONS_PER_TICKET};
use soroban_sdk::{contract, contractimpl, contracttype, Address, BytesN, Env, Symbol, Vec};

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum TicketStatus {
    Submitted,
    UnderReview,
    Applied,
    Rejected,
    Failed,
    PartiallyApplied,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct InstitutionOutcome {
    pub institution: Address,
    pub status: TicketStatus,
    pub updated_at: u64,
    pub reason_code: Option<u32>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Ticket {
    pub ticket_hash: BytesN<32>,
    pub holder: Address,
    pub created_at: u64,
    pub outcomes: Vec<InstitutionOutcome>,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Ticket(BytesN<32>),
}

const DAY_IN_LEDGERS: u32 = 17_280;
const PERSISTENT_THRESHOLD: u32 = 7 * DAY_IN_LEDGERS;
const PERSISTENT_EXTEND_TO: u32 = 30 * DAY_IN_LEDGERS;

fn extend_ttl(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, PERSISTENT_THRESHOLD, PERSISTENT_EXTEND_TO);
}

#[contract]
pub struct CorrectionTrackerContract;

#[contractimpl]
impl CorrectionTrackerContract {
    /// Open a new correction ticket targeting specific institutions.
    /// Holder authorization required.
    /// Cap on institutions is enforced (README §12.4, §12.5).
    pub fn open(
        env: Env,
        holder: Address,
        ticket_hash: BytesN<32>,
        institutions: Vec<Address>,
    ) -> Result<(), CorrectionTrackerError> {
        holder.require_auth();

        if institutions.is_empty() {
            return Err(CorrectionTrackerError::EmptyInstitutions);
        }
        if institutions.len() > MAX_INSTITUTIONS_PER_TICKET {
            return Err(CorrectionTrackerError::TooManyInstitutions);
        }

        let key = DataKey::Ticket(ticket_hash.clone());
        if env.storage().persistent().has(&key) {
            return Err(CorrectionTrackerError::AlreadyExists);
        }

        let now = env.ledger().timestamp();
        let mut outcomes = Vec::new(&env);
        for inst in institutions.iter() {
            outcomes.push_back(InstitutionOutcome {
                institution: inst,
                status: TicketStatus::Submitted,
                updated_at: now,
                reason_code: None,
            });
        }

        let ticket = Ticket {
            ticket_hash: ticket_hash.clone(),
            holder: holder.clone(),
            created_at: now,
            outcomes,
        };

        env.storage().persistent().set(&key, &ticket);
        extend_ttl(&env, &key);

        env.events().publish(
            (Symbol::new(&env, "opened"), ticket_hash),
            (holder, institutions.len()),
        );
        Ok(())
    }

    /// Update ticket status for a specific institution.
    /// Callable ONLY by that institution and updates ONLY its own outcome entry.
    /// Reason is an optional numeric code, never free text.
    pub fn update(
        env: Env,
        institution: Address,
        ticket_hash: BytesN<32>,
        status: TicketStatus,
        reason_code: Option<u32>,
    ) -> Result<(), CorrectionTrackerError> {
        institution.require_auth();

        let key = DataKey::Ticket(ticket_hash.clone());
        let mut ticket: Ticket = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(CorrectionTrackerError::NotFound)?;

        let mut found = false;
        let mut new_outcomes = Vec::new(&env);

        for outcome in ticket.outcomes.iter() {
            if outcome.institution == institution {
                found = true;
                new_outcomes.push_back(InstitutionOutcome {
                    institution: outcome.institution,
                    status,
                    updated_at: env.ledger().timestamp(),
                    reason_code,
                });
            } else {
                new_outcomes.push_back(outcome);
            }
        }

        if !found {
            return Err(CorrectionTrackerError::NotTargetedInstitution);
        }

        ticket.outcomes = new_outcomes;
        env.storage().persistent().set(&key, &ticket);
        extend_ttl(&env, &key);

        env.events().publish(
            (Symbol::new(&env, "outcome_updated"), ticket_hash),
            (institution, status),
        );
        Ok(())
    }

    /// Read the ticket trail. Public read.
    pub fn get(env: Env, ticket_hash: BytesN<32>) -> Result<Ticket, CorrectionTrackerError> {
        let key = DataKey::Ticket(ticket_hash);
        let ticket: Ticket = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(CorrectionTrackerError::NotFound)?;
        extend_ttl(&env, &key);
        Ok(ticket)
    }
}

#[cfg(test)]
mod test;
