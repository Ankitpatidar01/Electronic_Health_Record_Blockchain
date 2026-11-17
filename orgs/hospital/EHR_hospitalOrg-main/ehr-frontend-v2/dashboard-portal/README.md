# Observatory Dashboard Portal

React 18 & Vite web application for the Group 1 Observatory Dashboard, providing real-time Hyperledger Fabric metrics, agent telemetry, committed block streaming, and clinical views under a strict Zero-PHI design paradigm.

Served at [http://localhost/dashboard/](http://localhost/dashboard/) through Nginx or at host port `5176`.

---

## 🎨 Luxury Obsidian Glass Design System

The portal features a modern, medical-grade dark visual aesthetic:
- **Obsidian Dark Foundation:** Deep `#0B0F17` background with `#111827` surface panels and frosted glass borders (`rgba(255, 255, 255, 0.08)`).
- **Radiant Opposite-Corner Gradient Glow:** Cards feature subtle glowing light spreading from opposite corners (`linear-gradient(135deg, rgba(56, 189, 248, 0.12) 0%, transparent 50%, rgba(168, 85, 247, 0.12) 100%)`).
- **CareGrid Tokens:** Seamlessly integrates with the shared tokens in `packages/caregrid-ui/` and `design-system/tokens.css`.
- **Theme Toggle:** Supports seamless switching between Obsidian Dark Mode and Clinical Light Mode.

---

## ⚡ Real-Time Features & Views

### 1. Interactive Block Stream Inspector Panel
- Located directly below the live block stream card.
- Displays comprehensive cryptographic metadata for selected blocks: Block Number, Block Hash, Previous Hash, Data Hash, Node Endpoint (`peer0.hospital.example.com`), and Transaction IDs.
- Provides **1-Click Clipboard Copy** buttons for every hash and identifier with visual checkmark feedback.
- ASN.1 SHA-256 block header verification confirms cryptographic chain continuity.

### 2. 12/12 Live Consortium Telemetry Cards
- Displays real-time operational status for all 12 consortium nodes and agents:
  - 4 Fabric Peer operations (`peer0.hospital`, `peer1.hospital`, `peer0.diagnostic`, `peer0.provider`)
  - Raft CFT Orderer
  - Clinical AI & Medical RAG microservice
  - Longitudinal History Agent & Consent Governance Agent
  - Lab Gateway, Pharmacy Backend, IPFS Bridge, and Patient API.

### 3. Dedicated Clinical Agent Views
- **Doctor Agent (`DoctorAgent.jsx`):** Clinical consultations, prescription issuance, and vital trend alerts.
- **Nurse Agent (`NurseAgent.jsx`):** Vital signs intake, medication administration, and patient forwarding.
- **Pharmacy Agent (`PharmacyAgent.jsx`):** Dispensing verification, inventory tracking, and IPFS receipt auditing.
- **Lab Agent (`LabAgent.jsx`):** Biomarker classification, out-of-range flags, and Human Review deck status.
- **Clinical Overview (`ClinicalAgentPage.jsx`):** Cross-organization clinical metric synthesis.

### 4. Real-Time Alert Engine (`Alerts.jsx`)
- Active threshold alerts for Hypertensive Crisis, Hypoxia, Hypoglycemia, and unusual ledger transaction latencies.
- Evaluates duration hysteresis and persists alert states across browser reconnects.

---

## 🚀 Running & Building

### Running within Docker Compose
Managed by `./start.sh` from the repository root:
- Accessible at [http://localhost/dashboard/](http://localhost/dashboard/)

### Standalone Development
```bash
npm install
npm run dev
```
Starts the local development server at `http://localhost:5176/dashboard/`.

### Production Build
```bash
npm run build
```
Generates optimized static assets in `dist/`.
