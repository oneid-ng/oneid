#!/usr/bin/env bash
# infra/scripts/demo-down.sh
# Stop local demo containers (data is preserved).
# README §10.3 — pnpm demo:down

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/../docker/docker-compose.yml"

echo "🔴  ONEiD demo:down"
docker compose -f "${COMPOSE_FILE}" down
echo "✅  Containers stopped. Data volumes preserved."
echo "    Run 'pnpm demo:up' to restart."
echo "    Run 'pnpm demo:reset' to wipe data and restart."
