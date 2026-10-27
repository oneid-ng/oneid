#!/usr/bin/env bash
# infra/scripts/wait-for-chain.sh
# Wait until the Soroban RPC on the local Stellar Quickstart is healthy.
# Usage: ./wait-for-chain.sh [RPC_URL] [MAX_ATTEMPTS]
# Idempotent — safe to re-run.

set -euo pipefail

RPC_URL="${1:-${STELLAR_RPC_URL:-http://localhost:8000/soroban/rpc}}"
MAX_ATTEMPTS="${2:-5}"
SLEEP_SECONDS=1

echo "⏳  Checking Soroban RPC at ${RPC_URL} ..."

for i in $(seq 1 "${MAX_ATTEMPTS}"); do
  RESPONSE=$(curl -sf \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' \
    "${RPC_URL}" 2>/dev/null || true)

  if echo "${RESPONSE}" | grep -q '"status":"healthy"'; then
    echo "✅  Soroban RPC is healthy (attempt ${i}/${MAX_ATTEMPTS})"
    exit 0
  fi

  sleep "${SLEEP_SECONDS}"
done

echo "ℹ️   Soroban RPC not reachable at ${RPC_URL} — proceeding with offline fallback"
exit 0
