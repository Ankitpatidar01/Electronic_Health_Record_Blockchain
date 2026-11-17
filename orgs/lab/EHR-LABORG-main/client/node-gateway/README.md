# Lab Node Gateway & Multi-Agent Engine

This directory contains the production Node.js Express server (`server.js`) that runs the `l-node-gateway` container (host port `3006`, ingress route `/lab/`).

---

## 📁 Directory Structure

```text
node-gateway/
├── server.js               # Main Express entry point & REST route definitions
├── gateway.js              # Fabric network gateway & chaincode interaction module
├── ipfs.js                 # Kubo IPFS client for uploading and fetching multihashes
├── integrity-check.js      # 4-hour scheduled raw-byte SHA-256 vs Fabric recheck loop
├── integrity-check.test.js # Test suite for ledger integrity verification
├── runtime-env.js          # Environment variable parser & gateway configuration
├── lab-connection.json     # DiagnosticsMSP network profile configuration
├── Dockerfile              # Container build definition for l-node-gateway
├── package.json            # Node.js dependencies & scripts
│
├── agents/                 # Multi-Agent Subsystem
│   ├── lab-agent.js        # Lab Report Analysis Agent (Biomarker extraction)
│   ├── lab-agent.test.js   # Unit tests for Lab Agent (10 tests)
│   ├── history-agent.js    # Longitudinal Trend Analysis Agent
│   ├── history-agent.test.js # Unit tests for History Agent (8 tests)
│   └── mock-data.js        # Realistic diagnostic test fixtures
│
├── orchestrator/           # Human-in-the-Loop Orchestration
│   ├── orchestrator.js     # State machine (SUBMITTED -> ANALYZED -> PENDING_REVIEW -> APPROVED -> ANCHORED)
│   ├── state.js            # Thread-safe in-memory job store
│   └── agent-contract.js   # Inter-agent message contract definitions
│
└── public/                 # Lab Web Console Static Frontend
    ├── index.html          # Console markup with radiant glowing cards
    ├── app.js              # Frontend UI logic, Human Review deck, & live polling
    └── styles.css          # Obsidian Dark Mode & opposite-corner gradient glow tokens
```

---

## 🚀 Running & Testing

### Running within Docker Compose
Managed by `./start.sh` from the repository root:
- Accessible at [http://localhost/lab/](http://localhost/lab/)
- API endpoints accessible at `http://localhost/api/lab/` or `http://localhost:3006/`

### Running Standalone Locally
```bash
npm install
npm start
```

### Running Test Suites
```bash
npm test
```
Executes all 24 automated unit tests across `lab-agent`, `history-agent`, and `integrity-check`.
