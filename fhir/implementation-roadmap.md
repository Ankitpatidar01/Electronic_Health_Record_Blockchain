# Implementation Roadmap

The three-tier architecture mandate from `EHR_VISION.pdf` §31, plus the concrete
build/verify steps.

## Architectures A / B / C

| Tier | Scope | Status |
|------|-------|--------|
| **A — Minimum viable** | Adapter → validator → canonicalizer → hasher, runnable standalone with tests | ✅ Done |
| **B — Recommended** | + AES-256-GCM encryption, IPFS bundler, zero-PHI Fabric anchor, AI tools, dashboard events, full docs | ✅ Done (encryption/anchor are injection-point reference impls) |
| **C — Future / research** | Native FHIR search API (`GET /fhir/Observation?patient=…&code=…`), live `$validate-code`/`$expand` terminology server with a co-located cache | Deferred |

## Build phases (what was built, in order)

1. **Schemas & terminology** — `schemas/*.schema.json`, `terminology/*.json`, `examples/*`.
2. **Validation & JCS** — `validator.js`, `canonicalizer.js`, `hasher.js`, `identifiers.js` + tests.
3. **Adapter + bundler + anchor** — `adapters/`, `ipfs-bundler.js`, `encryption.js`, `fabric-anchor.js`, `events.js`.
4. **Tools + demo + docs** — `tools/`, `demo/cli.js`, the seven docs.

## Verify

```bash
cd fhir
npm install
npm test                          # 18 tests: validator, determinism, HMAC, adapter
node demo/cli.js examples/legacy-lab-result.json --type lab-result
node demo/cli.js examples/legacy-lab-result.json --type lab-result --pin   # needs ipfs-service up
```

Determinism check: run the demo twice — the `patientRecordHash` is identical
across runs and machines (for a fixed `KNET`).

## Cross-module integration (next)

| Partner | Contract | Where it lands |
|---------|----------|----------------|
| Security (Teams 2/5) | `patientRecordHash = H(R)` for VCAP; `HMAC-SHA256(Knet,·)`; AES-256-GCM envelope | `src/hasher.js`, `src/identifiers.js`, `setEnvelopeEncryptor` |
| Agentic AI (Teams 3/6) | `getFHIRResource` / `createFHIRResource` | `src/tools/` |
| Dashboard (Team 1) | `FHIR_CONVERSION_STARTED/COMPLETED/FAILED` in common envelope | `src/events.js` |

## Open questions (resolve at the cross-module review)

- Security: exact `Knet` injection mechanism / env var name and the envelope-encryption routine's signature.
- Agentic AI: the tool-validation/authorization layer signature the two tools must satisfy.
- Dashboard: event transport (WebSocket vs SSE) and whether the envelope field set is final.
- All teams: whether `RECORD~<patientIdHash>~<recordId>` becomes the canonical on-chain key given the current plaintext `VISIT:`/`ACCESS:` keys.
