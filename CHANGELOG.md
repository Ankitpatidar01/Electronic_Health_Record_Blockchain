# Changelog

All notable changes to the Electronic Health Record (EHR) Blockchain Consortium workspace will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v3.0.0] - 2026-11-18

### 🚀 Unified Consortium Multi-Agent Integration & Resilience Release

This major milestone resolves all upstream PR conflicts, unifies the 18-member consortium across four technology stacks (Fabric Blockchain, Node.js Gateway, Python FastAPI AI, and React/Vite frontends), and delivers an automated, resilient workspace for seamless cloning and multi-machine execution.

#### Added
- **Clinical AI Agent Containerization (`services/ai-agent`)**:
  - Authored production `Dockerfile` with multi-stage Python 3.11 environment.
  - Added `clinical-ai-agent` service to `docker-compose.yaml` on internal and host port `8000`.
  - Mounted persistent `.venv` exclusion to prevent host/container virtual environment collisions.
  - Added reverse proxy path `/ai-agent/` in `nginx/nginx.conf` routing API queries and Swagger `/docs`.
  - Added dedicated health endpoint monitoring in `dashboard-api` (`clinical-agent` target).
- **Consortium Lab Multi-Agent System (`orgs/lab/EHR-LABORG-main/client/node-gateway`)**:
  - **Lab Report Analysis Agent (`agents/lab-agent.js`)**: Evaluates diagnostic metrics (Hemoglobin, WBC, Platelets, Creatinine, Bilirubin, Fasting Glucose) against clinical norms with anomaly categorization.
  - **Longitudinal History Agent (`agents/history-agent.js`)**: Computes longitudinal trajectories across chronological patient visits, identifying clinical trend deltas and chronic markers.
  - **Human-in-the-Loop Orchestrator (`orchestrator/orchestrator.js`)**: State machine enforcing human clinician review (`PENDING_REVIEW` $\rightarrow$ `APPROVED` / `REJECTED`) prior to ledger commit.
  - **VCAP Digest & CID Anchoring**: Pins diagnostic payloads to IPFS, records cryptographic multihash, and anchors immutable transaction digests to `ehrchannel` as `DiagnosticsMSP`.
- **Scheduled Ledger-Integrity Recheck Engine (`integrity-check.js`)**:
  - Implemented automated 4-hour background recheck loop.
  - Fetches raw bytes directly from IPFS gateway (`ipfs.ehr.local:5001`), computes SHA-256 hashes, and cross-verifies against on-chain Fabric digests.
  - Emits real-time integrity status via `GET /api/integrity/status` and `POST /api/integrity/run`.
- **Fabric Operations Telemetry & 12/12 Live Node Monitoring**:
  - Connected `dashboard-api` health monitoring to Hyperledger Fabric Operations endpoints (`/healthz`):
    - `peer0.hospital.example.com` (Port `9444`)
    - `peer1.hospital.example.com` (Port `9445`)
    - `peer0.diagnostic.example.com` (Port `9446`)
    - `peer0.provider.example.com` (Port `9447`)
    - `orderer.example.com` (Port `9443`)
  - Configured health targets for `clinical-agent` (`:8000/health`), `history-agent`, and `governance-agent` (`:3006/api/health`).
  - Achieved **12/12 Live Targets Reporting `OK`** on the Observatory Dashboard.
- **Obsidian Glass Dark Mode UI Overhaul**:
  - Redesigned System Dashboard with deep Obsidian background (`#0B0F17`), frosted glass panels, and radiant opposite-corner gradient card glows (`linear-gradient(135deg, rgba(56, 189, 248, 0.12), transparent, rgba(168, 85, 247, 0.12))`).
  - Interactive **Block Stream Inspector Panel** with 1-click clipboard copy for block hash, previous hash, data hash, transaction IDs, and channel metadata.
- **Automated First-Time Setup & Clone Resilience**:
  - Upgraded `setup.sh` to automatically copy `.env.example` to `.env` across `dashboard-api`, `dashboard-portal`, and `services/ai-agent`.
  - Added dependency auto-installation for `dashboard-api` and `dashboard-portal`.
  - Made Compose `env_file:` declarations optional (`required: false`) preventing startup failures on unconfigured systems.
  - Documented clean 4-step setup instructions in root `README.md` and `docs/setup-guide.md`.

#### Fixed
- **Lab Gateway Crash Loop (`ReferenceError: createIntegrityChecker is not defined`)**:
  - Resolved missing import in `orgs/lab/EHR-LABORG-main/client/node-gateway/server.js`.
  - Restored clean initialization and healthy HTTP 200 response on `http://localhost:3006/api/health`.
- **Merge Conflicts across 5 Key Files**:
  - Resolved git merge conflicts on `main` between PR #8 (`lab-integrity-recheck`) and `feat/ui-redesign`:
    - `docker-compose.yaml`: Unified port bindings, environment variables, and health checks.
    - `orgs/lab/EHR-LABORG-main/client/node-gateway/gateway.js`: Unified DiagnosticsMSP channel discovery with IPFS fallback.
    - `public/index.html`, `public/app.js`, `public/styles.css`: Preserved glowing gradient cards while displaying integrity status and human review controls.
- **Nginx Missing Routes**:
  - Added upstream `ai-agent` pointing to `clinical-ai-agent:8000` with `/ai-agent/` routing.
  - Added `/api/lab/` routing to `l-node-gateway:3006`.

#### Verified
- 76/76 passing unit/integration tests in `dashboard-api` (`node --test`).
- 20/20 passing pytest tests in `services/ai-agent` (`python -m pytest`).
- 24/24 passing Jest tests in `orgs/lab/EHR-LABORG-main/client/node-gateway/agents/` (`history-agent.test.js`, `lab-agent.test.js`, `integrity-check.test.js`).
- Complete End-to-End integration test across Hospital Auth $\rightarrow$ Patient Creation $\rightarrow$ Vitals Submission $\rightarrow$ AI Trend Analysis $\rightarrow$ Medical RAG $\rightarrow$ Lab Orchestration $\rightarrow$ Human Approval $\rightarrow$ Integrity Recheck $\rightarrow$ Dashboard Live Stream.

---

## [v2.5.0] - 2026-11-17

### 🧠 Agentic Foundation, Longitudinal History & Clinical AI RAG

#### Added
- **Clinical AI Agent & Medical RAG Subsystem** (PR #7 by Mohd Abd Khan):
  - FastAPI backend (`main.py`) with strict Pydantic v2 data validation schemas (`schemas/clinical.py`).
  - Offline RAG engine indexing PubMed clinical literature (`medical_data/pubmed_articles.json`) with hybrid semantic retrieval and scientific citation.
  - Clinician Web Dashboard in Gradio (`app.py` on `:7860`).
  - Deterministic clinical guideline evaluation (`core/config.py`) detecting Hypertensive Crisis, Hypoxia ($SpO_2 < 90\%$), and Hypoglycemia.
- **Lab Report Analysis Agent** (PR #9 by Saurabh Singh / Team 6):
  - Agentic parser extracting numerical biomarkers and flag classifications from unstructured laboratory reports.
  - Integration with Node.js Lab Gateway.
- **Agentic Foundation & Human-in-the-Loop Review** (PR #10 by Javed):
  - Orchestration state machine for diagnostic reports (`orchestrator/orchestrator.js`).
  - Longitudinal history trend agent synthesizing multi-visit clinical trajectory (`agents/history-agent.js`).
  - Human review approval deck in the Lab Web Console.
- **DiagnosticsMSP Gateway Integration** (PR #8 by Prafull Narang):
  - Connected Lab Gateway to Fabric `ehrchannel` under `DiagnosticsMSP`.
  - Connected Lab Gateway directly to the shared Kubo IPFS node (`ipfs.ehr.local:5001`).

---

## [v2.0.0] - 2026-11-16

### 💊 Pharmacy Resiliency, Persistent Store & CarePoint Interactive Patient Portal

#### Added
- **Resilient Persistent Store (`store.js`)**:
  - Implemented file-backed JSON state (`data/pharmacy_store.json`) with seeded medication catalog, patient profiles (`PAT-001`, `PAT-014`, `PAT-021`, `testuser`), initial bills, and staff roles.
  - Automatic inventory stock deduction upon dispensing and bill issuance.
  - Graceful fallback wrapping Fabric chaincode queries, ensuring 100% 200 OK responses with zero 500 crashes.
- **CarePoint Interactive Patient Portal (`app/patient/` on `:3004`)**:
  - Completely re-engineered from a static "Unavailable" stub into a full React healthcare portal.
  - Active patient switcher, verifiable prescription ledgers, dispensing timelines, and IPFS billing receipts (`/ipfs/<CID>`).
  - Interactive Patient Consent Self-Governance (Grant/Revoke staff access).
- **Consortium Reverse Proxy (Nginx on Port 80)**:
  - Engineered single-entry reverse proxy gateway routing `/`, `/hospital/`, `/patient/`, `/dashboard/`, `/pharmacy/*`, `/lab/`, and `/api/*`.
  - Solved all cross-origin resource sharing (CORS) browser restrictions.
- **Master Startup & Teardown Scripts**:
  - Built `./start.sh` and `./stop.sh` with automated port sweeping (`lsof -ti :<port> | xargs kill -9`) and volume isolation.

#### Fixed
- **Root-Cause HTTP 500 Crashes in Pharmacy Backend**:
  - Resolved invalid hardcoded path replacements in `p-backend/app.js`.
  - Connected `p-backend` to both `default` and `ehr_network` Docker networks for Kubo IPFS and Fabric access.
- **Raft Orderer TLS Certificate Genesis Mismatch**:
  - Re-synchronized `configtxgen` genesis block with on-disk crypto-config MSP certificates (Commit `e697a3e`).
- **Cross-Platform Docker Volume Native Binary Collisions**:
  - Isolated `node_modules` inside named Docker volumes, preventing WSL/Linux native binary crashes.

---

## [v1.5.0] - 2026-11-15

### 📊 Group 1 Real-Time Event Architecture & Zero-PHI Observatory

#### Added
- **Hyperledger Fabric Block Commit Collector (`dashboard-api/src/collector/`)**:
  - Read-only observer tapping committed blocks on `ehrchannel`.
  - Atomic checkpointing (`checkpoint.json`) for failover recovery without event loss or duplication.
- **Zero-PHI Event Normalizer (`dashboard-api/src/normalizer/`)**:
  - Redacts patient names and clinical notes into keyed hashes (`patientIdHash`).
  - Common Event Envelope strictly enforcing compliance with India DPDP Act 2023, HIPAA, and GDPR design guidelines.
- **Real-Time Streaming Engine**:
  - High-throughput WebSocket (`/ws`) and Server-Sent Events (`/stream`) with single-use stream-ticket authentication and resumable backpressure control.
- **5 Dedicated Clinical Agent Views**:
  - `DoctorAgent.jsx`, `NurseAgent.jsx`, `PharmacyAgent.jsx`, `LabAgent.jsx`, and `ClinicalAgentPage.jsx`.
- **Threshold Alert Engine (`Alerts.jsx`)**:
  - Real-time alert evaluation with duration hysteresis and auto-resolution.
- **76 Automated Backend Tests**:
  - Full test coverage across auth, role matrices, envelope validation, NDJSON store recovery, and metrics aggregation.

---

## [v1.0.0] - 2026-10-14

### 🏛️ Initial Hyperledger Fabric Consortium & Multi-Org Infrastructure

#### Added
- Hyperledger Fabric 2.5 network with Raft CFT consensus (`orderer.example.com`).
- 3 Consortium Organizations:
  - `HospitalMSP` (`peer0.hospital:7051`, `peer1.hospital:9051`, `peer2.hospital:10051`)
  - `DiagnosticsMSP` (`peer0.diagnostic:8051`)
  - `ProviderMSP` (`peer0.provider:11051`)
- Channel `ehrchannel` shared across all organizations.
- 8 Smart Contracts in `ehr-chaincode-v3`:
  - `PatientContract`, `VisitContract`, `ForwardContract`, `ClinicalContract`, `LabContract`, `ClaimsContract`, `EhrContract`, `AccessContract`.
- Kubo IPFS node (`:5001` / `:8090`) for off-chain large payload storage.
- Hospital Staff Portal (`:5173`) and Patient Portal (`:5174`).
- Express APIs on ports `4001`–`4006`.
