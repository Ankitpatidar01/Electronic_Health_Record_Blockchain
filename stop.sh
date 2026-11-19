#!/usr/bin/env bash
# Stop services while preserving Fabric identities, ledger data, and volumes.
#
#   ./stop.sh           stop everything, keep all data
#   ./stop.sh --reset --yes   same, without the confirmation prompt
#   ./stop.sh --reset   remove containers, volumes, ledger, channel artifacts and
#                       identities, so the next ./start.sh builds a new network
set -euo pipefail

RESET_ALL=false
ASSUME_YES=false
for arg in "$@"; do
  case "$arg" in
    --reset) RESET_ALL=true ;;
    --yes|-y) ASSUME_YES=true ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FABRIC_DIR="${ROOT_DIR}/orgs/hospital/EHR_hospitalOrg-main/ehr-network"
FABRIC_COMPOSE="${FABRIC_DIR}/docker/docker-compose-network.yaml"
CA_COMPOSE="${FABRIC_DIR}/docker/docker-compose-ca.yaml"
APP_COMPOSE="${ROOT_DIR}/docker-compose.yaml"

# ANSI styling
BOLD="\033[1m"
CYAN="\033[1;36m"
GREEN="\033[1;32m"
YELLOW="\033[1;33m"
GRAY="\033[0;90m"
RESET="\033[0m"

echo -e "${CYAN}══════════════════════════════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}${CYAN}               STOPPING EHR BLOCKCHAIN SERVICES & NETWORK                     ${RESET}"
echo -e "${CYAN}══════════════════════════════════════════════════════════════════════════════${RESET}"

# docker-compose.yaml refuses to parse without the root .env secrets.
node "${ROOT_DIR}/scripts/init-env.js" >/dev/null 2>&1 || true

if [[ "${RESET_ALL}" == true ]]; then
  echo -e "\n  ${YELLOW}--reset: this deletes the ledger, all identities and every application volume.${RESET}"
  if [[ "${ASSUME_YES}" != true ]]; then
    read -r -p "  Type RESET to continue: " answer || answer=""
    # Some terminals add a carriage return or spaces; accept any letter case.
    answer="$(printf '%s' "${answer}" | tr -d '[:space:]' | tr '[:lower:]' '[:upper:]')"
    [[ "${answer}" == "RESET" ]] || { echo "  Cancelled (got '${answer}')."; exit 1; }
  fi
  bash "${ROOT_DIR}/scripts/reset-app-state.sh"
  ( cd "${FABRIC_DIR}" && bash scripts/network-down.sh )
  rm -rf "${FABRIC_DIR}/.generated"
  echo -e "  ${GREEN}✓ Everything removed. Run ./start.sh to build a new network.${RESET}\n"
  exit 0
fi

echo -e "\n  ${YELLOW}[1/3] Stopping application containers (portals, APIs, microservices)...${RESET}"
docker compose -f "${APP_COMPOSE}" --profile dashboard stop >/dev/null 2>&1 || true
echo -e "  ${GREEN}✓ Application containers stopped (Docker volumes preserved)${RESET}"

echo -e "\n  ${YELLOW}[2/3] Stopping Fabric peers, orderer, and IPFS node...${RESET}"
docker compose -f "${FABRIC_COMPOSE}" stop >/dev/null 2>&1 || true
echo -e "  ${GREEN}✓ Fabric network nodes stopped (ledger data preserved)${RESET}"

echo -e "\n  ${YELLOW}[3/3] Stopping Fabric certificate authorities...${RESET}"
docker compose -f "${CA_COMPOSE}" stop >/dev/null 2>&1 || true
echo -e "  ${GREEN}✓ Fabric CAs stopped (identity certificates preserved)${RESET}"

echo -e "\n${CYAN}══════════════════════════════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}${GREEN}  ✓ All EHR services stopped successfully.${RESET}"
echo -e "  ${GRAY}Run ./start.sh anytime to bring the entire stack back online.${RESET}"
echo -e "${CYAN}══════════════════════════════════════════════════════════════════════════════${RESET}\n"

