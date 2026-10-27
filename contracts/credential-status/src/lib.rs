//! credential-status — manages credential anchoring, revocation and expiry status (README §12.2).
//! No personal data is ever stored here.

#![no_std]

use oneid_common::CredentialStatusError;
use soroban_sdk::{
    contract, contractclient, contractimpl, contracttype, Address, BytesN, Env, Symbol,
};

#[contractclient(name = "IssuerRegistryClient")]
pub trait IssuerRegistryInterface {
    fn is_active_issuer(env: &Env, addr: &Address) -> bool;
    fn is_active_verifier(env: &Env, addr: &Address) -> bool;
}

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum CredStatus {
    Active,
    Revoked,
    Expired,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CredentialRecord {
    pub credential_hash: BytesN<32>,
    pub issuer: Address,
    pub holder: Address,
    pub status: CredStatus,
    pub issued_at: u64,
    pub expires_at: u64,
    pub revoked_at: Option<u64>,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    IssuerRegistry,
    Credential(BytesN<32>),
}

const DAY_IN_LEDGERS: u32 = 17_280;
const PERSISTENT_THRESHOLD: u32 = 7 * DAY_IN_LEDGERS;
const PERSISTENT_EXTEND_TO: u32 = 30 * DAY_IN_LEDGERS;

fn extend_ttl(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, PERSISTENT_THRESHOLD, PERSISTENT_EXTEND_TO);
}

fn get_issuer_registry(env: &Env) -> Result<Address, CredentialStatusError> {
    let registry: Address = env
        .storage()
        .persistent()
        .get(&DataKey::IssuerRegistry)
        .ok_or(CredentialStatusError::NotInitialised)?;
    extend_ttl(env, &DataKey::IssuerRegistry);
    Ok(registry)
}

#[contract]
pub struct CredentialStatusContract;

#[contractimpl]
impl CredentialStatusContract {
    /// Initialise with the issuer-registry contract address.
    pub fn init(env: Env, issuer_registry: Address) -> Result<(), CredentialStatusError> {
        if env.storage().persistent().has(&DataKey::IssuerRegistry) {
            return Err(CredentialStatusError::AlreadyInitialised);
        }
        env.storage()
            .persistent()
            .set(&DataKey::IssuerRegistry, &issuer_registry);
        extend_ttl(&env, &DataKey::IssuerRegistry);
        Ok(())
    }

    /// Anchor a new credential. Requires auth from an active issuer.
    pub fn register(
        env: Env,
        issuer: Address,
        hash: BytesN<32>,
        holder: Address,
        expires_at: u64,
    ) -> Result<(), CredentialStatusError> {
        issuer.require_auth();

        if expires_at <= env.ledger().timestamp() {
            return Err(CredentialStatusError::InvalidExpiry);
        }

        let key = DataKey::Credential(hash.clone());
        if env.storage().persistent().has(&key) {
            return Err(CredentialStatusError::AlreadyRegistered);
        }

        // Cross-contract call to issuer-registry to verify issuer is active
        let registry_addr = get_issuer_registry(&env)?;
        let registry_client = IssuerRegistryClient::new(&env, &registry_addr);
        if !registry_client.is_active_issuer(&issuer) {
            return Err(CredentialStatusError::NotActiveIssuer);
        }

        let record = CredentialRecord {
            credential_hash: hash.clone(),
            issuer: issuer.clone(),
            holder: holder.clone(),
            status: CredStatus::Active,
            issued_at: env.ledger().timestamp(),
            expires_at,
            revoked_at: None,
        };

        env.storage().persistent().set(&key, &record);
        extend_ttl(&env, &key);

        env.events()
            .publish((Symbol::new(&env, "issued"), hash), (issuer, holder));
        Ok(())
    }

    /// Revoke a credential. Reason is a numeric code, never free text.
    /// Only callable by the original issuing issuer.
    pub fn revoke(
        env: Env,
        hash: BytesN<32>,
        reason_code: u32,
    ) -> Result<(), CredentialStatusError> {
        let key = DataKey::Credential(hash.clone());
        let mut record: CredentialRecord = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(CredentialStatusError::NotFound)?;

        if record.status == CredStatus::Revoked {
            return Err(CredentialStatusError::AlreadyRevoked);
        }

        record.issuer.require_auth();

        record.status = CredStatus::Revoked;
        record.revoked_at = Some(env.ledger().timestamp());

        env.storage().persistent().set(&key, &record);
        extend_ttl(&env, &key);

        env.events().publish(
            (Symbol::new(&env, "revoked"), hash),
            (record.issuer, reason_code),
        );
        Ok(())
    }

    /// Computed status of the credential.
    /// Returns Expired when ledger time passes expires_at.
    /// Revoked is terminal: once revoked, always revoked.
    pub fn status(env: Env, hash: BytesN<32>) -> Result<CredStatus, CredentialStatusError> {
        let key = DataKey::Credential(hash);
        let record: CredentialRecord = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(CredentialStatusError::NotFound)?;
        extend_ttl(&env, &key);

        if record.status == CredStatus::Revoked {
            Ok(CredStatus::Revoked)
        } else if env.ledger().timestamp() >= record.expires_at {
            Ok(CredStatus::Expired)
        } else {
            Ok(CredStatus::Active)
        }
    }

    /// Read the full credential record.
    pub fn get(env: Env, hash: BytesN<32>) -> Result<CredentialRecord, CredentialStatusError> {
        let key = DataKey::Credential(hash);
        let mut record: CredentialRecord = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(CredentialStatusError::NotFound)?;
        extend_ttl(&env, &key);

        if record.status != CredStatus::Revoked && env.ledger().timestamp() >= record.expires_at {
            record.status = CredStatus::Expired;
        }

        Ok(record)
    }
}

#[cfg(test)]
mod test;
