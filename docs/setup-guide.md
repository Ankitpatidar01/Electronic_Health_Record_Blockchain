# Comprehensive Local Setup Guide

This guide provides step-by-step instructions for running the complete Electronic Health Record (EHR) Consortium workspace on a local development machine or cloud VM. Following these steps ensures seamless execution across all 18 team members' machines.

---

## 💻 1. System Requirements & Prerequisites

### Supported Operating Systems
- **Linux:** Ubuntu 22.04 LTS or 24.04 LTS (Recommended)
- **Windows:** Windows 10/11 with **WSL2** (Ubuntu 22.04/24.04 distribution)
- **macOS:** Apple Silicon or Intel with Docker Desktop (ensure Docker socket sharing is enabled)

### Required Software Packages
Ensure the following packages are installed on your host system:
1. **Docker Engine & Docker Compose Plugin** (v24.0+ / Compose v2.20+):
   ```bash
   docker --version
   docker compose version
   ```
   *Verify non-root Docker execution:*
   ```bash
   sudo usermod -aG docker "$USER"
   # Log out and log back in, or run:
   newgrp docker
   docker ps  # Must succeed without sudo
   ```
2. **Node.js & npm** (v20 LTS recommended):
   ```bash
   node --version  # Should be v20.x or higher
   npm --version
   ```
3. **Python** (v3.10 or v3.11):
   ```bash
   python3 --version
   ```
4. **Utility Tools**: `curl`, `git`, `jq`, `lsof`, `tar`.

---

## 🛠️ 2. First-Time Setup (From a Fresh Git Clone)

When cloning this repository for the first time:

```bash
git clone https://github.com/devbyhimans/Electronic_Health_Record_Blockchain.git
cd Electronic_Health_Record_Blockchain
```

### Step 1: Run Workspace Setup Script
The automated setup script installs Node dependencies, configures Python virtual environments, and auto-generates `.env` files from templates:
```bash
./setup.sh
```

### Step 2: Bootstrap Hyperledger Fabric Network (First Run Only)
Cryptographic identity materials (X.509 MSP certificates, CA databases, and genesis blocks) are generated locally and excluded from Git for security. Generate the network credentials:
```bash
cd orgs/hospital/EHR_hospitalOrg-main/ehr-network
bash scripts/network-up.sh
bash scripts/deployChaincode.sh
cd ../../../..
```
*Note: This bootstrap step is required only once. Once certificates and channel genesis blocks are generated, persistent Docker volumes preserve them across system reboots.*

### Step 3: Launch the Consortium Workspace
Start the complete stack (Fabric CAs, Peers, Orderer, Kubo IPFS, Microservices, AI Agents, and Frontends):
```bash
./start.sh
```
The startup sequence runs 6 automated stages, performs a port-sweep, starts the Fabric infrastructure, launches all microservices, and displays a live service health matrix.

---

## 🌐 3. Accessing Portals & Entry Points

Once `./start.sh` completes, open your browser:

| Application | Browser URL | Port / Ingress | Credentials / Notes |
|:---|:---|:---:|:---|
| **Consortium Launchpad** | [http://localhost/](http://localhost/) | `:80` (Hub) | Central gateway checking real-time reachability of all portals. |
| **Hospital Staff Portal** | [http://localhost:5173/](http://localhost:5173/) | `:5173` | Receptionist, Doctor, Nurse, Pharmacist, Admin accounts. |
| **Hospital Patient Portal** | [http://localhost/patient/](http://localhost/patient/) | `:5174` | Patient self-service records and visit history. |
| **Observatory Dashboard** | [http://localhost/dashboard/](http://localhost/dashboard/) | `:5176` | Role-aware Obsidian Glass UI; login using hospital credentials. |
| **Clinical AI Swagger API** | [http://localhost/ai-agent/docs](http://localhost/ai-agent/docs) | `:8000` | Interactive REST documentation for Medical RAG and Trend Analyzer. |
| **Pharmacy Main Hub** | [http://localhost/pharmacy/](http://localhost/pharmacy/) | `:5175` | MedBlock consortium dashboard with IPFS receipt verification. |
| **Pharmacy Patient Portal** | [http://localhost/pharmacy/patient/](http://localhost/pharmacy/patient/) | `:3004` | Active patient switching (`PAT-001`, `PAT-014`, `testuser`), dispensing timeline, and consent self-governance. |
| **Pharmacy Staff Portals** | `/pharmacy/manager/` (`:3001`), `/employee/` (`:3002`), `/inventory/` (`:3003`), `/billing/` (`:3005`) | `:3001`–`:3005` | Manager, Pharmacist Dispensing, Stock Inventory, and Outpatient Billing. |
| **Lab Web Console** | [http://localhost/lab/](http://localhost/lab/) | `:3006` | Diagnostic review deck with glowing gradient cards and integrity status. |

---

## 🛑 4. Graceful Teardown & Reset

### Stop Without Data Loss (Normal Daily Use)
To stop the workspace while preserving blockchain ledgers, patient records, and Docker volumes:
```bash
./stop.sh
```
This script gracefully stops application containers, Fabric peers/orderer, and Fabric CAs, sweeping ports `3000`–`5176` to guarantee no orphan background processes are left running.

### Complete Clean Slate (Hard Reset)
If you need to completely reset the network, wipe ledgers, and regenerate certificates:
```bash
./stop.sh
docker compose down -v
docker volume prune -f
cd orgs/hospital/EHR_hospitalOrg-main/ehr-network
bash scripts/network-down.sh
cd ../../../..
```
Then repeat Step 2 (`network-up.sh` and `deployChaincode.sh`) and Step 3 (`./start.sh`).

---

## 🧪 5. Running Automated Verification Suites

To verify that all subsystems are working with 100% test coverage:

### 1. Dashboard API Tests (76 Tests)
```bash
cd orgs/hospital/EHR_hospitalOrg-main/ehr-backend-v3/dashboard-api
npm test
cd ../../../..
```

### 2. Clinical AI Agent Tests (20 Tests)
```bash
cd services/ai-agent
python3 -m pytest tests/ -v
cd ../..
```

### 3. Lab Multi-Agent Tests (24 Tests)
```bash
cd orgs/lab/EHR-LABORG-main/client/node-gateway
npm test
cd ../../../..
```

All test suites should pass with zero failures and zero unhandled rejections.
