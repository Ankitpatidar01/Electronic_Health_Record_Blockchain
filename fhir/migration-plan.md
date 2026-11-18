# Migration Plan — Legacy Custom JSON → FHIR

How the existing visit-based platform adopts the FHIR model without a big-bang
rewrite.

## Current state (audited)

The repo is a **visit-based** model, not the lab-report-centric gateway the
Group 4 proposal's "current system analysis" describes:

- Chaincode: `ehr-chaincode-v3/` (8 contracts — `patientContract`, `visitContract`,
  `clinicalContract`, `labContract`, `forwardContract`, `claimsContract`,
  `ehrContract`, `accessContract`).
- Backends: `ehr-backend-v3/` (one Express API per role + `ipfs-service`).
- Data: clinical content already lives in IPFS JSON (`visitCID` + `cidHistory`),
  so the **zero-PHI envelope pattern already exists**. Team D standardizes what
  goes *inside* the envelope, not the envelope itself.

## What must NOT be rewritten

- `ehr-chaincode-v3` contracts (extended, not replaced — FHIR adds
  `patientRecordHash`/`resource-type` fields to existing state).
- `ipfs-service/src/ipfs.js` (reused via `setIpfsClient`).
- The per-role Express backends (FHIR routes are added *alongside* existing ones).

## Phased migration

### Phase A — side-by-side adapter (this phase)
The standalone `fhir/` module runs alongside the live system. `report-extractor`
-equivalent inputs (the actual lab/patient/visit JSON) flow through
`convert()`; outputs are validated FHIR + hash + CID. No live endpoints change.

### Phase B — wire the adapter into the gateway
Add `/api/fhir/*` routes to the backends that call `toFHIR()` → `convert()`.
Legacy endpoints stay for backward compatibility during migration.

### Phase C — chaincode state enrichment
Extend the existing contracts' state records with `patientRecordHash` and
`resourceType`, keeping the current `VISIT:<id>` / `ACCESS:<patientId>` keys
working while new `RECORD~<patientIdHash>~<recordId>` records are introduced in
parallel (hash-first, per the locked decision).

### Phase D — retire legacy JSON
Flip consumers (AI agents, dashboard) to `getFHIRResource`/`createFHIRResource`
and the `FHIR_CONVERSION_*` events; deprecate the bespoke JSON parsers.

## Key migration decision (flagged for the team review)

Current chaincode stores **plaintext** `patientId` in keys (`ACCESS:PAT-001`,
`VISIT:PAT-001-V1`); the Security spec mandates `HMAC-SHA256(Knet, patientId)`.
Team D's module is built **hash-first** now. The shared on-chain key namespace
(`RECORD~<patientIdHash>~...` vs the existing plaintext keys) needs a
cross-module migration decision — recorded in `implementation-roadmap.md`.
