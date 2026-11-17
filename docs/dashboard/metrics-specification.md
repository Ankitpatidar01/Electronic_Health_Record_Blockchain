# Dashboard Metrics Specification

**Group 1 — Dashboard Module Implementation**  
Project: Blockchain-based Electronic Health Record (EHR) Platform  

---

## 1. Network Metrics Specification

| Metric | Source / Origin | Calculation / Meaning | Unit / Type |
|---|---|---|---|
| **Peer Status** | Fabric Operations Endpoint | Current health of peer node (`OK`, `DEGRADED`, `NOT_CONNECTED`) | Enum |
| **Block Height** | Fabric Block Collector | Latest committed block index on `ehrchannel` | Integer |
| **Ledger Lag** | Block Collector vs Peer Heights | Maximum delta between any two peers' reported block heights | Blocks (Int) |
| **Orderer Status** | Orderer Operations Endpoint | Reachability and health of `orderer.example.com` | Enum |
| **Channel Status** | Block Collector & Gossip | State of channel communication and block distribution | Enum |
| **Chaincode Status** | Committed Definition on Channel | Verification of active CC deployment on peers | Enum |

---

## 2. Transaction Metrics Specification

| Metric | Window | Calculation | Alert Condition |
|---|---|---|---|
| **Tx / Min** | 5m rolling | Committed transactions divided by window duration (minutes) | < 1 (during active shift) |
| **Success Rate** | 5m, 1h, 24h | `TRANSACTION_COMMITTED` / Total Transactions | < 95% |
| **Failure Rate** | 5m, 1h, 24h | `TRANSACTION_FAILED` / Total Transactions | > 5% (WARNING) |
| **MVCC Conflict Rate** | 5m, 1h, 24h | `MVCC_CONFLICT` / Total Transactions | > 5% (WARNING) |
| **Endorsement Failures**| 5m, 1h, 24h | `ENDORSEMENT_FAILED` / Total Proposals | > 2% (WARNING) |
| **Average Latency** | 5m, 1h, 24h | Mean elapsed duration from submission to block commit | > 1500ms (WARNING) |

---

## 3. Four Agentic Peer Metrics (Domain Specific)

### 3.1 Doctor Agent (`doctor-agent` on `peer1.hospital`)
- **Active Visits**: Current open outpatient/inpatient encounters under doctor review.
- **AI Requests**: Total clinical decision-support and diagnostic summary queries issued.
- **Success Rate**: Ratio of completed clinical AI invocations without error or timeout.
- **Average Latency**: Round-trip duration from physician query to structured AI recommendation.
- **VCAP Verification**: Cryptographic validation status of AI output against on-chain hash.

### 3.2 Nurse Agent (`nurse-agent` on `peer2.hospital`)
- **Active Patients**: Number of monitored ward patients with active nursing care plans.
- **Vitals Recorded**: Count of on-chain `RecordVitals` transactions committed via peer2.
- **AI Requests**: Triage guidance and early-warning calculation requests.
- **Average Latency**: Latency of vital-sign ledger commit and validation.

### 3.3 Pharmacy Agent (`pharmacy-agent` on `peer2.hospital` / pharmacy peer)
- **Prescriptions**: Total active medication orders received from hospital clinical contracts.
- **Dispensed**: Successful dispensation transactions verified and recorded on ledger.
- **Failed Txns**: Prescription verification or dispensing failures (e.g. stock lock conflict).
- **Average Latency**: Time required to process and anchor dispensing events.

### 3.4 Lab Agent (`lab-agent` on `peer0.diagnostic`)
- **Reports Today**: Total diagnostic requisitions and raw lab result files ingested.
- **AI Analyses**: Report OCR extraction and automated abnormality triage inferences.
- **Success Rate**: Ratio of reports successfully converted to FHIR and anchored.
- **Average Latency**: End-to-end pipeline processing duration from PDF/HL7 ingestion to ledger anchor.
- **Pipeline Stages**: Funnel breakdown across `Reports` → `Parse/OCR` → `AI Triage` → `IPFS` → `VCAP` → `Fabric`.

---

## 4. IPFS Storage Metrics

| Metric | Source | Meaning |
|---|---|---|
| **Node Status** | `ipfs-service` health check | HTTP reachability of local Kubo IPFS daemon (`:5001`) |
| **Gateway Status** | `ipfs-service` health check | Reachability of public IPFS gateway (`:8090`) |
| **Uploads** | `IPFS_UPLOAD_COMPLETED` events | Total off-chain diagnostic artifacts and encrypted records anchored |
| **Upload Failures** | `IPFS_UPLOAD_FAILED` events | File upload timeouts, daemon disconnects, or disk full conditions |
| **CID Resolution Failures** | `IPFS_RESOLUTION_FAILED` events | Inability to fetch an anchored record by CID within timeout |
| **Storage Usage** | System observation | Host disk allocation for IPFS data repository |

---

## 5. Security & Governance Metrics

| Metric | Event Types Counted | Threshold Severity |
|---|---|---|
| **Access Denials** | `ACCESS_DENIED`, `AUTHZ_DENIED`, `AUTHZ_ORG_DENIED`, `AUTHZ_ROLE_DENIED` | Spike > 10 in 5m: **HIGH** |
| **Consent Revocations** | `CONSENT_REVOKED`, `CONSENT_EXPIRED`, `CONSENT_INACTIVE` | Informational / Audit |
| **VCAP Failures** | `VCAP_MISMATCH`, `VCAP_VERIFICATION_FAILED` | Any single failure: **HIGH** |
| **Emergency Access** | `EMERGENCY_ACCESS_INVOKED` | Immediate audit notification |
