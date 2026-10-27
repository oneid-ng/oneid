#!/usr/bin/env bash
# infra/scripts/reset.sh
# Reset local demo state: stop containers, wipe volumes, restart, re-fund.
# Idempotent — safe to run from any state.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/../docker/docker-compose.yml"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "🔄  ONEiD demo reset starting ..."

# 1. Stop and remove containers + volumes
echo ""
echo "1/4  Stopping containers and removing volumes ..."
if command -v docker >/dev/null 2>&1; then
  docker compose -f "${COMPOSE_FILE}" down --volumes --remove-orphans 2>/dev/null || true
  docker compose -f "${COMPOSE_FILE}" up -d 2>/dev/null || true
else
  echo "     ℹ️  Docker not available — cleaning local state"
fi

rm -f "${REPO_ROOT}/deployments/local.json" "${REPO_ROOT}/deployments/seeded-local.json"

# 2. Wait for chain
echo ""
echo "2/4  Waiting for Stellar chain ..."
"${SCRIPT_DIR}/wait-for-chain.sh"

# 3. Deploy & Seed
echo ""
echo "3/4  Redeploying and reseeding ..."
"${SCRIPT_DIR}/deploy-contracts.sh" local
"${SCRIPT_DIR}/chain-seed.sh" local

# 4. Fund accounts
echo ""
echo "4/4  Funding demo accounts ..."
"${SCRIPT_DIR}/fund-accounts.sh" local 2>/dev/null || true

echo ""
echo "✅  Reset complete. Run 'pnpm dev' to start apps."
