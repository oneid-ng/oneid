//! consent-registry — records purpose-bound, expiring consent receipts on-chain (README §12.3).
//! No personal data, purpose text or claims are ever stored on-chain.

#![no_std]

use oneid_common::ConsentRegistryError;
use soroban_sdk::{
    contract, contractclient, contractimpl, contracttype, Address, BytesN, Env, Symbol,
};

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum ConsentStatus {
    Active,
    Withdrawn,
    Expired,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ConsentReceipt {
    pub receipt_hash: BytesN<32>, // SHA-256(JCS{holder, requester, claims, purpose, nonce, expiry, salt})
    pub holder: Address,
    pub requester: Address, // must be an active verifier
    pub expires_at: u64,
    pub status: ConsentStatus,
    pub created_at: u64,
    pub withdrawn_at: Option<u64>,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    IssuerRegistry,
    Consent(BytesN<32>),
}

const DAY_IN_LEDGERS: u32 = 17_280;
const PERSISTENT_THRESHOLD: u32 = 7 * DAY_IN_LEDGERS;
const PERSISTENT_EXTEND_TO: u32 = 30 * DAY_IN_LEDGERS;

fn extend_ttl(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, PERSISTENT_THRESHOLD, PERSISTENT_EXTEND_TO);
}

#[contractclient(name = "IssuerRegistryClient")]
pub trait IssuerRegistryInterface {
    fn is_active_verifier(env: &Env, addr: &Address) -> bool;
}

fn get_issuer_registry(env: &Env) -> Result<Address, ConsentRegistryError> {
    let registry: Address = env
        .storage()
        .persistent()
        .get(&DataKey::IssuerRegistry)
        .ok_or(ConsentRegistryError::NotInitialised)?;
    extend_ttl(env, &DataKey::IssuerRegistry);
    Ok(registry)
}

#[contract]
pub struct ConsentRegistryContract;

#[contractimpl]
impl ConsentRegistryContract {
    /// Initialise with the issuer-registry contract address.
    pub fn init(env: Env, issuer_registry: Address) -> Result<(), ConsentRegistryError> {
        if env.storage().persistent().has(&DataKey::IssuerRegistry) {
            return Err(ConsentRegistryError::AlreadyInitialised);
        }
        env.storage()
            .persistent()
            .set(&DataKey::IssuerRegistry, &issuer_registry);
        extend_ttl(&env, &DataKey::IssuerRegistry);
        Ok(())
    }

    /// Record a new consent receipt.
    /// Requires authorization from the holder.
    /// Fails unless the requester is an ACTIVE verifier in issuer-registry.
    /// Never stores purpose text or claims.
    pub fn grant(
        env: Env,
        holder: Address,
        receipt_hash: BytesN<32>,
        requester: Address,
        expires_at: u64,
    ) -> Result<(), ConsentRegistryError> {
        holder.require_auth();

        if expires_at <= env.ledger().timestamp() {
            return Err(ConsentRegistryError::InvalidExpiry);
        }

        let key = DataKey::Consent(receipt_hash.clone());
        if env.storage().persistent().has(&key) {
            return Err(ConsentRegistryError::AlreadyGranted);
        }

        // Cross-contract check that requester is an active verifier
        let registry_addr = get_issuer_registry(&env)?;
        let registry_client = IssuerRegistryClient::new(&env, &registry_addr);
        if !registry_client.is_active_verifier(&requester) {
            return Err(ConsentRegistryError::NotActiveVerifier);
        }

        let receipt = ConsentReceipt {
            receipt_hash: receipt_hash.clone(),
            holder: holder.clone(),
            requester: requester.clone(),
            expires_at,
            status: ConsentStatus::Active,
            created_at: env.ledger().timestamp(),
            withdrawn_at: None,
        };

        env.storage().persistent().set(&key, &receipt);
        extend_ttl(&env, &key);

        env.events().publish(
            (Symbol::new(&env, "granted"), receipt_hash),
            (holder, requester),
        );
        Ok(())
    }

    /// Withdraw consent.
    /// Requires authorization from the holder.
    ///
    /// IMPORTANT: Withdrawing consent affects FUTURE sharing only (README §12.3).
    /// It does not and cannot delete or erase personal data that the verifier has
    /// already received in an earlier disclosure. The UI must disclose this notice
    /// to the user prior to consent and withdrawal.
    /// Withdrawn is terminal.
    pub fn withdraw(env: Env, receipt_hash: BytesN<32>) -> Result<(), ConsentRegistryError> {
        let key = DataKey::Consent(receipt_hash.clone());
        let mut receipt: ConsentReceipt = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(ConsentRegistryError::NotFound)?;

        if receipt.status == ConsentStatus::Withdrawn {
            return Err(ConsentRegistryError::AlreadyWithdrawn);
        }

        receipt.holder.require_auth();

        receipt.status = ConsentStatus::Withdrawn;
        receipt.withdrawn_at = Some(env.ledger().timestamp());

        env.storage().persistent().set(&key, &receipt);
        extend_ttl(&env, &key);

        env.events().publish(
            (Symbol::new(&env, "withdrawn"), receipt_hash),
            receipt.holder,
        );
        Ok(())
    }

    /// Computed status of the consent receipt with expiry.
    /// Returns Expired if past expires_at and not withdrawn.
    /// Withdrawn is terminal.
    pub fn status(
        env: Env,
        receipt_hash: BytesN<32>,
    ) -> Result<ConsentStatus, ConsentRegistryError> {
        let key = DataKey::Consent(receipt_hash);
        let receipt: ConsentReceipt = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(ConsentRegistryError::NotFound)?;
        extend_ttl(&env, &key);

        if receipt.status == ConsentStatus::Withdrawn {
            Ok(ConsentStatus::Withdrawn)
        } else if env.ledger().timestamp() >= receipt.expires_at {
            Ok(ConsentStatus::Expired)
        } else {
            Ok(ConsentStatus::Active)
        }
    }

    /// Read receipt record.
    pub fn get(env: Env, receipt_hash: BytesN<32>) -> Result<ConsentReceipt, ConsentRegistryError> {
        let key = DataKey::Consent(receipt_hash);
        let mut receipt: ConsentReceipt = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(ConsentRegistryError::NotFound)?;
        extend_ttl(&env, &key);

        if receipt.status != ConsentStatus::Withdrawn
            && env.ledger().timestamp() >= receipt.expires_at
        {
            receipt.status = ConsentStatus::Expired;
        }

        Ok(receipt)
    }
}

#[cfg(test)]
mod test;
