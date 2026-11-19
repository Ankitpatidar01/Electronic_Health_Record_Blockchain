#!/usr/bin/env bash
# setup-dashboard-identity.sh — give the dashboard its own read-only Fabric
# identity so it can follow blocks and read ledger counts.
#
# Registers and enrols `dashboardobserver` (HospitalMSP, role=observer) on the
# hospital CA if it does not exist yet, then copies its certificate and key and
# the peer's TLS root certificate into dashboard-api/credentials/, which the
# dashboard container mounts read-only. Safe to run on every start.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FABRIC_DIR="${ROOT_DIR}/orgs/hospital/EHR_hospitalOrg-main/ehr-network"
ORG_DIR="${FABRIC_DIR}/organizations/peerOrganizations/hospital.example.com"
USER_MSP="${ORG_DIR}/users/dashboardobserver/msp"
CRED_DIR="${ROOT_DIR}/orgs/hospital/EHR_hospitalOrg-main/ehr-backend-v3/dashboard-api/credentials"
PEER_TLS_CA="${ORG_DIR}/peers/peer0.hospital.example.com/tls/ca.crt"
export PATH="${ROOT_DIR}/bin:${PATH}"

if [[ ! -s "${USER_MSP}/signcerts/cert.pem" ]]; then
  echo "[dashboard-identity] enrolling dashboardobserver on the hospital CA"
  ( cd "${FABRIC_DIR}" && bash scripts/enrollregisteruser.sh \
      --org hospital --username dashboardobserver --password dashobserverpw \
      --type client --role observer ) >/dev/null
fi

CERT="${USER_MSP}/signcerts/cert.pem"
KEY="$(find "${USER_MSP}/keystore" -type f -name '*_sk' | head -n 1)"
[[ -s "${CERT}" && -n "${KEY}" && -s "${KEY}" ]] || { echo "[dashboard-identity] enrolment did not produce a certificate and key" >&2; exit 1; }
[[ -s "${PEER_TLS_CA}" ]] || { echo "[dashboard-identity] peer TLS root certificate not found: ${PEER_TLS_CA}" >&2; exit 1; }

mkdir -p "${CRED_DIR}"
install -m 644 "${CERT}"        "${CRED_DIR}/observer-cert.pem"
# Readable by the container user (uid differs from the host user). The folder
# is git-ignored and the identity can only read.
install -m 644 "${KEY}"         "${CRED_DIR}/observer-key.pem"
install -m 644 "${PEER_TLS_CA}" "${CRED_DIR}/peer-tls-ca.pem"
echo "[dashboard-identity] credentials ready in dashboard-api/credentials"
