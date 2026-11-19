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
if ! down_output="$(docker compose -f "${APP_COMPOSE}" --profile dashboard down --volumes --remove-orphans 2>&1)"; then
  echo "[reset] docker compose down failed:" >&2
  echo "${down_output}" >&2
  exit 1
fi

# State kept in bind-mounted folders. Containers write these as root, so a plain
# rm can be refused; fall back to removing them from inside a container.
remove_state() {
  local dir="$1" pattern="$2"
  [[ -d "${dir}" ]] || return 0
  if ! ( cd "${dir}" && rm -f -- ${pattern} ) 2>/dev/null; then
    docker run --rm -v "${dir}:/state" busybox:latest sh -c "cd /state && rm -f -- ${pattern}"
  fi
  if compgen -G "${dir}/${pattern}" >/dev/null; then
    echo "[reset] could not remove ${dir}/${pattern}" >&2
    echo "        A process still has the file open, or it needs: sudo rm -f ${dir}/${pattern}" >&2
    exit 1
  fi
}

remove_state "${ROOT_DIR}/orgs/hospital/EHR_hospitalOrg-main/ehr-backend-v3/patient-api/data" 'patients.db*'
remove_state "${ROOT_DIR}/orgs/pharmacy/fabric-network-swarm/app/backend/data" 'pharmacy_store.json*'
remove_state "${ROOT_DIR}/orgs/hospital/EHR_hospitalOrg-main/ehr-backend-v3/dashboard-api/credentials" '*.pem'

echo "[reset] application state for the previous ledger removed"
