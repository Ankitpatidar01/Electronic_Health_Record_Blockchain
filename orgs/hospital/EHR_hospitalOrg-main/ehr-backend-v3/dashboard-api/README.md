# Observatory Dashboard API

Read-only operational observability and real-time event pipeline for Group 1. It provides Zero-PHI event validation, append-only NDJSON event caching, committed-block metadata collection, bounded HTTP health polling across all 12 consortium nodes/agents, authenticated REST aggregation, trace stitching, single-use stream tickets, and high-throughput WebSocket (`/ws`) and Server-Sent Events (`/stream`) delivery. It strictly does not write to Fabric and does not expose its internal ingest endpoint through Nginx.

The API container is `h-dashboard-api` on host port `4010` (loopback binding), reverse-proxied at `/api/dashboard/`; the companion portal is `h-dashboard-portal` on `5176`, served through Nginx at `/dashboard/`.

---

## 🔒 Security, Authorization & Zero-PHI Compliance

- **HS256 JWT Authentication:** Requires `userId`, `role`, `mspId`, `peer`, and `exp` claims. Missing, expired, unsigned, or `alg: none` tokens are strictly rejected.
- **Ordered Key Support:** `DASHBOARD_JWT_SECRETS` supports a comma-separated list of keys; `JWT_SECRET` is the local fallback.
- **Config-Based Default-Deny Role Policy:** Loaded from `config/authorization.json`. `admin` can see global aggregates; `doctor`, `nurse`, `pharmacist`, and `lab` roles are restricted to their authorized peer/agent/org scopes. Patient and unspecified roles are denied access.
- **Strict Zero-PHI Envelope Validation:** Rejects raw patient identifiers, names, clinical notes, lab values, and AI narrative. Patient references are hashed via keyed HMAC-SHA256 (`patientIdHash`) and omitted for non-admin viewers.
- **Single-Use Stream Tickets:** Clients request a short-lived ticket via `POST /api/dashboard/stream-ticket` before connecting to WebSocket or SSE, ensuring tokens are never leaked into URL query strings.

---

## 📡 12/12 Consortium Health Telemetry

Configured via `config/topology.json`, the dashboard actively polls 12 consortium targets reporting live status:
1. `peer0.hospital.example.com`: HospitalMSP Reception/Admin peer operations (`http://peer0.hospital.example.com:9444/healthz`)
2. `peer1.hospital.example.com`: HospitalMSP Doctor peer operations (`http://peer1.hospital.example.com:9445/healthz`)
3. `peer0.diagnostic.example.com`: DiagnosticsMSP Lab peer operations (`http://peer0.diagnostic.example.com:9446/healthz`)
4. `peer0.provider.example.com`: ProviderMSP Insurance peer operations (`http://peer0.provider.example.com:9447/healthz`)
5. `orderer.example.com`: Raft CFT Orderer operations (`http://orderer.example.com:9443/healthz`)
6. `clinical-agent`: Clinical AI & Medical RAG microservice (`http://clinical-ai-agent:8000/health`)
7. `history-agent`: Longitudinal History Agent in Lab Gateway (`http://l-node-gateway:3006/api/health`)
8. `governance-agent`: Consent Governance Agent in Lab Gateway (`http://l-node-gateway:3006/api/health`)
9. `lab-gateway`: Diagnostics Lab Gateway (`http://l-node-gateway:3006/api/health`)
10. `pharmacy-backend`: CarePoint Pharmacy API (`http://p-backend:3000/health`)
11. `ipfs-service`: Kubo IPFS Bridge API (`http://h-ipfs-service:4006/health`)
12. `patient-api`: Hospital Patient API (`http://h-patient-api:4005/health`)

---

## 🗄️ Event Storage & Block Telemetry

- **`NdjsonEventStore`:** Pure-JavaScript append-only event store. Serializes concurrent writes, indexes retained records in memory, deduplicates by event ID and `(txId, eventType)`, rotates logs, and handles corruption recovery. Disposable operational cache—not the Fabric ledger or an audit log.
- **Committed Block Collector:** Reads committed blocks on `ehrchannel`, extracting block number, channel, transaction count, valid transactions, and block timestamp. Dropped intentionally: transaction arguments, chaincode payloads, and read/write sets.
- **Cryptographic ASN.1 SHA-256 Block Hashing:** Reconstructs ASN.1 block headers to verify that block $N$'s `previousHash` matches block $N-1$'s `blockHash` with mathematical precision.
- **Checkpoints:** Stored in `data/checkpoint.json` for seamless restart recovery without re-emitting events.

---

## 🧪 Automated Test Suite

Run the full Node.js test suite:
```bash
npm test
```
**Results:** **76 tests passing** with 0 failures across authentication, role matrices, Zero-PHI envelope validation, NDJSON store concurrency, collector backfill, metrics aggregation, and block cryptographic hashing.
