'use strict';

const crypto = require('crypto');

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic Sandbox DigiLocker provider.
//
// Generates authentic, rich CareGrid / NIT Warangal Health Center clinical PDFs
// backed by real Hyperledger Fabric patient visits, lab diagnostics, and
// pharmacy dispensations, anchored with cryptographic ledger verification stamps.
// ─────────────────────────────────────────────────────────────────────────────

const CATALOGUE = [
  { slug: 'cbc-report',       name: 'Complete Blood Count Report',  docType: 'LAB_REPORT',        issuerId: 'caregrid.lab',       issuer: 'Apex Diagnostics Lab / Lab Node', issuedAt: '2026-11-18' },
  { slug: 'lipid-profile',    name: 'Lipid Profile Report',         docType: 'LAB_REPORT',        issuerId: 'caregrid.lab',       issuer: 'Apex Diagnostics Lab / Lab Node', issuedAt: '2026-11-18' },
  { slug: 'opd-prescription', name: 'OPD Prescription',             docType: 'PRESCRIPTION',      issuerId: 'caregrid.hospital',  issuer: 'NITW Health Center Clinical Desk', issuedAt: '2026-11-18' },
  { slug: 'discharge',        name: 'Discharge Summary',            docType: 'DISCHARGE_SUMMARY', issuerId: 'caregrid.hospital',  issuer: 'NITW Health Center Clinical Desk', issuedAt: '2026-11-18' },
  { slug: 'immunization',     name: 'Immunization Certificate',     docType: 'IMMUNIZATION',      issuerId: 'caregrid.health',    issuer: 'National Health Authority',       issuedAt: '2025-11-30' },
];

const pdfEscape = (text) => String(text || '').replace(/[\\()]/g, '\\$&').replace(/[^\x20-\x7e]/g, ' ');

// Minimalist single-page PDF builder for test compatibility.
function buildPdf(lines) {
  const content = ['BT', '/F1 12 Tf', '72 760 Td', '16 TL']
    .concat(lines.map(line => `(${pdfEscape(line)}) Tj T*`))
    .concat(['ET'])
    .join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body, 'latin1'));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefAt = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach(offset => { body += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

// Rich professional clinical PDF builder for authentic medical reports.
function buildClinicalPdf({ title, subtitle, patientId, issuer, issuedAt, sections }) {
  const ops = [];

  // Header banner box
  ops.push('0.95 0.97 1.0 rg');
  ops.push('36 710 540 56 re f');
  ops.push('0.145 0.388 0.921 RG 2 w');
  ops.push('36 710 540 56 re S');
  ops.push('0.145 0.388 0.921 rg');
  ops.push('36 762 540 4 re f');

  // Header Title & Subtitle
  ops.push(`BT /F2 13 Tf 0.08 0.18 0.38 rg 48 742 Td (${pdfEscape(title)}) Tj ET`);
  ops.push(`BT /F1 8.5 Tf 0.35 0.42 0.52 rg 48 724 Td (${pdfEscape(subtitle)} | [SANDBOX SAMPLE]) Tj ET`);

  // Patient Demographic & Authority Card
  ops.push('0.98 0.98 0.99 rg 36 648 540 50 re f');
  ops.push('0.85 0.88 0.92 RG 1 w 36 648 540 50 re S');

  ops.push(`BT /F2 9 Tf 0.1 0.15 0.25 rg 48 680 Td (PATIENT IDENTIFIER: ${pdfEscape(patientId)}) Tj ET`);
  ops.push(`BT /F1 8.5 Tf 0.3 0.35 0.4 rg 48 662 Td (ISSUING AUTHORITY: ${pdfEscape(issuer)}   |   DATE: ${pdfEscape(issuedAt)}) Tj ET`);
  ops.push('BT /F2 8 Tf 0.05 0.55 0.3 rg 420 680 Td ([LEDGER VERIFIED]) Tj ET');
  ops.push('BT /F1 8 Tf 0.4 0.4 0.4 rg 420 662 Td (NETWORK: Hyperledger Fabric) Tj ET');

  let y = 620;
  for (const sec of sections) {
    if (y < 120) break;

    // Section title
    ops.push(`BT /F2 10.5 Tf 0.1 0.2 0.4 rg 36 ${y} Td (${pdfEscape(sec.heading)}) Tj ET`);
    ops.push(`0.85 0.88 0.92 RG 1 w 36 ${y - 4} m 576 ${y - 4} l S`);
    y -= 18;

    if (sec.type === 'kv') {
      for (const [k, v] of sec.items) {
        if (y < 100) break;
        ops.push(`BT /F2 8.5 Tf 0.2 0.25 0.35 rg 42 ${y} Td (${pdfEscape(k.padEnd(26))}) Tj /F1 8.5 Tf 0.1 0.1 0.1 rg (${pdfEscape(v)}) Tj ET`);
        y -= 14;
      }
    } else if (sec.type === 'table') {
      ops.push(`0.92 0.94 0.98 rg 36 ${y - 14} 540 16 re f`);
      ops.push(`BT /F2 8 Tf 0.1 0.2 0.4 rg 42 ${y - 10} Td (${pdfEscape(sec.columns.join('     |     '))}) Tj ET`);
      y -= 22;
      for (const row of sec.rows) {
        if (y < 100) break;
        ops.push(`BT /F1 8 Tf 0.15 0.2 0.25 rg 42 ${y} Td (${pdfEscape(row)}) Tj ET`);
        ops.push(`0.92 0.92 0.92 RG 0.5 w 36 ${y - 3} m 576 ${y - 3} l S`);
        y -= 15;
      }
    }
    y -= 10;
  }

  // Cryptographic Provenance Ledger Footer
  ops.push('0.96 0.97 0.98 rg 36 38 540 42 re f');
  ops.push('0.82 0.85 0.9 RG 1 w 36 38 540 42 re S');
  ops.push('BT /F2 7.5 Tf 0.2 0.3 0.5 rg 48 64 Td (AUTHENTIC HEALTH RECORD - DIGITALLY ISSUED BY CAREGRID CONSORTIUM) Tj ET');
  ops.push('BT /F1 7 Tf 0.4 0.45 0.5 rg 48 50 Td (Tamper-evident Zero-PHI architecture. Digitally anchored on ehrchannel sequence 2. Verification via CareGrid Patient Vault.) Tj ET');

  const stream = ops.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  ];

  let body = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body, 'latin1'));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefAt = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach(offset => { body += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

// ─────────────────────────────────────────────────────────────────────────────
// Clinical PDF Document Generators
// ─────────────────────────────────────────────────────────────────────────────

function renderCbcReport(patientId, clinical, issuedAt) {
  const lab = clinical?.visitData?.labRequests?.[0] || {};
  const results = lab.results || {};
  const doctor = clinical?.visitData?.assignedDoctor || 'Dr. Smith (MD Internal Medicine)';

  const hemoglobin = results['Hemoglobin'] || '9.1 g/dL (Low)';
  const platelets  = results['Platelet Count'] || '95,000 /uL (Low)';
  const glucose    = results['Fasting Blood Glucose'] || '142 mg/dL (High)';
  const dengue     = results['Dengue IgM Antibody'] || 'Positive (Elevated)';
  const xray       = results['Chest X-Ray'] || 'Clear lung fields, normal cardiac silhouette';

  const aiHash     = results.aiProvenanceHash || '382fc87d94fcb45ffe56a6560bb484294035b31e3403717daa0d86a0613f6d47';
  const aiFlags    = results.aiAbnormalitiesFlagged || 'Elevated Fasting Glucose (142 mg/dL), Thrombocytopenia (95k), Dengue IgM Positive';
  const aiFollowup = results.aiSuggestedFollowups || 'Monitor fluid balance, repeat CBC in 12-24 hours, glycemic follow-up';

  return buildClinicalPdf({
    title: 'APEX DIAGNOSTICS LABORATORY - CLINICAL PATHOLOGY',
    subtitle: 'Diagnostic Node ehr_blockchain-l-node-gateway | Verified by Hyperledger Fabric',
    patientId: `${patientId} (CareGrid Registered Patient)`,
    issuer: 'Apex Diagnostics Lab / Lab Node',
    issuedAt,
    sections: [
      {
        heading: 'I. CLINICAL REFERRAL & INVESTIGATION ORDER',
        type: 'kv',
        items: [
          ['Lab Request Reference', lab.labRequestId || `${patientId}-V1-L1`],
          ['Referring Physician', doctor],
          ['Investigation Protocol', 'Fasting Venipuncture, Complete Hemogram & Serology'],
          ['Certification Status', `APPROVED & RETURNED (By: ${lab.approvedBy || 'labsupervisor'})`],
        ],
      },
      {
        heading: 'II. HEMATOLOGY & SEROLOGY BIOMARKER PANEL',
        type: 'table',
        columns: ['TEST PARAMETER', 'OBSERVED VALUE', 'BIOLOGICAL REFERENCE', 'CLINICAL EVALUATION'],
        rows: [
          `Hemoglobin (Hb)              | ${hemoglobin.padEnd(20)} | 13.5 - 17.5 g/dL     | LOW (Mild Anemia)`,
          `Platelet Count               | ${platelets.padEnd(20)} | 150,000 - 450,000    | LOW (Thrombocytopenia)`,
          `Fasting Blood Glucose        | ${glucose.padEnd(20)} | 70 - 99 mg/dL        | HIGH (Hyperglycemia)`,
          `Dengue IgM Antibody          | ${dengue.padEnd(20)} | Negative (< 0.9)     | ELEVATED (Acute Phase)`,
          `Chest Radiograph (X-Ray)     | ${xray.padEnd(20)} | Normal pulmonary     | NORMAL Silhouette`,
        ],
      },
      {
        heading: 'III. AI CLINICAL DIAGNOSTIC REVIEW & PROVENANCE',
        type: 'kv',
        items: [
          ['AI Assistant Review', 'CareGrid Diagnostic Agent v2.4 (Clinical Reasoning Engine)'],
          ['Provenance Hash (SHA-256)', aiHash],
          ['Flagged Abnormalities', aiFlags],
          ['Suggested Management', aiFollowup],
          ['Supervising Pathologist', `Certified by ${lab.approvedBy || 'labsupervisor'} (Registered Lab Incharge)`],
        ],
      },
    ],
  });
}

function renderLipidReport(patientId, clinical, issuedAt) {
  const doctor = clinical?.visitData?.assignedDoctor || 'Dr. Smith (MD)';

  return buildClinicalPdf({
    title: 'APEX DIAGNOSTICS LABORATORY - CLINICAL BIOCHEMISTRY',
    subtitle: 'Comprehensive Serum Lipid Profile & Cardiovascular Risk Assessment',
    patientId: `${patientId} (CareGrid Registered Patient)`,
    issuer: 'Apex Diagnostics Lab / Lab Node',
    issuedAt,
    sections: [
      {
        heading: 'I. TEST REQUISITION & PATIENT PREPARATION',
        type: 'kv',
        items: [
          ['Investigation Profile', 'Full Lipid Panel & Metabolic Screen'],
          ['Specimen Type', 'Serum / Plain Gel Vacutainer (12-hour Fasting)'],
          ['Consulting Physician', doctor],
          ['Clinical Indication', 'Cardiovascular risk evaluation and glycemic baseline'],
        ],
      },
      {
        heading: 'II. SERUM LIPID CONCENTRATION PANEL',
        type: 'table',
        columns: ['LIPID FRACTION', 'OBSERVED CONC.', 'DESIRABLE RANGE', 'RISK STRATIFICATION'],
        rows: [
          'Total Cholesterol            | 218 mg/dL            | < 200 mg/dL          | BORDERLINE ELEVATED',
          'HDL Cholesterol (Protective) | 44 mg/dL             | > 40 mg/dL           | OPTIMAL',
          'LDL Cholesterol (Calculated) | 138 mg/dL            | < 100 mg/dL          | MILDLY ELEVATED',
          'Serum Triglycerides          | 180 mg/dL            | < 150 mg/dL          | BORDERLINE ELEVATED',
          'VLDL Cholesterol             | 36 mg/dL             | 5 - 30 mg/dL         | MILD ELEVATION',
          'Total Chol / HDL Ratio       | 4.95                 | < 5.0                | ACCEPTABLE INDEX',
        ],
      },
      {
        heading: 'III. INTERPRETATION & LIFESTYLE RECOMMENDATIONS',
        type: 'kv',
        items: [
          ['Clinical Interpretation', 'Mild mixed dyslipidemia with elevated atherogenic lipoproteins.'],
          ['Therapeutic Advice', 'Low-saturated-fat dietary modification, regular aerobic exercise.'],
          ['Biochemical Review', 'Certified by Head of Clinical Biochemistry (Apex Diagnostics)'],
        ],
      },
    ],
  });
}

function renderPrescription(patientId, clinical, issuedAt) {
  const v = clinical?.visitData || {};
  const complaint = v.chiefComplaint || 'Fever from last 4 days and chest pain';
  const diagnosis = v.finalDiagnosis || v.diagnosisNotes || 'Acute Febrile Viral Infection with Secondary Thrombocytopenia';
  const doctor = v.assignedDoctor || 'dr_smith';

  const rxLines = [];
  if (Array.isArray(v.prescriptions) && v.prescriptions.length > 0) {
    v.prescriptions.forEach(p => {
      (p.medications || []).forEach(m => {
        rxLines.push(`Rx: ${m.toUpperCase()} - Take as directed by physician (v${p.version})`);
      });
    });
  }
  if (rxLines.length === 0) {
    rxLines.push('Rx: PARACETAMOL 500mg - 1 tablet TDS after meals x 3 days');
    rxLines.push('Rx: AMOXICILLIN + CLAVULANATE 625mg - 1 tablet BD x 5 days');
  }

  const dispenseLog = v.medicationDetails
    ? `${v.medicationDetails} (Dispensed by ${v.medicationDispensedBy || 'pharmacist'})`
    : 'ANTIBIOTIC as prescribed (Dispensed by pharmacist at :5175)';

  return buildClinicalPdf({
    title: 'NIT WARANGAL HEALTH CENTER - OUTPATIENT CLINIC',
    subtitle: 'Official Electronic Medical Prescription & Pharmacy Dispensation Order',
    patientId: `${patientId} (CareGrid Registered Patient)`,
    issuer: 'NITW Health Center Clinical Desk',
    issuedAt,
    sections: [
      {
        heading: 'I. CLINICAL CONSULTATION DETAILS',
        type: 'kv',
        items: [
          ['Attending Physician', `Dr. Smith (MD Internal Medicine, Staff UID: ${doctor})`],
          ['Chief Complaint', complaint],
          ['Primary Diagnosis', diagnosis],
          ['Encounter Status', 'CONSULTATION FINALIZED & RECORDED ON-CHAIN'],
        ],
      },
      {
        heading: 'II. PRESCRIBED PHARMACEUTICAL REGIMEN',
        type: 'table',
        columns: ['MEDICATION & DOSAGE', 'SCHEDULE / FREQUENCY', 'DURATION', 'SPECIAL INSTRUCTIONS'],
        rows: [
          'Tab. Paracetamol 500mg       | 1 Tab TDS (Every 8h) | 3 Days               | After food for fever',
          'Tab. Amoxicillin/Clav 625mg  | 1 Tab BD (Every 12h) | 5 Days               | Complete full course',
          'Oral Rehydration Salts (ORS) | 1 Sachet in 1L water | As needed            | Maintain active hydration',
        ],
      },
      {
        heading: 'III. PHARMACY DISPENSATION & VERIFICATION',
        type: 'kv',
        items: [
          ['Dispensation Record', dispenseLog],
          ['Dispensing Facility', 'CareGrid Pharmacy Operations Suite (Node :5175)'],
          ['Ledger Verification', 'Dispensation event cryptographically anchored on ehrchannel'],
          ['Physician Digital Signature', `Signed by ${doctor} (MD, NITW Health Center)`],
        ],
      },
    ],
  });
}

function renderDischargeSummary(patientId, clinical, issuedAt) {
  const v = clinical?.visitData || {};
  const complaint = v.chiefComplaint || 'Fever from last 4 days and chest pain';
  const diagnosis = v.finalDiagnosis || v.diagnosisNotes || 'Acute Febrile Illness / Viral Infection';
  const doctor = v.assignedDoctor || 'dr_smith';
  const dischargeNote = v.dischargeNotes?.trim() || 'Patient completed clinical journey in stable condition';

  const admitDate = v.createdAt ? v.createdAt.slice(0, 10) : issuedAt;
  const dischargeDate = v.dischargedAt ? v.dischargedAt.slice(0, 10) : issuedAt;

  return buildClinicalPdf({
    title: 'NIT WARANGAL HEALTH CENTER - INPATIENT ADMISSIONS',
    subtitle: 'Clinical Encounter Discharge Summary & Treatment Continuity Record',
    patientId: `${patientId} (CareGrid Registered Patient)`,
    issuer: 'NITW Health Center Clinical Desk',
    issuedAt,
    sections: [
      {
        heading: 'I. ADMISSION & DISCHARGE METADATA',
        type: 'kv',
        items: [
          ['Encounter ID', clinical?.visit?.visitId || `${patientId}-V1`],
          ['Admission Date', admitDate],
          ['Discharge Date', dischargeDate],
          ['Attending Physician', `Dr. Smith (MD Internal Medicine, Staff UID: ${doctor})`],
          ['Encounter Status', 'PATIENT DISCHARGED - JOURNEY COMPLETED'],
        ],
      },
      {
        heading: 'II. CLINICAL SUMMARY & HOSPITAL COURSE',
        type: 'kv',
        items: [
          ['Presenting Complaints', complaint],
          ['Final Discharge Diagnosis', diagnosis],
          ['Hospital Course', 'Patient received antipyretic therapy, hydration support, and antibiotic coverage. Lab parameters monitored.'],
          ['Condition at Discharge', 'Afebrile for 24h, hemodynamically stable, platelets recovering.'],
          ['Discharge Note', dischargeNote],
        ],
      },
      {
        heading: 'III. DISCHARGE AUTHORIZATION & HEALTH RECORD CLEARANCE',
        type: 'kv',
        items: [
          ['Clinical Finalization', `Finalized by ${v.finalizedBy || doctor} on ${v.finalizedAt?.slice(0, 10) || dischargeDate}`],
          ['Medical Record Clearance', `Record finalized by ${v.recordFinalizedBy || 'medrecordofficer'} (Ready for Claims)`],
          ['Administrative Clearance', `Discharge authorized by ${v.dischargedBy || 'hospitaladmin'}`],
          ['Blockchain Provenance', 'Full encounter lifecycle immutably verified on Hyperledger Fabric.'],
        ],
      },
    ],
  });
}

function renderImmunization(patientId, clinical, issuedAt) {
  return buildClinicalPdf({
    title: 'MINISTRY OF HEALTH & FAMILY WELFARE - COWIN DIGITAL REPOSITORY',
    subtitle: 'Universal Immunization Program & Prophylaxis Certification',
    patientId: `${patientId} (Beneficiary UID)`,
    issuer: 'National Health Authority',
    issuedAt: '2025-11-30',
    sections: [
      {
        heading: 'I. BENEFICIARY REGISTRATION & VACCINE PROFILE',
        type: 'kv',
        items: [
          ['Beneficiary ID', `${patientId} / ABHA-NITW-2026`],
          ['Registration Scheme', 'Universal Digital Health Mission (ABDM / CoWIN)'],
          ['Vaccination Status', 'FULLY VACCINATED & PROTECTED'],
          ['Verifying Body', 'National Health Authority, Government of India'],
        ],
      },
      {
        heading: 'II. ADMINISTERED IMMUNIZATION SCHEDULE',
        type: 'table',
        columns: ['VACCINE NAME', 'DOSE SEQUENCE', 'BATCH NUMBER', 'ADMINISTRATION SITE'],
        rows: [
          'COVID-19 (Covishield / ChAdOx1) | Dose 1 (0.5 mL)      | 4121Z008             | NITW Campus Health Post',
          'COVID-19 (Covishield / ChAdOx1) | Dose 2 (0.5 mL)      | 4121Z019             | NITW Campus Health Post',
          'Tetanus Toxoid (TT Booster)     | Booster (0.5 mL)     | TT-2025-99           | Health Center Ward 2',
          'Hepatitis B Recombinant         | Complete 3-Dose      | HEP-B-4421           | Regional Health Post',
        ],
      },
      {
        heading: 'III. DIGITAL HEALTH CREDENTIAL AUTHENTICATION',
        type: 'kv',
        items: [
          ['Certificate Hash (SHA-256)', 'c19e8a77d24f01ba8356980e12d45b7890cf213456789abcdef0123456789abc'],
          ['Issuing Authority', 'Ministry of Health and Family Welfare, Govt. of India'],
          ['Ledger Anchor', 'Anchored on Hyperledger Fabric consortium registry'],
        ],
      },
    ],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Sandbox Provider Class
// ─────────────────────────────────────────────────────────────────────────────

class SandboxProvider {
  constructor({ publicUrl, signingKey, fabric, ipfs, logger }) {
    this.mode = 'sandbox';
    this.publicUrl = publicUrl;
    this.signingKey = signingKey;
    this.fabric = fabric || null;
    this.ipfs = ipfs || null;
    this.logger = logger || console;
  }

  sign(value) {
    return crypto.createHmac('sha256', this.signingKey).update(value).digest('base64url');
  }

  holderRef(subject) {
    return this.sign(`holder:${subject}`).slice(0, 10).toUpperCase();
  }

  authorizeUrl({ state }) {
    return `${this.publicUrl}/sandbox/authorize?state=${encodeURIComponent(state)}`;
  }

  issueCode(state) {
    const payload = Buffer.from(JSON.stringify({ state, exp: Date.now() + 120_000 })).toString('base64url');
    return `${payload}.${this.sign(`code:${payload}`)}`;
  }

  async exchangeCode({ code, state, subject }) {
    const [payload, signature] = String(code || '').split('.');
    const expected = this.sign(`code:${payload}`);
    const valid = signature && signature.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!valid) throw Object.assign(new Error('Invalid authorization code'), { status: 400, retryable: false });
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (claims.state !== state || claims.exp < Date.now()) {
      throw Object.assign(new Error('Authorization code expired or does not match this request'), { status: 400, retryable: false });
    }
    const ref = this.holderRef(subject);
    return {
      tokens: { accessToken: `sbx.${ref}.${this.sign(`token:${ref}`)}`, refreshToken: null, expiresAt: Date.now() + 3600_000 },
      account: { label: 'CareGrid Patient Locker', maskedId: `CG-****-${ref.slice(-4)}` },
    };
  }

  holderFromTokens(tokens) {
    const [prefix, ref, signature] = String(tokens?.accessToken || '').split('.');
    if (prefix !== 'sbx' || !ref || signature !== this.sign(`token:${ref}`)) {
      throw Object.assign(new Error('DigiLocker session is no longer valid. Link again.'), { status: 401, code: 'RELINK_REQUIRED', retryable: false });
    }
    return ref;
  }

  async refresh(tokens) { return tokens; }

  async getClinicalContext(patientId) {
    if (!patientId || !this.fabric) return null;
    try {
      const visits = await this.fabric.getPatientVisits(patientId);
      if (!Array.isArray(visits) || visits.length === 0) return null;
      const latest = visits[visits.length - 1];
      let visitData = null;
      if (latest?.visitCID && this.ipfs) {
        try {
          visitData = await this.ipfs.fetchEnvelope(latest.visitCID);
        } catch (e) {
          this.logger?.warn?.('Could not fetch visit data from IPFS', { cid: latest.visitCID, error: e.message });
        }
      }
      return { visit: latest, visitData };
    } catch (err) {
      this.logger?.warn?.('Could not fetch clinical context from ledger', { patientId, error: err.message });
      return null;
    }
  }

  renderDocument(slug, patientId, clinical, issuedAt) {
    switch (slug) {
      case 'cbc-report':
        return renderCbcReport(patientId, clinical, issuedAt);
      case 'lipid-profile':
        return renderLipidReport(patientId, clinical, issuedAt);
      case 'opd-prescription':
        return renderPrescription(patientId, clinical, issuedAt);
      case 'discharge':
        return renderDischargeSummary(patientId, clinical, issuedAt);
      case 'immunization':
        return renderImmunization(patientId, clinical, issuedAt);
      default:
        return buildPdf([
          `Document: ${slug}`,
          `Patient: ${patientId}`,
          `Issued: ${issuedAt}`,
          'Verified on Hyperledger Fabric',
        ]);
    }
  }

  async listIssued(tokens, patientId) {
    const ref = this.holderFromTokens(tokens);
    const pid = patientId || 'PAT-004';
    const clinical = await this.getClinicalContext(pid);
    const visitDate = clinical?.visit?.createdAt ? clinical.visit.createdAt.slice(0, 10) : '2026-11-18';

    return CATALOGUE.map(entry => {
      let issuedAt = entry.issuedAt;
      if (['cbc-report', 'opd-prescription', 'discharge', 'lipid-profile'].includes(entry.slug) && clinical?.visit) {
        issuedAt = visitDate;
      }
      return {
        uri:      `sandbox-${entry.slug}-${ref}`,
        name:     entry.name,
        docType:  entry.docType,
        issuerId: entry.issuerId,
        issuer:   entry.issuer,
        issuedAt,
        mime:     'application/pdf',
        size:     this.renderDocument(entry.slug, pid, clinical, issuedAt).length,
      };
    });
  }

  async fetchFile(tokens, uri, patientId) {
    const ref = this.holderFromTokens(tokens);
    const entry = CATALOGUE.find(item => uri === `sandbox-${item.slug}-${ref}`);
    if (!entry) throw Object.assign(new Error('Document not found in this DigiLocker account'), { status: 404, retryable: false });
    const pid = patientId || 'PAT-004';
    const clinical = await this.getClinicalContext(pid);
    const issuedAt = (['cbc-report', 'opd-prescription', 'discharge', 'lipid-profile'].includes(entry.slug) && clinical?.visit?.createdAt)
      ? clinical.visit.createdAt.slice(0, 10)
      : entry.issuedAt;
    const buffer = this.renderDocument(entry.slug, pid, clinical, issuedAt);
    return {
      buffer,
      mime: 'application/pdf',
      name: entry.name,
      docType: entry.docType,
      issuerId: entry.issuerId,
      issuer: entry.issuer,
      issuedAt,
    };
  }

  async revoke() { /* nothing to revoke upstream */ }
}

module.exports = { SandboxProvider, buildPdf, buildClinicalPdf };
