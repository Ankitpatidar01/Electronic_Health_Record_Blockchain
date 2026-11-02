# Validation Design

Feature 2 of the Group 4 proposal: structural conformance + terminology
membership in a single pass, target **< 40 ms p95**.

Implementation: `src/validator.js`.

## Two checks, one pass

1. **Structural** — each resource is validated against a bundled FHIR R4 profile
   JSON-Schema (`schemas/*.schema.json`, draft-07) via `ajv`. Validators are
   compiled once per `resourceType` and cached.
2. **Terminology** — a recursive walk of the resource finds every
   `{ system, code }` pair (codings *and* `valueQuantity` units). If `system` is
   one of the four bundled systems and `code` is not a member of the
   corresponding subset, the resource is rejected.

## Error typing (matches the proposal's Failure Handling)

| Code | Meaning |
|------|---------|
| `SCHEMA_INVALID` | structural conformance failure (with the failing JSON path) |
| `TERMINOLOGY_UNBOUND` | a code/unit uses a bundled system but is not in the subset |

Unknown coding *systems* are out of scope and skipped (lenient) — we only
reject uncoded values that claim to be LOINC/UCUM/SNOMED/ICD-10.

## Terminology subsets

Bundled in `terminology/` to keep the validator in-process and inside the
latency budget. Live `$validate-code`/`$expand` against an external terminology
server is deferred to Architecture C (co-located cache).

- `loinc-subset.json` — CBC + basic chemistry panel
- `ucum-units.json` — the units our lab results emit
- `snomed-subset.json` / `icd10-subset.json` — common diagnoses

## The deliberate departure from the proposal

The Group 4 proposal recommends `@asymmetrik/fhir-json-schema-validator`.
Research shows that package is **stale (last published Sept 2020, ~35
downloads/week)**. Instead we bundle focused FHIR R4 profile schemas and
validate with a maintained `ajv` (v8). The full HL7 R4 `fhir.schema.json` can be
layered on via `$ref` later; our profiles validate the fields the adapters
actually emit, which is what makes the <40 ms target achievable in-process.

## Negative cases (covered by `test/validator.test.js`)

- missing `resourceType` → `SCHEMA_INVALID`
- missing required field → `SCHEMA_INVALID`
- unknown LOINC code → `TERMINOLOGY_UNBOUND`
- unknown UCUM unit → `TERMINOLOGY_UNBOUND`
