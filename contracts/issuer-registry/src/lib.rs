//! issuer-registry — tracks authorised issuers and verifiers (README §12.1).
//! No personal data is ever stored here.

#![no_std]

use oneid_common::IssuerRegistryError;
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Symbol};

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum Role {
    Issuer,
    Verifier,
}

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum EntityStatus {
    Active,
    Suspended,
    Removed,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Entity {
    pub address: Address,
    pub role: Role,
    pub name: String,
    pub home_domain: String, // matched against stellar.toml off-chain
    pub status: EntityStatus,
    pub registered_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Entity(Address),
}

const DAY_IN_LEDGERS: u32 = 17_280;
const PERSISTENT_THRESHOLD: u32 = 7 * DAY_IN_LEDGERS;
const PERSISTENT_EXTEND_TO: u32 = 30 * DAY_IN_LEDGERS;

fn extend_ttl(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, PERSISTENT_THRESHOLD, PERSISTENT_EXTEND_TO);
}

fn get_admin(env: &Env) -> Result<Address, IssuerRegistryError> {
    let admin: Address = env
        .storage()
        .persistent()
        .get(&DataKey::Admin)
        .ok_or(IssuerRegistryError::NotInitialised)?;
    extend_ttl(env, &DataKey::Admin);
    Ok(admin)
}

#[contract]
pub struct IssuerRegistryContract;

#[contractimpl]
impl IssuerRegistryContract {
    /// One-time initialisation with the admin address.
    pub fn init(env: Env, admin: Address) -> Result<(), IssuerRegistryError> {
        if env.storage().persistent().has(&DataKey::Admin) {
            return Err(IssuerRegistryError::AlreadyInitialised);
        }
        admin.require_auth();
        env.storage().persistent().set(&DataKey::Admin, &admin);
        extend_ttl(&env, &DataKey::Admin);
        Ok(())
    }

    /// Register a new issuer or verifier. Admin auth required.
    pub fn register(env: Env, entity: Entity) -> Result<(), IssuerRegistryError> {
        let admin = get_admin(&env)?;
        admin.require_auth();

        let key = DataKey::Entity(entity.address.clone());
        if env.storage().persistent().has(&key) {
            return Err(IssuerRegistryError::AlreadyRegistered);
        }

        let registered_entity = Entity {
            address: entity.address.clone(),
            role: entity.role,
            name: entity.name,
            home_domain: entity.home_domain,
            status: EntityStatus::Active,
            registered_at: env.ledger().timestamp(),
        };

        env.storage().persistent().set(&key, &registered_entity);
        extend_ttl(&env, &key);

        env.events().publish(
            (Symbol::new(&env, "registered"), entity.address.clone()),
            (registered_entity.role, registered_entity.status),
        );
        Ok(())
    }

    /// Suspend or remove an entity. Admin auth required.
    pub fn set_status(
        env: Env,
        addr: Address,
        status: EntityStatus,
    ) -> Result<(), IssuerRegistryError> {
        let admin = get_admin(&env)?;
        admin.require_auth();

        let key = DataKey::Entity(addr.clone());
        let mut entity: Entity = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(IssuerRegistryError::NotFound)?;
        let old_status = entity.status;
        entity.status = status;

        env.storage().persistent().set(&key, &entity);
        extend_ttl(&env, &key);

        env.events().publish(
            (Symbol::new(&env, "status_changed"), addr),
            (old_status, status),
        );
        Ok(())
    }

    /// Read an entity record. Public read.
    pub fn get(env: Env, addr: Address) -> Result<Entity, IssuerRegistryError> {
        let key = DataKey::Entity(addr);
        let entity: Entity = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(IssuerRegistryError::NotFound)?;
        extend_ttl(&env, &key);
        Ok(entity)
    }

    /// Check if the address is an active issuer. Public query.
    pub fn is_active_issuer(env: Env, addr: Address) -> bool {
        let key = DataKey::Entity(addr);
        if let Some(entity) = env.storage().persistent().get::<DataKey, Entity>(&key) {
            extend_ttl(&env, &key);
            entity.role == Role::Issuer && entity.status == EntityStatus::Active
        } else {
            false
        }
    }

    /// Check if the address is an active verifier. Public query.
    pub fn is_active_verifier(env: Env, addr: Address) -> bool {
        let key = DataKey::Entity(addr);
        if let Some(entity) = env.storage().persistent().get::<DataKey, Entity>(&key) {
            extend_ttl(&env, &key);
            entity.role == Role::Verifier && entity.status == EntityStatus::Active
        } else {
            false
        }
    }

    /// Governance handover. Admin auth required.
    pub fn transfer_admin(env: Env, new_admin: Address) -> Result<(), IssuerRegistryError> {
        let admin = get_admin(&env)?;
        admin.require_auth();

        env.storage().persistent().set(&DataKey::Admin, &new_admin);
        extend_ttl(&env, &DataKey::Admin);

        env.events()
            .publish((Symbol::new(&env, "admin_transferred"), admin), new_admin);
        Ok(())
    }
}

#[cfg(test)]
mod test;
