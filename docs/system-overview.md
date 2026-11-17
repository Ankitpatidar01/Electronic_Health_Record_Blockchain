# System Overview

This repository contains an Electronic Health Record (EHR) Consortium workspace built on Hyperledger Fabric 2.5, Kubo IPFS, containerized microservices, autonomous AI intelligence agents, and React/Vite frontends. It federates three healthcare organizations—**Hospital**, **Diagnostics Lab**, and **Pharmacy**—under a shared cryptographic channel (`ehrchannel`) while maintaining sovereign microservices, role-based access control, and zero-PHI observability.

---

## 🏛️ Consortium Organizations & Components

### 1. Hyperledger Fabric Blockchain Network
- **Channel:** `ehrchannel` shared across all consortium members.
- **Consensus:** Crash Fault Tolerant (CFT) Raft consensus via `orderer.example.com` on port `7050` (operations `/healthz` on port `9443`).
- **Organizations:**
  - `HospitalMSP`: Governs core hospital operations with `peer0.hospital` (`:7051`), `peer1.hospital` (`:9051`), and `peer2.hospital` (`:10051`).
  - `DiagnosticsMSP`: Governs laboratory diagnostic reports with `peer0.diagnostic` (`:8051`).
  - `ProviderMSP`: Governs billing claims and external provider audits with `peer0.provider` (`:11051`).
- **Smart Contracts (8 deployed contracts in `ehr-chaincode-v3`):**
  - `PatientContract`, `VisitContract`, `ForwardContract`, `ClinicalContract`, `LabContract`, `ClaimsContract`, `EhrContract`, `AccessContract`.

### 2. Clinical AI Agent & Medical RAG Microservice (`services/ai-agent`)
- **Runtime:** Containerized Python 3.11 FastAPI microservice (`clinical-ai-agent:8000`), reverse-proxied at `http://localhost/ai-agent/`.
- **Clinical Governance:** Evaluates vitals in real time against clinical thresholds (Hypertensive Crisis, Hypoxia $SpO_2 < 90\%$, Hypoglycemia, Tachycardia) and calculates historical trajectory deltas.
- **Medical RAG:** Hybrid semantic and keyword retrieval over curated PubMed clinical literature (`medical_data/pubmed_articles.json`) with scientific citations and confidence scores.
- **Verification:** 20 passing unit and integration tests (`pytest`).

### 3. Lab Multi-Agent Subsystem & Gateway (`orgs/lab/EHR-LABORG-main`)
- **Runtime:** Node.js Express gateway on host port `3006`, reverse-proxied at `http://localhost/lab/`.
- **Lab Report Analysis Agent (`agents/lab-agent.js`):** Extracts clinical biomarkers (CBC, metabolic panels) from unstructured diagnostic reports.
- **Longitudinal History Agent (`agents/history-agent.js`):** Synthesizes multi-visit historical trajectory and correlates chronic trends.
- **Human-in-the-Loop Orchestrator (`orchestrator/orchestrator.js`):** Enforces mandatory review and sign-off by a licensed clinician before anchoring diagnostic reports on-chain.
- **Scheduled Ledger-Integrity Recheck Engine (`integrity-check.js`):** Background 4-hour verification loop comparing raw IPFS multihashes against on-chain Fabric digests.
- **Consortium Anchoring:** Connected directly to `ehrchannel` as `DiagnosticsMSP` and to the shared Kubo IPFS node.
- **Verification:** 24 passing Jest unit tests.

### 4. Pharmacy Organization & CarePoint Portals (`orgs/pharmacy/fabric-network-swarm`)
- **Runtime:** Node.js Express API (`p-backend:3000`) and 6 separate frontends (`:5175`, `:3001`–`:3005`).
- **Persistent Storage (`store.js`):** Resilient file-backed JSON store with seeded medications, patient records (`PAT-001`, `PAT-014`, `PAT-021`, `testuser`), initial bills, and staff roles.
- **Automatic Stock Deduction:** Deducts inventory units in real time upon prescription fulfillment.
- **IPFS Receipt Pinning:** Prescription bills pinned to Kubo IPFS (`http://localhost:8090/ipfs/<CID>`).
- **CarePoint Interactive Patient Portal (`:3004`):** Active patient switcher, prescription table, dispensing timeline, IPFS billing receipts, and patient consent self-governance (grant/revoke staff access).

### 5. Hospital Applications & Peer APIs (`orgs/hospital/EHR_hospitalOrg-main`)
- **Portals:** Hospital Staff Portal (`:5173`) and Patient Portal (`:5174`) styled with the CareGrid Soft Glass Bento design system.
- **Peer APIs:** Six Express microservices on ports `4001`–`4006` (`peer0-api`, `peer1-api`, `peer2-api`, `extorg-api`, `patient-api`, `ipfs-service`).

### 6. Group 1 Real-Time Observatory Dashboard (`dashboard-api` & `dashboard-portal`)
- **Runtime:** `dashboard-api:4010` and `dashboard-portal:5176` (served at `http://localhost/dashboard/`).
- **Telemetry Coverage:** **12/12 Live Consortium Targets Reporting `OK`** (Fabric orderer, 4 peer operations `/healthz`, Clinical AI agent, Lab agents, IPFS, and microservices).
- **Zero-PHI Compliance:** Strict Common Event Envelope scrubbing all patient-identifiable data into keyed HMAC hashes (`patientIdHash`).
- **Real-Time Streaming:** High-throughput WebSocket (`/ws`) and SSE (`/stream`) with single-use stream tickets.
- **Luxury Obsidian Glass UI:** Deep Obsidian theme (`#0B0F17`), radiant opposite-corner gradient card glows, interactive Block Stream Inspector with 1-click clipboard copy, 5 clinical agent views, and real-time threshold alert engine.
- **Verification:** 76 passing automated backend test suites.

### 7. Unified Ingress Gateway (`nginx/nginx.conf`)
- Central reverse proxy on Port 80 routing all traffic cleanly to prevent browser CORS issues:
  - `/` $\rightarrow$ Workspace Hub
  - `/hospital/` $\rightarrow$ Hospital Staff Portal (`:5173`)
  - `/patient/` $\rightarrow$ Patient Portal (`:5174`)
  - `/dashboard/` $\rightarrow$ System Dashboard (`:5176`)
  - `/pharmacy/*` $\rightarrow$ Pharmacy Portals (`:5175`, `:3001`–`:3005`)
  - `/lab/` $\rightarrow$ Lab Web Console (`:3006`)
  - `/ai-agent/` $\rightarrow$ Clinical AI Agent & Swagger Docs (`:8000`)
  - `/api/*` $\rightarrow$ Respective microservice backends

### 8. Digilocker (Proposed Module Only)
- Inventory item for future patient-controlled encrypted document vaults. Contains no runnable backend or frontend in this workspace.

---

## 🚀 Running the System

1. **First-time clone setup:** Run `./setup.sh` to install dependencies and initialize `.env` configuration files.
2. **Start all services:** Run `./start.sh` from the repository root. All 20 services will launch cleanly and be reachable at [http://localhost/](http://localhost/).
3. **Stop all services:** Run `./stop.sh` to gracefully stop containers and free ports without deleting persistent Docker volume data.
