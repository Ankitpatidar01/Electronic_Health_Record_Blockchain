# CareGrid Frontend Redesign — Research-Backed Plan

Scope: every UI in the EHR Blockchain workspace (hospital staff portal, patient portal, observability dashboard, 5 pharmacy apps + pharmacy records portal, lab control deck, nginx hub) plus a new scroll-driven public landing site.
Rule of the whole plan: **replace the presentation layer completely, keep the data/contract layer untouched.**

Put this file in your repo at `docs/redesign/PLAN.md`. The prompts in `ANTIGRAVITY_PROMPTS.md` refer to its section numbers.

---

## 1. What the research says (and what we do about it)

| # | Finding | Design decision |
|---|---|---|
| 1 | Overcrowded EHR screens slow users and cause errors; role-specific layouts, foldable sections and highlighted critical data are the standard fixes | Every role gets its own "Today" home and a progressive-disclosure layout (summary first, details in tabs/drawers) |
| 2 | Alert fatigue is the most studied clinical UX problem; clinicians override roughly half to nearly all drug alerts | Only **three** alert tiers. Critical = inline + explicit acknowledge. Everything else = quiet toast/badge. No modal spam |
| 3 | Accessibility is a safety issue; WCAG 2.2 AA is the safer baseline than 2.1 AA | Hard requirement: AA contrast, visible focus, 24px minimum targets, keyboard-complete, no colour-only status |
| 4 | Healthcare token systems should be semantic (`status-critical / warning / info / neutral`) so urgency is enforced by the system, not per screen | Design tokens are semantic only; raw colours are banned in components |
| 5 | Making data freshness and source visible is a design responsibility on clinical dashboards | Every live panel shows "Updated 4s ago · Source: Fabric peer0 / cache / demo data" |
| 6 | Modern clinical UIs can be dense *and* beautiful (dark chart views, duration-sized schedule blocks) | Density toggle (Comfortable / Compact), dark mode on every portal, dark-first for the observability dashboard |
| 7 | Scroll storytelling works best with GSAP ScrollTrigger for scroll effects + Framer Motion/Motion for component interactions + Lenis for smooth scroll; the main risk is hiding critical content behind animation and heavy effects on mobile | Scroll effects **only** on the public landing site. Inside portals, motion is limited to feedback and transitions. Content-first, reduced-motion respected, heavy effects disabled on mobile |
| 8 | Tailwind v4 + shadcn/ui with OKLCH tokens, CSS-variable theming and `.dark` class is the current default stack for React dashboards | Token layer is plain CSS variables (works with Tailwind v3 *and* v4), so existing portals keep their Tailwind version at first |
| 9 | Zero-trust and role-based access are now expected to be visible in product design, not hidden | "Verified on-chain" badges, consent status in the patient banner, role chip always visible |

---

## 2. Why Antigravity only made "minor changes" — and how we fix it

Typical causes, all fixable by prompt structure:

1. **No target design was defined.** "Make it modern" has no finish line, so the agent restyles what exists. → We give it a token file, a component list and screen-by-screen specs first.
2. **It was asked to change files, not to replace screens.** → Rules file explicitly says: *full rewrite of JSX/CSS is expected; incremental restyling is a failure*.
3. **One giant request.** → One phase per conversation, one portal per phase, "explore → plan → execute" (Antigravity's own best-practice order).
4. **No verification loop.** → Every phase ends with build + lint + screenshot-per-route + a before/after comparison against Phase 0 baselines.
5. **No persistent instructions.** → `.agent/rules/` (always-on) and `.agent/workflows/` (reusable prompts) so every new conversation starts with the same constraints.

---

## 3. Design direction: "Calm Clinical"

Brand name used in the repo already: **CareGrid**.
Mood: quiet, spacious, trustworthy — warm-paper light mode, deep-ink dark mode, one confident accent per portal, blockchain trust cues that are *informative, not gimmicky*.

### 3.1 Tokens (starting values — Antigravity must verify contrast and tune)

```css
:root {
  /* surfaces */
  --bg:        oklch(0.985 0.004 95);
  --surface:   oklch(1 0 0);
  --surface-2: oklch(0.97 0.006 95);
  --border:    oklch(0.91 0.006 250);
  --ink:       oklch(0.22 0.02 250);
  --ink-muted: oklch(0.50 0.02 250);

  /* portal accents (swap --brand per app) */
  --brand-hospital:  oklch(0.55 0.11 190);  /* deep teal   */
  --brand-patient:   oklch(0.60 0.13 40);   /* warm coral  */
  --brand-pharmacy:  oklch(0.58 0.13 150);  /* leaf green  */
  --brand-lab:       oklch(0.54 0.16 295);  /* violet      */
  --brand-observe:   oklch(0.52 0.17 265);  /* indigo      */

  /* semantic status — never colour alone: always icon + text */
  --status-critical: oklch(0.56 0.21 25);
  --status-warning:  oklch(0.76 0.15 80);
  --status-info:     oklch(0.58 0.13 245);
  --status-success:  oklch(0.60 0.15 150);
  --status-neutral:  oklch(0.60 0.01 250);

  --radius-sm: 8px; --radius-md: 12px; --radius-lg: 20px;
}
.dark {
  --bg:        oklch(0.17 0.015 255);
  --surface:   oklch(0.21 0.018 255);
  --surface-2: oklch(0.25 0.02 255);
  --border:    oklch(0.32 0.02 255);
  --ink:       oklch(0.96 0.005 250);
  --ink-muted: oklch(0.72 0.015 250);
}
```

### 3.2 Typography
- UI: **Geist Sans** (fallback Inter/system). Data, hashes, IDs: **Geist Mono**. Both are free via `@fontsource`.
- Scale: 12 / 14 / 16 / 20 / 28 / 40 / 64 (landing hero only). Body never below 14px in portals, 16px on the patient portal.
- Tabular numerals on every vitals/lab/billing number.

### 3.3 Layout and shape
- 4px grid, 12-col, max content width 1280 (portals) / 1200 (landing).
- Cards: 1px border + very soft shadow, not heavy drop shadows. Glass/blur **only** on the landing hero and the command palette.
- Density modes: Comfortable (default) and Compact (clinical staff).

### 3.4 Motion
- App UI: 120–200ms, ease-out, opacity/translate only. Skeletons instead of spinners.
- Landing: GSAP ScrollTrigger (pinned journey, scrubbed block chain), Lenis smooth scroll, Motion for card hover/tilt.
- `prefers-reduced-motion`: replace all scroll effects with static, fully readable sections.
- Disable parallax/pinning under 768px; keep fade-ups.

### 3.5 Imagery and backgrounds
Do not use stock photos of real patients. This system uses synthetic data, so the visual language should be **abstract and diagrammatic**:
- Generated SVG/CSS: soft mesh gradients, hex/block-chain patterns, ECG/pulse lines, DNA-like helix strokes, grid noise. Antigravity can generate these directly (no licence risk).
- Photos where needed (hero, role cards): Unsplash (the standard Unsplash licence is free; **avoid items marked "Unsplash+"**, those are paywalled), Burst by Shopify (copyright-free). Prefer hands, devices, corridors, lab glassware — no identifiable faces.
- Illustrations: unDraw / similar open sets. **Check each licence** and record it.
- Every downloaded asset goes in `public/assets/` with an entry in `docs/redesign/ASSETS.md` (file, source URL, licence, date). No hotlinking.

### 3.6 Blockchain trust components (shared)
- `HashChip` — shortened tx ID / CID in mono, click to copy, tooltip shows full value.
- `VerifiedBadge` — "Verified on-chain" with block number + timestamp, opens a drawer showing txId, CID, endorsing orgs, and (where available) the content-hash vs on-chain-CID check.
- `BlockPulse` — tiny animated indicator that a new block landed (dashboard + hub only).
- `DataSourceTag` — Live / Cached / Demo data. **Mock fallbacks must never look live.**

---

## 4. Keep / Add / Remove

### 4.1 Keep (do not touch)
Routes and URL paths, Vite `base` paths, router `basename`, API client modules (`utils/api.js`, `services/api.js`), `AuthContext` logic and storage keys, role guards, the WebSocket path `/api/dashboard/ws`, IPFS gateway config, all backend/chaincode/network files, nginx upstream routes, Docker ports.

### 4.2 Add (frontend-only; must work with existing endpoints)
| Feature | Where | Notes |
|---|---|---|
| Command palette (Ctrl/⌘+K) | Staff portal, dashboard | Navigate + patient search using existing search endpoints |
| Role-specific "Today" home | Staff portal | Queue counts, next patient, pending lab results, pending dispenses |
| Sticky patient banner | Doctor/nurse chart | Name, ID, age/sex, allergies, consent status, assigned staff |
| Visit/patient timeline | Staff + patient | Visit → vitals → Rx → lab → dispense → discharge, from existing visit data |
| Verify-integrity drawer | Everywhere a CID appears | Shows on-chain CID, tx, history; if the API exposes it, the hash-match check |
| Consent centre | Patient portal | Plain-language grant/revoke, expiry chips, history |
| Global states kit | All apps | Skeletons, empty, error+retry, offline banner, DataSourceTag |
| Dark mode + density toggle | All apps | One shared implementation |
| Toast/notification centre | All apps | Replaces browser `alert()` and ad-hoc banners |
| Printable/PDF-friendly layouts | Patient + staff | Patient already has jsPDF; unify styling |
| Mobile-first layouts | Patient, pharmacy employee/patient, lab | Bottom tab bar on patient portal |
| Interactive "hash avalanche" demo | Landing | Type text → SHA-256 changes (Web Crypto, client-only); explains tamper-evidence |
| Scroll-driven landing site | New app | See Prompt 6 |
| Optional: i18n scaffold | Patient portal | English + Hindi; your docs already reference ABHA ID, so this fits. Phase 7, only if time |

### 4.3 Remove / consolidate
| Item | Action |
|---|---|
| Vite template leftovers (`hero.png`, `react.svg`, `vite.svg`, unused `App.css` in dashboard-portal) | Delete |
| 9 copies of `ThemeToggle.jsx` and 3 copies of `ui/index.jsx` | Replace with the shared kit |
| Silent mock fallbacks in `services/api.js` (dashboard) | Keep the fallback if you want it for demos, but show a visible **Demo data** tag |
| Fake "success" states where pharmacy ledger integration is unavailable | Show honest "Ledger sync unavailable" state |
| Emoji-as-icons, inconsistent icon sets | Lucide only |
| Page names that are "dashboards" but are really forms (OpenVisit, Visits) | Re-model as proper list + wizard patterns |
| Marketing claims like "HIPAA & GDPR compliant by design" if they reach any UI copy | Remove; your own status note says this is not a compliance claim. Use "Designed for privacy: consent-gated access, off-chain storage" |
| Six separate pharmacy frontends | **Optional, Phase 5b:** merge into one "Pharmacy Suite" with role routes; keep old ports redirecting until verified. Skip if time is short |

---

## 5. New information architecture

```
/                    NEW CareGrid landing (scrollytelling)   ← shipped last, previewed at /welcome/ first
/workspace/          Existing hub, restyled (service status launchpad)
/                    (hospital staff portal stays at its current route until Phase 6 cut-over)
/patient/            Patient portal
/dashboard/          Observability dashboard
/pharmacy/*          Pharmacy apps
/lab/                Lab control deck
```
Cut-over rule: the new landing is served at `/welcome/` during development. Only in Phase 6, after sign-off, does nginx move it to `/` and the old hub to `/workspace/`.

---

## 6. Screen-by-screen specs

Common to all: app shell (collapsible sidebar on desktop, bottom tabs on mobile for patient), top bar with role chip + data-source tag + theme/density toggles, breadcrumbs, command palette (staff/dashboard), toast centre, skeleton/empty/error states.

### 6.1 Patient portal (`patient-portal`, `/patient/`) — mobile-first, warm coral accent
| Existing page | New design |
|---|---|
| Login | Split screen: calm illustration/pattern left, form right; clear error text; show/hide password; "demo credentials" collapsible only in demo mode |
| Overview | Greeting + "Your health at a glance": active visit card with status stepper, vitals sparkline tiles, allergy/condition chips, next steps, quick actions (View record, Manage access, Download report) |
| Visits list | Vertical timeline grouped by month; filters; status badges |
| Visit detail | Tabs: Summary · Vitals · Prescriptions · Lab results · Documents. `VerifiedBadge` on every section. "Download PDF" |
| EHR | Record vault: sections as accordions, each with CID chip and last-updated-by |
| Access (consent) | Consent centre: who has access, since when, until when; grant/revoke with plain-language confirmation; activity log |
| Signatures | "Proof" page: list of signed entries with verify drawer; short explainer of what the checkmark means |
| Profile | Demographics, ABHA ID, emergency contacts; edit-in-place |

### 6.2 Hospital staff portal (`hospital-portal`) — deep teal, compact-friendly
| Role/page | New design |
|---|---|
| Shell | Sidebar generated from role; command palette; "Today" home per role |
| Receptionist: Patients | Search-first registry (ID/ABHA/name), table + cards toggle, side drawer for patient, "Register patient" multi-step wizard |
| Receptionist: Visits / OpenVisit | List with status filters and queue view; OpenVisit becomes a 3-step wizard (Patient → Department/Doctor → Confirm) |
| Doctor: DoctorVisits | **Split-pane workspace**: left = my queue (status chips, wait time); right = patient chart with sticky banner and tabs Summary · Vitals · Diagnosis & notes · Prescriptions · Lab orders · Timeline. Autosave draft indicator; explicit "Commit to ledger" action with result drawer (tx ID, CID) |
| Nurse: NurseVisits | Triage board (Waiting → Vitals taken → With doctor) with big touch-friendly vitals entry, unit-aware inputs, out-of-range highlighting (icon + text) |
| Pharmacist: PharmacistRecords (dispense) | Prescription queue → verify → dispense stepper; stock-aware warnings if data exists |
| Med records: PharmacistRecords (finalize) | Checklist-style finalization with integrity check and confirmation |
| Admin: Staff | Roster table, role assignment dialog, status chips |

### 6.3 Observability dashboard (`dashboard-portal`, `/dashboard/`) — dark-first, indigo
- Shell: dark command-center, live block counter, connection status, freshness on every card.
- Overview: block stream (cards sliding in), TPS chart (Recharts, gradient area), peer health grid, latest tx table.
- Network: animated topology (orgs → peers → orderer), block heights, MSP badges.
- Agents / AgentDashboard / AgentTrace: fleet cards + a horizontal 10-stage pipeline stepper with per-stage duration.
- Transactions, Security, IPFS, Logs: dense tables with saved filters, severity pills (icon + text), virtualised log stream with pause/resume, zero-PHI notice always visible.

### 6.4 Pharmacy apps (`app/frontend, manager, employee, inventory, billing, patient`) — leaf green
- Shared `PharmacyShell`. Manager: 4 tabs (Pulse, Employees, Audit, Inventory) with KPI row. Employee: POS layout (patient lookup left, cart/dispense right, settlement bar bottom). Inventory: stock table with low-stock chips, batch dialog. Billing: template picker → itemised invoice → summary card. Patient: friendly status card, large type. Records portal (`app/frontend`): inventory/prescription ledger with IPFS link preview.
- Honest-state rule: where ledger integration is unavailable, show it.

### 6.5 Lab control deck (`client/node-gateway/public`) — violet, vanilla JS
Rebuild with the shared CSS tokens (no React required): peer switcher as segmented control, submission form as a card with validation, results table with status chips, raw payload inspector as a collapsible code panel. Keep `app.js` API calls identical.

### 6.6 Workspace hub (`nginx/hub`) — restyled launchpad
Service tiles grouped by org, live status pills with latency, `BlockPulse`, keyboard-searchable. Keep `hub.js` probing logic.

### 6.7 Landing site (new) — see Prompt 6 for the section-by-section scroll design.

---

## 7. Phases (each phase = one branch, one PR, shippable)

If your viva/demo is close, do **0 → 1 → 2 → 3 (doctor + receptionist only) → 6** first; that gives the biggest visible change fastest.

| Phase | Goal | Done when |
|---|---|---|
| **0 Safety net** | Branch `ui-v2`, tag current state `ui-v1-final`; write `docs/redesign/FRONTEND_CONTRACT.md` (every route, API call, storage key, role, base path per app); Playwright baseline screenshots per route per role; confirm `./start.sh` boots | Contract doc + baseline screenshots committed; stack boots |
| **1 Design system** | `packages/caregrid-ui`: tokens, Tailwind preset, components, "design lab" page | Lab page renders every component in light/dark/compact; axe has 0 serious issues |
| **2 Patient portal** | Rebuild all 8 pages | Every route matches the contract; mobile + desktop screenshots; login → overview → consent flow works against real API |
| **3 Hospital portal** | Rebuild shell + all roles | Each role completes its core flow (register → open visit → vitals → diagnosis → lab order → dispense → finalize) |
| **4 Dashboard** | Rebuild 7 pages | WebSocket live feed works; mock/live tagging visible |
| **5 Lab + Pharmacy + Hub** | Rebuild lab deck, 6 pharmacy UIs, hub | All ports respond 200; honest-state UI for unavailable ledger |
| **6 Landing** | Build scroll site at `/welcome/`, then cut over | Lighthouse ≥ 90 perf/a11y on desktop; reduced-motion version works; nginx cut-over with rollback note |
| **7 Polish** | a11y audit, performance, visual regression, docs, updated demo script | WCAG 2.2 AA checklist passed; bundle budgets met; viva demo script updated |

### Shared-package caution (important for your Docker setup)
Your portals each have their own `Dockerfile` and use named volumes for `node_modules`. A shared package that lives *outside* each app folder will break image builds. **Recommended first approach:** keep the source of truth in `packages/caregrid-ui/` and run `scripts/sync-ui.sh` to copy it into each app at `src/ui-kit/` (generated, committed). Zero changes to Docker or nginx. Later, if you want a true workspace package, change the Docker build context to the repo root.

Also: pharmacy apps are React 18 / Vite 4, others React 19 / Vite 5–8. The kit must support `react ^18 || ^19`. Do **not** upgrade React/Vite versions inside the redesign phases.

---

## 8. Don't-break checklist (run at the end of every phase)

- [ ] `./start.sh` brings up every container; `docker ps` unchanged
- [ ] Every Vite app builds (`npm run build`) and lints
- [ ] Ports unchanged: 5173, 5174, 5175, 5176, 3001–3005, 8080 (and 3006 via nginx for lab)
- [ ] Vite `base` / router `basename` unchanged (`/patient/`, `/dashboard/`, pharmacy subpaths, `/lab/`)
- [ ] Nginx routes unchanged (until Phase 6)
- [ ] Login works for each demo role; role guards still block wrong roles
- [ ] Network tab: same API paths and payload shapes as baseline
- [ ] Dashboard WebSocket path `/api/dashboard/ws` still connects
- [ ] IPFS gateway links still resolve
- [ ] No console errors on any route; no PHI logged
- [ ] Screenshots captured and compared with Phase 0 baselines

---

## 9. How to share the codebase (it's huge — don't upload everything)

The redesign only needs the frontend source. Make a lean zip from the repo root:

```bash
cd ~/Desktop/EHR_blockchain
zip -r frontend-only.zip \
  nginx/hub nginx/nginx.conf \
  orgs/hospital/EHR_hospitalOrg-main/ehr-frontend-v2 \
  orgs/pharmacy/fabric-network-swarm/app \
  orgs/lab/EHR-LABORG-main/client/node-gateway/public \
  docker-compose.yaml docs \
  -x "*/node_modules/*" "*/dist/*" "*/.git/*" "*.log" "*.env" "*.pem" "*.key" \
     "*/crypto-config/*" "*/organizations/*" \
     "orgs/pharmacy/fabric-network-swarm/app/backend/*"
```

- If it is still too big, send three zips: (1) hospital `ehr-frontend-v2`, (2) pharmacy `app` minus backend, (3) lab `public` + `nginx` + `docker-compose.yaml`.
- Never include `.env`, keys, certificates or crypto material.
- Alternative: give me the GitHub repo (`owner/repo`) and the branch; I can attach the repository to this session and read it directly, which avoids zipping.
- What I would do with the code: extract every route, API call and role to write the real `FRONTEND_CONTRACT.md`, find shared components to dedupe, and tighten each phase prompt to your actual file names.

---

## 10. Sources used

- EHR interface design principles — https://www.purrweb.com/blog/emr-ehr-interface-design/
- EHR UX challenges and role-specific dashboards — https://fuselabcreative.com/ehr-interface-design-principles-ux-and-usability-challenges/
- Healthcare dashboard best practices (2026) — https://fuselabcreative.com/healthcare-dashboard-design-best-practices/
- Healthcare dashboard design examples (2026) — https://adminlte.io/blog/healthcare-dashboard-design-examples/
- Healthcare design systems, tokens, alert tiers — https://www.themomentum.ai/blog/healthcare-app-design-ui-patterns-design-systems
- Patient vs provider UX, alert fatigue — https://www.themomentum.ai/blog/healthcare-ux-design-principles-patient-provider-apps
- WCAG 2.2 for health apps — https://www.monterail.com/blog/inclusive-design-accessibility-in-healthtech-ux-ui
- Design systems for EHR accessibility — https://www.healthitanswers.net/harnessing-design-systems-to-advance-ehr-accessibility-and-digital-health-equity/
- EMR/EHR modernization trends 2026 — https://www.softura.com/blog/emr-ehr-modernization-trends-2026/
- GSAP ScrollTrigger in React — https://blog.logrocket.com/how-to-use-the-gsap-scrolltrigger-plugin-in-react/
- Combining GSAP + Framer Motion (case study) — https://contra.com/p/cAoYvc2Y-zooom-kombucha-brand-website
- Premium scroll animation, motion hierarchy, reduced motion — https://dev.to/uianimation/build-premium-scroll-animations-with-gsap-3kf7
- Antigravity best practices (explore → plan → execute, rules) — https://www.antigravity.google/docs/cli/best-practices
- Antigravity rules and workflows — https://www.kdnuggets.com/build-better-ai-agents-with-google-antigravity-skills-and-workflows
- shadcn/ui + Tailwind v4 + OKLCH tokens — https://sharedcontext.ai/skills/external/brandonrbridges/shad
- Unsplash healthcare imagery — https://unsplash.com/s/photos/health-care
- Burst (copyright-free medical photos) — https://burst.shopify.com/medical
