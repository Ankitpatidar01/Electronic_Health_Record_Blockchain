# EHR Blockchain Workspace — File Search Root & Project Structure Index

> **File Purpose:** Comprehensive inventory and search root for all sub-projects in the EHR Blockchain workspace, explicitly highlighting every **Frontend and Frontend-related file** and every **Dashboard file** across the entire multi-organization codebase.

---

## Table of Contents
1. [Architectural Overview](#1-architectural-overview)
2. [Classification Legend](#2-classification-legend)
3. [Project Folder Structures with Frontend & Dashboard Highlights](#3-project-folder-structures-with-frontend--dashboard-highlights)
   - [Project 1: Central Workspace Hub & Reverse Proxy (`nginx/`)](#project-1-central-workspace-hub--reverse-proxy-nginx)
   - [Project 2: Hospital Organization (`orgs/hospital/EHR_hospitalOrg-main/`)](#project-2-hospital-organization-orgshospitalehr_hospitalorg-main)
     - [2.1 Hospital Staff Clinical Portal (`hospital-portal`)](#21-hospital-staff-clinical-portal-hospital-portal)
     - [2.2 Patient Health Portal (`patient-portal`)](#22-patient-health-portal-patient-portal)
     - [2.3 System Observability & Blockchain Dashboard (`dashboard-portal`)](#23-system-observability--blockchain-dashboard-dashboard-portal)
     - [2.4 Hospital Backend Microservices (`ehr-backend-v3`)](#24-hospital-backend-microservices-ehr-backend-v3)
     - [2.5 Hospital Hyperledger Fabric Network & Chaincodes](#25-hospital-hyperledger-fabric-network--chaincodes)
   - [Project 3: Pharmacy Organization (`orgs/pharmacy/fabric-network-swarm/`)](#project-3-pharmacy-organization-orgspharmacyfabric-network-swarm)
     - [3.1 Pharmacy Main Records Portal (`app/frontend`)](#31-pharmacy-main-records-portal-appfrontend)
     - [3.2 Pharmacy Manager Dashboard (`app/manager`)](#32-pharmacy-manager-dashboard-appmanager)
     - [3.3 Pharmacy Employee / POS Dispensing Portal (`app/employee`)](#33-pharmacy-employee--pos-dispensing-portal-appemployee)
     - [3.4 Pharmacy Inventory Management Portal (`app/inventory`)](#34-pharmacy-inventory-management-portal-appinventory)
     - [3.5 Pharmacy Billing & Invoicing Portal (`app/billing`)](#35-pharmacy-billing--invoicing-portal-appbilling)
     - [3.6 Pharmacy Patient Status Portal (`app/patient`)](#36-pharmacy-patient-status-portal-apppatient)
     - [3.7 Pharmacy Backend API & Swarm Cluster Infrastructure](#37-pharmacy-backend-api--swarm-cluster-infrastructure)
   - [Project 4: Laboratory Organization (`orgs/lab/EHR-LABORG-main/`)](#project-4-laboratory-organization-orgslabehr-laborg-main)
     - [4.1 Laboratory Results Control Deck & Gateway (`client/node-gateway`)](#41-laboratory-results-control-deck--gateway-clientnode-gateway)
     - [4.2 Laboratory Fabric Network, Docker & Chaincode Assets](#42-laboratory-fabric-network-docker--chaincode-assets)
   - [Project 5: Digital Locker Integration (`orgs/digilocker/`)](#project-5-digital-locker-integration-orgsdigilocker)
   - [Project 6: Root Infrastructure & Orchestration](#project-6-root-infrastructure--orchestration)
4. [Master Catalog: Every Dashboard in the Complete Project](#4-master-catalog-every-dashboard-in-the-complete-project)
5. [Frontend Technology & Framework Matrix](#5-frontend-technology--framework-matrix)

---

## 1. Architectural Overview

The EHR Blockchain workspace is a distributed, multi-organization healthcare network composed of Hyperledger Fabric channels, Kubo IPFS storage, Express gateway APIs, and specialized React/Vite and vanilla web user interfaces:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   REVERSE PROXY & WORKSPACE HUB (:80)                                  │
│                                           nginx/hub/index.html                                         │
└────────────────┬───────────────────────┬───────────────────────────────┬───────────────────────────────┘
                 │                       │                               │
┌────────────────▼──────────────┐ ┌──────▼───────────────────────┐ ┌─────▼───────────────────────────────┐
│     HOSPITAL ORGANIZATION     │ │    PHARMACY ORGANIZATION     │ │     LABORATORY ORGANIZATION     │
│   (HospitalMSP / ehrchannel)  │ │   (PharmacyMSP / Swarm)     │ │        (LabMSP / ehrchannel)         │
├───────────────────────────────┤ ├──────────────────────────────┤ ├─────────────────────────────────────┤
│ Frontends (ehr-frontend-v2):  │ │ Frontends (app/*):           │ │ Frontends (client/node-gateway):    │
│ • Hospital Staff Portal :5173 │ │ • Main Records Portal :5175  │ │ • Lab Results Control Deck :8080    │
│ • Patient Health Portal :5174 │ │ • Manager Dashboard   :3001  │ │                                     │
│ • Dashboard Portal      :5176 │ │ • Employee / POS UI   :3002  │ │ Backend Services:                   │
│                               │ │ • Inventory Portal    :3003  │ │ • Express Gateway Server :8080/3006 │
│ Backend APIs (ehr-backend-v3):│ │ • Billing Portal      :3005  │ │ • Lab AI Diagnostic Agent           │
│ • peer0-api (Admin/Auth) :4001│ │ • Patient Status UI   :3004  │ │ • Fabric Lab Gateway                │
│ • peer1-api (Doctor)     :4002│ │                              │ └─────────────────────────────────────┘
│ • peer2-api (Nurse/Rx)   :4003│ │ Backend Services:            │
│ • extorg-api (Diag)      :4004│ │ • Pharmacy API (app/backend) │
│ • patient-api (OCR/Data) :4005│ │   running on port :3000      │
│ • ipfs-service (Bridge)  :4006│ └──────────────────────────────┘
│ • dashboard-api (Obsv)   :4010│
└───────────────────────────────┘
```

---

## 2. Classification Legend

Throughout this document, files are classified with tags:
* 🎯 **`[DASHBOARD FILE]`**: An interactive screen, control panel, monitoring console, or telemetry deck designed to display KPIs, data tables, queues, or charts.
* 🌐 **`[FRONTEND FILE]`**: User interface file, client-side code, markup, stylesheets, assets, contexts, hooks, utilities, or build configurations.
* ⚙️ **`[BACKEND / INFRA]`**: Server-side logic, Express routes, Fabric chaincode, shell scripts, or Docker compose configs.

---

## 3. Project Folder Structures with Frontend & Dashboard Highlights

### Project 1: Central Workspace Hub & Reverse Proxy (`nginx/`)
The primary system entrypoint. It provides unified Nginx reverse routing and serves a live workspace launchpad dashboard on port 80.

```text
nginx/
├── ⚙️ [BACKEND / INFRA] nginx.conf                Reverse proxy configuration for all portals & APIs
└── hub/
    ├── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] index.html  CareGrid Workspace Hub & Service Status Dashboard
    ├── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] hub.js      Client-side asynchronous health probe controller
    └── 🌐 [FRONTEND FILE] hub.css                         Hub UI typography, responsive layout & theme rules
```

**Key Frontend & Dashboard Files:**
- [nginx/hub/index.html](file:///home/himanshu/Desktop/EHR_blockchain/nginx/hub/index.html) — Unified workspace launchpad with live reachability badges for all 10+ services.
- [nginx/hub/hub.js](file:///home/himanshu/Desktop/EHR_blockchain/nginx/hub/hub.js) — Asynchronous fetch loop polling service endpoints.
- [nginx/hub/hub.css](file:///home/himanshu/Desktop/EHR_blockchain/nginx/hub/hub.css) — Modern glassmorphism UI styles for the hub.

---

### Project 2: Hospital Organization (`orgs/hospital/EHR_hospitalOrg-main/`)
The core clinical system featuring three dedicated React/Vite frontends in `ehr-frontend-v2/` and seven backend microservices in `ehr-backend-v3/`.

#### 2.1 Hospital Staff Clinical Portal (`hospital-portal`)
*Role-based clinical, triage, administrative, and pharmacy dispensing dashboard running on host port `5173`.*

```text
orgs/hospital/EHR_hospitalOrg-main/ehr-frontend-v2/hospital-portal/
├── 🌐 [FRONTEND FILE] index.html                  Application root HTML
├── 🌐 [FRONTEND FILE] package.json                React 19, React Router 7, Lucide-React, TailwindCSS
├── 🌐 [FRONTEND FILE] vite.config.js              Vite dev/build configuration (port 5173, API proxying)
├── 🌐 [FRONTEND FILE] tailwind.config.js          Tailwind utility classes and theme extensions
├── 🌐 [FRONTEND FILE] postcss.config.js           PostCSS configuration
├── 🌐 [FRONTEND FILE] Dockerfile                  Docker containerization manifest
└── src/
    ├── 🌐 [FRONTEND FILE] main.jsx                Router configuration & role-based route guard
    ├── 🌐 [FRONTEND FILE] index.css               Global CSS styling and Tailwind directives
    ├── context/
    │   └── 🌐 [FRONTEND FILE] AuthContext.jsx     Authentication context, JWT persistence & role state
    ├── utils/
    │   └── 🌐 [FRONTEND FILE] api.js              Axios HTTP client with Bearer token interceptor
    ├── components/
    │   ├── 🌐 [FRONTEND FILE] ThemeToggle.jsx     Light/Dark theme toggle button
    │   ├── layout/
    │   │   └── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] Layout.jsx  Sidebar navigation customized dynamically per role
    │   └── ui/
    │       └── 🌐 [FRONTEND FILE] index.jsx       UI kit: Card, Button, Badge, Modal, FormInput, StatCard
    └── pages/
        ├── 🌐 [FRONTEND FILE] Login.jsx           Hospital staff credential authentication view
        ├── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] DoctorVisits.jsx       Doctor Clinical Dashboard (consultation queue, vitals, Rx, lab orders)
        ├── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] NurseVisits.jsx        Nurse Triage Dashboard (intake queue, recording vitals)
        ├── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] Patients.jsx           Patient Census Dashboard (registration, search, demographic cards)
        ├── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] Visits.jsx             Hospital Visits Encounter Management Dashboard
        ├── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] OpenVisit.jsx          Consultation Intake & Visit Initiation Dashboard
        ├── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] PharmacistRecords.jsx  Dual-role Dashboard:
        │                                                                 ├── PharmacistPage: Hospital Dispensing & Prescription Fulfillment
        │                                                                 └── MedRecordsPage: Medical Records Officer Final Record Sign-Off
        └── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] Staff.jsx              Admin Clinical Personnel Credential & Staff Roster Dashboard
```

#### 2.2 Patient Health Portal (`patient-portal`)
*Patient-facing health dashboard, records vault, and consent controller running on host port `5174` (or `/patient/`).*

```text
orgs/hospital/EHR_hospitalOrg-main/ehr-frontend-v2/patient-portal/
├── 🌐 [FRONTEND FILE] index.html                  Application root HTML
├── 🌐 [FRONTEND FILE] package.json                React 19, React Router 7, Lucide, Tailwind, jsPDF, html2canvas
├── 🌐 [FRONTEND FILE] vite.config.js              Vite build config with proxy to patient-api (:4005)
├── 🌐 [FRONTEND FILE] tailwind.config.js          Tailwind configuration
├── 🌐 [FRONTEND FILE] postcss.config.js           PostCSS configuration
├── 🌐 [FRONTEND FILE] Dockerfile                  Docker container manifest
└── src/
    ├── 🌐 [FRONTEND FILE] main.jsx                Router configuration and authentication gateway
    ├── 🌐 [FRONTEND FILE] index.css               Global CSS styles
    ├── context/
    │   └── 🌐 [FRONTEND FILE] AuthContext.jsx     Patient session, credential & token store
    ├── utils/
    │   ├── 🌐 [FRONTEND FILE] api.js              API communication helpers with patient-api (:4005)
    │   └── 🌐 [FRONTEND FILE] pdfGenerator.js     Client-side medical report PDF generator
    ├── components/
    │   ├── 🌐 [FRONTEND FILE] ThemeToggle.jsx     Dark / light mode toggle
    │   ├── layout/
    │   │   └── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] Layout.jsx  App Shell with topbar and bottom tab bar
    │   └── ui/
    │       └── 🌐 [FRONTEND FILE] index.jsx       Reusable Card, Spinner, VisitStatusBadge, SectionTitle
    └── pages/
        ├── 🌐 [FRONTEND FILE] Login.jsx           Patient credential login screen
        ├── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] Overview.jsx    Comprehensive Patient Health Dashboard (active visits, vitals, allergies, conditions)
        ├── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] Visits.jsx      Dual Dashboard Views:
        │                                                          ├── VisitsListPage: Chronological medical encounters timeline
        │                                                          └── VisitDetailPage: Deep clinical report, prescriptions & lab results
        ├── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] EHRAccess.jsx   Triple Management Dashboards:
        │                                                          ├── EHRPage: Comprehensive medical record repository
        │                                                          ├── AccessPage: Consent & data-sharing access control audit log
        │                                                          └── SignaturesPage: Blockchain cryptographic signature verification
        └── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] Profile.jsx     Patient Demographics, ABHA ID & Emergency Contacts
```

#### 2.3 System Observability & Blockchain Dashboard (`dashboard-portal`)
*System-wide operations and blockchain telemetry center running on host port `5176` (or `/dashboard/`).*

```text
orgs/hospital/EHR_hospitalOrg-main/ehr-frontend-v2/dashboard-portal/
├── 🌐 [FRONTEND FILE] index.html                  Application entry point
├── 🌐 [FRONTEND FILE] package.json                React 19, Recharts 3, Lucide-React, TailwindCSS
├── 🌐 [FRONTEND FILE] vite.config.js              Vite configuration for port 5176 with base `/dashboard/`
├── 🌐 [FRONTEND FILE] tailwind.config.js          Tailwind theme configuration
├── 🌐 [FRONTEND FILE] postcss.config.js           PostCSS configuration
├── 🌐 [FRONTEND FILE] .oxlintrc.json              Linter configuration
├── public/
│   ├── 🌐 [FRONTEND FILE] favicon.svg             Dashboard favicon asset
│   └── 🌐 [FRONTEND FILE] icons.svg               Dashboard SVG icon sprite sheet
└── src/
    ├── 🌐 [FRONTEND FILE] main.jsx                React entry root
    ├── 🌐 [FRONTEND FILE] App.jsx                 Application router, role-based guard & authentication shell
    ├── 🌐 [FRONTEND FILE] App.css                 Component-level CSS rules
    ├── 🌐 [FRONTEND FILE] index.css               Global CSS styling and animation definitions
    ├── assets/
    │   ├── 🌐 [FRONTEND FILE] hero.png            Graphic hero banner
    │   ├── 🌐 [FRONTEND FILE] react.svg           React logo SVG
    │   └── 🌐 [FRONTEND FILE] vite.svg            Vite logo SVG
    ├── config/
    │   ├── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] agentConfig.js  Multi-agent registry, endpoint & capability definitions
    │   └── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] roleViews.js    Zero-PHI role-based access matrix configuration
    ├── hooks/
    │   └── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] useDashboardSocket.js Real-time WebSocket hook (`/api/dashboard/ws`) for live blocks & events
    ├── services/
    │   └── 🌐 [FRONTEND FILE] api.js              API service client, JWT auth handlers, and mock fallbacks
    ├── components/
    │   ├── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] AgentCard.jsx       AI Agent status, metric, and trigger card
    │   ├── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] AgentDashboard.jsx  Deep-dive execution & performance dashboard for a single AI agent
    │   ├── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] AgentTrace.jsx      10-stage end-to-end execution pipeline tracer
    │   ├── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] MetricCard.jsx      Telemetry metric card (KPIs, rates, health)
    │   ├── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] DataTable.jsx       Paginated, searchable event & transaction table
    │   ├── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] DataView.jsx        Unified data loader, error wrapper & polling state
    │   ├── 🌐 [FRONTEND FILE] EmptyState.jsx      Empty query display component
    │   ├── 🌐 [FRONTEND FILE] ErrorState.jsx      Error display & retry button component
    │   ├── 🌐 [FRONTEND FILE] LoadingSkeleton.jsx Skeleton placeholder loader
    │   ├── 🌐 [FRONTEND FILE] SeverityPill.jsx    Log severity badge (INFO, WARN, ERROR, CRITICAL)
    │   ├── 🌐 [FRONTEND FILE] StatusBadge.jsx     Node & agent status badge (ONLINE, BUSY, IDLE, OFFLINE)
    │   ├── 🌐 [FRONTEND FILE] ThemeToggle.jsx     Theme switcher
    │   └── layout/
    │       └── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] Layout.jsx      Master Operations Header, Sidebar, and Live Block Counter
    └── pages/
        ├── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] Overview.jsx        Master System Observability & Blockchain Explorer Dashboard
        ├── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] Network.jsx         Fabric Network Topology & Peer Node Health Dashboard
        ├── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] Agents.jsx          Fleet Overview Dashboard for Autonomous Clinical AI Agents
        ├── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] Transactions.jsx    Blockchain Transaction Log & Ingestion Metrics Dashboard
        ├── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] Security.jsx        Security Incidents, Zero-PHI Compliance & Audit Dashboard
        ├── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] IPFS.jsx            IPFS Distributed Storage & CID Pinning Dashboard
        └── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] Logs.jsx            Real-Time System Event Log Stream Dashboard
```

#### 2.4 Hospital Backend Microservices (`ehr-backend-v3`)
*Server-side Node.js/Express APIs powering the Hospital Organization.*

```text
orgs/hospital/EHR_hospitalOrg-main/ehr-backend-v3/
├── ⚙️ [BACKEND / INFRA] peer0-api/         Port 4001: Reception, Staff Auth & Admin API
├── ⚙️ [BACKEND / INFRA] peer1-api/         Port 4002: Doctor consultation API
├── ⚙️ [BACKEND / INFRA] peer2-api/         Port 4003: Nurse vitals & Pharmacist record API
├── ⚙️ [BACKEND / INFRA] extorg-api/        Port 4004: Diagnostics & External Provider API
├── ⚙️ [BACKEND / INFRA] patient-api/       Port 4005: Patient Portal API & Tesseract OCR engine
├── ⚙️ [BACKEND / INFRA] ipfs-service/      Port 4006: IPFS Kubo gateway & encryption bridge
├── ⚙️ [BACKEND / INFRA] dashboard-api/     Port 4010: Event collector, WebSocket & metrics API
│   ├── src/
│   │   ├── app.js                          Express server and WebSocket server mount
│   │   ├── collector/                      Fabric block committed event observer
│   │   ├── store/                          Append-only NDJSON event cache & index
│   │   └── routes/                         /api/dashboard REST, WebSocket and SSE endpoints
└── ⚙️ [BACKEND / INFRA] shared/            Shared Fabric connection & crypto utilities
```

#### 2.5 Hospital Hyperledger Fabric Network & Chaincodes
```text
orgs/hospital/EHR_hospitalOrg-main/
├── ⚙️ [BACKEND / INFRA] ehr-network/       Fabric scripts, crypto-config, docker-compose, and configtx
└── ⚙️ [BACKEND / INFRA] ehr-chaincode-v3/  Node.js smart contracts: Patients, Visits, Medical Records,
                                            Prescriptions, Consents, Lab Results, Audit, Diagnostics
```

---

### Project 3: Pharmacy Organization (`orgs/pharmacy/fabric-network-swarm/`)
The pharmacy consortium features **six specialized frontend applications** under `app/`.

#### 3.1 Pharmacy Main Records Portal (`app/frontend`)
*Consortium inventory and prescription ledger portal running on host port `5175`.*

```text
orgs/pharmacy/fabric-network-swarm/app/frontend/
├── 🌐 [FRONTEND FILE] index.html                  Main entry HTML
├── 🌐 [FRONTEND FILE] package.json                React 19, Lucide-React, Framer Motion
├── 🌐 [FRONTEND FILE] vite.config.js              Vite configuration for port 5175
├── 🌐 [FRONTEND FILE] eslint.config.js            ESLint configuration
├── 🌐 [FRONTEND FILE] Dockerfile                  Docker container definition
├── public/
│   ├── 🌐 [FRONTEND FILE] favicon.svg             Pharmacy icon
│   └── 🌐 [FRONTEND FILE] icons.svg               Icon set
└── src/
    ├── 🌐 [FRONTEND FILE] main.jsx                Root renderer
    ├── 🌐 [FRONTEND FILE] App.jsx                 Application shell with Fabric/IPFS network monitor
    ├── 🌐 [FRONTEND FILE] App.css                 Layout styling
    ├── 🌐 [FRONTEND FILE] index.css               Theme CSS
    ├── 🌐 [FRONTEND FILE] config.js               API base URL & IPFS gateway URL settings
    ├── 🌐 [FRONTEND FILE] ThemeToggle.jsx         Theme toggle widget
    ├── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] Dashboard.jsx      MedBlock Pharmacy Records & Inventory Dashboard
    └── 🌐 [FRONTEND FILE] CreateRecord.jsx        Prescription dispensing & ledger record creation form
```

#### 3.2 Pharmacy Manager Dashboard (`app/manager`)
*Executive pharmacy operations dashboard running on host port `3001` (`/pharmacy/manager/`).*

```text
orgs/pharmacy/fabric-network-swarm/app/manager/
├── 🌐 [FRONTEND FILE] index.html                  Entry HTML
├── 🌐 [FRONTEND FILE] package.json                React 18, Vite, Framer Motion, Lucide-React
├── 🌐 [FRONTEND FILE] vite.config.js              Vite configuration for port 3001
├── 🌐 [FRONTEND FILE] Dockerfile                  Container file
└── src/
    ├── 🌐 [FRONTEND FILE] main.jsx                App mount point
    ├── 🌐 [FRONTEND FILE] styles.css              Manager dashboard UI styling
    ├── 🌐 [FRONTEND FILE] ThemeToggle.jsx         Theme controller
    └── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] App.jsx  Complete Pharmacy Manager Dashboard with 4 Views:
                                                        ├── 'pulse': Fabric Nodes & IPFS Cluster Health
                                                        ├── 'employees': Staff Credentials & Personnel Roster
                                                        ├── 'audit': Financial & Dispensing Audit Log Trail
                                                        └── 'inventory': Real-time Stock Levels & Shortage Warnings
```

#### 3.3 Pharmacy Employee / POS Dispensing Portal (`app/employee`)
*Pharmacist point-of-sale and prescription fulfillment portal running on host port `3002` (`/pharmacy/employee/`).*

```text
orgs/pharmacy/fabric-network-swarm/app/employee/
├── 🌐 [FRONTEND FILE] index.html                  Entry HTML
├── 🌐 [FRONTEND FILE] package.json                React 18, Vite, Lucide-React, Framer Motion
├── 🌐 [FRONTEND FILE] vite.config.js              Vite configuration for port 3002
├── 🌐 [FRONTEND FILE] Dockerfile                  Container definition
└── src/
    ├── 🌐 [FRONTEND FILE] main.jsx                App entry point
    ├── 🌐 [FRONTEND FILE] styles.css              POS terminal styles
    ├── 🌐 [FRONTEND FILE] ThemeToggle.jsx         Dark mode toggle
    └── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] App.jsx  Pharmacist POS & Dispensing Dashboard:
                                                        ├── Staff Identity Switcher / Login
                                                        ├── Patient Lookup & Active Prescription Fetching
                                                        └── Dispensing Reconciliation & Blockchain Settlement
```

#### 3.4 Pharmacy Inventory Management Portal (`app/inventory`)
*Pharmacy warehouse and stock control console running on host port `3003` (`/pharmacy/inventory/`).*

```text
orgs/pharmacy/fabric-network-swarm/app/inventory/
├── 🌐 [FRONTEND FILE] index.html                  Entry HTML
├── 🌐 [FRONTEND FILE] package.json                React 18, Vite, Lucide-React, Framer Motion
├── 🌐 [FRONTEND FILE] vite.config.js              Vite configuration for port 3003
├── 🌐 [FRONTEND FILE] Dockerfile                  Container definition
└── src/
    ├── 🌐 [FRONTEND FILE] main.jsx                Root bootstrap
    ├── 🌐 [FRONTEND FILE] styles.css              Inventory UI stylesheet
    ├── 🌐 [FRONTEND FILE] ThemeToggle.jsx         Theme toggle component
    └── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] App.jsx  Pharmacy Stock & Batch Inventory Dashboard:
                                                        ├── Real-time Drug Inventory Table & Quantity Counters
                                                        ├── Low-Stock Alert Warning Indicators
                                                        └── Add Stock Batch & Ledger Adjustment Modal
```

#### 3.5 Pharmacy Billing & Invoicing Portal (`app/billing`)
*Prescription billing and insurance payment portal running on host port `3005` (`/pharmacy/billing/`).*

```text
orgs/pharmacy/fabric-network-swarm/app/billing/
├── 🌐 [FRONTEND FILE] index.html                  Entry HTML
├── 🌐 [FRONTEND FILE] package.json                React 18, Vite, Lucide-React, Framer Motion
├── 🌐 [FRONTEND FILE] vite.config.js              Vite configuration for port 3005
├── 🌐 [FRONTEND FILE] Dockerfile                  Container definition
└── src/
    ├── 🌐 [FRONTEND FILE] main.jsx                App mount point
    ├── 🌐 [FRONTEND FILE] styles.css              Financial billing stylesheet
    ├── 🌐 [FRONTEND FILE] ThemeToggle.jsx         Theme switch
    └── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] App.jsx  Pharmacy Billing & Prescription Invoicing Dashboard:
                                                        ├── Standard Clinical Templates (Post-Op, Chronic Care, Emergency)
                                                        ├── Dynamic Prescription Itemization & Subtotal Calculation
                                                        └── Invoice Generation & Ledger Bill Dispatching
```

#### 3.6 Pharmacy Patient Status Portal (`app/patient`)
*Read-only status portal for pharmacy customers running on host port `3004` (`/pharmacy/patient/`).*

```text
orgs/pharmacy/fabric-network-swarm/app/patient/
├── 🌐 [FRONTEND FILE] index.html                  Entry HTML
├── 🌐 [FRONTEND FILE] package.json                React 19, Lucide-React
├── 🌐 [FRONTEND FILE] vite.config.js              Vite configuration for port 3004
├── 🌐 [FRONTEND FILE] Dockerfile                  Container definition
└── src/
    ├── 🌐 [FRONTEND FILE] main.jsx                App mount point
    ├── 🌐 [FRONTEND FILE] styles.css              Patient care card stylesheet
    ├── 🌐 [FRONTEND FILE] ThemeToggle.jsx         Theme switch
    └── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] App.jsx  Patient Pharmacy Health Status & Privacy Deck
```

#### 3.7 Pharmacy Backend API & Swarm Cluster Infrastructure
```text
orgs/pharmacy/fabric-network-swarm/
├── ⚙️ [BACKEND / INFRA] app/backend/app.js        Pharmacy Express API (Port 3000)
├── ⚙️ [BACKEND / INFRA] deploy.sh                 Docker Swarm multi-machine deployment script
├── ⚙️ [BACKEND / INFRA] configtx.yaml             Pharmacy Fabric channel configuration
└── ⚙️ [BACKEND / INFRA] crypto-config.yaml        Pharmacy cryptographic identity setup
```

---

### Project 4: Laboratory Organization (`orgs/lab/EHR-LABORG-main/`)
The diagnostic laboratory system providing diagnostic OCR, AI analysis, and blockchain test verification.

#### 4.1 Laboratory Results Control Deck & Gateway (`client/node-gateway`)
*Lab management deck and diagnostic testing gateway running on port `8080` (or `3006` host via Nginx `/lab/`).*

```text
orgs/lab/EHR-LABORG-main/client/node-gateway/
├── ⚙️ [BACKEND / INFRA] server.js                 Express gateway serving static frontend & REST API
├── ⚙️ [BACKEND / INFRA] gateway.js                Hyperledger Fabric LabMSP gateway connection
├── ⚙️ [BACKEND / INFRA] ipfs.js                   IPFS diagnostic report storage & hashing
├── ⚙️ [BACKEND / INFRA] ai-agent.js               Lab AI diagnostic agent integration
├── ⚙️ [BACKEND / INFRA] report-extractor.js       Diagnostic PDF & OCR parsing
├── ⚙️ [BACKEND / INFRA] package.json              Node gateway dependencies
├── ⚙️ [BACKEND / INFRA] Dockerfile                Docker container setup
└── public/                                        
    ├── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] index.html  Lab Results Control Deck Dashboard (form, stats, table)
    ├── 🎯 [DASHBOARD FILE] 🌐 [FRONTEND FILE] app.js      Client dashboard controller (DOM rendering, ledger query, record submission)
    ├── 🌐 [FRONTEND FILE] styles.css                      High-contrast modern control deck styling
    └── 🌐 [FRONTEND FILE] theme.js                        LocalStorage-backed theme synchronization
```

#### 4.2 Laboratory Fabric Network, Docker & Chaincode Assets
```text
orgs/lab/EHR-LABORG-main/
├── ⚙️ [BACKEND / INFRA] chaincode/lab-results/    Smart contract for laboratory diagnostic records
├── ⚙️ [BACKEND / INFRA] docker/                   Multi-machine docker-compose files
├── ⚙️ [BACKEND / INFRA] explorer/                 Hyperledger Explorer configuration
├── ⚙️ [BACKEND / INFRA] organizations/            LabMSP cryptographic material
└── ⚙️ [BACKEND / INFRA] scripts/                  Network startup and channel join scripts
```

---

### Project 5: Digital Locker Integration (`orgs/digilocker/`)
Architectural specification for external ABDM Digital Locker document anchoring.

```text
orgs/digilocker/
├── ⚙️ [BACKEND / INFRA] README.md                 DigiLocker architecture specification & proposal
├── 🌐 [FRONTEND FILE] frontend/                   Directory placeholder for future citizen locker frontend
├── ⚙️ [BACKEND / INFRA] backend/                  Directory placeholder for future DigiLocker gateway
└── ⚙️ [BACKEND / INFRA] chaincode/                Directory placeholder for future smart contracts
```

---

### Project 6: Root Infrastructure & Orchestration
Root files responsible for coordinating the multi-organization setup.

```text
.
├── ⚙️ [BACKEND / INFRA] docker-compose.yaml       Orchestrates all 14 containers across Hospital, Pharmacy & Lab
├── ⚙️ [BACKEND / INFRA] start.sh                  Recommended automated container startup script
├── ⚙️ [BACKEND / INFRA] stop.sh                   Graceful container and network shutdown script
├── ⚙️ [BACKEND / INFRA] start-sequential.sh       Legacy direct host process runner
├── ⚙️ [BACKEND / INFRA] setup.sh                  Prerequisites check and dependency installation
├── ⚙️ [BACKEND / INFRA] bin/                      Fabric 2.5 platform binaries (peer, orderer, configtxgen)
├── ⚙️ [BACKEND / INFRA] config/                   Fabric configtx.yaml, orderer.yaml, core.yaml
├── ⚙️ [BACKEND / INFRA] builders/                 Chaincode-as-a-service binary wrappers
├── ⚙️ [BACKEND / INFRA] docs/                     Architecture documents, audit reports, and novelty proposals
└── ⚙️ [BACKEND / INFRA] logs/                     Runtime log directory for background processes
```

---

## 4. Master Catalog: Every Dashboard in the Complete Project

| # | System / Org | Dashboard Name | Primary File(s) | Role / Persona | Host Port / Route | Description & Features |
|---|---|---|---|---|---|---|
| **1** | **Gateway Hub** | **Workspace Launchpad** | [nginx/hub/index.html](file:///home/himanshu/Desktop/EHR_blockchain/nginx/hub/index.html)<br>[nginx/hub/hub.js](file:///home/himanshu/Desktop/EHR_blockchain/nginx/hub/hub.js) | Public / Staff | `http://localhost/` (:80) | Live service reachability probes, real-time latency checks, and navigation cards to all portals. |
| **2** | **Hospital** | **Doctor Clinical Dashboard** | [DoctorVisits.jsx](file:///home/himanshu/Desktop/EHR_blockchain/orgs/hospital/EHR_hospitalOrg-main/ehr-frontend-v2/hospital-portal/src/pages/DoctorVisits.jsx) | `doctor` | `/my-visits` (:5173) | Assigned patient queue, clinical history review, vitals observation, diagnosis logging, drug prescription, and lab test ordering. |
| **3** | **Hospital** | **Nurse Triage Dashboard** | [NurseVisits.jsx](file:///home/himanshu/Desktop/EHR_blockchain/orgs/hospital/EHR_hospitalOrg-main/ehr-frontend-v2/hospital-portal/src/pages/NurseVisits.jsx) | `nurse` | `/my-visits` (:5173) | Patient check-in triage queue, recording vital signs (blood pressure, pulse, SpO2, temp), and triage notes. |
| **4** | **Hospital** | **Patient Census Dashboard** | [Patients.jsx](file:///home/himanshu/Desktop/EHR_blockchain/orgs/hospital/EHR_hospitalOrg-main/ehr-frontend-v2/hospital-portal/src/pages/Patients.jsx) | `receptionist`, `admin` | `/patients` (:5173) | Master patient registry, ABHA/National ID search, new patient onboarding modal, demographic cards. |
| **5** | **Hospital** | **Encounter Visits Dashboard** | [Visits.jsx](file:///home/himanshu/Desktop/EHR_blockchain/orgs/hospital/EHR_hospitalOrg-main/ehr-frontend-v2/hospital-portal/src/pages/Visits.jsx) | `receptionist`, `admin` | `/visits` (:5173) | Filtering encounters by status (ADMITTED, IN_CONSULTATION, DISCHARGED) and appointment management. |
| **6** | **Hospital** | **Consultation Intake Dashboard** | [OpenVisit.jsx](file:///home/himanshu/Desktop/EHR_blockchain/orgs/hospital/EHR_hospitalOrg-main/ehr-frontend-v2/hospital-portal/src/pages/OpenVisit.jsx) | `receptionist`, `admin` | `/open-visit` (:5173) | Workflow form for doctor assignment, department selection, and encounter initiation. |
| **7** | **Hospital** | **Hospital Dispensing Dashboard** | [PharmacistRecords.jsx](file:///home/himanshu/Desktop/EHR_blockchain/orgs/hospital/EHR_hospitalOrg-main/ehr-frontend-v2/hospital-portal/src/pages/PharmacistRecords.jsx) | `pharmacist` | `/dispense` (:5173) | Prescription verification, drug dispensing fulfillment, and transaction commit to `ehrchannel`. |
| **8** | **Hospital** | **Medical Record Finalization** | [PharmacistRecords.jsx](file:///home/himanshu/Desktop/EHR_blockchain/orgs/hospital/EHR_hospitalOrg-main/ehr-frontend-v2/hospital-portal/src/pages/PharmacistRecords.jsx) | `medrecordofficer` | `/finalize` (:5173) | Final encounter review, IPFS CID hashing verification, and immutable ledger locking. |
| **9** | **Hospital** | **Staff & Credential Administration** | [Staff.jsx](file:///home/himanshu/Desktop/EHR_blockchain/orgs/hospital/EHR_hospitalOrg-main/ehr-frontend-v2/hospital-portal/src/pages/Staff.jsx) | `admin` | `/staff` (:5173) | Hospital personnel directory and role assignments (Doctor, Nurse, Pharmacist, Admin). |
| **10** | **Patient** | **Patient Health Summary Dashboard** | [Overview.jsx](file:///home/himanshu/Desktop/EHR_blockchain/orgs/hospital/EHR_hospitalOrg-main/ehr-frontend-v2/patient-portal/src/pages/Overview.jsx) | `patient` | `/overview` (:5174) | Active visit alerts, chronic condition cards, allergy warnings, vitals summary, rapid navigation. |
| **11** | **Patient** | **Visits & Encounters History** | [Visits.jsx](file:///home/himanshu/Desktop/EHR_blockchain/orgs/hospital/EHR_hospitalOrg-main/ehr-frontend-v2/patient-portal/src/pages/Visits.jsx) | `patient` | `/visits` (:5174) | Historical visits timeline, doctor consultation notes, prescribed medication, and PDF report generator. |
| **12** | **Patient** | **EHR Records, Consent & Audit** | [EHRAccess.jsx](file:///home/himanshu/Desktop/EHR_blockchain/orgs/hospital/EHR_hospitalOrg-main/ehr-frontend-v2/patient-portal/src/pages/EHRAccess.jsx) | `patient` | `/ehr`, `/access`, `/signatures` | 3 distinct views: Medical record repository, Consent grant/revoke audit log, and Cryptographic signatures viewer. |
| **13** | **Observability** | **System Observability & Explorer** | [Overview.jsx](file:///home/himanshu/Desktop/EHR_blockchain/orgs/hospital/EHR_hospitalOrg-main/ehr-frontend-v2/dashboard-portal/src/pages/Overview.jsx) | `admin` (or authorized) | `/dashboard/overview` (:5176) | Connected peers, block cards, real-time TPS chart, system health cards, hash clipboard utilities. |
| **14** | **Observability** | **Fabric Network Topology** | [Network.jsx](file:///home/himanshu/Desktop/EHR_blockchain/orgs/hospital/EHR_hospitalOrg-main/ehr-frontend-v2/dashboard-portal/src/pages/Network.jsx) | `admin` | `/dashboard/network` (:5176) | Peer node health, MSP organization badges, block heights, and network latency metrics. |
| **15** | **Observability** | **AI Agent Fleet & Trace** | [Agents.jsx](file:///home/himanshu/Desktop/EHR_blockchain/orgs/hospital/EHR_hospitalOrg-main/ehr-frontend-v2/dashboard-portal/src/pages/Agents.jsx)<br>[AgentDashboard.jsx](file:///home/himanshu/Desktop/EHR_blockchain/orgs/hospital/EHR_hospitalOrg-main/ehr-frontend-v2/dashboard-portal/src/components/AgentDashboard.jsx)<br>[AgentTrace.jsx](file:///home/himanshu/Desktop/EHR_blockchain/orgs/hospital/EHR_hospitalOrg-main/ehr-frontend-v2/dashboard-portal/src/components/AgentTrace.jsx) | `admin`, `doctor` | `/dashboard/agents`<br>`/dashboard/agents/:id` | AI agent status cards, execution history, and 10-stage execution pipeline trace (OCR -> FHIR -> IPFS -> VCAP). |
| **16** | **Observability** | **Transactions, Security, IPFS & Logs** | [Transactions.jsx](file:///home/himanshu/Desktop/EHR_blockchain/orgs/hospital/EHR_hospitalOrg-main/ehr-frontend-v2/dashboard-portal/src/pages/Transactions.jsx)<br>[Security.jsx](file:///home/himanshu/Desktop/EHR_blockchain/orgs/hospital/EHR_hospitalOrg-main/ehr-frontend-v2/dashboard-portal/src/pages/Security.jsx)<br>[IPFS.jsx](file:///home/himanshu/Desktop/EHR_blockchain/orgs/hospital/EHR_hospitalOrg-main/ehr-frontend-v2/dashboard-portal/src/pages/IPFS.jsx)<br>[Logs.jsx](file:///home/himanshu/Desktop/EHR_blockchain/orgs/hospital/EHR_hospitalOrg-main/ehr-frontend-v2/dashboard-portal/src/pages/Logs.jsx) | `admin` | `/dashboard/*` | Real-time transaction tables, zero-PHI security alert monitors, IPFS CID pin status, and live log stream. |
| **17** | **Pharmacy** | **Pharmacy MedBlock Records** | [Dashboard.jsx](file:///home/himanshu/Desktop/EHR_blockchain/orgs/pharmacy/fabric-network-swarm/app/frontend/src/Dashboard.jsx) | Pharmacist / Staff | `http://localhost:5175/` | Inventory lookup, prescription verification, drug dispatch records, IPFS document link preview. |
| **18** | **Pharmacy** | **Pharmacy Executive Manager** | [App.jsx](file:///home/himanshu/Desktop/EHR_blockchain/orgs/pharmacy/fabric-network-swarm/app/manager/src/App.jsx) | Pharmacy Manager | `http://localhost:3001/` | Multi-tab dashboard: Fabric network pulse, Employee identity management, Invoicing audit log, Inventory analytics. |
| **19** | **Pharmacy** | **Pharmacy Employee POS Dispensing** | [App.jsx](file:///home/himanshu/Desktop/EHR_blockchain/orgs/pharmacy/fabric-network-swarm/app/employee/src/App.jsx) | Dispensing Pharmacist | `http://localhost:3002/` | Dispensing point-of-sale: patient search, prescription selection, drug dispensing, transaction confirmation. |
| **20** | **Pharmacy** | **Pharmacy Stock & Inventory** | [App.jsx](file:///home/himanshu/Desktop/EHR_blockchain/orgs/pharmacy/fabric-network-swarm/app/inventory/src/App.jsx) | Inventory Manager | `http://localhost:3003/` | Stock tracking table, low-stock threshold badges, inventory adjustment form, batch updates. |
| **21** | **Pharmacy** | **Pharmacy Billing & Invoicing** | [App.jsx](file:///home/himanshu/Desktop/EHR_blockchain/orgs/pharmacy/fabric-network-swarm/app/billing/src/App.jsx) | Billing Clerk | `http://localhost:3005/` | Prescription pack templates, medicine quantity itemizer, total calculation, ledger invoice recording. |
| **22** | **Laboratory** | **Lab Results Control Deck** | [index.html](file:///home/himanshu/Desktop/EHR_blockchain/orgs/lab/EHR-LABORG-main/client/node-gateway/public/index.html)<br>[app.js](file:///home/himanshu/Desktop/EHR_blockchain/orgs/lab/EHR-LABORG-main/client/node-gateway/public/app.js) | Lab Technician / Supervisor | `http://localhost/lab/` (:8080) | Live gateway peer switcher, recent test records table, new diagnostic test submission form, raw ledger payload inspector. |

---

## 5. Frontend Technology & Framework Matrix

| Application | UI Library / Engine | Build Tool | Styling Solution | State / Communication |
|---|---|---|---|---|
| **Workspace Hub** | Vanilla ES6+ JavaScript | Static / Nginx | Native CSS3 Variables | Fetch API (Async Polling) |
| **Hospital Staff Portal** | React 19 (`react-dom/client`) | Vite 5 | TailwindCSS + Lucide-React | React Context (`AuthContext`) + Axios |
| **Patient Health Portal** | React 19 (`react-dom/client`) | Vite 5 | TailwindCSS + Lucide-React | React Context (`AuthContext`) + Axios + jsPDF |
| **System Observability Portal** | React 19 (`react-dom/client`) | Vite 8 | TailwindCSS + Recharts 3 | WebSocket (`/api/dashboard/ws`) + Custom Hooks |
| **Pharmacy Main Portal** | React 19 (`react-dom/client`) | Vite 5 | Custom CSS + Framer Motion | Fetch API + Local State |
| **Pharmacy Manager Portal** | React 18 (`react-dom/client`) | Vite 4 | Custom CSS + Framer Motion | Fetch API + Local State |
| **Pharmacy Employee Portal** | React 18 (`react-dom/client`) | Vite 4 | Custom CSS + Framer Motion | Fetch API + Local State |
| **Pharmacy Inventory Portal** | React 18 (`react-dom/client`) | Vite 4 | Custom CSS + Framer Motion | Fetch API + Local State |
| **Pharmacy Billing Portal** | React 18 (`react-dom/client`) | Vite 4 | Custom CSS + Framer Motion | Fetch API + Local State |
| **Pharmacy Patient Portal** | React 19 (`react-dom/client`) | Vite 5 | Custom CSS + Lucide-React | Fetch API (Health check probe) |
| **Laboratory Control Deck** | Vanilla ES6+ JavaScript | Static / Express | Custom Modern CSS3 | Fetch API (`/api/lab/records`) |
