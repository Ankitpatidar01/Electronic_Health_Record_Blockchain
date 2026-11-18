# Standard EHR / HL7 FHIR R4 Module (Team D)

The **Standard EHR / FHIR interoperability layer** of the blockchain EHR
platform. This module is the boundary that converts every clinical artifact —
patient records, encounters, lab results, prescriptions, consent grants — into
**HL7 FHIR R4** resources *before* anything is hashed, encrypted, stored, or
anchored.

It sits directly beneath the Security layer and directly above Storage/AI in the
platform's four-pillar model (Security → **Standard EHR (FHIR)** → Agentic AI /
Storage → Dashboard). FHIR is the shared data model that lets the other three
pillars talk about "the same patient record" without agreeing on anything else.

## The pipeline

```
legacy JSON  →  ADAPTER  →  VALIDATE  →  CANONICALIZE (RFC 8785)  →  HASH (SHA-256)
   (7 resources)     (schema + terminology)     patientRecordHash = VCAP H(R)
        →  ENCRYPT (AES-256-GCM)  →  PIN (IPFS)  →  ANCHOR (zero-PHI state record)
```

The binding constraint is **zero-PHI on-chain**: Fabric only ever receives a
SHA-256 digest of a canonicalized FHIR payload, an IPFS CID, and non-clinical
status. The on-chain schema has no field capable of holding a clinical value by
construction.

## The seven target resources

| Legacy concept | FHIR R4 resource |
|----------------|------------------|
| Patient master record | `Patient` |
| Visit | `Encounter` |
| Lab measurement / report | `Observation` / `DiagnosticReport` |
| Prescription | `MedicationRequest` |
| Diagnosis | `Condition` |
| Access grant | `Consent` |

Full field-level mappings and terminology bindings (LOINC / UCUM / SNOMED-CT /
ICD-10) live in `resource-mapping.md`.

## Quick start

```bash
npm install
npm test                                   # 18 tests
node demo/cli.js examples/legacy-lab-result.json          # full pipeline, no IPFS
node demo/cli.js examples/legacy-lab-result.json --pin    # also pin to ipfs-service (:3006)
```

The demo prints the FHIR resource, its RFC 8785 canonical form, the SHA-256
`patientRecordHash`, the AES-256-GCM encryption metadata, and the zero-PHI
Fabric anchor record. It is **deterministic** — the same input produces the same
hash across runs and machines (for a fixed `KNET`).

## Using it as a library

```js
const fhir = require('./src');

// 1. Convert legacy JSON to a validated FHIR resource + hash + anchor
const result = await fhir.convert('lab-result', legacyJson, { pin: false });
result.resource;            // FHIR DiagnosticReport
result.patientRecordHash;   // "sha256:..."  (VCAP H(R))
result.anchor;              // { recordId, patientIdHash, dataCID, status, ... }

// 2. Lower-level primitives
fhir.toFHIR('patient', patientJson);        // -> FHIR Patient
fhir.validateResource(resource);            // -> { valid, errors }
fhir.canonicalizeResource(resource);        // -> RFC 8785 string
fhir.patientRecordHash(resource);           // -> "sha256:..."
fhir.patientIdHash('PAT-001');              // -> "hmac-sha256:..." (HMAC-SHA256(Knet,·))

// 3. AI tool layer (Agentic AI contract)
fhir.createFHIRResource('Observation', obs); // validate + register
fhir.getFHIRResource('Observation', 'OBS-1');

// 4. Injection points for the live system
fhir.setEnvelopeEncryptor(securityAesRoutine); // Security team's AES-256-GCM
fhir.setIpfsClient(ipfsServiceClient);         // reuse ipfs-service/src/ipfs.js
fhir.setEventEmitter(dashboardTransport);      // FHIR_CONVERSION_* events
```

## Directory layout

```
fhir/
├── schemas/         # bundled FHIR R4 profile JSON-Schemas (draft-07)
├── terminology/     # LOINC / UCUM / SNOMED-CT / ICD-10 subsets
├── src/
│   ├── adapters/    # legacy-to-fhir engine + per-source mappings
│   ├── validator.js     # schema + terminology, single pass (<40ms p95)
│   ├── canonicalizer.js # RFC 8785 JCS (strict)
│   ├── hasher.js        # SHA-256 patientRecordHash
│   ├── identifiers.js   # HMAC-SHA256(Knet, patientId)
│   ├── encryption.js    # AES-256-GCM envelope (injection point)
│   ├── ipfs-bundler.js  # reuses ipfs-service
│   ├── fabric-anchor.js # zero-PHI state records (RECORD~/CONSENT~)
│   ├── events.js        # FHIR_CONVERSION_* dashboard events
│   └── tools/           # getFHIRResource / createFHIRResource (AI tools)
├── examples/        # sample legacy inputs + FHIR outputs
├── demo/cli.js      # end-to-end demo
└── test/            # node:test suite
```

## Cross-module contracts

| Partner | This module supplies |
|---------|----------------------|
| Security (VCAP) | `patientRecordHash = H(R)` — the only field Team D computes of the VCAP tuple |
| Security (identity) | `patientIdHash = HMAC-SHA256(Knet, patientId)` — never plaintext MRN |
| Security (storage) | AES-256-GCM envelope via `setEnvelopeEncryptor` (DEK under patient KEK) |
| Agentic AI | `getFHIRResource` / `createFHIRResource` |
| Dashboard | `FHIR_CONVERSION_STARTED / _COMPLETED / _FAILED` in the common envelope |

## Technology notes

- **Validation** uses maintained `ajv` v8 against bundled FHIR R4 profile
  schemas (the proposal's `@asymmetrik/fhir-json-schema-validator` is stale —
  last published 2020).
- **Canonicalization** delegates to `canonicalize` (RFC 8785 JCS) with a strict
  guard that rejects `undefined` / `NaN` / `Infinity` rather than silently
  coercing them — otherwise two verifiers could disagree on a digest.
- **Terminology** is bundled in-process to stay within the 40 ms latency budget;
  a live `$validate-code` server is deferred to Architecture C.

See `ehr-schema.md`, `validation-design.md`, `blockchain-storage-model.md`,
`ipfs-storage-model.md`, `migration-plan.md`, and `implementation-roadmap.md`
for the full design rationale.
