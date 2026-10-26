#!/usr/bin/env bash
# infra/scripts/fund-accounts.sh
# Fund demo service accounts via Friendbot.
# Idempotent — re-funding an already-funded account is safe (Friendbot ignores it).
# Usage: ./fund-accounts.sh [NETWORK]
#   NETWORK defaults to $STELLAR_NETWORK or "local"

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Load .env if it exists (local overrides)
if [[ -f "${REPO_ROOT}/.env" ]]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' "${REPO_ROOT}/.env" | grep -v '^$' | xargs)
fi

NETWORK="${1:-${STELLAR_NETWORK:-local}}"
FRIENDBOT_URL="${STELLAR_FRIENDBOT_URL:-http://localhost:8000/friendbot}"

echo "💸  Funding demo accounts on network: ${NETWORK}"
echo "    Friendbot: ${FRIENDBOT_URL}"

# ── Key names to generate and fund ────────────────────────────────────────
KEYS=(admin issuer-demo verifier-anchor verifier-fintech fee-sponsor)

for KEY in "${KEYS[@]}"; do
  echo ""
  echo "  🔑  ${KEY}"

  # Generate key if it doesn't already exist
  if ! stellar keys show "${KEY}" --network "${NETWORK}" 2>/dev/null | grep -q "^G"; then
    echo "      generating ..."
    stellar keys generate "${KEY}" --network "${NETWORK}" --no-fund 2>/dev/null || true
  else
    echo "      key already exists"
  fi

  # Get the public key
  ADDRESS=$(stellar keys address "${KEY}" 2>/dev/null || true)
  if [[ -z "${ADDRESS}" ]]; then
    echo "      ⚠  could not read address for ${KEY}, skipping"
    continue
  fi
  echo "      address: ${ADDRESS}"

  # Fund via Friendbot
  HTTP_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" \
    "${FRIENDBOT_URL}?addr=${ADDRESS}" 2>/dev/null || echo "000")

  if [[ "${HTTP_STATUS}" == "200" ]]; then
    echo "      ✅  funded"
  elif [[ "${HTTP_STATUS}" == "400" ]]; then
    echo "      ℹ   already funded (HTTP 400 from Friendbot is normal)"
  else
    echo "      ⚠  Friendbot returned HTTP ${HTTP_STATUS} — may need retry"
  fi
done

echo ""
echo "✅  fund-accounts done"
