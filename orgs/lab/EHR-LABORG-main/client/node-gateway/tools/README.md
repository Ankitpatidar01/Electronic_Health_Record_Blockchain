# Sushil Tool Layer + VCAP

This package contains only Sushil's assigned modules from the EHR Agentic AI architecture:

- `tools/fabric-tools.js` — Lab Fabric wrappers; reuses existing `../gateway.js`
- `tools/ipfs-tools.js` — IPFS wrappers; reuses existing `../ipfs.js`
- `tools/hospital-tools.js` — Hospital HTTP wrappers; consent/access is checked before patient data is returned
- `tools/pharmacy-tools.js` — Pharmacy HTTP wrappers
- `provenance/vcap.js` — VCAP builder, hashing, IPFS storage and caller-supplied Fabric anchoring

`gateway.js` and `ipfs.js` are intentionally NOT included or modified.

## Required interfaces

### Fabric
`getPatientHistory`, `getLabResult`, `createLabResult`, `submitLabResult`, `storeAISummary`, `addToIPFS`, `updateLabResult`

### Hospital
`getPatientVisits`, `getClinicalNotes`, `getPatientConsent`, `checkAccess`, `recordClinicalSummary`

### Pharmacy
`checkInventory`, `checkMedication`, `createBill`, `deductInventory`

### IPFS
`addToIPFS`, `addJson`, `addBinary`, `readFromIPFS`, `readRaw`, `checkIPFS`, `sha256`

### VCAP
`createVCAPRecord`, `buildVCAP`, `storeVCAP`, `buildAndStoreVCAP`, `anchorVCAP`, `sha256`

## Mock testing

From `client/node-gateway/tools`:

```bash
node test-mock.js
```

Expected:

```text
ALL MOCK TESTS PASSED
```

## Integration environment

The architecture specifies these base services:

- Hospital: `HOSPITAL_API_URL` (documented default `http://localhost:3004`)
- Pharmacy: `PHARMACY_API_URL` (documented default `http://localhost:3000`)
- Existing Lab `gateway.js` / `ipfs.js` provide their own Fabric/IPFS configuration.
