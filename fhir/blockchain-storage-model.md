# Blockchain Storage Model

What Fabric holds, and why it holds nothing more.

## Principle

Fabric = **trust + provenance + authorization + metadata**. It is never a store
for clinical content. Because payload size is constant (only hashes and CIDs),
a 200 MB MRI and a 2 KB lab value impose identical ledger cost — the reason the
off-chain design scales (Security §25.2).

## The record Team D anchors

See `ehr-schema.md` for the full schema. Summarized:

| Field | Derivation |
|-------|-----------|
| `recordId` | `RECORD~<patientIdHash>~<recordId>` |
| `patientIdHash` | `HMAC-SHA256(Knet, patientId)` |
| `patientRecordHash` | `SHA-256(RFC8785( resource ))` |
| `dataCID` | CID of the AES-256-GCM ciphertext in IPFS |
| `status` | non-clinical state |

A full ledger copy at any peer reveals only hashes, CIDs, and status — no PHI.

## VCAP hand-off (the Security contract)

Team D supplies exactly one field of the VCAP tuple
`V = { H(R), H(P), F(M), H(S), t, σ }`: `H(R) = patientRecordHash`. The
canonicalizer is exposed as a shared library (`src/canonicalizer.js`) so the
Security team's `VerifyVCAP` recomputes the identical digest. Team D does not
compute `H(P)`, `F(M)`, `H(S)`, or `σ`.

## Canonicalization (why hashing is safe)

RFC 8785 (JCS) — lexicographic key order, no insignificant whitespace,
normalized numbers, normalized UTF-8. Two services with the same clinical facts
produce the same digest regardless of source-JSON key order, which is what makes
VCAP tamper-detection reproducible. `src/canonicalizer.js` enforces strictness:
`undefined`, `NaN`, and `±Infinity` are rejected loudly rather than coerced
(`canonicalize` is lenient here; we are not).

## Versioning

Every CID transition is append-only (`cidHistory` in the existing chaincode). A
FHIR amendment produces a new `patientRecordHash` and a new CID; the prior
values remain in history, so amendments have a defined, auditable lineage.
