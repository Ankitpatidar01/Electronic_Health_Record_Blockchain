# Dashboard Information Architecture

**Group 1 — Dashboard Module Implementation**  
Project: Blockchain-based Electronic Health Record (EHR) Platform  
Team Lead: Himanshu (24MCF1R16)  
Members: Harsh Bhagat (24MCF1R14), Dhruv Kumarawat (24MCF1R12)  

---

## 1. Top-Level Navigation & Information Hierarchy

```
CareOps EHR Observability Dashboard
│
├── 1. Executive Overview (/overview)
│   ├── Key Performance Indicators (Peers online, Services UP, Configured agents, Tx/min, Security, IPFS)
│   ├── Fabric Block Chain Explorer (Interactive horizontal block rail, verified hash, data hash, copy tools)
│   └── Block & Transaction Activity Chart (Hourly histogram across 24h, 7d, 30d, all-time)
│
├── 2. Blockchain Network (/network)
│   ├── Network KPI Cards (Organizations, Peers online/total, Orderers, Channel, Chaincode, Block height, Tx/min)
│   └── Topology Node Table (Peers, Orderers, Health Endpoints, MSP IDs, Block Heights, Latencies)
│
├── 3. Agentic Peers (/agents)
│   ├── Unified Agentic Peer Health Comparison (Doctor, Nurse, Pharmacy, Lab cards with real-time health)
│   ├── Doctor Agent Dashboard (/agents/doctor)
│   │   ├── Domain KPIs: Active Visits, AI Requests, Success Rate, Avg Latency
│   │   ├── Clinical Activity Event Feed
│   │   ├── Recent AI Executions Table (with VCAP verification status)
│   │   └── Role Alerts Panel
│   ├── Nurse Agent Dashboard (/agents/nurse)
│   │   ├── Domain KPIs: Active Patients, Vitals Recorded, AI Requests, Avg Latency
│   │   ├── Nursing Workflow Activity Feed
│   │   └── Role Alerts Panel (failed transactions, consent denials)
│   ├── Pharmacy Agent Dashboard (/agents/pharmacy)
│   │   ├── Domain KPIs: Prescriptions, Dispensed, Failed Txns, Avg Latency
│   │   ├── Pharmacy & Inventory Activity Feed
│   │   └── Health & Dispensing Alerts
│   ├── Lab Agent Dashboard (/agents/lab)
│   │   ├── Domain KPIs: Reports Today, AI Analyses, Success Rate, Avg Latency
│   │   ├── Lab Processing Pipeline: Reports → Parse/OCR → AI Triage → IPFS → VCAP → Fabric
│   │   ├── Recent Lab Report Executions with VCAP & Fabric Anchor Status
│   │   └── Processing Alerts
│   └── All Agents & Peers Registry (Full registry table for system administrators)
│
├── 4. Transactions (/transactions)
│   ├── Transaction Throughput KPIs (Tx/min, Successful, Failed, MVCC conflicts, Endorsements, Avg latency)
│   └── Transaction Ledger Event Table (Event ID, Type, Chaincode, Function, Status, Timestamp, Patient hash for admin)
│
├── 5. Security & Consent (/security)
│   ├── Security KPI Cards (Access Denials, Consent Events, VCAP Audits, Total Security Events)
│   └── Security Event Log (Authorization denials, emergency access grants, consent revocations, VCAP mismatches)
│
├── 6. IPFS Observations (/ipfs)
│   ├── Node & Gateway Health Status (Online / Degraded / Offline badges)
│   ├── Operational Metrics (Upload counts, Failures, CID resolution errors)
│   └── Storage Utilization (Deferred note — Kubo API isolation)
│
├── 7. System Event Log (/logs)
│   └── Operational Event Metadata Stream (Filtered for Zero-PHI compliance)
│
└── 8. Active Alerts (/alerts)
    ├── Threshold-based Alert Queue (CRITICAL, HIGH, WARNING, INFO)
    ├── Condition Status & Reason Codes
    └── Operator Acknowledge Action
```

---

## 2. Role-Based Dashboard Visibility Matrix

| Dashboard Route | admin / hospitaladmin | doctor | nurse | pharmacist | labtechnician / supervisor |
|---|:---:|:---:|:---:|:---:|:---:|
| `/overview` | ✅ Full | ❌ | ❌ | ❌ | ❌ |
| `/network` | ✅ Full | ❌ | ❌ | ❌ | ❌ |
| `/agents` | ✅ Full | ✅ Scoped | ✅ Scoped | ✅ Scoped | ✅ Scoped |
| `/agents/doctor` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/agents/nurse` | ✅ | ❌ | ✅ | ❌ | ❌ |
| `/agents/pharmacy` | ✅ | ❌ | ❌ | ✅ | ❌ |
| `/agents/lab` | ✅ | ❌ | ❌ | ❌ | ✅ |
| `/transactions` | ✅ Full | ❌ | ❌ | ❌ | ❌ |
| `/security` | ✅ Full | ❌ | ❌ | ❌ | ❌ |
| `/ipfs` | ✅ Full | ❌ | ❌ | ❌ | ❌ |
| `/logs` | ✅ Full | ❌ | ❌ | ❌ | ❌ |
| `/alerts` | ✅ Full | ❌ | ❌ | ❌ | ❌ |

---

## 3. Core Architectural Principles
1. **Observability, Not Storage**: The dashboard monitors Fabric ledgers, CouchDB state, IPFS artifacts, and agent events. It never stores clinical records directly.
2. **Zero-PHI Guarantee**: No patient names, diagnoses, raw clinical notes, or unhashed identifiers ever traverse the dashboard API or render on the UI.
3. **Four Agentic Peers as First-Class Citizens**: The Doctor, Nurse, Pharmacy, and Lab agents are represented with dedicated operational views and role-tailored metrics.
4. **Resilient Physical-to-Logical Decoupling**: Endpoints and machine topologies are resolved dynamically from configuration (`topology.json`) rather than hardcoded IPs.
