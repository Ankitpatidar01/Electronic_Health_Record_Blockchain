# EHR Schema — On-Chain vs Off-Chain

The binding constraint of this module is **zero-PHI on-chain**: the Fabric
ledger never holds a clinical value, code, or narrative. It holds only hashes,
CIDs, and non-clinical status. This is enforced *by construction* — the on-chain
schema has no field capable of holding PHI.

## On-chain record (CouchDB state, per Security §19.1)

Produced by `src/fabric-anchor.js` (`buildRecord`):

```json
{
  "recordId": "hmac-sha256:74c953...~DR-LAB-001",
  "resourceType": "DiagnosticReport",
  "patientIdHash": "hmac-sha256:74c95353fbdc3591f53ccf651bf7cce5b0aa3cd4b8aa44a1bf1d72e5648030eb",
  "patientRecordHash": "sha256:31a35049a74a3b9319140bf947c665e2465fd712bf9d80b0afeed914c29315e4",
  "dataCID": "bafybeic7x42mpn6u7iynr4l4qgsqd5j26wf5j2l3",
  "status": "FINAL",
  "canonicalizationScheme": "RFC8785-JCS",
  "timestamp": "2026-09-16T10:30:00Z"
}
```

Fields:
- `recordId` / `patientIdHash` — `HMAC-SHA256(Knet, patientId)` (`src/identifiers.js`), keyed so a ledger copy cannot brute-force a small id space.
- `patientRecordHash` — `SHA-256(canonicalize(resource))`, the VCAP `H(R)` input (`src/hasher.js`).
- `dataCID` — IPFS CID of the **encrypted** artifact.
- No clinical value, code, or narrative field exists.

State-key namespace (matches Security §19.1, `src/fabric-anchor.js`):

```
RECORD~<patientIdHash>~<recordId>        -> EHR metadata + CID
CONSENT~<patientIdHash>~<granteeId>~<scope> -> consent grant
```

## Off-chain payload (IPFS)

The full FHIR resource (e.g. a `DiagnosticReport` with `contained`
`Observation`s) is the object that is canonicalized, hashed, encrypted, and
pinned — never the on-chain record. See `examples/diagnostic-report-lab.json`.

## Where each concern lives

| Concern | Location |
|---------|----------|
| Clinical content (FHIR) | IPFS, AES-256-GCM encrypted |
| Cryptographic proof | Fabric (`patientRecordHash`) |
| Access / consent | Fabric (`CONSENT~` composite keys) + `accessContract.js` |
| Status transitions | Fabric (state fields) |
