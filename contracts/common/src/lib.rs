//! oneid-common — shared error enums, types and constants.
//! No personal data is ever stored here.

#![no_std]

use soroban_sdk::contracterror;

// ── Issuer Registry errors ─────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum IssuerRegistryError {
    /// Caller is not the admin.
    Unauthorized = 1,
    /// Entity already registered.
    AlreadyRegistered = 2,
    /// Entity not found.
    NotFound = 3,
    /// Contract already initialised.
    AlreadyInitialised = 4,
    /// Invalid address.
    InvalidAddress = 5,
}

// ── Credential Status errors ───────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum CredentialStatusError {
    /// Caller is not an active issuer.
    NotActiveIssuer = 100,
    /// Credential already registered.
    AlreadyRegistered = 101,
    /// Credential not found.
    NotFound = 102,
    /// Credential already revoked.
    AlreadyRevoked = 103,
    /// Only the original issuer may revoke.
    NotOriginalIssuer = 104,
    /// expiry_ts must be in the future.
    InvalidExpiry = 105,
}

// ── Consent Registry errors ────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ConsentRegistryError {
    /// Requester is not an active verifier.
    NotActiveVerifier = 200,
    /// Consent receipt already exists.
    AlreadyGranted = 201,
    /// Consent receipt not found.
    NotFound = 202,
    /// Consent already withdrawn.
    AlreadyWithdrawn = 203,
    /// Caller is not the holder.
    NotHolder = 204,
    /// expiry_ts must be in the future.
    InvalidExpiry = 205,
}

// ── Correction Tracker errors ──────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum CorrectionTrackerError {
    /// Ticket already exists.
    AlreadyExists = 300,
    /// Ticket not found.
    NotFound = 301,
    /// Caller is not a targeted institution.
    NotTargetedInstitution = 302,
    /// Too many institutions (exceeds cap).
    TooManyInstitutions = 303,
    /// Caller is not the holder.
    NotHolder = 304,
}

// ── Shared constants ───────────────────────────────────────────────────────

/// Maximum institutions per correction ticket (README §12.4).
pub const MAX_INSTITUTIONS_PER_TICKET: u32 = 10;

// ── Tests ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn max_institutions_constant_is_ten() {
        assert_eq!(MAX_INSTITUTIONS_PER_TICKET, 10);
    }

    #[test]
    fn issuer_registry_error_codes_are_stable() {
        assert_eq!(IssuerRegistryError::Unauthorized as u32, 1);
        assert_eq!(IssuerRegistryError::AlreadyRegistered as u32, 2);
        assert_eq!(IssuerRegistryError::NotFound as u32, 3);
    }

    #[test]
    fn credential_status_error_codes_start_at_100() {
        assert_eq!(CredentialStatusError::NotActiveIssuer as u32, 100);
    }

    #[test]
    fn consent_registry_error_codes_start_at_200() {
        assert_eq!(ConsentRegistryError::NotActiveVerifier as u32, 200);
    }

    #[test]
    fn correction_tracker_error_codes_start_at_300() {
        assert_eq!(CorrectionTrackerError::AlreadyExists as u32, 300);
        assert_eq!(CorrectionTrackerError::TooManyInstitutions as u32, 303);
    }
}
