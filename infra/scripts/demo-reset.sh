#!/usr/bin/env bash
# infra/scripts/demo-reset.sh
# Wipe all local demo state and restart from scratch.
# README §10.3 — pnpm demo:reset
# Idempotent — safe to run repeatedly.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "⚠️   ONEiD demo:reset — this will wipe all local chain and DB state"
echo "    Press Ctrl-C within 3 seconds to cancel ..."
sleep 3

"${SCRIPT_DIR}/reset.sh"

echo ""
echo "✅  demo:reset complete. Run 'pnpm dev' to start app servers."
