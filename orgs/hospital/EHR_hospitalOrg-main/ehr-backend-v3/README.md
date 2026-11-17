# Hospital Backend Services & Microservices

This folder contains the hospital-facing Fabric API gateways, IPFS bridge, and the Group 1 Observatory Dashboard API. In the unified consortium workspace, these services run as containerized Docker microservices managed by the root `./start.sh` launcher.

---

## 🚀 Services & Port Mapping

| Service | Container Name | Host Port | Ingress Route | Main Responsibility |
|:---|:---|:---:|:---|:---|
| `peer0-api` | `h-peer0-api` | `4001` | `/api/hospital/peer0/` | Reception/admin workflows and staff authentication. |
| `peer1-api` | `h-peer1-api` | `4002` | `/api/hospital/peer1/` | Doctor consultations and clinical notes. |
| `peer2-api` | `h-peer2-api` | `4003` | `/api/hospital/peer2/` | Nurse vitals, inpatient medication administration, and medical records. |
| `extorg-api` | `h-extorg-api` | `4004` | `/api/hospital/extorg/` | Provider and diagnostics cross-organization routes. |
| `patient-api` | `h-patient-api` | `4005` | `/api/hospital/patient/` | Patient self-service portal API. |
| `ipfs-service` | `h-ipfs-service` | `4006` | `/api/hospital/ipfs/` | Authenticated Kubo IPFS bridge API. |
| `dashboard-api` | `h-dashboard-api` | `4010` | `/api/dashboard/` | Real-time event pipeline, committed-block collector, 12/12 node telemetry, and WebSocket/SSE streams. |

Requests originating from client browsers flow through the Nginx reverse proxy on Port 80, eliminating CORS issues.

---

## 🔗 Fabric & Data Synchronization

The hospital APIs connect to Hyperledger Fabric peers using the channel `ehrchannel` and the `HospitalMSP` identity profile. The root `./start.sh` script starts existing Fabric services, checks peer readiness, and launches these microservices in sequential order.

- **Smart Contracts:** Interacts with the 8 smart contracts exported from `ehr-chaincode-v3`: `PatientContract`, `VisitContract`, `ClinicalContract`, `ForwardContract`, `LabContract`, `ClaimsContract`, `EhrContract`, and `AccessContract`.
- **IPFS Bridge:** Provides endpoints (`POST /pin`, `GET /fetch/:cid`, `POST /upload`) for off-chain storage of encrypted medical files.
- **Dashboard Telemetry:** The `dashboard-api` reads committed blocks from `peer0.hospital` and polls health endpoints across the entire consortium.

---

## 🏃 Running the Backend Services

From the repository root:
```bash
./start.sh
```

To run an individual service standalone for debugging:
```bash
cd peer0-api  # Or any other service directory
npm install
npm start
```
