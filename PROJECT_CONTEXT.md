# PROJECT_CONTEXT — EHR Blockchain

Written 2026-11-19 from a static read of the repository at commit `9b23b5b` (branch `main`, clean tree).
Nothing in this document was observed on a running system: the shell used for this pass has no Docker,
so every "works" below means "the code path exists and is wired", not "seen working". Items marked
**(not traced)** were located but not read line by line.

## 1. Architecture

One Fabric network, one channel (`ehrchannel`), one main chaincode (`ehr`, ten contracts), Kubo IPFS
for off-chain content, Express gateways per peer/role, React portals, an nginx hub on port 80.

| Service (compose name) | Port | Stack | Talks to | Purpose |
| --- | --- | --- | --- | --- |
| `nginx` | 80 | nginx | all below | Hub page (`nginx/hub`) and path routing |
| `h-peer0-api` | 4001 | Express | peer0.hospital, ipfs-service | Receptionist/admin: patients, visits, staff users |
| `h-peer1-api` | 4002 | Express | peer1.hospital, ipfs-service | Doctor: diagnosis, prescription, forward to nurse/lab, finalize, EHR |
| `h-peer2-api` | 4003 | Express | peer2.hospital, ipfs-service | Nurse, pharmacist (dispense), medical-records officer |
| `h-extorg-api` | 4004 | Express | peer0.diagnostic, peer0.provider, ipfs-service | Lab workflow and insurance claims |
| `h-patient-api` | 4005 | Express + SQLite | peer0.hospital, ipfs-service | Patient login, profile, EHR, visits, consent, OCR, signatures |
| `h-ipfs-service` | 4006 | Express | Kubo `ipfs.ehr.local:5001` | Pin/fetch JSON and files; guarded by `X-IPFS-Key` |
| `h-digilocker-service` | 4007 | Express | peer0.hospital, ipfs-service | DigiLocker vault (sandbox provider by default) |
| `clinical-ai-agent` | 8000 | FastAPI | local JSON files | "Clinical RAG" + lab-report analysis; runs with `EHR_OFFLINE_MODE=true` |
| `h-dashboard-api` (profile `dashboard`) | 4010 | Express + WS | all peers, orderer, health URLs | Block collector, event ingest, aggregation, realtime stream |
| `h-dashboard-portal` (profile `dashboard`) | 5176 | React/Vite | dashboard-api | Observability dashboard |
| `h-hospital-portal` | 5173 | React/Vite dev server | peer0/1/2/ext APIs via Vite proxy | Staff portal (all hospital and lab roles) |
| `h-patient-portal` | 5174 | React/Vite dev server | patient-api, digilocker | Patient portal |
| `p-backend` | 3000 | Express | Fabric (`ehr`), Kubo directly | Pharmacy inventory, billing, employees |
| `p-frontend` | 5175 | React/Vite | p-backend, peer2-api | Unified pharmacy suite |
| `l-node-gateway` | 3006→3000 | Express + static UI | peer0.diagnostic (`labresults` chaincode), Kubo, clinical-ai-agent, Gemini | Lab "control deck" and multi-agent pipeline |

Fabric containers (separate compose files under `orgs/hospital/EHR_hospitalOrg-main/ehr-network/docker`):
orderer (7050), peer0/1/2.hospital (7051/9051/10051), peer0.diagnostic (8051), peer0.provider (11051),
four CAs (7054–7057), and Kubo as `ipfs.ehr.local` (API 5001, gateway 8090).

### How to start (as documented)

```
node scripts/init-env.js        # root .env + secrets
./setup.sh                      # deps, images
cd orgs/hospital/EHR_hospitalOrg-main/ehr-network && bash scripts/network-up.sh   # first time only
bash scripts/deployChaincode.sh --channel ehrchannel --chaincode-name ehr --chaincode-path ../ehr-chaincode-v3 --version <v> --sequence <n>
./start.sh [--build]
```

`start.sh` refuses to run unless Fabric identities and CA state already exist; it does not create the
network or deploy chaincode. Linux or WSL2 only.

## 2. Fabric network

- Orgs: `HospitalMSP` (3 peers), `DiagnosticsMSP` (1 peer), `ProviderMSP` (1 peer), `OrdererMSP` (1 Raft orderer).
- Channel: `ehrchannel`.
- Chaincode `ehr` (Node, `ehr-chaincode-v3`), endorsement policy `OR('HospitalMSP.peer','DiagnosticsMSP.peer','ProviderMSP.peer')` — any single org endorses.
- Chaincode `labresults` (`orgs/lab/EHR-LABORG-main/chaincode/lab-results`) is what `l-node-gateway` calls on `ehrchannel`, but no root script deploys it there; its deploy scripts target the lab team's separate three-machine network.
- Role comes from the `role` attribute in the caller's X.509 certificate (`accessControl.js`).

### Chaincode functions (`ehr`)

| Contract | Function | Who may call (enforced in chaincode) |
| --- | --- | --- |
| PatientContract | RegisterPatient | receptionist, admin |
| | GetPatient, GetPatientHistory | any staff role; others need a grant |
| | PatientExists | anyone |
| | GetPatientVisits | staff / grant on `visits` |
| | UpdatePatientInfo, SetPatientEhrCID, ListAllPatients | receptionist, admin |
| VisitContract | OpenVisit, AssignDoctor | receptionist, admin |
| | AssignNurse | receptionist, doctor, admin |
| | FinalizeVisit | doctor |
| | FinalizeRecord | medrecordofficer |
| | DischargePatient | admin |
| | UpdateVisitCID, GetVisitCID, GetVisit, GetVisitHistory, GetCIDHistory, ListAllVisits, GetPatientVisitsFull | **(checks not traced)** |
| ForwardContract | ForwardToNurse, ForwardToLab | doctor |
| | ForwardToDoctor | nurse |
| | LabResultsBackToDoctor | labsupervisor, labadmin, admin |
| ClinicalContract | UpdateDiagnosisNotes, UpdatePrescription | doctor |
| | RecordVitals, AddCareNote | nurse |
| | DispenseMedication | pharmacist (visit must be VISIT_FINALIZED) |
| LabContract | AcknowledgeLabRequest | labreceptionist, labadmin |
| | SubmitLabResult | labtechnician, radiologist, labadmin |
| | ApproveLabResult | labsupervisor, labadmin |
| ClaimsContract | SubmitClaim / AuditClaim / ProcessClaim | billingofficer / claimsauditor / insuranceofficer |
| EhrContract | InitEHR | receptionist, admin |
| | UpdateEHRCID | doctor, nurse (with patient grant), admin, patientService **(not traced)** |
| | GetCurrentCID, GetEHRCIDHistory, GetEHRRecord, GetEHRBlockHistory | read-access check **(not traced)** |
| AccessContract | GrantAccess, RevokeAccess, ApproveAccessRequest, RejectAccessRequest | patientService, admin |
| | RequestAccess, HasAccess, GetAccessList, GetActiveGrants, LogAccess, GetAccessRequests, GetAuditLog | **(not traced)** |
| FhirContract | AnchorFHIRRecord | a fixed list of write roles |
| | UpdateFHIRAnchorStatus | admin, labadmin, provideradmin, patientService |
| | GetFHIRAnchor, ListFHIRAnchors, AnchorExists, GetFHIRAnchorHistory | **(not traced)** |
| DigiLockerContract | AnchorDocument, RevokeDocument | patientService, admin |
| | GetDocument, ListDocuments, VerifyDocument, GetDocumentHistory | those two, plus doctor/nurse with consent |

Visit statuses: OPEN → WITH_DOCTOR ⇄ WITH_NURSE / WITH_LAB → VISIT_FINALIZED → RECORD_FINALIZED →
CLAIM_SUBMITTED → CLAIM_UNDER_AUDIT → CLAIM_APPROVED / CLAIM_REJECTED → DISCHARGED.

## 3. Organisations and roles

Users live in `ehr-backend-v3/shared/users.json` (bcrypt hashes) and must also have an enrolled Fabric identity.

| Org | Role | Intended work | UI today |
| --- | --- | --- | --- |
| Hospital | receptionist | Register patients, open visits, assign doctor/nurse | Hospital portal: Patients, Visits, Open Visit |
| | admin | Same plus discharge and staff management | Hospital portal: + Staff, Discharge |
| | doctor | Diagnosis notes, prescription, forward to nurse/lab, finalize visit, edit EHR (with consent) | Hospital portal: My Visits |
| | nurse | Vitals, care notes, forward to doctor | Hospital portal: My Visits |
| | pharmacist | Dispense after visit finalized | Hospital portal: Dispense; pharmacy suite |
| | medrecordofficer | Finalize the record | Hospital portal: Finalize |
| | inventory, billing, manager | Pharmacy suite roles (log in through peer2-api) | Pharmacy suite |
| Diagnostics | labreceptionist | Acknowledge a lab request | Hospital portal: Lab Queue |
| | labtechnician, radiologist | Enter results | Hospital portal: Lab Queue |
| | labsupervisor | Approve (sign off) results, return to doctor | Hospital portal: Lab Queue |
| | labadmin | All of the above | Hospital portal: Lab Queue |
| Provider | billingofficer, claimsauditor, insuranceofficer, provideradmin | Submit, audit, decide claims | **API only (`extorg-api /claims`), no page in any portal** |
| Patient | patient (SQLite account; on-chain via `patientService` identity) | View profile/EHR/visits, grant and revoke consent, DigiLocker vault, verify signatures | Patient portal |

## 4. Portals and pages

**Hospital portal** (5173; one API base per role):
`/login`, `/patients` + `/register` (peer0 `/patients`), `/visits`, `/visits/:id`, `/open-visit`, `/discharge`
(peer0 `/visits…`), `/staff` (peer0 `/auth/users…`), `/my-visits` (doctor: peer1 `/doctor/visits…`; nurse:
peer2 `/nurse/visits…`), `/dispense` (peer2 `/pharmacist/…`), `/finalize` (peer2 `/records/…`), `/lab-queue`
(ext `/lab/visits…`, plus `/api/ai-agent/api/v1/agent/analyze-report`).

**Patient portal** (5174): Login/Register, Health Home (Overview), My Visits, Record Vault / Consent Centre /
On-Chain Proof (all inside `EHRAccess.jsx`), DigiLocker Vault, Profile. Calls patient-api `/auth`, `/profile`,
`/ehr`, `/visits`, `/access`, `/ocr`, `/signatures` and digilocker `/status`, `/link…`, `/documents…`, `/vault…`.
**(per-page call list not traced)**

**Pharmacy suite** (5175): single `App.jsx` with role gate (manager, pharmacist, inventory, billing, patient);
calls p-backend `/api/inventory`, `/billing`, `/bills…`, `/employees`, `/patient…`, `/grant-access`,
`/revoke-access` and peer2-api `/pharmacist/visits…`.

**Lab control deck** (`/lab/`, static HTML in `node-gateway/public`): record list, submit record with report
file, AI analysis, agent run + human approval, integrity check. Calls l-node-gateway `/api/*`.

**Dashboard** (`/dashboard/`): Overview, Network, Transactions, Agents (+ per-agent pages), IPFS, Security,
Alerts, Logs. Calls dashboard-api `/overview`, `/network`, `/blocks`, `/transactions`, `/transactions/metrics`,
`/blocks/metrics`, `/agents…`, `/executions…`, `/ipfs`, `/security…`, `/alerts…`, `/logs/events`, and the
`/stream` WebSocket.

**Hub** (`/`): static cards with health probes.

## 5. AI agents

| Agent | Where | Trigger | Input | Output | Shown |
| --- | --- | --- | --- | --- | --- |
| Clinical agent — query | `services/ai-agent` `POST /api/v1/agent/query` | Dashboard "Clinical Agent" page; lab orchestrator | question + patient id | answer + citations | Dashboard page |
| Clinical agent — analyze-report | same service, `/agent/analyze-report` | Lab technician clicks AI analysis in Lab Queue | report text | findings, abnormal flags, follow-ups, SHA-256 of the text | Lab Queue; saved into results as `ai*` keys; doctor sees flags |
| Lab agent | `node-gateway/agents/lab-agent.js` | Lab deck `/api/ai/analyze`, `/api/agents/run` | extracted report text / result data | findings | Lab deck |
| History agent | `node-gateway/agents/history-agent.js` | orchestrator run | patient id | trend summary of past lab records | Lab deck |
| Clinical agent (lab side) | `node-gateway/agents/clinical-agent.js` | orchestrator run | lab + history output | recommendation from clinical-ai-agent | Lab deck, after human approval |
| Governance | `node-gateway/governance/governance.js` | orchestrator run | all agent outputs | allow / block (rule-based, not AI) | Lab deck |
| VCAP provenance | `node-gateway/provenance/vcap.js` | end of run | hashes | IPFS CID of provenance record | Lab deck |
| Clinical decision support (LangGraph + Gemini) | `services/clinical-decision-support` | **none — not in compose, not called** | — | — | — |
| Hospital agent | `hospital-agent/capabilities/clinical.js` | **(not traced; appears unwired)** | — | — | — |

Important: `clinical-ai-agent` is built with only `fastapi uvicorn pydantic` and runs in offline mode, so its
"analysis" is keyword/rule matching over bundled JSON, not a language model. The only real model call in the
system is Gemini from the lab gateway, and `GEMINI_API_KEY` is not set in `.env`, so that path currently
falls back to a keyword heuristic.

There is no symptom-analysis agent, and nothing runs at patient registration.

## 6. Data flow of one record (as coded)

1. **Registration** — receptionist → peer0-api `POST /patients`: pin EHR JSON to IPFS → `PatientContract:RegisterPatient` (demographics + ehrCID) → `EhrContract:InitEHR` → best-effort FHIR Patient anchor.
2. **Visit** — `POST /visits`: pin visit JSON → `VisitContract:OpenVisit`; assign doctor/nurse.
3. **Consultation** — doctor edits fetch the visit JSON by CID, change it, re-pin, and call the matching ClinicalContract function with the new CID (appended to `visit.cidHistory`).
4. **Lab order** — doctor `PUT /doctor/visits/:id/forward/lab` adds a `labRequests[]` entry (`<visitId>-L<n>`) → `ForwardContract:ForwardToLab`; visit becomes WITH_LAB.
5. **Lab** — extorg-api: acknowledge → submit results (free-form key/value object) → approve → return to doctor; each step re-pins the visit JSON and records the CID on-chain; submit also anchors a FHIR DiagnosticReport.
6. **History** — patient-api and peer APIs read `GetVisit`/`GetCIDHistory` and fetch JSON by CID; patient portal shows visits, CID history and signature checks.

## 7. Where data lives

| Store | Contents |
| --- | --- |
| Ledger (`ehr`) | `PATIENT:<id>` — **name, age, gender, blood group, contact, address in plain text**, visitIds, ehrCID. `VISIT:<id>` — status, assigned staff, chief complaint **(not traced whether complaint text is stored)**, current CID, CID history. `EHR:<id>` CID index; `ACCESS:<id>` grants, requests, audit log; FHIR anchors (hashes + CID); DigiLocker anchors (hashes + CID). |
| IPFS | EHR JSON and visit JSON (diagnosis, vitals, prescriptions, lab results) — **pinned as plain, unencrypted JSON**; uploaded report files; FHIR bundles; DigiLocker documents (AES-256-GCM ciphertext); VCAP provenance records. |
| SQLite (`patient-api/data/patients.db`) | Patient portal accounts. |
| Files | `shared/users.json` staff accounts; dashboard NDJSON event store; DigiLocker link store; pharmacy `backend/data` JSON store; ai-agent `patient_data/patients.json`. |

## 8. Feature status (from code reading; to be confirmed on a live run)

| Feature | Status | Note |
| --- | --- | --- |
| Fabric network bring-up scripts | Unverified | Scripts exist; not run |
| `start.sh` | **Broken** | Step 5 starts `p-manager p-employee p-inventory p-billing p-patient`, which were removed from compose; with `set -e` the script stops before nginx starts |
| Patient registration, visits, doctor, nurse, dispense, finalize | Partial | Wired end to end; demographics go on-chain in plain text |
| Access control in chaincode | Partial | Role checks present on writes; several read functions not yet traced |
| Chaincode timestamps | Partial | `new Date()` in all older contracts — non-deterministic under any multi-org policy |
| Lab workflow in hospital portal (order → ack → result → approve → return) | Partial | Works as a flow; results are untyped key/value text, no units, ranges, flags, attachments, print/PDF |
| Lab AI analysis button in Lab Queue | **Broken in Docker** | Portal proxy for `/api/ai-agent` defaults to `127.0.0.1:8000`; compose never sets `VITE_AI_AGENT_TARGET` |
| Lab control deck (`l-node-gateway`) | Partial / misleading | Calls `labresults` chaincode that is not deployed by this repo; on any Fabric error it silently serves and stores records in an in-memory sample list; no authentication |
| History agent | Partial | Contains built-in sample records for `PAT-DEMO-001` |
| Clinical AI agent | Partial | Rule-based offline mode, no model; endpoints unauthenticated and store patients in a local JSON file |
| Gemini lab agent | Partial | Real call exists; no key configured → heuristic fallback |
| clinical-decision-support (LangGraph) | Missing wiring | Not deployed, not called |
| IPFS pin/fetch | Partial | Works via ipfs-service; EHR/visit content not encrypted; retrieval gated only by the service key |
| Pharmacy suite | Partial / misleading | Backend calls functions that do not exist in `ehr` chaincode, then silently uses a local JSON store; backend has no auth; frontend hard-codes `pharmacist/pharmpw` |
| Insurance claims | Partial | Chaincode + API exist; no UI for any Provider role |
| Patient portal (visits, EHR, consent, signatures, OCR) | Unverified | Wired; not exercised |
| DigiLocker vault | Partial | Sandbox mode; needs chaincode upgrade on the channel |
| FHIR anchoring | Unverified | Best-effort at registration and lab submit |
| Dashboard | Partial | Block collector, health polling and agent events exist; no patient/record counts, no submit→commit latency, no explorer detail view, no IPFS timing, no AI-vs-doctor match rate |
| nginx hub | Partial | `/hospital/` and `/patient/` paths break asset loading (known) |
| One DID per patient, CID list per DID, timeline (4a) | **Missing** | No DID concept anywhere; CIDs are per visit and per EHR |
| ICD-10 template on IPFS, provisional and confirmed codes, code history (4b) | **Missing** | |
| Symptom analysis agent at registration (4c) | **Missing** | Registration form has no symptoms field |
| Submit/commit timestamps per transaction (4d) | **Missing** | |
