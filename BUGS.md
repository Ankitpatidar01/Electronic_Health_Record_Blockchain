# BUGS — Phase 2 audit

## Fix log

| ID | Fix | Verified |
| --- | --- | --- |
| A1, A2 | `start.sh`, `start-sequential.sh`, `start-sequential.ps1` list only services that exist | `bash -n` only; live run pending |
| A3 | `start.sh` now creates the network when no identities exist and calls new `ehr-network/scripts/ensure-chaincode.sh`, which deploys or upgrades `ehr` when the source changed; `stop.sh --reset` wipes everything; `setup.sh` pulls the image tags the compose files use | `bash -n` only; live run pending |
| A5 | `VITE_AI_AGENT_TARGET` set for `h-hospital-portal` in compose | YAML parses; live run pending |
| A6 | Credentials banner removed from `start.sh` (it printed `password123`, which matches no account) | — |
| A1, A3 | (same fix as above) | **Verified live on WSL2, 2026-11-19:** `./start.sh` detected stale identities, rebuilt the network, joined 5 peers, deployed `ehr` sequence 1, started every service; all 16 health checks passed |
| B2 | All contracts take time from `ctx.stub.getTxTimestamp()` | Unit test `labWorkflow.test.js`; live upgrade pending |
| B4 | `ListAllVisits` requires a staff role | Loads; live pending |
| B6, C4, C5 | Lab orders have their own ledger record (`LABREQ:<id>`) with an enforced state machine; API no longer swaps identities; API and chaincode role lists match; approver must differ from the person who entered the result; `RejectLabResult` added; `LabResultsBackToDoctor` removed (approval releases the report) | 6 unit tests in `test/labWorkflow.test.js` pass; live pending |
| B8 | `role=admin` is scoped by MSP (`admin` / `labadmin` / `provideradmin`) | Unit test; live pending |
| C6, C7, C8, C9, C10 | Structured lab report (`shared/labReport.js`): parameters with unit, reference range and computed flag, specimen, comments, attachments, SHA-256 of the report on the ledger. New Lab worklist page with role worklist, status filters with counts, search, validated result entry (values never pre-filled), review/sign/return, print or save as PDF. Same report component in the doctor view and the patient portal; patients see a report only after verification. Queue reads `LabContract:ListLabRequests` instead of scanning every visit | JSX compiles; helper checked with node; live and browser pending |
| E6 | 30 s timeout on AI calls from the hospital portal; Lab page shows a message when the AI check is unavailable | Live pending |

Status on 2026-11-19: started as a static audit; a first live pass followed once the stack ran on WSL2 (see "Live confirmation" below). The text of the original static note follows. **Static audit:** Every entry below was found by reading code at commit
`9b23b5b`, or by running the unit tests that can run without Docker. The system has not been started,
so page-by-page UI checks, browser console errors, failed network requests, endpoint probing and peer CLI
checks are still to do; they are listed at the end. "Confirm live" marks entries whose runtime effect is
inferred from code and needs to be seen on a running stack.

Severity: **S1** blocks startup or a core flow, or breaks a stated security/privacy rule · **S2** feature
wrong or misleading · **S3** minor / cosmetic / hygiene.

## Live confirmation (WSL2, 2026-11-19, through nginx on http://localhost)

Core flow worked end to end by API: login → register patient → open visit → assign doctor → diagnosis → forward to lab → lab result → doctor sees result.

| ID | Observed |
| --- | --- |
| B1 | `GET /patients/:id` returned name, age, contact and address from world state |
| B6 | Technician submitted a result for an order that was never acknowledged: HTTP 200 |
| C4 | Technician called approve: HTTP 200, ledger recorded `labsupervisor` as the approver |
| C5 | Technician called acknowledge: API let it through, chaincode answered 403 with raw text |
| C1 | `GET /api/lab/records` returned sample record `labresult1` / `PAT-DEMO-001` on a brand-new ledger |
| C3 | `POST /api/lab/records` with no token reached validation (400 for missing fields, not 401) |
| F2 | `GET /api/pharmacy/api/inventory` with no token returned stock (`MED-001 Amoxicillin…`) on a brand-new ledger, i.e. from the local store (F1) |
| G4 | `GET /auth/staff` with no token: 200 |
| E2 | `POST /ai-agent/api/v1/agent/analyze-report` with no token: 200 |
| D1 | Not confirmed in the browser (gateway port not reachable from the test page); stands on code reading |

## Found during Phase 3

| ID | Sev | Location | Problem | Status |
| --- | --- | --- | --- | --- |
| B8 | S1 | `ehr-network/scripts/enroll.sh`, `lib/accessControl.js` | `hospitaladmin`, `labadmin` and `provideradmin` all carry `role=admin`, and chaincode ignored the MSP, so the lab or insurer administrator could register patients and discharge visits | Fixed (see fix log) |
| C10 | S1 | old `hospital-portal/pages/LabQueue.jsx` | The result form was pre-filled with normal-looking values ("Hemoglobin 13.5 g/dL", "Dengue NS1 Negative") and had "auto-approve" on by default, so one click could file invented normal results as approved | Fixed: page rewritten |
| B9 | S2 | every `gatewayManager.js` | The Fabric identity is chosen by role, not by user: `dr_smith` and `doctor` both sign as `doctor`, so the ledger cannot tell two people with the same role apart | Open |
| A9 | S3 | `ehr-network/scripts/test-chaincode-v2.sh` | Calls lab functions with argument lists that match neither the old nor the new chaincode | Open |
| A10 | S2 | `setup.sh` | Exited silently on the first failed host-side `npm install` (`--silent` hid the error) | Fixed: errors are shown and setup continues |
| G8 | S3 | `hospital-portal/pages/Login.jsx` | Lab role cards show the hint `recpw`, which happens to be the lab accounts' password; the removed `start.sh` banner advertised `password123`, which matched nothing | Open (login hints to be reviewed with G6) |
| G9 | S1 | `patient-api/routes/auth.js` `/auth/register` | Anyone who knew or guessed a patient ID could create the portal account for it and read that patient's record; the ID did not even have to exist (confirmed live: account created for `PAT-AUD-934030` with only an ID and a password) | Fixed: the patient must exist on the ledger and the phone number must match the one recorded at reception; password minimum raised to 8. Live test pending |
| C1, C2 | S1 | lab gateway | Sample-record store and built-in history records | Fixed: removed; ledger errors are reported. The lab deck still targets the undeployed `labresults` chaincode (A4), so its record list now shows an error instead of sample data until it is re-pointed at the hospital lab orders |
| A11 | S2 | `start.sh`, `stop.sh` | Rebuilding the network left patient logins, dashboard checkpoints, DigiLocker links and the pharmacy store from the old ledger in place | Fixed: `scripts/reset-app-state.sh` runs on every rebuild and on `stop.sh --reset` |

## A. Startup and scripts

| ID | Sev | Location | Reproduce | Expected | Actual | Root cause |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | S1 | `start.sh:116-117` | `./start.sh` | All services and nginx start | `docker compose up` is given `p-manager p-employee p-inventory p-billing p-patient`, which no longer exist; `set -e` aborts before step 6, so nginx/hub never starts (confirm live) | Script not updated when the five pharmacy apps were merged into `p-frontend` |
| A2 | S2 | `start.sh:140-144,176-180`; `start-sequential.sh:37-41,111`; `start-sequential.ps1:12-16` | Read banner / run sequential scripts | Only existing services listed and started | Advertises ports 3001–3005 and starts removed apps | Same as A1 |
| A3 | S1 | `start.sh`, `setup.sh` | Fresh clone, `./setup.sh && ./start.sh` | Network is created, chaincode deployed, system up | `start.sh` exits if identities/CA state are missing; nothing deploys `ehr`; user must know to run `network-up.sh` and `deployChaincode.sh` by hand with the right version/sequence | No single from-scratch path |
| A4 | S2 | `docker-compose.yaml` `l-node-gateway`; no deploy script | Start stack, open lab deck | Lab deck reads/writes the ledger | `LAB_CHAINCODE: labresults` is never deployed on `ehrchannel` by this repo; every call fails and hits the fallback in C1 (confirm live) | Lab team's chaincode belongs to their separate 3-machine network |
| A5 | S2 | `docker-compose.yaml` `h-hospital-portal`; `hospital-portal/vite.config.js:30-33` | Lab technician clicks AI analysis in Lab Queue (Docker) | Request reaches `clinical-ai-agent` | Proxy target defaults to `127.0.0.1:8000` inside the portal container → connection refused (confirm live) | `VITE_AI_AGENT_TARGET` not set in compose |
| A6 | S3 | `start.sh:165-…` | Run `start.sh` | No credentials in terminal output | Prints default usernames and `password123` | Demo convenience left in |
| A7 | S3 | `services/ai-agent/Dockerfile` vs `requirements.txt` | Build image | Declared deps installed | Only `fastapi uvicorn pydantic` installed; requirements list (langchain, chromadb, torch…) ignored | Offline mode made permanent |
| A8 | S3 | `ehr-chaincode-v3/test` | `node --test test/*.test.js` | Core contracts covered | Only `digilockerContract.test.js` exists (3 pass); Patient/Visit/Lab/Access contracts have no tests | — |

## B. Fabric / chaincode

| ID | Sev | Location | Reproduce | Expected | Actual | Root cause |
| --- | --- | --- | --- | --- | --- | --- |
| B1 | S1 | `lib/patientContract.js` `RegisterPatient`; `peer0-api/routes/patients.js:50` | Register a patient, `peer chaincode query … PatientContract:GetPatient` | Only hashes, CIDs, metadata on-chain | Name, age, gender, blood group, contact, address stored in world state in plain text | Demographics passed as chaincode args |
| B2 | S2 | `lib/accessControl.js` `now()`, `putState`; ~57 call sites; `assertReadAccess`, `accessContract.js:210,262` | Deploy with a 2-org endorsement policy and submit any write | Identical read/write sets on all endorsers | `new Date()` differs per peer → endorsement mismatch. Hidden today because policy is OR of single orgs | Wall clock used instead of `ctx.stub.getTxTimestamp()` |
| B3 | S2 | `scripts/deployChaincode.sh:78` | `querycommitted` | Multi-org consortium needs more than one org to agree on writes | `OR(Hospital, Diagnostics, Provider)` — any single org can write any state | Policy chosen to sidestep B2 |
| B4 | S2 | `lib/visitContract.js` `ListAllVisits`, `UpdateVisitCID` | Invoke `ListAllVisits` as any enrolled identity (e.g. insuranceofficer) | Role/consent check | Only `getCallerIdentity` — no restriction on listing every visit; `UpdateVisitCID` check is role-derived and needs review | Missing `requireRole` |
| B5 | S2 | `lib/accessControl.js` `STAFF_ROLES`, `assertReadAccess` | As billingofficer/pharmacist query `GetPatient`, `GetVisit` for any patient | Access limited to staff involved with that patient, or by consent | Every staff role in every org reads every patient's master record and visits; consent applies only to doctor/nurse on the `ehr` section | Blanket staff bypass |
| B6 | S2 | `lib/labContract.js` | Submit a result for a request that was never acknowledged, or approve one never submitted; reuse a `labRequestId` from another visit | State machine enforced on-chain | Chaincode only checks role and that the visit exists; lab request status lives solely in IPFS JSON, so order of steps and request existence are enforced only by the API | Lab request has no on-chain record |
| B7 | S3 | `lib/fhirContract.js` read functions | Query as any identity | Role check | None (data is hashes only, so impact is low) | — |

## C. Lab and diagnostics

| ID | Sev | Location | Reproduce | Expected | Actual | Root cause |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | S1 | `node-gateway/gateway.js:120,277-345` | Stop the diagnostic peer (or see A4), open lab deck, list/create records | Clear "ledger unavailable" error | Silently serves and stores records in an in-memory `localRecords` sample array; UI shows them as ledger records | Fabricated-data fallback |
| C2 | S1 | `node-gateway/agents/history-agent.js:400-440` | Run agents for `PAT-DEMO-001` without gateway | Failure | Returns built-in sample CBC history | Fabricated-data fallback |
| C3 | S1 | `node-gateway/server.js` (all `/api/*`) | `curl -X POST localhost:3006/api/records …` with no token | 401 | Accepted. Record creation, IPFS upload, agent run and approval are open; tamper demo route exists | No authentication |
| C4 | S1 | `extorg-api/routes/lab.js:165-175,202-210` | Log in as `labtechnician`, call `…/approve` | 403 — technician cannot approve own result | API swaps in the `labsupervisor` Fabric identity and approves; ledger records the supervisor as approver | Deliberate identity substitution; breaks separation of duties and falsifies the on-chain actor |
| C5 | S2 | `extorg-api/routes/lab.js:67,98` vs `lib/labContract.js:34,55` | `labtechnician` calls `…/acknowledge`; `admin` calls `…/submit` | API and chaincode agree | API allows it, chaincode rejects with raw "Access denied…" text (confirm live) | Role lists out of sync |
| C6 | S2 | `hospital-portal/pages/LabQueue.jsx:128-195,398-430`; `DoctorVisits.jsx:346-365`; `patient-portal/pages/Visits.jsx:481-485` | Enter and view a lab result | Report: patient/test details, parameter table with value, unit, reference range, flag, attachments, status, print/PDF | Free-form key/value pairs rendered as a list; no units, ranges or flags; no attachments; no print/export; AI fields mixed into results as `ai*` keys | Results modelled as `{key: string}` |
| C7 | S2 | `extorg-api/routes/lab.js:108,118`; `LabQueue.jsx:194` | Submit result | `resultsHash` = hash of the results | Set to the AI text hash, or empty | Field misused |
| C8 | S2 | `LabQueue.jsx` | Use the queue with many orders | Pending list, search, filters, validation | Not yet reviewed in a browser; code shows no search/filter and minimal validation (confirm live) | — |
| C9 | S2 | `extorg-api/routes/lab.js:23-43` | Open Lab Queue with N visits | One query | Fetches every visit on the ledger and one IPFS document per visit on each load | No lab-request index |

## D. IPFS and storage

| ID | Sev | Location | Reproduce | Expected | Actual | Root cause |
| --- | --- | --- | --- | --- | --- | --- |
| D1 | S1 | `ipfs-service/src/ipfs.js` `pinJSON`, `pinFile` | Register patient, `ipfs cat <ehrCID>` or open `localhost:8090/ipfs/<cid>` | Ciphertext | Full EHR/visit JSON readable by anyone with the CID; gateway is published on 8090 and proxied at `/ipfs/` | No encryption layer for EHR/visit/report content (only DigiLocker and FHIR bundles encrypt) |
| D2 | S1 | `ipfs-service/src/routes.js` `/fetch/:cid` | Any backend holding the service key fetches any CID | Retrieval respects patient access permissions | Only the shared `X-IPFS-Key` is checked; no per-patient or per-role check | Service is a thin Kubo proxy |
| D3 | S2 | `pharmacy backend/app.js:120-141` | Pharmacy write | Goes through ipfs-service | Talks to Kubo directly, falls back to `127.0.0.1:5001`, unencrypted, 3.5 s timeout | Separate implementation |
| D4 | S3 | `ipfs-service/src/app.js:19` and all APIs `cors({origin:'*'})` | — | Allow-list | Any origin | — |

## E. Agents

| ID | Sev | Location | Reproduce | Expected | Actual | Root cause |
| --- | --- | --- | --- | --- | --- | --- |
| E1 | S1 | `services/ai-agent` (`EHR_OFFLINE_MODE=true`, Dockerfile) | Call `/api/v1/agent/query` or `/analyze-report` | AI model output | Keyword/rule output presented as "Clinical AI"; no model is ever called | Offline synthesizer is the only code path installed |
| E2 | S2 | `services/ai-agent/api/routes.py` | `curl localhost:8000/api/v1/patients` | Authenticated | No auth on any route; patients kept in `patient_data/patients.json` outside ledger/IPFS | — |
| E3 | S2 | `node-gateway/agents/lab-agent.js:700-730` | Run lab agent with no/invalid Gemini key | Explicit failure or clearly labelled degraded result | Heuristic keyword result returned with status FALLBACK; label must be verified in UI (confirm live) | — |
| E4 | S2 | `services/clinical-decision-support/` | — | Wired or removed | LangGraph + Gemini agent with `mock_agents.py`; not in compose, called by nothing | Dead module |
| E5 | S2 | `hospital-agent/capabilities/clinical.js` | — | Wired or removed | Not referenced by any service (to confirm) | Dead module |
| E6 | S2 | `hospital-portal/utils/api.js:45-70` | AI call fails | User-facing message, timeout | No timeout; error only `console.error` then rethrown | — |
| E7 | S2 | Registration flow | Register a patient | Symptom agent runs | No agent at registration (Phase 4c) | Not built |

## F. Pharmacy

| ID | Sev | Location | Reproduce | Expected | Actual | Root cause |
| --- | --- | --- | --- | --- | --- | --- |
| F1 | S1 | `pharmacy backend/app.js:190-245`, `store.js` | Add inventory / create bill, then query the ledger | Transaction on `ehrchannel` | Backend invokes functions that do not exist in `ehr` chaincode; on error it silently uses a local JSON store and reports success | Pharmacy chaincode was never merged into `ehr`; fallback hides it |
| F2 | S1 | `pharmacy backend/app.js` | `curl -X POST localhost:3000/api/inventory …` | 401 | Accepted; all routes open, `cors()` open | No authentication on the backend (the UI login is cosmetic for these routes) |
| F3 | S1 | `pharmacy frontend/src/App.jsx:333,438` | Read the bundle | No credentials in client code | `pharmacist` / `pharmpw` hard-coded and used for every dispense regardless of who is logged in | Shortcut |
| F4 | S3 | `pharmacy backend/app.js:38` | — | — | Hard-coded Tailscale IP `100.124.176.94` | Leftover |

## G. Portals and UX (from code; browser pass pending)

| ID | Sev | Location | Reproduce | Expected | Actual | Root cause |
| --- | --- | --- | --- | --- | --- | --- |
| G1 | S2 | `hospital-portal/main.jsx`, `Login.jsx` | Log in as billingofficer / claimsauditor / insuranceofficer | Claims workspace | No page for any Provider role; redirected to `/patients`, which then rejects the role (dead end, confirm live) | Claims UI never built |
| G2 | S2 | `nginx.conf:47-65` | Open `http://localhost/hospital/` | Portal loads | Assets 404 (Vite serves from `/`) | Known item 6.4 |
| G3 | S2 | `nginx.conf:77` vs `hospital-portal/utils/api.js` | Use lab roles through nginx | Same path both ways | nginx exposes `/api/hospital/extorg/`, portal calls `/api/hospital/ext` (works only via Vite proxy on :5173) | Naming drift |
| G4 | S2 | `peer0-api/routes/auth.js:73` | `curl localhost:4001/auth/staff` | Authenticated | Staff list returned without a token | Missing middleware |
| G5 | S2 | `peer0-api` staff creation | Admin creates a user in Docker | User enrolled | Fails: network folder mounted read-only, no `fabric-ca-client` in image | Known item 6.2 |
| G6 | S3 | `hospital-portal/pages/Login.jsx`; `shared/users.json` | Open login page | No credentials shown outside dev | Demo usernames/passwords displayed; hashes committed | Known item 6.5 |
| G7 | S3 | Portals run as Vite dev servers in compose | — | Production build served | `npm run dev` in containers | — |

## H. Dashboard (gaps against the required analytics)

| ID | Sev | Location | Actual |
| --- | --- | --- | --- |
| H1 | S2 | `dashboard-api` aggregation | No patient or record counts from the ledger |
| H2 | S2 | all gateways | Submit and commit timestamps are not recorded, so latency (avg/min/max/median/p95) cannot be computed |
| H3 | S2 | `dashboard-portal/pages/Transactions.jsx` (88 lines) | No block explorer detail view, no date-range filter (confirm live) |
| H4 | S2 | — | No IPFS upload/retrieval timing or storage growth; no agent response-time or AI-vs-doctor match rate |
| H5 | S3 | `dashboard-api/scripts/mock-events.js`, `demo.js` | Mock event generators exist; must confirm nothing in the running system uses them |

## Unit tests run in this pass (no Docker)

| Suite | Result |
| --- | --- |
| `ehr-chaincode-v3/test/digilockerContract.test.js` | 3 / 3 pass |
| `node-gateway/tests/*.test.js` | 23 / 23 pass |
| `orgs/digilocker/backend/test` | units pass; service test not run (dependencies not installed on host) |
| `fhir/test`, `dashboard-api/test` | not run (dependencies not installed on host) |

## Still to audit on a running stack

- Every page, button, form, link and table in the five portals, in both themes, with console and network tabs open.
- Every API endpoint: success, invalid input, no token, wrong role.
- Every chaincode function by peer CLI, including access-control negatives.
- Network from scratch: orgs/peers join, chaincode install/approve/commit.
- IPFS: pin, fetch, CID on chain equals CID in IPFS.
- Patient portal (not reviewed in depth in this pass), DigiLocker flow, dashboard live stream.

## Live API pass 2 (patient portal, through nginx)

All of these answered 200 for a logged-in patient: `/auth/me`, `/profile`, `/profile/history`, `/ehr`, `/ehr/history`, `/visits`, `/visits/:id`, `/visits/:id/history`, `/visits/:id/cids`, `/access`, `/access/active`, `/access/log`, `/access/requests`, `/access/staff`, `/signatures`, `/signatures/verify/ehr`, `/signatures/verify/visit/:id`; grant and revoke worked; no token → 401; another patient's visit → 404. DigiLocker `/health`, `/status`, `/vault` → 200, `/documents` → 409 "not linked" (expected before linking). Dashboard API without a token → 401.

## Removed as stale (commit c91b8fd)

- `orgs/pharmacy/fabric-network-swarm/app/{manager,employee,inventory,patient,billing}` — replaced by the unified `app/frontend`; removed from CI and the two sync scripts
- `orgs/hospital/EHR_hospitalOrg-main/hospital-agent/` — referenced by nothing
- lab gateway `agents/demo-lab-agent.js`, `integrity-demo.js`, `tools/test-mock.js` — manual demo scripts, referenced by nothing
- `FILE_SEARCH_ROOT.md` (out-of-date file index), `BlockChain_24MCF1R06` (a 34-byte stray pointer file), `ehr-network/chaincode_test_output.txt` (old test dump)

Kept on purpose: `services/clinical-decision-support` (unwired, but it is the only agent code that calls a real model — to be wired in for E1/4c), the lab team's standalone three-machine network files under `orgs/lab/EHR-LABORG-main` and the pharmacy swarm files (teammates' deliverables, not used by the integrated stack), `ai-agent` legacy modules and `dashboard-api/scripts/mock-events.js` (imported by tests).
