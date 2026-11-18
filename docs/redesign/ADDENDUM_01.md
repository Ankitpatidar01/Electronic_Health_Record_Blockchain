# Addendum 01 — Reference Look for the Patient Panel + Backend Changes (Doctor Photos & Friends)

This addendum **overrides** the earlier plan and prompt pack wherever they conflict:

| Earlier rule | Now |
|---|---|
| Backend is never changed | Backend may change, but only through a controlled, **additive** track (Section 4). Chaincode, Fabric network and ports stay frozen |
| Patient portal accent = warm coral | Patient portal and all portals adopt the **Soft Glass Bento** language below (Section 1) |
| Phase 2 (patient) is frontend-only | New **Phase 2B (backend)** runs before the patient portal rebuild (Section 5) |

Put the reference image in your repo at `docs/redesign/reference/patient-dashboard.png` and attach it to the Antigravity prompts that mention it.

---

## 1. Design language read from the reference: "Soft Glass Bento"

What the reference does (and what we take from it):

| Element in the image | Take it as |
|---|---|
| Muted teal-grey backdrop with a frosted, rounded app shell | Page backdrop gradient + glass shell (blur, 55% white overlay, 28px radius). Fallback to solid surface when `prefers-reduced-transparency` or low-power |
| Left sidebar with "General" and "Tools" groups, active item = white pill, black count badges | Same nav pattern; badges are black circles with white numerals |
| Big white cards, 20–24px radius, soft shadow, bold title + muted one-line subtitle | `Card` with `title` + `description` header slots |
| Pastel tinted tiles (mint / sky / butter) for appointments and medicines | Tint tokens `--tint-mint`, `--tint-sky`, `--tint-butter` (L≈0.95, low chroma) |
| Near-black pill primary buttons ("New Appointment"), ghost buttons for secondary | `Button variant=primary` = ink pill; `variant=ghost` = pale surface |
| Tab chips above the chart + period dropdown | `SegmentedControl` + `Select` in the card header |
| Two-series smooth line chart with faint gradient fill and left/right axes | Chart wrapper: smooth line, 8% gradient fill, series distinguished by **line style/marker as well as colour** |
| Month calendar with black rounded "today", dots under days that have events | `MiniCalendar` with event dots, keyboard-navigable |
| Doctor photo thumbnails inside appointment rows | `DoctorAvatar` (real uploaded photo → fallback initials) |
| Floating 3D capsules, yellow gradient promo card with "Subscribe $10/month" | **Do not copy.** No subscription/payment UI. Generate your own simple SVG capsule/pulse shapes if you want decoration. Replace the promo card with a "Record verified" trust card (Section 2) |
| Mock people photos and "MediApp" branding | **Do not reproduce.** Use CareGrid branding and your own uploaded photos / initials |

### 1.1 Token additions (put in `tokens.css`)

```css
:root {
  /* backdrop + glass */
  --backdrop-from: oklch(0.80 0.050 205);
  --backdrop-to:   oklch(0.87 0.040 220);
  --glass-bg:      oklch(1 0 0 / 0.55);
  --glass-border:  oklch(1 0 0 / 0.60);
  --glass-blur:    20px;
  --radius-shell:  28px;
  --radius-card:   22px;

  /* pastel tiles */
  --tint-mint:   oklch(0.95 0.040 160);
  --tint-sky:    oklch(0.95 0.035 235);
  --tint-butter: oklch(0.96 0.055 95);

  /* primary = ink pill */
  --btn-primary-bg: var(--ink);
  --btn-primary-fg: oklch(0.99 0 0);
}
.dark {
  --backdrop-from: oklch(0.22 0.030 235);
  --backdrop-to:   oklch(0.17 0.025 250);
  --glass-bg:      oklch(0.25 0.020 250 / 0.60);
  --glass-border:  oklch(1 0 0 / 0.08);
  --tint-mint:   oklch(0.30 0.035 160);
  --tint-sky:    oklch(0.30 0.035 235);
  --tint-butter: oklch(0.32 0.045 95);
  --btn-primary-bg: oklch(0.96 0.005 250);
  --btn-primary-fg: oklch(0.20 0.02 250);
}
@media (prefers-reduced-transparency: reduce) {
  :root { --glass-bg: var(--surface); --glass-blur: 0px; }
}
```

### 1.2 Where it applies
- **Patient portal:** full glass shell + bento cards (this is the hero look).
- **Hospital/staff, pharmacy, lab:** same tokens and card/tile language, but a flatter shell (no large blur), tighter spacing, compact mode.
- **Dashboard (observability):** dark variant of the same system.
- **Landing:** can use the glass shell as a "product preview" frame inside the hero.

### 1.3 Accessibility guardrails for this look
- Muted text on pastel tiles must still reach 4.5:1; test every tint in light and dark.
- Never rely on glass transparency for legibility: text sits on opaque or near-opaque surfaces.
- Chart series need non-colour cues (dash pattern, markers, direct end-labels) and a "View as table" toggle.
- Dual-axis charts: label units on each axis and in the legend. Prefer two small stacked charts when units differ a lot.

---

## 2. Patient dashboard: widget mapping to real data

Classification: **Free** = data already exists in the app; **Small** = additive backend/form change; **Large** = new feature, defer unless you want it.

| Reference widget | CareGrid patient widget | Data source | Class |
|---|---|---|---|
| Sidebar nav | Dashboard · Visits · Records · Access & consent · Proof · Profile · (Notifications) | Existing routes (`/overview`, `/visits`, `/ehr`, `/access`, `/signatures`, profile) | Free |
| Search box | Search visits, medicines, doctors, lab results | Client-side over already-loaded data | Free |
| "My parameters" chart, tabs Weight · BP · Pulse | **My vitals**: tabs Blood pressure · Pulse · SpO₂ · Temperature · Weight/BMI, period selector | Vitals inside each visit's off-chain JSON (BP, pulse, temp, SpO₂ are in your sample payload). Needs patient-api to return a vitals history series | Free / Small |
| Weight and % Fat | Weight (kg) and BMI. **Skip body-fat** | Add optional `weightKg` and `heightCm` to the nurse vitals form; stored in the visit JSON (no chaincode change expected) | Small |
| Calendar with event dots | Month calendar: dots on days with visits, lab results, prescriptions; today highlighted | Visit dates (free); upcoming dates need `scheduledAt` (below) | Free / Small |
| "My appointments" rows with doctor photo, specialty, time | **My visits & appointments**: status-tinted rows with doctor photo, department, time, status stepper | Visit list + doctor profile (photo, specialty). Needs doctor public-profile fields (Section 3) and `scheduledAt` | Small |
| "New Appointment" button | **Option A** (default): hide. **Option B:** "Request appointment" (patient asks, reception confirms). **Option C:** full self-booking with slots | A = none; B = new off-chain `appointment_requests` + reception queue; C = availability model | A free, B Small-Medium, C Large |
| "My treatment" tiles (name, "2 times per day") | **My medicines**: tinted tiles with name, dose, frequency, until-date, prescribing doctor | Prescriptions in visit JSON. Add structured fields `dose`, `frequencyPerDay`, `durationDays`, `instructions` to the doctor's prescription form; keep the old free-text `frequency` for compatibility | Small |
| "New Medication" button | **Remove.** Patients must not add prescriptions. Replace with "View all prescriptions" | — | — |
| Notifications badge | Notification centre: new lab result, prescription added, visit status change, consent expiring | Derived on the client from visit/consent data, or a small `/notifications` endpoint later | Free / Small |
| Chats badge | **Defer.** Secure messaging is a new subsystem (storage, encryption, moderation). Hide behind a feature flag; do not fake it | — | Large |
| Promo card ("Subscribe") | **"Record verified" trust card:** latest block number, last sync time, "Verify my record" button opening the VerifyDrawer | Existing signature/verification data | Free |
| User chip (name, email) | Name + patient ID (masked) + logout menu | Existing auth context | Free |

**Recommendation:** ship A for "New Appointment" and Small for everything else now. Add B later if the demo needs it.

---

## 3. Backend change spec: doctor photos (required at registration)

### 3.1 Decisions
| Question | Decision | Why |
|---|---|---|
| Store photos on-chain? | **No** | Staff photos aren't clinical records; immutable storage is wrong for personal images |
| Store photos in IPFS? | **No** | Content-addressed and replicated, so hard to delete or replace when a doctor leaves or asks for removal. Your docs already treat off-chain auth data separately |
| Where? | A **named Docker volume** (`staff-photos`) mounted into the service that owns staff registration (documented as `peer0-api`, port 4001: reception, staff auth and admin). Metadata goes in the **same store peer0-api already uses for staff accounts** | No new infrastructure; survives container rebuilds |
| Who must upload? | `doctor` role: **required**. Nurse, pharmacist, lab tech: optional (config flag `REQUIRE_PHOTO_ROLES=doctor`) | Matches your requirement; easy to widen |
| Existing doctors without photos? | Not blocked. UI shows initials avatar; admin Staff page flags "Photo missing" with an upload action. Optional seed script for demo doctors | Backward compatible |

> I have not seen the backend code. Everything below must be checked against `peer0-api`, `patient-api` and `shared/` before editing (Prompt 2B does this first). If staff accounts live somewhere else than assumed, apply the same design there.

### 3.2 API contract (additive; keep existing paths working)

| Endpoint | Change |
|---|---|
| `POST …/staff` (existing staff registration; confirm exact path) | Accept `multipart/form-data` **in addition to** the existing JSON body. New file field `photo`. If role ∈ `REQUIRE_PHOTO_ROLES` and no valid photo → `400 {code:"PHOTO_REQUIRED"}`. Add optional `specialty`, `department`, `qualification`, `displayName` |
| `PUT …/staff/:id/photo` (new) | Replace photo. Allowed: `admin`, or the staff member themselves |
| `GET …/staff/:id/photo?size=sm\|md\|lg` (new) | Returns processed WebP. Requires auth or a signed URL (see 3.4). `Cache-Control: private, max-age=3600`, `ETag` |
| `GET …/staff/:id/public-profile` (new, internal/`patient-api`-facing) | `{id, displayName, role, specialty, department, qualification, photoUrl}`. **No** contact details, credentials or internal IDs beyond what patients already see |
| `patient-api` visit list/detail responses | Embed `doctor: {id, displayName, specialty, photoUrl}` and, for nurses, the same shape. Keep all existing fields untouched |
| `OpenVisit` payload | Optional `scheduledAt` (ISO) and `department`, stored in the visit JSON (off-chain) |
| Nurse vitals payload | Optional `weightKg`, `heightCm` |
| Prescription payload | Optional `dose`, `frequencyPerDay`, `durationDays`, `instructions` |

All new request/response fields are **optional**; old clients keep working.

### 3.3 Upload handling (follows the usual OWASP file-upload guidance)
1. `multer` with memory storage; limits: 1 file, **5 MB**, field name `photo` only.
2. Allow-list **JPEG, PNG, WebP** by **magic bytes** (e.g. `file-type`), never by extension or client `Content-Type`. Reject SVG, GIF, HEIC, PDFs and anything else.
3. Decode and **re-encode with `sharp`**: apply EXIF orientation, then strip all metadata (GPS, device info), centre-crop square, output WebP at 96 / 256 / 512 px. Set `limitInputPixels` to defend against decompression bombs. Reject if shorter side < 256 px.
4. Never use the original filename. Store as `<uuid>-<size>.webp` in the `staff-photos` volume, outside any static web root. Save the SHA-256 of the 512 px variant in the staff record.
5. Serve only through the API handler with fixed `Content-Type: image/webp` and `X-Content-Type-Options: nosniff`.
6. Rate-limit the upload endpoints; write an audit entry (uploader, target staff, time, result) with no image contents.
7. **Atomic registration:** process and store the image first; create the account; if account creation or Fabric identity enrollment fails, delete the stored image. If the image fails, do not create the account.
8. **nginx:** the default `client_max_body_size` is 1 MB, so 5 MB uploads would fail at the proxy. Add a limit of 6 MB **only on the staff upload routes**. This is a small, documented nginx change and needs its own rollback note.
9. **Docker:** `sharp` ships platform-specific binaries. Install it inside the container image (your named `node_modules` volumes already isolate Linux binaries), rebuild the image, confirm `sharp` loads at startup.

### 3.4 Serving photos to a patient's `<img>` tag
`<img>` can't send an `Authorization` header. Two options:
- **Signed URL (recommended):** the API returns `photoUrl` with `?exp=<unix>&sig=<hmac>`; the photo handler verifies signature and expiry (e.g. 1 h). No cookie changes.
- Blob fetch through the existing Axios interceptor, then `URL.createObjectURL`. Simple but loses native browser caching.

Authorization rule: a patient can obtain a doctor's photo URL **only** for doctors/nurses linked to that patient's visits (it comes embedded in their visit data). Staff can see colleagues' photos.

### 3.5 Staff registration UI (hospital portal, Admin → Staff)
"Add staff" becomes a 3-step wizard:
1. **Identity:** name, role, department/specialty, qualification.
2. **Photo:** drop zone + camera/file picker, circular cropper (e.g. `react-easy-crop`), live preview "This is how patients will see you", clear rules text (JPEG/PNG/WebP, up to 5 MB, face clearly visible, min 256 px), **required** badge for doctors; continue disabled until valid.
3. **Credentials & confirm:** existing credential fields, summary card with photo, submit.
Show server errors per field (`PHOTO_REQUIRED`, wrong type, too large, too small). Existing roster table gets avatars and a "Photo missing" chip with an upload action.

### 3.6 Tests required
- Unit: wrong type, spoofed `Content-Type`, SVG, zero-byte, 20 MB file, huge-pixel image, polyglot file, image with GPS EXIF (must be stripped).
- Integration: register doctor with/without photo; register nurse without photo; replace photo; failed enrollment cleans up the file; atomicity.
- Authorization: patient can't read an unrelated doctor's photo; expired/tampered signature is rejected.
- End-to-end via port 80: upload a 4 MB photo through nginx.

---

## 4. Backend change policy (rules-file amendment)

Replace the "Hard boundaries" backend line in `.agent/rules/00-caregrid-frontend.md` with:

```markdown
## Backend changes (allowed only under these rules)
- Allowed only in Phase 2B or when a phase prompt explicitly says so. Never as a side effect of UI work.
- Additive and backward compatible: new optional fields, new endpoints. Never remove or rename an existing field, path, status code or error shape.
- No changes to chaincode, Fabric network config, orderer/peer settings, crypto material, or container ports.
- Every backend change is logged in docs/redesign/BACKEND_CHANGES.md: files touched, new/changed endpoints, migration notes, rollback steps.
- Tests required for each change; old frontends/contract (docs/redesign/FRONTEND_CONTRACT.md) must still pass.
- Any new dependency (e.g. multer, sharp, file-type) is added inside the owning service's package.json and verified to install in its Docker image.
- Do not log image contents or PHI. Treat all uploads as untrusted input.
```

---

## 5. Updated and new prompts

### 5.1 Phase 1 amendment (append to the design-system prompt)

```markdown
ADDITION TO PHASE 1: Implement the "Soft Glass Bento" language from docs/redesign/ADDENDUM_01 §1 using the reference image docs/redesign/reference/patient-dashboard.png (attached). Add tokens (§1.1), a GlassShell layout, Card with title/description slots, tinted Tile (mint/sky/butter), ink-pill Button, SegmentedControl chips, MiniCalendar with event dots, DoctorAvatar (photo → initials fallback, sizes sm/md/lg, alt text = name), SmoothLineChart wrapper (gradient fill, non-colour series cues, "view as table"), TrustCard. Recreate the layout language only: do NOT reproduce the reference's brand, people photos, 3D capsule art, or the subscription promo. Verify AA contrast for every tint in light and dark, and provide the reduced-transparency fallback.
```

### 5.2 NEW Phase 2B — Backend additions (run before the patient portal)

```markdown
PHASE 2B — BACKEND ADDITIONS (doctor photos + supporting fields). Read .agent/rules/00-caregrid-frontend.md (backend-change rules) and docs/redesign/ADDENDUM_01 §3 first.

Step 1 — Explore (no edits): inspect peer0-api (staff registration and auth), patient-api (visit list/detail, vitals), peer1-api (prescriptions), peer2-api (nurse vitals), shared/, and nginx.conf. Report: where staff accounts are stored, how Fabric identities are enrolled at registration, the exact existing paths and payloads, how visit/vitals/prescription JSON is built and pinned, and how patient-api resolves doctors today. Post a written plan listing every file you will touch. Wait for my approval.

Step 2 — Implement exactly the contract in ADDENDUM_01 §3.2–§3.4:
 a) Staff registration accepts multipart with `photo`; doctors require it (REQUIRE_PHOTO_ROLES env, default "doctor"); atomic create/cleanup; new endpoints PUT photo, GET photo (signed-URL support), GET public-profile.
 b) Upload pipeline per §3.3 (multer memory, magic-byte allow-list, sharp re-encode to 96/256/512 WebP, EXIF stripped, limitInputPixels, uuid filenames, named volume `staff-photos` added in the service's compose entry only, nosniff, rate limit, audit log).
 c) patient-api embeds `doctor: {id, displayName, specialty, photoUrl}` in visit list/detail; add a vitals-history endpoint returning time-ordered series (BP, pulse, SpO2, temp, weightKg, bmi) built from existing visit data; keep all existing fields.
 d) Optional `scheduledAt`/`department` on OpenVisit; optional `weightKg`/`heightCm` on nurse vitals; optional `dose`/`frequencyPerDay`/`durationDays`/`instructions` on prescriptions — all stored in the off-chain JSON; confirm no chaincode change is needed (if one IS needed, STOP and tell me).
 e) nginx: raise client_max_body_size to 6m only on the staff photo routes; document the exact lines and rollback.
 f) Seed script scripts/seed-doctor-photos.js that reads seed/photos/<staffId>.jpg for existing demo doctors and uploads them through the new pipeline (skip missing files; never overwrite an existing photo without --force).

Step 3 — Verify: run the tests in ADDENDUM_01 §3.6; run /contract-diff (old payloads must still work); run ./start.sh and confirm all containers healthy; upload a 4 MB photo through http://localhost/; confirm a doctor registration without a photo returns PHOTO_REQUIRED; confirm GPS EXIF is stripped from the stored file.

Step 4 — Docs: update docs/redesign/BACKEND_CHANGES.md, FRONTEND_CONTRACT.md (new fields/endpoints), and docs/architecture.md (photo storage note). List anything you could not do.

Do not start any frontend work in this phase.
```

### 5.3 REPLACES D2 — Patient portal (after Phase 2B)

```markdown
PHASE 2 — PATIENT PORTAL with the reference look. Prerequisite: Phases 1 and 2B done. Attach docs/redesign/reference/patient-dashboard.png.

Rebuild every page of patient-portal from scratch in the "Soft Glass Bento" language (ADDENDUM_01 §1), keeping routes, AuthContext, api.js and pdfGenerator logic. Use ADDENDUM_01 §2 as the widget spec.

Dashboard (/overview), desktop layout like the reference: glass shell; left nav (General: Dashboard, Visits, Records · Tools: Access & consent, Proof, Notifications, Profile) with white-pill active state and black count badges; top search; header "Dashboard".
 - "My vitals" card (wide): tab chips BP · Pulse · SpO₂ · Temp · Weight/BMI, period select, smooth line chart with non-colour cues and "view as table"; empty state if no history.
 - Calendar card: month grid, dots on days with visits/labs/prescriptions, today highlighted.
 - "My visits & appointments" card: tinted rows (status → tint) with DoctorAvatar (uploaded photo, initials fallback), department, time (scheduledAt if present, otherwise visit date), doctor name, status chip, kebab → View details. No "New Appointment" button (Option A).
 - "My medicines" card: tinted tiles with name, dose, frequency ("2 times per day" from frequencyPerDay, otherwise the free-text frequency), until-date, prescribing doctor. "View all prescriptions" instead of "New Medication".
 - TrustCard replacing the promo: latest block, last sync, "Verify my record" → VerifyDrawer.
 - Notifications badge: derived from new lab results, new prescriptions, visit status changes, consent expiring.
 - Chats: do not render (feature flag off).
Mobile (390px): single column, bottom tab bar, full-bleed cards, no blur shell.

Other pages: Visits (timeline), Visit detail (tabs + DoctorAvatar + VerifiedBadge), EHR (record vault), Access (consent centre), Signatures (Proof), Profile, Login — as in PLAN.md §6.1 and the D2 prompt, now in the glass/bento language. Doctor name + photo must appear on visit rows, visit detail and consent entries wherever a doctor is shown.

Rules: if the API lacks a field, show a neutral placeholder and log it in GAPS.md; never invent doctor photos; alt text on every image; dark mode + compact mode working; DataSourceTag on anything mocked.

Verify: /verify-app, /contract-diff, /dont-break; side-by-side screenshots (desktop + mobile) vs baseline and vs the reference; confirm a newly registered doctor's uploaded photo shows in the patient's visit list.
```

### 5.4 Phase 3 amendment (append to the hospital-portal prompt)

```markdown
ADDITION TO PHASE 3: 
 1) Admin → Staff gets the 3-step "Add staff" wizard from ADDENDUM_01 §3.5 (photo step with cropper, required for doctors, per-field server errors) and a roster with avatars and "Photo missing" chips with an upload action. Uses the Phase 2B endpoints only.
 2) Nurse vitals form: add optional weight (kg) and height (cm) with unit-aware inputs; show BMI live.
 3) Doctor prescription form: structured dose, times per day (1–4 or as-needed), duration (days), instructions; still send the legacy free-text `frequency` string for old clients.
 4) OpenVisit wizard: optional date/time (`scheduledAt`) and department.
 5) Everywhere staff are shown (queues, chart banner, roster) use DoctorAvatar.
```

---

## 6. Order of work (updated)

0 Safety net → 1 Design system (with Soft Glass Bento) → **2B Backend additions** → 2 Patient portal → 3 Hospital portal (incl. staff registration photos) → 4 Dashboard → 5 Lab/Pharmacy/Hub → 6 Landing → 7 Polish.

For the fastest visible win before a demo: 0 → 1 → 2B → 2 → 3 (admin staff wizard + doctor + receptionist) → 6.

---

## 7. References
- OWASP File Upload Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- Secure image upload API with Node.js, Express, Multer — https://transloadit.com/devtips/secure-image-upload-api-with-node-js-express-and-multer/
- Checking uploads with magic numbers in Node.js — https://transloadit.com/devtips/secure-api-file-uploads-with-magic-numbers/
