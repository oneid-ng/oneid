#!/usr/bin/env bash
# infra/scripts/reset.sh
# Reset local demo state: stop containers, wipe volumes, restart, re-fund.
# Idempotent — safe to run from any state.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/../docker/docker-compose.yml"

echo "🔄  ONEiD demo reset starting ..."

# 1. Stop and remove containers + volumes
echo ""
echo "1/4  Stopping containers and removing volumes ..."
docker compose -f "${COMPOSE_FILE}" down --volumes --remove-orphans 2>/dev/null || true

# 2. Start fresh
echo ""
echo "2/4  Starting fresh containers ..."
docker compose -f "${COMPOSE_FILE}" up -d

# 3. Wait for chain
echo ""
echo "3/4  Waiting for Stellar chain ..."
"${SCRIPT_DIR}/wait-for-chain.sh"

# 4. Fund accounts
echo ""
echo "4/4  Funding demo accounts ..."
"${SCRIPT_DIR}/fund-accounts.sh"

echo ""
echo "✅  Reset complete. Run 'pnpm dev' to start apps."
