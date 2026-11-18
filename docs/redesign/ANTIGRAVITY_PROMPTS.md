# CareGrid Frontend Redesign — Antigravity Prompt Pack

How to use this pack:
1. Copy `CAREGRID_REDESIGN_PLAN.md` into your repo at `docs/redesign/PLAN.md`.
2. Create the **rules file** (Section A) and **workflows** (Section B) in your workspace.
3. Open a **new Antigravity conversation per phase**. Paste the **Master Prompt** (Section C) first, then the phase prompt (Sections D0–D7). Do not skip phases and do not merge phases.
4. After each phase, run the verification block yourself before starting the next conversation.

Antigravity workspace rules live in `.agent/rules/` and workflows in `.agent/workflows/`. If your installed version uses `.agents/` instead, use that folder name.

---

## A. Always-on rules file

Save as `.agent/rules/00-caregrid-frontend.md` (activation: Always On).

```markdown
# CareGrid Frontend Redesign — Standing Rules

## Mission
Completely replace the visual layer (layout, components, styling, motion, imagery) of every frontend in this repo with the new "Calm Clinical" design described in docs/redesign/PLAN.md.
Incremental restyling of existing JSX/CSS is a FAILURE. Rewrite screens from scratch where needed. Delete old styling that is no longer used.

## Hard boundaries (never change)
- Backend, chaincode, Fabric network, Docker/compose files, nginx.conf (until Phase 6), shell scripts.
- Ports, Vite `base`, React Router `basename`, route paths, API endpoints, request/response shapes.
- AuthContext logic, token/storage keys, role guards, WebSocket path /api/dashboard/ws, IPFS gateway config.
- React / Vite / Tailwind MAJOR versions per app. Do not upgrade them.
- If a screen needs data the API does not provide, DO NOT invent an endpoint. Show a clear placeholder, tag it "Not available yet", and list it in docs/redesign/GAPS.md.

## Design rules
- Use only semantic tokens (var(--surface), var(--ink), var(--status-critical)…). No raw hex/rgb/Tailwind palette colours in components.
- Every status uses colour + icon + text. Never colour alone.
- WCAG 2.2 AA: 4.5:1 text contrast, visible focus ring, 24px min target, full keyboard use, labels on every input, aria-live for toasts.
- Light, dark and compact-density modes on every app.
- Lucide icons only. No emoji as UI icons.
- Loading = skeletons shaped like the content. Every list/view has empty, error+retry and offline states.
- Any value that comes from a mock/fallback must show a visible "Demo data" tag. Never make mock data look live.
- Scroll-driven animation is allowed ONLY on the public landing site. Inside portals use 120–200ms feedback motion; respect prefers-reduced-motion.
- No PHI in console logs, URLs or analytics. Use synthetic data only.
- Do not claim regulatory compliance anywhere in UI copy.
- Images: no real patient photos, no hotlinking. Assets go in public/assets/ and are recorded in docs/redesign/ASSETS.md with source URL and licence. Avoid paywalled "Unsplash+" assets.

## Process rules
1. Explore → Plan → Execute. First reply of every task is a written plan (Implementation Plan artifact) listing files to create/delete/modify. Wait for approval on Phases 1, 3 and 6.
2. Work one app at a time. Commit per app with a clear message.
3. After every app: run `npm run build`, `npm run lint` (if present), and open each route in the browser agent; capture a screenshot per route per role into docs/redesign/shots/<phase>/.
4. Compare screenshots with docs/redesign/baseline/ and write a short before/after note.
5. Stop and ask if a change would alter a route, endpoint, port, storage key or role guard.
6. Finish every task with: what changed, what was deleted, new gaps (GAPS.md), and the verification results.
```

---

## B. Workflows (reusable slash commands)

Save each as a file in `.agent/workflows/`.

**`verify-app.md`**
```markdown
Verify the app I name:
1. Run npm ci (if node_modules missing), npm run build, npm run lint.
2. Start the dev server, open every route from docs/redesign/FRONTEND_CONTRACT.md for that app, once per role.
3. Capture a desktop (1440x900) and mobile (390x844) screenshot per route into docs/redesign/shots/.
4. Check: no console errors, no failed network requests, same API paths as the contract, focus ring visible, dark mode works.
5. Run axe (or equivalent) and report serious/critical issues.
6. Output a table: route | role | build | console | a11y | notes.
```

**`contract-diff.md`**
```markdown
Compare the current app against docs/redesign/FRONTEND_CONTRACT.md. Report any changed route, base path, API call, storage key, role guard or port. Anything that differs is a bug unless I explicitly approved it.
```

**`dont-break.md`**
```markdown
Run the Don't-break checklist from docs/redesign/PLAN.md section 8 and report pass/fail per item with evidence.
```

---

## C. Master Prompt (paste at the start of every phase conversation)

```markdown
You are redesigning the entire frontend of the CareGrid EHR Blockchain workspace. Read these first, in order:
1. .agent/rules/00-caregrid-frontend.md
2. docs/redesign/PLAN.md
3. docs/redesign/FRONTEND_CONTRACT.md (exists after Phase 0)
4. FILE_SEARCH_ROOT.md (inventory of every frontend file and port)

Product: a multi-organisation hospital system (Hyperledger Fabric + IPFS). Users: receptionist, nurse, doctor, pharmacist, medical-records officer, hospital admin, patient, lab technician, pharmacy staff/manager, and an observability admin. Data is synthetic.

Goal: every screen should look and feel like a modern 2026 product: spacious, calm, fast, accessible, with clear hierarchy, role-specific home screens, polished empty/loading/error states, dark mode, compact mode, and blockchain "trust" cues (HashChip, VerifiedBadge, DataSourceTag).

What "done" looks like: a user who knew the old UI would not recognise it, but every existing feature, route, role and API call still works exactly as before.

What I do NOT want: small colour/padding tweaks, keeping old component structure, a generic admin-template look, gradients everywhere, stock photos of people, or changes to backend/ports/routes.

Today's phase is stated below. Do only that phase. Start by posting an implementation plan, then wait for approval where the phase says so.
```

---

## D0. Phase 0 — Safety net (no visual changes)

```markdown
PHASE 0 — SAFETY NET. Do not change any UI in this phase.

1. Create branch `ui-v2` and tag the current commit `ui-v1-final`.
2. Create docs/redesign/FRONTEND_CONTRACT.md. For EVERY frontend app listed in FILE_SEARCH_ROOT.md (hub, hospital-portal, patient-portal, dashboard-portal, pharmacy app/frontend, manager, employee, inventory, billing, patient, lab node-gateway/public) record by reading the source:
   - port, Vite base / router basename, dev proxy rules
   - every route and which roles can see it
   - every API call (method, path, request fields, response fields actually used)
   - localStorage/sessionStorage keys, cookies, JWT handling
   - WebSocket/SSE usage
   - every place a CID, txId or hash is displayed
   - every mock/fallback path (e.g. fallback data when an API fails)
   - package.json react / vite / tailwind versions and the Dockerfile build context
3. Create docs/redesign/GAPS.md (empty template) and docs/redesign/ASSETS.md (table header: file | source URL | licence | date | used in).
4. Create a Playwright setup under e2e/redesign/ that, for each app and role, logs in with the demo credentials from the evaluation guide and captures a full-page screenshot of every route at 1440x900 and 390x844 into docs/redesign/baseline/. Put the login helper in one file. Do not hardcode secrets beyond the demo credentials already documented.
5. Run ./start.sh, confirm containers and all frontends respond, and record any pre-existing failures (so they are not blamed on the redesign) in docs/redesign/PREEXISTING_ISSUES.md.
6. Add a short README in docs/redesign/ explaining the folder.

Finish with the Phase 0 report. Do not start Phase 1.
```

---

## D1. Phase 1 — Design system (approval required)

```markdown
PHASE 1 — DESIGN SYSTEM. Post the plan first and wait for my approval.

Create `packages/caregrid-ui/` as the single source of truth, plus `scripts/sync-ui.sh` that copies it into each app at `src/ui-kit/` (generated, committed). Reason: each app has its own Dockerfile and named node_modules volume, so a cross-folder import would break image builds. Do NOT change Docker or nginx.

Compatibility: React ^18 || ^19; Tailwind either v3 or v4 — the token layer must be plain CSS variables in `tokens.css`, with a small `tailwind-preset.js` mapping them for apps that use Tailwind. Apps with custom CSS (pharmacy, lab) import tokens.css directly.

Deliver:
1. tokens.css using the values in PLAN.md §3.1 (OKLCH, light/dark/compact), verified for AA contrast — adjust values where they fail and document what you changed. Per-app accent via `data-app="hospital|patient|pharmacy|lab|observe"`.
2. Fonts via @fontsource (Geist Sans, Geist Mono), tabular numerals utility.
3. Components (JSX, accessible, documented props), all with light/dark/compact:
   Button, IconButton, Input, Select, Textarea, Checkbox/Switch, SegmentedControl, Tabs, Card, StatTile, Badge/StatusPill (critical/warning/info/success/neutral with icon+text), Avatar, Tooltip, Dialog, Drawer, Popover, DropdownMenu, CommandPalette (Ctrl/⌘+K), Toast + ToastProvider (aria-live), Table (sortable, sticky header, row actions, compact), DataList, Timeline, Stepper/Wizard, Accordion, Skeleton variants, EmptyState, ErrorState (with retry), OfflineBanner, Breadcrumbs, PageHeader, AppShell (sidebar + topbar + mobile bottom tabs), ThemeToggle, DensityToggle, Sparkline.
   Blockchain components: HashChip (copy + tooltip), VerifiedBadge + VerifyDrawer (txId, CID, block, endorsing orgs, history list), BlockPulse, DataSourceTag (Live/Cached/Demo), PatientBanner.
   Charts: thin wrappers with consistent colours and accessible table fallback.
4. A "design lab" page (Vite app under packages/caregrid-ui/lab) showing every component in every mode, plus a theme/density switcher.
5. Unit smoke tests (render without crashing) and an axe test on the lab page.
6. docs/redesign/DESIGN_SYSTEM.md: usage rules, do/don't, token table.

Constraints: no app is modified in this phase except running sync-ui.sh into a throwaway folder to prove the sync works. Report bundle size of the kit.
```

---

## D2. Phase 2 — Patient portal

```markdown
PHASE 2 — PATIENT PORTAL (orgs/hospital/EHR_hospitalOrg-main/ehr-frontend-v2/patient-portal). Mobile-first, warm coral accent (data-app="patient"), 16px body text, large touch targets.

Run scripts/sync-ui.sh for this app. Then rebuild EVERY page from scratch using the kit, keeping routes, AuthContext, api.js and pdfGenerator logic intact:

- Login: split layout (abstract blockchain/pulse pattern left, form right), clear inline errors, show/hide password. Demo-credential hint only when VITE demo flag or an existing equivalent exists; otherwise omit.
- Overview: greeting, "health at a glance": active visit card with status stepper, vitals tiles with sparklines where history exists, allergy/condition chips, quick actions (View record, Manage access, Download report).
- Visits list: month-grouped vertical timeline, status filter chips, search.
- Visit detail: tabs Summary · Vitals · Prescriptions · Lab results · Documents; VerifiedBadge on each section; Download PDF (keep jsPDF flow, restyle the PDF template to match the brand).
- EHR: record vault with accordions, each section showing CID HashChip and last-updated-by.
- Access/consent: "Consent centre" — who has access, since/until, plain-language grant/revoke with confirmation dialog, activity log. Same API calls as today.
- Signatures: "Proof" page — signed entries list + VerifyDrawer + a short plain-language explainer of what verification means.
- Profile: demographics, ABHA ID, emergency contacts, edit-in-place if the existing API supports it, otherwise read-only.
- Layout: topbar + bottom tab bar on mobile, sidebar on desktop; theme + density toggles; toast centre; offline banner.

Remove: old ThemeToggle.jsx, old ui/index.jsx, unused CSS, default Vite assets.

Verify with /verify-app, /contract-diff and /dont-break. Provide before/after screenshot pairs for every route. Update GAPS.md for any data the UI wants but the API does not return.
```

---

## D3. Phase 3 — Hospital staff portal (approval required)

```markdown
PHASE 3 — HOSPITAL STAFF PORTAL (…/ehr-frontend-v2/hospital-portal). Deep teal accent (data-app="hospital"), compact-friendly. Post the plan first and wait for approval.

Run scripts/sync-ui.sh. Rebuild the shell and every role experience from scratch. Keep routes, role guards, AuthContext, api.js.

Shell: role-generated sidebar, topbar with role chip + DataSourceTag + theme/density toggles, command palette (navigate + patient search using existing endpoints only), toast centre.

Per role (see PLAN.md §6.2 for detail):
- Common: a role-specific "Today" home (queue counts, next item, pending actions) computed from data the app already fetches.
- Receptionist — Patients: search-first registry, table/cards toggle, patient drawer, "Register patient" multi-step wizard. Visits: list + queue view with status filters. OpenVisit: 3-step wizard (Patient → Department/Doctor → Confirm).
- Doctor — DoctorVisits: split-pane workspace. Left: my queue with status chips and wait time. Right: patient chart with sticky PatientBanner (name, ID, age/sex, allergies, consent status, assigned staff) and tabs Summary · Vitals · Diagnosis & notes · Prescriptions · Lab orders · Timeline. Draft-saved indicator and an explicit "Commit to ledger" action that opens a result drawer (txId, CID, block).
- Nurse — NurseVisits: triage board (Waiting → Vitals taken → With doctor), large unit-aware vitals inputs, out-of-range highlighting with icon+text.
- Pharmacist — dispense: queue → verify → dispense stepper; show stock warnings only if data exists.
- Medical records — finalize: checklist-style finalization with integrity check and confirmation.
- Admin — Staff: roster table, role-assignment dialog, status chips.

Every place a CID/txId appears uses HashChip + VerifiedBadge. Replace all browser alert()/confirm() with Dialog/Toast.

Do the work in this order and verify after each: shell → receptionist → doctor → nurse → pharmacist/records → admin. For each role, run the full clinical flow end-to-end against the live stack (register → open visit → vitals → diagnosis → lab order → dispense → finalize) and report evidence.
```

---

## D4. Phase 4 — Observability dashboard

```markdown
PHASE 4 — OBSERVABILITY DASHBOARD (…/ehr-frontend-v2/dashboard-portal, base /dashboard/). Dark-first, indigo accent (data-app="observe"), Recharts 3.

Keep: App routing/guards, services/api.js, hooks/useDashboardSocket.js behaviour, config/roleViews.js zero-PHI matrix, WebSocket path.

Rebuild:
- Layout: command-centre shell, live block counter with BlockPulse, connection status, last-updated time on every card.
- Overview: block stream (cards slide in, pausable), TPS area chart with accessible table fallback, peer health grid, latest-transactions table.
- Network: animated SVG topology (orgs → peers → orderer), block heights, MSP badges, latency.
- Agents, AgentDashboard, AgentTrace: fleet cards; per-agent detail with horizontal 10-stage pipeline stepper showing duration per stage, failure highlight and retry info.
- Transactions, Security, IPFS, Logs: dense sortable/filterable tables, saved filters (localStorage with try/catch), severity pills with icon+text, virtualised log stream with pause/resume and "jump to latest", persistent zero-PHI notice.
- Mock fallbacks in services/api.js must trigger a visible "Demo data" DataSourceTag; do not remove the fallbacks themselves unless I ask.
- Delete hero.png, react.svg, vite.svg and unused App.css.

Verify the WebSocket feed live (new block appears without reload) and report.
```

---

## D5. Phase 5 — Lab, Pharmacy suite, Hub

```markdown
PHASE 5 — LAB DECK, PHARMACY APPS, WORKSPACE HUB. Do them in this order; verify after each.

5a. Lab control deck (orgs/lab/EHR-LABORG-main/client/node-gateway/public, vanilla JS): violet accent. Rebuild index.html/styles.css/theme.js using the shared tokens.css (copy it in; no build step added). Keep app.js API calls identical. Peer switcher as segmented control, submission form with validation, results table with status chips, raw ledger payload in a collapsible code panel, dark mode.

5b. Pharmacy (orgs/pharmacy/fabric-network-swarm/app/*): leaf green accent. Apps are React 18 / Vite 4 (and 19/5 for frontend + patient): keep versions. Sync the kit into each app. Rebuild:
 - frontend (records portal): inventory + prescription ledger, IPFS link preview, honest ledger-sync state.
 - manager: Pulse / Employees / Audit / Inventory with KPI row.
 - employee (POS): patient lookup left, prescription/cart right, settlement bar; keep the staff identity switcher behaviour.
 - inventory: stock table, low-stock chips, add-batch dialog.
 - billing: template picker → itemised invoice → totals card.
 - patient: friendly large-type status card.
 Where ledger integration is unavailable (legacy profile), show "Ledger sync unavailable" — never a fake success.
 Do NOT merge the six apps in this phase unless I explicitly say "merge pharmacy".

5c. Workspace hub (nginx/hub): restyled launchpad grouped by org, live status pills with latency, keyboard search, BlockPulse. Keep hub.js probing logic and endpoints. Do not edit nginx.conf.

Verify every port responds 200 and each app's contract is unchanged.
```

---

## D6. Phase 6 — Landing site (approval required)

```markdown
PHASE 6 — PUBLIC LANDING SITE. New app `landing/` (React + Vite, kit tokens, GSAP + ScrollTrigger, Lenis, Motion). Served at /welcome/ first. Post the plan and wait for approval.

Story: "Your health record — private, portable, provable."
Sections (scroll order):
1. Hero — full-height, animated mesh gradient + faint block-chain grid, headline, one-line subhead, two CTAs (Open workspace, See how it works). No stock people. Static fallback for reduced motion.
2. The problem — pinned scroll: scattered records ("silos") connect into one trusted timeline as you scroll.
3. How a record travels — pinned 6-step journey (Register → Visit → Consultation → Lab → Pharmacy → Discharge). As each step activates, a new block is appended to a growing chain on the side and the matching role card highlights. Content must also be readable without animation.
4. Tamper-evidence demo — interactive: user types text, live SHA-256 (Web Crypto) shown as a HashChip; flip one character and show the avalanche difference highlighted. Caption explains CIDs and on-chain pointers in plain language.
5. Who sees what — role cards (patient, doctor, nurse, lab, pharmacy, admin) with a consent toggle demo (grant/revoke) that changes what a mock doctor card can see. Label as demo.
6. Under the hood — compact diagram: Hospital/Diagnostics/Provider orgs → Fabric channel ↔ IPFS; short, honest copy. No compliance claims; say "designed for privacy: consent-gated access, off-chain storage, signed audit trail".
7. Portals — launchpad tiles to each portal (use real routes), with the same status pills as the hub if reachable.
8. Footer — project credits, "Synthetic data only" notice.

Technical rules: ScrollTrigger context cleanup on unmount; matchMedia to disable pinning/parallax under 768px and when prefers-reduced-motion; Lenis disabled for reduced-motion; no content hidden behind animation (use IntersectionObserver fallbacks); images lazy-loaded, WebP/AVIF, width/height set, total landing JS under 250 KB gzip excluding lazy chunks; Lighthouse ≥ 90 performance and accessibility on desktop.
Visual assets: generate SVG/CSS patterns yourself; if you need photos, use Unsplash (non-Plus) or Burst, no identifiable faces, and record licences in ASSETS.md.

Cut-over (only after I say so): move landing to `/` and the old hub to `/workspace/` by editing nginx.conf, with a rollback note listing the exact lines changed.
```

---

## D7. Phase 7 — Polish, QA, docs

```markdown
PHASE 7 — POLISH.
1. Accessibility: axe on every route; fix all serious/critical; manual keyboard-only run of the three most important flows (patient consent, doctor commit, pharmacy dispense); verify focus order, focus ring, 24px targets, contrast in both themes.
2. Performance: bundle analysis per app, code-split routes, lazy-load charts and PDF libs, image optimisation, report before/after.
3. Visual regression: Playwright screenshot comparison against Phase-2..6 approved shots.
4. Consistency sweep: grep for raw hex/rgb colours, `alert(`, emoji icons, duplicate ThemeToggle/ui components, leftover Vite assets; fix all.
5. Docs: update README, docs/architecture.md frontend section, FILE_SEARCH_ROOT.md (new file tree), and write docs/redesign/DEMO_SCRIPT.md — a step-by-step live demo for the viva using the new UI (with the demo credentials).
6. Final /dont-break and /contract-diff reports.
```

---

## E. If Antigravity still under-delivers

- Reply in the same conversation with: "This is a restyle, not a redesign. Rewrite the component tree for <screen> from scratch according to PLAN.md §6.x. Delete the old JSX."
- Split the phase by app or by role and run each alone.
- Attach the baseline screenshot and the spec for just that screen; ask for a before/after screenshot.
- Ask for the plan artifact again and edit it before approving.
- Use the strongest model available for Phases 1, 3 and 6; faster models are fine for repetitive pharmacy apps.
