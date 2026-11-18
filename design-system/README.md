# CareGrid NITW Design System

> **Brand:** CareGrid NITW  
> **Tagline:** *Secure Care, Verified on Chain.*  
> **Aesthetic Foundation:** Blend of Reference 1 (Pastel Tiles), Reference 2 (Hospital UI with clean blue palette & pill buttons), and Reference 3 (Doctor Dashboard with teal-to-navy gradient and rounded profile cards).

---

## 1. Structure

```text
design-system/
├── brand.config.js       JavaScript configuration with portal titles and accents
├── brand.config.json     JSON configuration for vanilla JS or shell scripts
├── tokens.css            Canonical design tokens (colors, gradients, radii, cards)
├── assets/
│   ├── logo.svg          Heart-ECG pulse + shield & chain-link vector logo
│   ├── favicon.svg       Favicon for all frontends
│   └── mesh-background.svg Subtle pastel mesh backdrop with faint ECG lines
├── components/
│   ├── Avatar.jsx        Deterministic avatar fallback (initials on hashed gradient)
│   ├── DoctorCard.jsx    Doctor profile card with avatar, rating, specialty, schedule
│   ├── PatientCard.jsx   Patient profile card with clinical chips and visit status
│   ├── StaffCard.jsx     Clinical staff card (Nurse, Pharmacist, Reception, Admin)
│   ├── PhotoUploadModal.jsx Client-side local photo upload (resized to 256px)
│   └── index.js
└── sync.sh               Sync script copying tokens and assets to all app directories
```

---

## 2. Portals & Sub-labels

- **CareGrid NITW Workspace** (`nginx/hub/` on `:80`): Main launchpad and reachability dashboard.
- **CareGrid NITW Clinical** (`hospital-portal` on `:5173`): Staff portal with Doctor, Nurse, Receptionist, Pharmacist, and Admin roles.
- **CareGrid NITW Patient** (`patient-portal` on `:5174`): Patient self-service health records and consent vault.
- **CareGrid NITW Observatory** (`dashboard-portal` on `:5176`): Real-time Hyperledger Fabric metrics, agent telemetry, and block stream (Zero-PHI compliant).
- **CareGrid NITW Pharmacy** (`orgs/pharmacy/...` on `:5175`, `:3001`–`:3005`): Medication inventory, billing, POS dispensing, and patient status.
- **CareGrid NITW Lab** (`orgs/lab/...` on `:8080` / `:3006`): Diagnostic control deck and result reporting.

---

## 3. Synchronization

Run `./design-system/sync.sh` anytime you update tokens or brand assets. It distributes files directly to each app's `src/design-system/` and `public/` directories without altering Docker volume boundaries.
