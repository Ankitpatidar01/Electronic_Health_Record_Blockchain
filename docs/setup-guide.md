# Setup Guide

This guide provides instructions to run each organization in standalone/single-node mode for local development.

> [!IMPORTANT]
> **Operating System & Terminal Requirements**
> - **Windows Users:** You **MUST** use an Ubuntu WSL (Windows Subsystem for Linux) terminal. Do not use standard Command Prompt or PowerShell, as the Fabric bash scripts will fail.
> - **macOS / Linux Users:** You can use your standard native Terminal.
> - **Docker:** Ensure a Docker runtime is open and running before executing any scripts. On Windows, enable Docker's WSL Integration for your Ubuntu distribution. **On macOS, use Colima** (see the [macOS (Colima)](#macos-running-with-colima) section below) instead of Docker Desktop.

## macOS: Running with Colima

macOS has no native Linux container runtime, so the Fabric network (orderer, peers, CAs) runs inside a Linux VM. [Colima](https://github.com/abiosoft/colima) is the lightweight Docker runtime used for this — a drop-in replacement for Docker Desktop.

### 1. Install prerequisites

```bash
# Colima + Docker CLI (skip if already installed)
brew install colima docker
```

**Fabric binaries** — the network scripts resolve these automatically via `scripts/fabric-bin.sh`:

- **macOS** — the committed `bin/` holds Linux ELF binaries that can't run on Apple Silicon, so the scripts use the host's **darwin/arm64** binaries instead (found under `~/go/src/github.com/*/fabric-samples/bin`, `~/fabric-samples/bin`, or a `peer` already on `PATH`).
- **Linux** — the scripts use the committed `bin/`.

To point at a specific location, export `FABRIC_BIN_DIR` before running any script:

```bash
export FABRIC_BIN_DIR="$HOME/go/src/github.com/PrinceHerenj/fabric-samples/bin"
```

### 2. Start the Docker runtime

```bash
colima start --cpu 4 --memory 8 --disk 60
docker context use colima
docker ps                         # verify the daemon is reachable
```

> `colima start` boots a Linux VM and points Docker at it. It persists across reboots — use `colima status` to check, `colima stop` / `colima delete` to tear down.

### 3. Bring up the hospital network

> **First-time / clean-slate:** if any partial or previous setup exists, tear it down before bringing it up:
> ```bash
> cd orgs/hospital/EHR_hospitalOrg-main/ehr-network
> bash scripts/network-down.sh      # full teardown — containers + crypto + channel artifacts
> ```

Then bring the network up — this runs CA start → enroll → peers/orderer/IPFS → channel → anchor peers in one go:

```bash
cd orgs/hospital/EHR_hospitalOrg-main/ehr-network/scripts
bash network-up.sh
```

### 4. Deploy the chaincode (with the FHIR contract)

First-time deploy uses **sequence 1**:

```bash
bash scripts/deployChaincode.sh \
  --channel ehrchannel \
  --chaincode-name ehr \
  --chaincode-path ../ehr-chaincode-v3 \
  --version 2.1 \
  --sequence 1
```

> On a **re-deploy** (upgrade) of an already-committed chaincode, bump `--sequence` past the
> committed value instead — check it with:
> `peer lifecycle chaincode querycommitted -C ehrchannel -n ehr`.
> Every org on the channel (HospitalMSP, DiagnosticsMSP, ProviderMSP) approves automatically.

### 5. Start the backends

```bash
cd ../../ehr-backend-v3

# 1) create a .env for each service (one-time) and set a JWT_SECRET
for s in peer0-api peer1-api peer2-api extorg-api patient-api ipfs-service; do
  cp "$s/.env.example" "$s/.env"
done
# edit each .env: set JWT_SECRET (e.g. `openssl rand -hex 32`); leave FABRIC_BASE_PATH empty

# 2) install + start (ipfs-service first, then the APIs — each in its own terminal
#    or background it). Ports:
#   ipfs-service :4006   peer0-api :4001   peer1-api :4002
#   peer2-api    :4003   extorg-api :4004  patient-api :4005
cd ipfs-service && npm install && npm start
```

> **Note:** `patient-api` uses `better-sqlite3` (pinned to `^13.0.3`, which has Node 22/26
> prebuilds — an older `^11.x` would fail to compile on Node ≥ 23).

### 6. Start the frontends

```bash
cd ../../ehr-frontend-v2/hospital-portal && npm install && npm run dev   # :5173 → receptionist/doctor/nurse UI
cd ../../ehr-frontend-v2/patient-portal  && npm install && npm run dev   # :5174 → patient self-service
```

Open `http://localhost:5173` in a browser. Log in as `receptionist` to register patients.

### 7. Verify the FHIR anchor end-to-end

Default login (all roles share one password in the current `shared/users.json`):

| role | username | password |
|---|---|---|
| receptionist | `receptionist` | `password123` |

1. Login and register a patient — the response now carries a `fhirAnchor`:

```bash
TOKEN=$(curl -s -X POST http://localhost:4001/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"receptionist","password":"password123"}' | jq -r '.data.token')

curl -s -X POST http://localhost:4001/patients \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"patientId":"PAT-100","name":"Aisha Khan","age":34,"gender":"female","bloodGroup":"B+","contact":"+91-90000-11111","address":"Mumbai"}' \
  | jq '.data.fhirAnchor'
```

2. `fhirAnchor` contains the zero-PHI anchor (`resourceType`, `patientIdHash`, `patientRecordHash`, `dataCID`). The FHIR `Patient` resource is pinned to IPFS at `dataCID`; only its digest + CID are written on-chain.

3. Read the anchor back from the ledger:

```bash
peer chaincode query -C ehrchannel -n ehr \
  -c '{"function":"FhirContract:GetFHIRAnchor","Args":["<patientIdHash>","PAT-100"]}'
```

### macOS gotchas

- **No `sudo` is needed** for the `chown` steps — the network scripts fall back gracefully on macOS.
- **`FABRIC_BASE_PATH` is auto-resolved** — leave it empty in `.env` (the hardcoded `/home/avi/...` path has been removed).
- **`KNET` must be identical** on every machine that writes FHIR anchors (Mac and Linux alike), otherwise the same patient yields different hashes. Set it in each backend `.env`.

## Hospital Organization

To bring up the Hospital organization on a single node:

1. Navigate to the hospital network directory:
   ```bash
   cd orgs/hospital/EHR_hospitalOrg-main/ehr-network
   ```
2. Fabric binaries are resolved automatically by `scripts/fabric-bin.sh` (Linux → committed `bin/`; macOS → host darwin binaries — see the [macOS section](#macos-running-with-colima)). No manual download is needed; export `FABRIC_BIN_DIR` to override.
3. Tear down any previous setup, then boot up the network:
   ```bash
   bash scripts/network-down.sh      # (first-time clean-slate — skip if nothing exists yet)
   bash scripts/network-up.sh        # CA → enroll → peers/orderer/IPFS → channel → anchor peers
   ```
4. Deploy the chaincode (includes `FhirContract` — sequence 1 on first deploy):
   ```bash
   bash scripts/deployChaincode.sh \
     --channel ehrchannel \
     --chaincode-name ehr \
     --chaincode-path ../ehr-chaincode-v3 \
     --version 2.1 --sequence 1
   ```
5. Start the backend API:
   ```bash
   cd ../ehr-backend-v3/peer0-api
   npm install && npm start
   ```
6. Start the frontend UI:
   ```bash
   cd ../../ehr-frontend-v2
   npm install && npm run dev
   ```

## Pharmacy Organization

To bring up the Pharmacy organization on a single node:

1. Navigate to the pharmacy network directory:
   ```bash
   cd orgs/pharmacy/fabric-network-swarm
   ```
2. Set up the `.env` configuration for single node:
   ```bash
   cp deploy.env.example deploy.env
   ```
3. Run the full deployment script:
   ```bash
   bash deploy.sh
   ```
   > [!TIP]
   > The `deploy.sh` script automatically packages chaincode, launches the local Fabric network, creates the channel, commits chaincode, imports identities, and starts the frontend/backend apps.

## Lab Organization

To bring up the Lab organization on a single node:

1. Navigate to the lab network directory:
   ```bash
   cd orgs/lab/EHR-LABORG-main
   ```
2. Configure your environment:
   ```bash
   cp env/network.env.example env/network.env
   # Make sure to edit env/network.env and add your GEMINI_API_KEY
   ```
3. Download Fabric binaries and generate crypto material:
   ```bash
   chmod +x scripts/*.sh
   ./scripts/download-fabric.sh
   ./scripts/generate-artifacts.sh
   ```
4. Launch the Machine 1 containers (Orderer + Peer0 + CouchDB + IPFS + Explorer):
   ```bash
   ./scripts/start-machine1.sh
   ```
5. Create the channel and join Peer0:
   ```bash
   ./scripts/create-channel.sh
   ```
6. Deploy the Lab Results Smart Contract:
   ```bash
   ./scripts/deploy-labresults-machine1.sh
   ```
7. Start the API Gateway & Web Dashboard:
   ```bash
   cd client/node-gateway
   npm install && npm run web
   ```
