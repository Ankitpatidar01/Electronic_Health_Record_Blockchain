# Current system architecture

This diagram describes the repository's current local Compose wiring. It separates present services from optional or incomplete integrations. A running UI/API container is not evidence that its Fabric, IPFS, or cross-organization dependency is connected.

```mermaid
flowchart TB
  Browser["Browser"] --> Nginx["Nginx :80"]
  Nginx --> Hub["Workspace hub /"]
  Nginx --> PatientUI["Patient portal /patient/ → :5174"]
  Nginx --> DashboardUI["Dashboard /dashboard/ → :5176<br/>real-time event streaming"]
  Nginx --> LabUI["Lab console /lab/ → node-gateway :3006 host"]
  Nginx --> PharmUI["Pharmacy Portals /pharmacy/*<br/>Main :5175, Mgr :3001, Emp :3002,<br/>Inv :3003, Patient :3004, Bill :3005"]
  Browser --> HospitalUI["Hospital portal :5173"]

  HospitalUI --> P0["peer0-api :4001"]
  HospitalUI --> P1["peer1-api :4002"]
  HospitalUI --> P2["peer2-api :4003"]
  PatientUI --> PatientAPI["patient-api :4005"]
  LabUI --> LabGateway["Lab gateway :3006 host"]
  PharmUI --> PharmAPI["p-backend :3000"]

  P0 --> Fabric["Fabric channel ehrchannel"]
  P1 --> Fabric
  P2 --> Fabric
  PatientAPI --> Fabric
  ExtOrg["extorg-api :4004"] --> ExternalOrgs["DiagnosticsMSP / ProviderMSP"]
  ExternalOrgs --> Fabric
  IPFSService["ipfs-service :4006"] --> Kubo[("IPFS Kubo :5001 / :8090")]
  PharmAPI --> Kubo
  PharmAPI <--> PharmStore[("Pharmacy Persistent Store<br/>store.js & JSON state")]

  Fabric -. "committed block metadata, when observer identity is configured" .-> Collector["Dashboard collector"]
  Health["HTTP health checks"] --> Collector
  Producers["Other event producers"] -. "not connected by default" .-> Ingest["POST /internal/events"]
  Collector --> Store["NDJSON event cache"]
  Ingest --> Store
  Store --> Aggregation["REST aggregation / traces"]
  Store --> Realtime["WebSocket / SSE"]
  Aggregation --> DashboardUI
  Realtime --> DashboardUI

  PharmAPI -. "ehrchannel chaincode / resilient store fallback" .-> Fabric
  Digilocker["Digilocker proposal; no runnable module"] -.-> Browser
```

## Request and event paths

1. The browser opens the single-entry hub or a portal. Nginx routes `/patient/`, `/dashboard/`, `/pharmacy/…`, and `/lab/`. The hospital staff Vite server is also directly available at port `5173`.
2. Hospital portal APIs route to peer0, peer1, peer2, extorg, patient, and IPFS services on ports `4001`–`4006`.
3. Fabric peers share the configured `ehrchannel`; current organization IDs are `HospitalMSP`, `DiagnosticsMSP`, and `ProviderMSP`. The root startup script starts existing Fabric services, checks chaincode readiness, and brings up microservices in sequence.
4. The dashboard observes committed Fabric blocks and configured HTTP health endpoints. Its event cache is local NDJSON. Other services send events to `/internal/events` using the service key; that route is protected behind the API layer.
5. The dashboard API supplies role-filtered REST results, 5 clinical agent views, real-time threshold alerts, and WebSocket/SSE events. It does not write to Fabric. Mock events are synthetic, explicitly marked, and separate from real-source status.
6. The pharmacy organization includes 6 active frontend portals (Main `:5175`, Manager `:3001`, Employee `:3002`, Inventory `:3003`, Patient `:3004`, Billing `:3005`) connected to `p-backend:3000`. The backend integrates with Kubo IPFS for prescription receipts and uses a persistent storage engine (`store.js`) with automatic stock deduction and resilient Fabric fallback.

## Trust and data boundaries

- Portal theme state is presentation preference only; authorization is server-side.
- Dashboard event envelopes reject raw patient identifiers, names, clinical values, and AI narrative. Non-admin event views omit `patientIdHash`.
- Dashboard role authorization is defined in `dashboard-api/config/authorization.json`, with default deny.
- The NDJSON store is operational telemetry, not the authoritative audit ledger and not tamper-evident.
- Digilocker, production FHIR/ABDM conformance, and legal certification are not delivered by this repository state.
