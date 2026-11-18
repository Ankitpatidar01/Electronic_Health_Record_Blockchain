# Dashboard Implementation Roadmap & Status

**Group 1 — Dashboard Module Implementation**  
Project: Blockchain-based Electronic Health Record (EHR) Platform  
Reference Document: `docs/Group_1_Novelty/bitcoin.pdf`  

---

## Deliverables Checklist & Completion Status

### Phase 1 — Dashboard Foundation
- [x] React 18 / Vite / Tailwind dashboard shell (`dashboard-portal`)
- [x] Responsive layout with sticky top-bar, navigation, live indicator, and theme switcher
- [x] Complete REST client with JWT verification and automatic token injection
- [x] Zero-PHI audit compliance: sensitive patient narratives excluded from presentation

### Phase 2 — Network Monitoring
- [x] Fabric Peer status monitoring across Hospital, Diagnostic, and Provider MSPs
- [x] Block height tracking and ledger lag calculation
- [x] Orderer and channel health observation
- [x] Interactive Block Chain Explorer with verified block hashes and copy utilities
- [x] Historical block activity charting (Recharts histogram across 24h, 7d, 30d, all-time)

### Phase 3 — Four Agentic Peer Dashboards
- [x] Common `ClinicalAgentPage` component for reusable role-tailored views
- [x] **Doctor Agent Dashboard** (`/agents/doctor`): Active visits, AI decision-support requests, clinical activity feed
- [x] **Nurse Agent Dashboard** (`/agents/nurse`): Active ward patients, vitals recording rate, nursing alerts
- [x] **Pharmacy Agent Dashboard** (`/agents/pharmacy`): Prescriptions, dispensing throughput, stock lock metrics
- [x] **Lab Agent Dashboard** (`/agents/lab`): Report ingestion, OCR/Gemini triage, end-to-end processing funnel
- [x] **Unified Comparison View** (`/agents`): Side-by-side health overview of all 4 clinical agentic peers

### Phase 4 — Agent Execution Trace
- [x] Multi-stage execution pipeline component (`AgentTrace.jsx`)
- [x] Stage tracking: `REPORT_RECEIVED` $\to$ `OCR_PARSING` $\to$ `FHIR_CONVERSION` $\to$ `IPFS` $\to$ `VCAP` $\to$ `FABRIC`
- [x] Trace stitching engine in backend (`traces.js`) with out-of-order event handling

### Phase 5 — Real-Time Events
- [x] Fabric block listener (`FabricBlockCollector.js`)
- [x] Real-time event normalization pipeline (`normalizer.js`)
- [x] WebSocket streaming server with ephemeral single-use ticket authentication
- [x] Frontend subscription hook (`useDashboardSocket.js`) with auto-reconnect and rolling event ring

### Phase 6 — Security + IPFS Monitoring
- [x] Security dashboard (`/security`): Access denials, consent revocations, VCAP mismatches
- [x] IPFS operational dashboard (`/ipfs`): Node reachability, gateway availability, upload successes/failures

### Phase 7 — Alerts Engine & System Polish
- [x] In-memory & persisted Alert Engine (`AlertEngine.js`) covering all 10 defined rules
- [x] Threshold-based alerting: `peer_down`, `orderer_down`, `ipfs_down`, `agent_offline`, `latency_high`, etc.
- [x] Active Alerts page (`/alerts`) with operator acknowledgement workflow
- [x] Agent Heartbeat Monitor with automatic offline detection and pending execution marking

---

## Testing & Verification Summary
- **Backend Test Suite**: 76 automated tests passing (`node --test`), 0 failures.
- **Frontend Build**: Vite production build passes with 0 syntax or bundle errors.
- **Service Integration**: Verified live via `./start.sh` with all Fabric CAs, peers, orderers, gateways, and portals online.
