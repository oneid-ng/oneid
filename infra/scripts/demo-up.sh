#!/usr/bin/env bash
# infra/scripts/demo-up.sh
# One-command local demo startup.
# README §10.3 — pnpm demo:up

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/../docker/docker-compose.yml"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "🟢  ONEiD demo:up"
echo ""

# Step 1: Start Docker services
echo "1/7  Starting Docker services (stellar + postgres) ..."
if command -v docker >/dev/null 2>&1; then
  docker compose -f "${COMPOSE_FILE}" up -d 2>/dev/null || true
else
  echo "     ℹ️  Docker not available in environment — continuing in local mode"
fi
echo ""

# Step 2: Wait for chain
echo "2/7  Waiting for Soroban RPC ..."
"${SCRIPT_DIR}/wait-for-chain.sh"
echo ""

# Step 3: Build contracts
echo "3/7  Building Soroban contracts ..."
cd "${REPO_ROOT}/contracts"
stellar contract build 2>&1
cd "${REPO_ROOT}"
echo ""

# Step 4: Deploy contracts
echo "4/7  Deploying contracts to local network ..."
"${SCRIPT_DIR}/deploy-contracts.sh" local
echo ""

# Step 5: Generate TypeScript bindings
echo "5/7  Generating TypeScript bindings ..."
"${SCRIPT_DIR}/gen-bindings.sh"
echo ""

# Step 6: On-chain seeding (platform admin, demo issuer, 2 demo verifiers)
echo "6/7  On-chain seeding (issuer registry) ..."
"${SCRIPT_DIR}/chain-seed.sh" local
echo ""

# Step 7: Fund accounts
echo "7/7  Funding demo accounts ..."
"${SCRIPT_DIR}/fund-accounts.sh" local 2>/dev/null || true
echo ""

echo "✅  demo:up complete!"
echo ""
echo "   Services:"
echo "   • Stellar RPC   http://localhost:8000/soroban/rpc"
echo "   • Postgres      localhost:5432  (user: oneid  db: oneid)"
echo ""
echo "   Run 'pnpm dev' to start the app servers."
echo "   Run 'pnpm demo:down' to stop."
echo "   Run 'pnpm demo:reset' to wipe and restart."
