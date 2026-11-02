# Resource Mapping — Legacy EHR → HL7 FHIR R4

Team D owns the boundary that converts every clinical artifact entering the
platform into **HL7 FHIR R4** resources before anything is hashed, encrypted,
stored, or anchored.

## The seven target resources (built and validated)

| Legacy concept (this repo) | FHIR R4 resource | Mapping file | Key notes |
|----------------------------|------------------|--------------|-----------|
| Patient master record (`patientContract.RegisterPatient`) | `Patient` | `src/adapters/mappings/patient-mapping.js` | `identifier.value` = HMAC-SHA256 hash, **not** raw MRN |
| Visit (`visitContract.OpenVisit`) | `Encounter` | `src/adapters/mappings/visit-mapping.js` | `subject` → `Patient/`, `reasonCode` ← chief complaint |
| Lab measurement (IPFS visit `labRequests[].results`) | `Observation` | `src/adapters/mappings/lab-result-mapping.js` | LOINC `code`, UCUM `valueQuantity`, `contained` in `DiagnosticReport` |
| Lab report / panel | `DiagnosticReport` | `src/adapters/mappings/lab-result-mapping.js` | references contained `Observation`s |
| Prescription | `MedicationRequest` | `src/adapters/mappings/prescription-mapping.js` | RxNorm/SNOMED when coded, else `text` |
| Diagnosis (`diagnosisNotes` / `finalDiagnosis`) | `Condition` | `src/adapters/mappings/condition-mapping.js` | SNOMED-CT / ICD-10 `code` |
| Access grant (`accessContract.GrantAccess`) | `Consent` | `src/adapters/mappings/consent-mapping.js` | 1:1 with `CONSENT~<patientIdHash>~<granteeId>~<scope>` |

## Terminology bindings

| Concept | System | Example |
|---------|--------|---------|
| CBC panel test codes | LOINC (`http://loinc.org`) | `718-7` = Hemoglobin |
| Lab result units | UCUM (`http://unitsofmeasure.org`) | `g/dL`, `10*3/uL` |
| Diagnoses | SNOMED-CT (`http://snomed.info/sct`) / ICD-10 (`http://hl7.org/fhir/sid/icd-10`) | `Condition.code` |
| National profile | ABDM (India) / IPS | `Patient.identifier` system, `DocumentReference` profile |

## Example: legacy → FHIR Observation

```json
// Before (legacy, mirrors actual lab result shape)
{ "patientId": "PAT-001", "results": { "Hemoglobin": { "value": 8.5, "unit": "g/dL", "loinc": "718-7" } } }

// After (FHIR Observation)
{
  "resourceType": "Observation",
  "status": "final",
  "subject": { "reference": "Patient/PAT-001" },
  "code": { "coding": [{ "system": "http://loinc.org", "code": "718-7", "display": "Hemoglobin" }] },
  "valueQuantity": { "value": 8.5, "unit": "g/dL", "system": "http://unitsofmeasure.org", "code": "g/dL" }
}
```

## Stretch mappings (documented, not yet built)

From `EHR_VISION.pdf` §23, additional resources the platform will eventually
need — recorded here so the model stays forward-compatible:

| Project concept | FHIR resource |
|-----------------|---------------|
| Doctor | `Practitioner` |
| Hospital / Lab | `Organization` |
| Medicine | `Medication` |
| Uploaded PDF | `DocumentReference` |
| Allergy | `AllergyIntolerance` |
| Vitals | `Observation` (vital-signs category) |
| Procedure | `Procedure` |
