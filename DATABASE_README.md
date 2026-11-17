# EHR Blockchain Platform — Database & Storage Architecture

This document provides a comprehensive guide to all databases, ledgers, off-chain storage systems, and local state persistence used across the Electronic Health Record (EHR) Blockchain platform.

---

## 1. Storage Layers Overview

The platform uses a **hybrid on-chain / off-chain storage architecture** designed for high security, data privacy, and scalability in healthcare environments:

```mermaid
flowchart TD
    subgraph Client ["Client Layer"]
        Browser["User Browser (LocalStorage)"]
    end

    subgraph AppBackends ["Application & Microservices"]
        HospitalAPI["Hospital APIs (peer0, peer1, peer2)"]
        DashboardAPI["Dashboard Realtime API (:4010)"]
        PharmAPI["Pharmacy Backend (:3000)"]
        LabGateway["Lab Node Gateway (:3006)"]
        Wallets["Fabric Wallets (FileSystem Keystores)"]
    end

    subgraph OffChain ["Off-Chain File Storage"]
        IPFS["Kubo IPFS Daemon (:5001 / :8090)<br/>Content-Addressed (CID)"]
    end

    subgraph ObservabilityStore ["Monitoring Event Store"]
        NDJSON["NDJSON Event Store & Checkpoints<br/>(Zero-PHI Append-Only)"]
    end

    subgraph OnChainLedger ["Hyperledger Fabric Ledger (On-Chain)"]
        GoLevelDB["GoLevelDB World State (Current State)<br/>Peers: Hospital, Diagnostic, Provider"]
        BlockStore["Fabric Block Store (Append-Only Log)<br/>Cryptographic Chain & Transactions"]
    end

    subgraph AuthDB ["Identity & CA Layer"]
        SQLiteCA["SQLite Database (fabric-ca-server.db)<br/>Fabric CAs: Hospital, Orderer, Diagnostic, Provider"]
    end

    Browser --> HospitalAPI
    Browser --> DashboardAPI
    Browser --> PharmAPI
    HospitalAPI --> Wallets
    HospitalAPI --> IPFS
    HospitalAPI --> GoLevelDB
    PharmAPI --> IPFS
    PharmAPI --> GoLevelDB
    DashboardAPI --> NDJSON
    DashboardAPI -.-> GoLevelDB
    HospitalAPI -.-> SQLiteCA
```

---

## 2. Summary Comparison Matrix

| Storage Layer | Engine / Technology | Container / Host Location | Key Data Stored | Access Pattern |
|---|---|---|---|---|
| **World State Database** | **GoLevelDB** (embedded KV store) | Peer containers: `/var/hyperledger/production` (Docker volumes) | Current state of patients, visits, vitals, prescriptions, consents, and IPFS CIDs | Key-value lookup, range queries via Smart Contracts |
| **Blockchain Block Store** | **Fabric Ledger Block Log** (binary append-only) | `/var/hyperledger/production/ledgersData` | Full transaction history, block headers, signatures, Merkle roots, and RWSet | Append-only block commit by Orderer & Peers |
| **Off-Chain Document Storage** | **Kubo IPFS** (`ipfs/kubo:latest`) | Container `ipfs.ehr.local` (`:5001` API, `:8090` gateway), volume `ipfs_data` | Large medical records, consultation notes JSON, diagnostic PDFs, lab scans, prescription sheets | Content-addressed lookup by hash (CID) |
| **Identity & CA Database** | **SQLite** (`fabric-ca-server.db`) | `organizations/peerOrganizations/*/ca/fabric-ca-server.db` | User accounts, enrollment secrets, roles, X.509 certs, CRLs | Relational queries by Fabric CA daemon |
| **Dashboard Event Store** | **NDJSON Document Store** | Host: `dashboard-api/data/events.ndjson` & `checkpoints.json` | Real-time monitoring events, alert states, AI execution run metrics (Zero-PHI only) | Append-only log with cursor pagination & in-memory indexes |
| **Client Identity Wallets** | **File-System Keystore** | Host: `*/wallet/` in each API service | User private keys (`priv_sk`) and X.509 digital certificates | Local filesystem reads to sign Fabric transactions |
| **Browser Session Storage** | **Browser LocalStorage** | User's browser | JWT tokens (`ehr_dashboard_token`), username, role, theme preference | Client-side synchronous read/write |

---

## 3. Detailed Storage Specifications

### 3.1 Hyperledger Fabric Ledger & World State (GoLevelDB)

Each Hyperledger Fabric peer node maintains its own copy of the channel ledger (`ehrchannel`), composed of:
1. **The Block Store**: An immutable append-only chain of blocks recording every valid transaction since genesis.
2. **The World State (State Database)**: An embedded **GoLevelDB** database holding the latest key-value state of smart contract assets.

#### Configuration Reference
- Defined in `orgs/hospital/EHR_hospitalOrg-main/ehr-network/configtx/core.yaml`:
  ```yaml
  ledger:
    state:
      stateDatabase: goleveldb
      totalQueryLimit: 100000
  ```
- Stored inside persistent Docker volumes:
  - `peer0.hospital.example.com:/var/hyperledger/production`
  - `peer1.hospital.example.com:/var/hyperledger/production`
  - `peer2.hospital.example.com:/var/hyperledger/production`
  - `peer0.diagnostic.example.com:/var/hyperledger/production`
  - `peer0.provider.example.com:/var/hyperledger/production`

#### Data Schemas Managed on GoLevelDB
The state is managed by 8 smart contracts deployed on `ehrchannel`:

- **Patient Contract (`patientContract.js`)**:
  - `patientId`: Unique patient identifier.
  - `abhaId`: Hashed Ayushman Bharat Health Account (ABHA) reference.
  - `demographics`: Minimal demographic metadata.
  - `registrationDate`: ISO timestamp.
- **Clinical Contract (`clinicalContract.js`) & EHR Contract (`ehrContract.js`)**:
  - `recordId`: Unique EHR asset ID.
  - `patientId`: Reference to owner patient.
  - `diagnosisCodes`: ICD-10 diagnostic codes.
  - `vitals`: Blood pressure, heart rate, temperature, SpO2 (via `RecordVitals`).
  - `prescriptions`: Prescribed medication names, dosages, and quantities.
  - `ipfsCid`: Hash pointer to the off-chain clinical document on IPFS.
  - `recordHash`: SHA-256 cryptographic checksum of the off-chain file.
  - `authorMsp`: Submitting organization MSP (`HospitalMSP`).
- **Access Control & Consent Contract (`accessContract.js`, `accessControl.js`)**:
  - `consentId`: Unique consent grant reference.
  - `patientId`: Granting patient.
  - `granteeId` / `granteeRole`: Authorized practitioner ID and role.
  - `status`: `ACTIVE`, `REVOKED`, or `EXPIRED`.
  - `expiresAt`: Validity epoch timestamp.
  - `emergencyOverride`: Boolean flag for audited "break-glass" emergency access.
- **Lab Contract (`labContract.js`)**:
  - `orderId`: Lab requisition ID.
  - `status`: `REQUESTED`, `IN_PROGRESS`, `COMPLETED`.
  - `reportCid`: IPFS link to the diagnostic report scan.
  - `technicianSignature`: Digital signature of the verifying technician.
- **Claims Contract (`claimsContract.js`)**:
  - `claimId`: Insurance reimbursement claim ID.
  - `claimStatus`: `PENDING`, `APPROVED`, `REJECTED`.
  - `amount`: Claimed amount.
  - `adjudicationLog`: Pointers to audit records.

---

### 3.2 Off-Chain File Storage (Kubo IPFS)

- **Container**: `ipfs.ehr.local` (`ipfs/kubo:latest`)
- **Ports**: API on `5001`, Read-only HTTP Gateway on `8090`
- **Volume**: `ipfs_data:/data/ipfs`

#### Why IPFS is Used
Storing full medical PDFs, imaging files (X-rays, MRIs), or multi-page consultation notes directly in blockchain blocks causes ledger bloat, slow gossip replication, and high storage costs.

#### Data Stored
- Full consultation notes in raw JSON/HL7 format.
- Diagnostic lab report PDFs and imaging scans.
- Detailed pharmacy medication guidance sheets and itemized invoices.
- **Anchoring Mechanism**: When an asset is stored on IPFS, Kubo produces an immutable Content Identifier (CID). The application writes only the **CID + SHA-256 hash** to the Fabric ledger. Any tampering with the IPFS file invalidates the hash.

---

### 3.3 Certificate Authority Database (SQLite)

- **Engine**: SQLite 3 database file (`fabric-ca-server.db`)
- **Containers**: `ca-hospital`, `ca-orderer`, `ca-diagnostics`, `ca-provider`
- **Host Location**:
  - `orgs/hospital/EHR_hospitalOrg-main/ehr-network/organizations/peerOrganizations/hospital.example.com/ca/fabric-ca-server.db`
  - `.../diagnostic.example.com/ca/fabric-ca-server.db`
  - `.../provider.example.com/ca/fabric-ca-server.db`
  - `.../ordererOrganizations/example.com/ca/fabric-ca-server.db`

#### Data Stored
- User identity registry (`users` table): Usernames, hashed passwords, identity types (`client`, `peer`, `orderer`, `admin`).
- Organizational affiliations and roles (`doctor`, `nurse`, `receptionist`, `pharmacist`, `labtech`, `hospitaladmin`).
- Issued digital certificates (`certificates` table): X.509 certificates, serial numbers, public keys, validity periods.
- Certificate Revocation Lists (CRL).

---

### 3.4 Dashboard Observability Store (NDJSON Document Store)

- **Engine**: Append-only Newline-Delimited JSON with in-memory indexes (`NdjsonEventStore.js`)
- **File Location**: `orgs/hospital/EHR_hospitalOrg-main/ehr-backend-v3/dashboard-api/data/events.ndjson`
- **Checkpoints**: `orgs/hospital/EHR_hospitalOrg-main/ehr-backend-v3/dashboard-api/data/checkpoints.json`

#### Data Stored
- Real-time operational events ingested from Fabric block listener and health pollers:
  - `TRANSACTION_COMMITTED`, `TRANSACTION_FAILED`, `MVCC_CONFLICT`
  - `PEER_STATUS_CHANGED`, `ORDERER_STATUS_CHANGED`, `IPFS_STATUS_CHANGED`
  - `AGENT_HEARTBEAT`, `AGENT_OFFLINE`, `AGENT_EXECUTION_COMPLETED`
  - `ACCESS_DENIED`, `CONSENT_GRANTED`, `CONSENT_REVOKED`
  - `ALERT_RAISED`, `ALERT_ACKNOWLEDGED`, `ALERT_RESOLVED`
- **Checkpoints**: The block height index currently processed to prevent re-processing historical blocks upon restart.
- **Zero-PHI Compliance**: Stored data is strictly restricted to metadata, timestamps, durations, and one-way hashes (`patientIdHash`). Raw clinical notes, patient names, and diagnoses never enter this database.

---

### 3.5 Client Identity Wallets (FileSystem Keystores)

- **Locations**:
  - `orgs/hospital/EHR_hospitalOrg-main/ehr-backend-v3/peer0-api/wallet/`
  - `orgs/hospital/EHR_hospitalOrg-main/ehr-backend-v3/peer1-api/wallet/`
  - `orgs/hospital/EHR_hospitalOrg-main/ehr-backend-v3/peer2-api/wallet/`
  - `orgs/pharmacy/fabric-network-swarm/app/backend/wallet/`

#### Data Stored
- Local JSON identity files holding:
  - The client's X.509 signing certificate (`cert.pem`).
  - The client's private ECDSA key (`priv_sk`).
  - MSP ID identification (`HospitalMSP`, `DiagnosticsMSP`, etc.).
- Used by the Fabric Node.js SDK Gateway to sign transaction proposals before sending them to peers for endorsement.

---

### 3.6 Browser LocalStorage

- **Location**: Browser `localStorage` sandbox per client origin.
- **Keys**:
  - `ehr_dashboard_token`: Signed HS256 JWT access token for Dashboard API requests.
  - `ehr_hospital_token`: JWT token for hospital staff portals.
  - `ehr_dashboard_user`: JSON profile of the logged-in user (`username`, `role`, `mspId`).
  - `ehr_appearance`: Persistent UI theme preference (`light` or `dark`).

---

## 4. End-to-End Data Flow

The following sequence illustrates how the different databases interact during a clinical encounter:

```mermaid
sequenceDiagram
    autonumber
    actor Doctor as Doctor (Browser)
    participant API as Doctor API (:4002)
    participant Wallet as Local Keystore Wallet
    participant IPFS as Kubo IPFS (:5001)
    participant Peer as Fabric Peer (GoLevelDB)
    participant EventHub as Dashboard API (NDJSON)

    Doctor->>API: Submit consultation note & diagnosis
    API->>IPFS: Upload encrypted consultation record
    IPFS-->>API: Return IPFS CID (e.g. Qm7bX...)
    API->>Wallet: Retrieve doctor's X.509 cert & private key
    API->>Peer: Submit CreateEHR(patientIdHash, CID, recordHash)
    Note over Peer: Evaluate ABAC in accessControl.js<br/>Check active consent in GoLevelDB
    Peer->>Peer: Endorse transaction & commit to World State (GoLevelDB)
    Peer->>Peer: Append block to Block Store
    Peer-->>API: Transaction Committed response
    Peer->>EventHub: Block listener captures transaction
    EventHub->>EventHub: Append Zero-PHI event to events.ndjson
    EventHub-->>Doctor: Push real-time event via WebSocket
```

---

## 5. Security & Privacy Rules

1. **Zero-PHI On-Chain**: No plain-text Protected Health Information (PHI) is placed directly on the blockchain or in the monitoring logs.
2. **Cryptographic Integrity**: IPFS documents are verified against on-chain SHA-256 hashes to prevent undetected off-chain modifications.
3. **Decoupled Identity**: Private keys remain strictly within local service wallets or secure CA vaults; they are never sent to frontends or exposed in API payloads.
