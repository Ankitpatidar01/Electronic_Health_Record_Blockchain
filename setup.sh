#!/usr/bin/env bash
# ==============================================================================
# setup.sh — Automated Setup for EHR Hyperledger Fabric Blockchain System
# ==============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="${ROOT_DIR}/bin:${PATH}"

echo "════════════════════════════════════════════════════"
echo "        EHR Blockchain System — Setup               "
echo "════════════════════════════════════════════════════"

# 1. Check prerequisites
echo "[1/5] Checking prerequisites..."
for tool in docker node npm curl jq; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "[-] Missing prerequisite: $tool"
    echo "    Run: sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2 nodejs npm curl jq"
    exit 1
  fi
  echo "  ✓ $tool ($(command -v "$tool"))"
done

# 2. Check Docker daemon & permissions
echo "[2/5] Verifying Docker socket access..."
if ! docker ps >/dev/null 2>&1; then
  echo "[-] Cannot connect to Docker daemon without sudo."
  echo "    Run: sudo usermod -aG docker \"$USER\" and then log out and back in."
  echo "    Do not make the Docker socket world-writable."
  exit 1
fi
echo "  ✓ Docker daemon is active and accessible."

# 3. Pull required Docker images if missing
echo "[3/5] Checking Fabric and IPFS Docker images..."
REQUIRED_IMAGES=(
  "hyperledger/fabric-peer:2.5"
  "hyperledger/fabric-orderer:2.5"
  "hyperledger/fabric-ca:latest"
  "hyperledger/fabric-ccenv:2.5"
  "hyperledger/fabric-nodeenv:2.5"
  "ipfs/kubo:latest"
)

for img in "${REQUIRED_IMAGES[@]}"; do
  if ! docker images --format "{{.Repository}}:{{.Tag}}" | grep -qx "$img"; then
    echo "  [-] Missing $img. Pulling..."
    docker pull "$img"
  else
    echo "  ✓ Image present: $img"
  fi
done

# 4. Install Node.js dependencies
echo "[4/5] Installing application and chaincode dependencies..."
MODULES=(
  "orgs/hospital/EHR_hospitalOrg-main/ehr-chaincode-v3"
  "orgs/hospital/EHR_hospitalOrg-main/ehr-backend-v3/ipfs-service"
  "orgs/hospital/EHR_hospitalOrg-main/ehr-backend-v3/peer0-api"
  "orgs/hospital/EHR_hospitalOrg-main/ehr-backend-v3/peer1-api"
  "orgs/hospital/EHR_hospitalOrg-main/ehr-backend-v3/peer2-api"
  "orgs/hospital/EHR_hospitalOrg-main/ehr-backend-v3/extorg-api"
  "orgs/hospital/EHR_hospitalOrg-main/ehr-backend-v3/patient-api"
  "orgs/hospital/EHR_hospitalOrg-main/ehr-backend-v3/dashboard-api"
  "orgs/digilocker/backend"
  "orgs/hospital/EHR_hospitalOrg-main/ehr-frontend-v2/hospital-portal"
  "orgs/hospital/EHR_hospitalOrg-main/ehr-frontend-v2/patient-portal"
  "orgs/hospital/EHR_hospitalOrg-main/ehr-frontend-v2/dashboard-portal"
  "orgs/lab/EHR-LABORG-main/client/node-gateway"
  "orgs/pharmacy/fabric-network-swarm/app/backend"
  "fhir"
  "orgs/pharmacy/fabric-network-swarm/app/frontend"
)

# These host-side installs are only needed for running unit tests and for the
# chaincode package. Containers install their own packages on first start, so a
# failure here is reported but does not stop setup.
FAILED_MODULES=()
for mod in "${MODULES[@]}"; do
  target="${ROOT_DIR}/${mod}"
  if [ -d "$target" ]; then
    echo "  [*] Installing dependencies in $mod..."
    if (cd "$target" && npm install --no-audit --no-fund --loglevel=error); then
      echo "  ✓ $mod ready"
    else
      echo "  ✖ npm install failed in $mod (see the error above)"
      FAILED_MODULES+=("$mod")
    fi
  fi
done
if [ "${#FAILED_MODULES[@]}" -gt 0 ]; then
  echo "  [!] ${#FAILED_MODULES[@]} module(s) failed to install on the host: ${FAILED_MODULES[*]}"
  echo "      The Docker stack can still start; host unit tests for those modules will not run."
fi

# 5. Initialize environment configs if missing
echo "[5/5] Checking configuration files..."
# Root .env + per-service .env files with generated shared secrets.
node "${ROOT_DIR}/scripts/init-env.js"
DASHBOARD_ENV="${ROOT_DIR}/orgs/hospital/EHR_hospitalOrg-main/ehr-backend-v3/dashboard-api/.env"
if [ ! -f "$DASHBOARD_ENV" ] && [ -f "${DASHBOARD_ENV}.example" ]; then
  cp "${DASHBOARD_ENV}.example" "$DASHBOARD_ENV"
  echo "  ✓ Created dashboard-api/.env from .env.example"
fi

echo ""
echo "════════════════════════════════════════════════════"
echo "  ✓ Setup complete. Next: ./start.sh"
echo "    (the first start creates the Fabric network and deploys the chaincode)"
echo "════════════════════════════════════════════════════"
