#!/usr/bin/env bash
# reset-app-state.sh — remove application state that belongs to a ledger which
# no longer exists. Called whenever the Fabric network is rebuilt, so that
# patient logins, dashboard block checkpoints, DigiLocker links and pharmacy
# records from the old ledger do not survive into the new one.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_COMPOSE="${ROOT_DIR}/docker-compose.yaml"

# Containers and their named volumes (dashboard events/checkpoints, DigiLocker
# store, node_modules caches).
node "${ROOT_DIR}/scripts/init-env.js" >/dev/null 2>&1 || true
docker compose -f "${APP_COMPOSE}" --profile dashboard down --volumes --remove-orphans >/dev/null 2>&1 || true

# State kept in bind-mounted folders.
rm -f "${ROOT_DIR}/orgs/hospital/EHR_hospitalOrg-main/ehr-backend-v3/patient-api/data/"patients.db*
rm -f "${ROOT_DIR}/orgs/pharmacy/fabric-network-swarm/app/backend/data/pharmacy_store.json"*

rm -f "${ROOT_DIR}/orgs/hospital/EHR_hospitalOrg-main/ehr-backend-v3/dashboard-api/credentials/"*.pem

echo "[reset] application state for the previous ledger removed"
