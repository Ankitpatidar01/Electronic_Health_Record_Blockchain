# CareGrid Frontend Contract Registry

This contract documents every frontend application, its port, base route, authentication keys, role access permissions, and underlying API contracts across the EHR Blockchain workspace.

---

## 1. Applications & Routing Overview

| Application | Port / Route | Base Path | Framework / Build | Auth Mechanism & Storage Key | Allowed Roles |
|---|---|---|---|---|---|
| **Hub / Launchpad** | `:80` (`/` or `/workspace/`) | `/` | Vanilla JS / Nginx | None (Probes endpoints) | Public / All |
| **Hospital Staff Portal** | `:5173` | `/` | React 18 + Vite | `localStorage: token, user` | `receptionist`, `admin`, `doctor`, `nurse`, `pharmacist`, `medrecordofficer` |
| **Patient Portal** | `:5174` | `/` | React 18 + Vite | `localStorage: patient_token, patient` | Patient (`PAT-*` identities) |
| **Observability Dashboard** | `:5176` | `/` | React 19 + Vite | `localStorage: token, user` (Role-based views) | `admin`, `clinician`, `pharmacist`, `auditor`, `observer` |
| **Pharmacy Suite (Records)** | `:5175` | `/` | React 18 + Vite | Direct REST / Session | Pharmacy Staff & Admin |
| **Pharmacy Billing** | `:3001` | `/` | React 18 + Vite | Session / API Proxy | Billing Clerks |
| **Pharmacy Employee** | `:3002` | `/` | React 18 + Vite | Session / API Proxy | Dispensing Technicians |
| **Pharmacy Inventory** | `:3003` | `/` | React 18 + Vite | Session / API Proxy | Stock Managers |
| **Pharmacy Patient Portal** | `:3004` | `/` | React 18 + Vite | Session / Patient selector | Patients |
| **Pharmacy Manager** | `:3005` | `/` | React 18 + Vite | Session / API Proxy | Store Managers & Auditors |
| **Lab Results Gateway** | `:3006` (or `/lab/`) | `/` | Vanilla JS / Node Gateway | Admin / Client Identity (LabMSP) | Lab Technicians & Pathologists |

---

## 2. Hospital Portal Routes & APIs (`:5173`)

### Routes
- `/login` — Staff sign-in page with role selector
- `/` — Role-based default redirect
- `/patients` — Patient directory & registration modal (`receptionist`, `admin`)
- `/visits` — Active visits list & filtering (`receptionist`, `admin`)
- `/visits/:id` — Visit encounter detail
- `/register` — Patient registration wizard
- `/open-visit` — Open encounter wizard
- `/my-visits` — Clinical workspace: Doctor visits queue or Nurse triage board
- `/dispense` — Pharmacist dispensing queue (`pharmacist`)
- `/finalize` — Medical record completion & ledger finalization (`medrecordofficer`)
- `/staff` — Clinical staff roster & credentialing (`admin`)

### Primary API Contracts
- `POST /api/auth/login` -> `{ token, user: { username, role, org } }`
- `GET /api/patients` -> List of registered patients
- `POST /api/patients` -> `{ patientId, name, age, gender, contact, bloodGroup }`
- `GET /api/visits` -> List of active and discharged visits
- `POST /api/visits` -> `{ visitId, patientId, department, doctor }`
- `PUT /api/visits/:id/vitals` -> `{ bp, pulse, temperature, spo2, weight }`
- `PUT /api/visits/:id/diagnosis` -> `{ diagnosis, notes, prescription }`
- `POST /api/visits/:id/discharge` -> Closes encounter & anchors hash to Fabric

---

## 3. Patient Portal Routes & APIs (`:5174`)

### Routes
- `/login` — Split-screen patient login and activation
- `/overview` — Soft Glass Bento health home, vitals cards & recent consultations
- `/visits` — Timeline of historical and active visits
- `/visits/:id` — Detailed encounter view with on-chain verification
- `/ehr` — Vault of allergies, chronic conditions, and clinical records
- `/access` — Consent management center (grant & revoke permissions)
- `/signatures` — Cryptographic proof explorer (Fabric txId & CIDs)
- `/profile` — Patient demographics & ABHA identifier

### Primary API Contracts
- `POST /api/patient/login` -> `{ token, data: { patientId, email } }`
- `POST /api/patient/register` -> `{ patientId, password, email, phone }`
- `GET /api/patient/profile` -> Patient demographic record
- `GET /api/patient/visits` -> Encounters list
- `GET /api/patient/ehr` -> Off-chain JSON payload CID & parsed allergies/conditions
- `GET /api/patient/access` -> Active consent entries
- `POST /api/patient/access/grant` -> `{ doctorId, expiry }`
- `POST /api/patient/access/revoke` -> `{ doctorId }`

---

## 4. Observability Dashboard Routes & Real-Time Contracts (`:5176`)

### Routes
- `/overview` — Network block stream, TPS chart, peer health summary
- `/network` — Interactive topology (Hospital, Lab, Pharmacy MSPs)
- `/agents` — 4 Agentic Peers fleet health (Doctor, Nurse, Pharmacy, Lab agents)
- `/agents/:id` — Dedicated agent observability detail page
- `/transactions` — Fabric ledger block & transaction explorer
- `/security` — Zero-PHI compliance & cryptographic proof verification
- `/ipfs` — Content-addressed off-chain record storage inspector
- `/logs` — Streaming ledger and service logs
- `/alerts` — Real-time anomaly alerts with severity pills

### Real-Time WebSocket Contract
- Path: `/api/dashboard/ws`
- Protocol: JSON stream with heartbeats and block events (`BLOCK_COMMITTED`, `TX_PROCESSED`, `AGENT_STATUS_CHANGED`, `ALERT_RAISED`).
