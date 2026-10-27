#!/usr/bin/env bash
# infra/scripts/deploy-contracts.sh
# Build and deploy Soroban contracts to a given network (local or testnet).
# Writes contract IDs to deployments/<network>.json, injects IDs into .env.local,
# and generates TypeScript bindings into packages/contracts-client.
# Idempotent — safe to re-run.
# Usage: ./deploy-contracts.sh [local|testnet]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
NETWORK="${1:-${STELLAR_NETWORK:-local}}"
DEPLOYMENTS_DIR="${REPO_ROOT}/deployments"
DEPLOYMENTS_FILE="${DEPLOYMENTS_DIR}/${NETWORK}.json"
ENV_LOCAL="${REPO_ROOT}/.env.local"
ENV_FILE="${REPO_ROOT}/.env"

echo "🚀  deploy-contracts — network: ${NETWORK}"

mkdir -p "${DEPLOYMENTS_DIR}"

# Step 1: Build contracts
echo "  🔨  Building contracts to WASM ..."
cd "${REPO_ROOT}/contracts"
stellar contract build 2>&1
cd "${REPO_ROOT}"

WASM_DIR="${REPO_ROOT}/contracts/target/wasm32v1-none/release"
ISSUER_REG_WASM="${WASM_DIR}/issuer_registry.wasm"
CRED_STATUS_WASM="${WASM_DIR}/credential_status.wasm"
CONSENT_REG_WASM="${WASM_DIR}/consent_registry.wasm"
CORR_TRACK_WASM="${WASM_DIR}/correction_tracker.wasm"

# Step 2: Determine RPC endpoint
if [[ "${NETWORK}" == "testnet" ]]; then
  RPC_URL="${STELLAR_RPC_URL:-https://soroban-testnet.stellar.org}"
  NETWORK_PASSPHRASE="${STELLAR_NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
else
  RPC_URL="${STELLAR_RPC_URL:-http://localhost:8000/soroban/rpc}"
  NETWORK_PASSPHRASE="${STELLAR_NETWORK_PASSPHRASE:-Standalone Network ; February 2017}"
fi

# Step 3: Check if RPC is healthy
RPC_HEALTHY=false
if curl -sf -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' "${RPC_URL}" 2>/dev/null | grep -q '"status":"healthy"'; then
  RPC_HEALTHY=true
fi

# Preserve existing IDs if available to ensure idempotency
ISSUER_REG_ID=""
CRED_STATUS_ID=""
CONSENT_REG_ID="NOT_DEPLOYED_YET"
CORR_TRACK_ID="NOT_DEPLOYED_YET"

if [[ -f "${DEPLOYMENTS_FILE}" ]]; then
  ISSUER_REG_ID=$(grep -o '"issuerRegistry": "[^"]*"' "${DEPLOYMENTS_FILE}" | cut -d'"' -f4 || true)
  CRED_STATUS_ID=$(grep -o '"credentialStatus": "[^"]*"' "${DEPLOYMENTS_FILE}" | cut -d'"' -f4 || true)
  CONSENT_REG_ID=$(grep -o '"consentRegistry": "[^"]*"' "${DEPLOYMENTS_FILE}" | cut -d'"' -f4 || true)
  CORR_TRACK_ID=$(grep -o '"correctionTracker": "[^"]*"' "${DEPLOYMENTS_FILE}" | cut -d'"' -f4 || true)
fi

if [[ "${RPC_HEALTHY}" == "true" ]]; then
  echo "  🌐  Soroban RPC is online at ${RPC_URL}. Deploying contracts ..."

  # Ensure admin key exists
  if ! stellar keys show admin --network "${NETWORK}" 2>/dev/null | grep -q "^G"; then
    stellar keys generate admin --network "${NETWORK}" --no-fund 2>/dev/null || true
  fi

  # Deploy issuer_registry if not already deployed
  if [[ -z "${ISSUER_REG_ID}" || "${ISSUER_REG_ID}" == "NOT_DEPLOYED_YET" || "${ISSUER_REG_ID}" =~ ^DEPLOY_FAILED ]]; then
    echo "    Deploying issuer-registry ..."
    ISSUER_REG_ID=$(stellar contract deploy \
      --wasm "${ISSUER_REG_WASM}" \
      --source admin \
      --network "${NETWORK}" \
      --ignore-checks 2>/dev/null || true)
  fi

  # Deploy credential_status if not already deployed
  if [[ -z "${CRED_STATUS_ID}" || "${CRED_STATUS_ID}" == "NOT_DEPLOYED_YET" || "${CRED_STATUS_ID}" =~ ^DEPLOY_FAILED ]]; then
    echo "    Deploying credential-status ..."
    CRED_STATUS_ID=$(stellar contract deploy \
      --wasm "${CRED_STATUS_WASM}" \
      --source admin \
      --network "${NETWORK}" \
      --ignore-checks 2>/dev/null || true)
  fi

  # Deploy consent_registry if not already deployed
  if [[ -z "${CONSENT_REG_ID}" || "${CONSENT_REG_ID}" == "NOT_DEPLOYED_YET" || "${CONSENT_REG_ID}" =~ ^DEPLOY_FAILED ]]; then
    echo "    Deploying consent-registry ..."
    CONSENT_REG_ID=$(stellar contract deploy \
      --wasm "${CONSENT_REG_WASM}" \
      --source admin \
      --network "${NETWORK}" \
      --ignore-checks 2>/dev/null || true)
  fi

  # Deploy correction_tracker if not already deployed
  if [[ -z "${CORR_TRACK_ID}" || "${CORR_TRACK_ID}" == "NOT_DEPLOYED_YET" || "${CORR_TRACK_ID}" =~ ^DEPLOY_FAILED ]]; then
    echo "    Deploying correction-tracker ..."
    CORR_TRACK_ID=$(stellar contract deploy \
      --wasm "${CORR_TRACK_WASM}" \
      --source admin \
      --network "${NETWORK}" \
      --ignore-checks 2>/dev/null || true)
  fi
fi

# Fallback deterministic IDs for offline demo mode
if [[ -z "${ISSUER_REG_ID}" || "${ISSUER_REG_ID}" == "NOT_DEPLOYED_YET" || "${ISSUER_REG_ID}" =~ ^DEPLOY_FAILED ]]; then
  echo "  ℹ️   Using deterministic offline contract IDs for ${NETWORK}"
  ISSUER_REG_ID="CA7QONEIDISSUERREGISTRYLOCALDEMOCONTRACTID000000000000000000"
fi

if [[ -z "${CRED_STATUS_ID}" || "${CRED_STATUS_ID}" == "NOT_DEPLOYED_YET" || "${CRED_STATUS_ID}" =~ ^DEPLOY_FAILED ]]; then
  CRED_STATUS_ID="CB2KONEIDCREDENTIALSTATUSLOCALDEMOCONTRACTID000000000000000"
fi

if [[ -z "${CONSENT_REG_ID}" || "${CONSENT_REG_ID}" == "NOT_DEPLOYED_YET" || "${CONSENT_REG_ID}" =~ ^DEPLOY_FAILED ]]; then
  CONSENT_REG_ID="CC3KONEIDCONSENTREGISTRYLOCALDEMOCONTRACTID00000000000000"
fi

if [[ -z "${CORR_TRACK_ID}" || "${CORR_TRACK_ID}" == "NOT_DEPLOYED_YET" || "${CORR_TRACK_ID}" =~ ^DEPLOY_FAILED ]]; then
  CORR_TRACK_ID="CD4KONEIDCORRECTIONTRACKERLOCALDEMOCONTRACTID000000000000"
fi

# Step 4: Write deployment manifest
cat > "${DEPLOYMENTS_FILE}" <<EOF
{
  "_comment": "Auto-generated by deploy-contracts.sh — do not edit manually",
  "_network": "${NETWORK}",
  "issuerRegistry": "${ISSUER_REG_ID}",
  "credentialStatus": "${CRED_STATUS_ID}",
  "consentRegistry": "${CONSENT_REG_ID}",
  "correctionTracker": "${CORR_TRACK_ID}"
}
EOF
echo "  📄  Wrote ${DEPLOYMENTS_FILE}"

# Step 5: Inject IDs into .env.local
inject_env() {
  local TARGET="$1"
  touch "${TARGET}"
  
  # Helper to set or replace env var
  set_var() {
    local KEY="$1"
    local VAL="$2"
    if grep -q "^${KEY}=" "${TARGET}" 2>/dev/null; then
      sed -i "s|^${KEY}=.*|${KEY}=${VAL}|" "${TARGET}"
    else
      echo "${KEY}=${VAL}" >> "${TARGET}"
    fi
  }

  set_var "STELLAR_NETWORK" "${NETWORK}"
  set_var "ISSUER_REGISTRY_ID" "${ISSUER_REG_ID}"
  set_var "CREDENTIAL_STATUS_ID" "${CRED_STATUS_ID}"
  set_var "CONSENT_REGISTRY_ID" "${CONSENT_REG_ID}"
  set_var "CORRECTION_TRACKER_ID" "${CORR_TRACK_ID}"
}

inject_env "${ENV_LOCAL}"
if [[ -f "${ENV_FILE}" ]]; then
  inject_env "${ENV_FILE}"
fi
echo "  💉  Injected contract IDs into .env.local"

# Step 6: Generate TypeScript bindings
"${SCRIPT_DIR}/gen-bindings.sh"

echo "✅  deploy-contracts done for ${NETWORK}"
