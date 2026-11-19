'use strict';

/**
 * labReport.js — structure, validation, flagging and hashing of a lab report.
 * Shared by extorg-api (lab), peer1-api (doctor) and patient-api (patient).
 *
 * A report lives inside the visit document:  clinical.labRequests[i].report
 *   {
 *     parameters: [{ name, value, unit, refLow, refHigh, refText, flag }],
 *     specimen, notes,
 *     attachments: [{ cid, filename, mimeType, size }],
 *     aiAnalysis: { ... } | null,        // assistive only, never part of the hash
 *     enteredBy, enteredAt, revision, resultsHash
 *   }
 * flag is NORMAL | LOW | HIGH | ABNORMAL | '' (no reference available).
 */

const crypto = require('crypto');

// Adult reference intervals. Laboratories set their own; these are common
// textbook intervals used as defaults and can be edited per result on entry.
// `f` overrides low/high for female patients where the interval differs.
const TEST_CATALOG = {
  'CBC': { label: 'Complete Blood Count', specimen: 'Whole blood (EDTA)', parameters: [
    { name: 'Hemoglobin', unit: 'g/dL', low: 13.0, high: 17.0, f: { low: 12.0, high: 15.5 } },
    { name: 'Total WBC Count', unit: '10^3/µL', low: 4.0, high: 11.0 },
    { name: 'RBC Count', unit: '10^6/µL', low: 4.5, high: 5.9, f: { low: 4.1, high: 5.1 } },
    { name: 'Platelet Count', unit: '10^3/µL', low: 150, high: 450 },
    { name: 'Hematocrit (PCV)', unit: '%', low: 40, high: 52, f: { low: 36, high: 46 } },
    { name: 'MCV', unit: 'fL', low: 80, high: 100 },
    { name: 'MCH', unit: 'pg', low: 27, high: 33 },
    { name: 'MCHC', unit: 'g/dL', low: 32, high: 36 },
  ] },
  'Lipid Profile': { label: 'Lipid Profile', specimen: 'Serum (fasting)', parameters: [
    { name: 'Total Cholesterol', unit: 'mg/dL', high: 200 },
    { name: 'LDL Cholesterol', unit: 'mg/dL', high: 100 },
    { name: 'HDL Cholesterol', unit: 'mg/dL', low: 40, f: { low: 50 } },
    { name: 'Triglycerides', unit: 'mg/dL', high: 150 },
  ] },
  'LFT': { label: 'Liver Function Test', specimen: 'Serum', parameters: [
    { name: 'Total Bilirubin', unit: 'mg/dL', low: 0.2, high: 1.2 },
    { name: 'Direct Bilirubin', unit: 'mg/dL', high: 0.3 },
    { name: 'ALT (SGPT)', unit: 'U/L', high: 40 },
    { name: 'AST (SGOT)', unit: 'U/L', high: 40 },
    { name: 'Alkaline Phosphatase', unit: 'U/L', low: 44, high: 147 },
    { name: 'Total Protein', unit: 'g/dL', low: 6.0, high: 8.3 },
    { name: 'Albumin', unit: 'g/dL', low: 3.5, high: 5.0 },
  ] },
  'KFT': { label: 'Kidney Function Test', specimen: 'Serum', parameters: [
    { name: 'Serum Creatinine', unit: 'mg/dL', low: 0.7, high: 1.3, f: { low: 0.6, high: 1.1 } },
    { name: 'Blood Urea', unit: 'mg/dL', low: 15, high: 45 },
    { name: 'Uric Acid', unit: 'mg/dL', low: 3.5, high: 7.2, f: { low: 2.6, high: 6.0 } },
    { name: 'Sodium', unit: 'mmol/L', low: 135, high: 145 },
    { name: 'Potassium', unit: 'mmol/L', low: 3.5, high: 5.1 },
    { name: 'Chloride', unit: 'mmol/L', low: 98, high: 107 },
  ] },
  'Blood Glucose': { label: 'Blood Glucose', specimen: 'Plasma (fluoride)', parameters: [
    { name: 'Fasting Blood Glucose', unit: 'mg/dL', low: 70, high: 99 },
    { name: 'Post-Prandial Blood Glucose', unit: 'mg/dL', high: 140 },
  ] },
  'HbA1c': { label: 'Glycated Haemoglobin', specimen: 'Whole blood (EDTA)', parameters: [
    { name: 'HbA1c', unit: '%', high: 5.6 },
  ] },
  'Thyroid Profile': { label: 'Thyroid Profile', specimen: 'Serum', parameters: [
    { name: 'TSH', unit: 'µIU/mL', low: 0.4, high: 4.0 },
    { name: 'Free T4', unit: 'ng/dL', low: 0.8, high: 1.8 },
    { name: 'Free T3', unit: 'pg/mL', low: 2.3, high: 4.2 },
  ] },
  'CRP': { label: 'C-Reactive Protein', specimen: 'Serum', parameters: [
    { name: 'CRP', unit: 'mg/L', high: 5 },
  ] },
};

const ALIASES = {
  'complete blood count': 'CBC', 'hemogram': 'CBC', 'cbc': 'CBC',
  'lipid': 'Lipid Profile', 'lipid profile': 'Lipid Profile', 'lipid panel': 'Lipid Profile',
  'lft': 'LFT', 'liver function test': 'LFT', 'liver function': 'LFT',
  'kft': 'KFT', 'rft': 'KFT', 'kidney function test': 'KFT', 'renal function test': 'KFT',
  'blood glucose': 'Blood Glucose', 'blood sugar': 'Blood Glucose', 'fbs': 'Blood Glucose', 'glucose': 'Blood Glucose',
  'hba1c': 'HbA1c', 'thyroid': 'Thyroid Profile', 'thyroid profile': 'Thyroid Profile', 'tft': 'Thyroid Profile',
  'crp': 'CRP',
};

function catalogKey(testName) {
  const key = String(testName || '').trim().toLowerCase();
  if (ALIASES[key]) return ALIASES[key];
  return Object.keys(TEST_CATALOG).find(k => k.toLowerCase() === key) || null;
}

/** Catalog with the interval resolved for the patient's sex ('F…' → female interval). */
function catalogFor(gender) {
  const female = /^f/i.test(String(gender || ''));
  const out = {};
  for (const [key, def] of Object.entries(TEST_CATALOG)) {
    out[key] = {
      label: def.label,
      specimen: def.specimen,
      parameters: def.parameters.map(p => {
        const r = female && p.f ? { ...p, ...p.f } : p;
        return { name: p.name, unit: p.unit, refLow: r.low ?? null, refHigh: r.high ?? null };
      }),
    };
  }
  return out;
}

const NUMERIC = /^-?\d+(\.\d+)?$/;
const CID_RE  = /^(?:b[a-z2-7]{20,120}|Qm[1-9A-HJ-NP-Za-km-z]{44})$/;

function toNumberOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function flagFor(value, refLow, refHigh, statedFlag) {
  if (NUMERIC.test(value) && (refLow !== null || refHigh !== null)) {
    const n = Number(value);
    if (refLow !== null && n < refLow) return 'LOW';
    if (refHigh !== null && n > refHigh) return 'HIGH';
    return 'NORMAL';
  }
  // Qualitative result (e.g. "Positive"): the technician states normal/abnormal.
  return ['NORMAL', 'ABNORMAL'].includes(statedFlag) ? statedFlag : '';
}

/**
 * Validate and normalise what the technician entered.
 * Returns { report } or { errors: [..] }.
 */
function normalizeReport(input) {
  const errors = [];
  const body = input && typeof input === 'object' ? input : {};
  const rows = Array.isArray(body.parameters) ? body.parameters : [];
  if (rows.length === 0) errors.push('At least one result parameter is required');
  if (rows.length > 100) errors.push('Too many parameters (maximum 100)');

  const seen = new Set();
  const parameters = rows.slice(0, 100).map((row, i) => {
    const name  = String(row?.name ?? '').trim();
    const value = String(row?.value ?? '').trim();
    const unit  = String(row?.unit ?? '').trim();
    const refText = String(row?.refText ?? '').trim();
    const refLow  = toNumberOrNull(row?.refLow);
    const refHigh = toNumberOrNull(row?.refHigh);
    const label = name || `Row ${i + 1}`;
    if (!name)  errors.push(`Row ${i + 1}: parameter name is required`);
    if (!value) errors.push(`${label}: value is required`);
    if (name.length > 80 || value.length > 120 || unit.length > 30 || refText.length > 120) {
      errors.push(`${label}: a field is too long`);
    }
    if (Number.isNaN(refLow) || Number.isNaN(refHigh)) errors.push(`${label}: reference limits must be numbers`);
    if (refLow !== null && refHigh !== null && !Number.isNaN(refLow) && !Number.isNaN(refHigh) && refLow > refHigh) {
      errors.push(`${label}: lower reference limit is above the upper limit`);
    }
    if ((refLow !== null || refHigh !== null) && value && !NUMERIC.test(value)) {
      errors.push(`${label}: value must be a number because a numeric reference range is set`);
    }
    const key = name.toLowerCase();
    if (name && seen.has(key)) errors.push(`${label}: listed more than once`);
    seen.add(key);
    const lo = Number.isNaN(refLow) ? null : refLow;
    const hi = Number.isNaN(refHigh) ? null : refHigh;
    return { name, value, unit, refLow: lo, refHigh: hi, refText, flag: flagFor(value, lo, hi, row?.flag) };
  });

  const attachments = (Array.isArray(body.attachments) ? body.attachments : []).map((a, i) => {
    const cid = String(a?.cid ?? '').trim();
    if (!CID_RE.test(cid)) errors.push(`Attachment ${i + 1}: invalid CID`);
    return {
      cid,
      filename: String(a?.filename ?? 'attachment').slice(0, 120),
      mimeType: String(a?.mimeType ?? 'application/octet-stream').slice(0, 80),
      size: Number(a?.size) || 0,
    };
  });
  if (attachments.length > 5) errors.push('At most 5 attachments are allowed');

  const specimen = String(body.specimen ?? '').trim().slice(0, 120);
  const notes    = String(body.notes ?? '').trim().slice(0, 2000);

  if (errors.length) return { errors };
  return { report: { parameters, specimen, notes, attachments } };
}

/** SHA-256 over the clinically meaningful content, with a fixed field order. */
function hashReport(labRequestId, tests, report) {
  const canonical = JSON.stringify({
    labRequestId,
    tests: (tests || []).map(String),
    parameters: report.parameters.map(p => [p.name, p.value, p.unit, p.refLow, p.refHigh, p.refText, p.flag]),
    specimen: report.specimen,
    notes: report.notes,
    attachments: report.attachments.map(a => a.cid),
  });
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/** name → "value unit" map kept for older readers (FHIR adapter, DigiLocker PDFs). */
function legacyResults(report) {
  return Object.fromEntries(report.parameters.map(p => [p.name, `${p.value} ${p.unit}`.trim()]));
}

// ── Attachments ────────────────────────────────────────────────────────────
// Stored in IPFS as a JSON envelope so they travel through the same pin/fetch
// path (and the same protection) as every other document.
const ATTACHMENT_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;

function buildAttachmentEnvelope({ filename, mimeType, dataBase64 }, context) {
  if (!ATTACHMENT_TYPES.includes(mimeType)) {
    return { error: 'Only PDF, PNG and JPEG files can be attached' };
  }
  if (typeof dataBase64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(dataBase64)) {
    return { error: 'File content is missing or not valid base64' };
  }
  const size = Buffer.byteLength(dataBase64, 'base64');
  if (size === 0) return { error: 'File is empty' };
  if (size > MAX_ATTACHMENT_BYTES) return { error: 'File is larger than 3 MB' };
  const safeName = String(filename || 'attachment').replace(/[^\w.\- ]+/g, '_').slice(0, 120);
  return {
    envelope: { _type: 'LAB_ATTACHMENT', ...context, filename: safeName, mimeType, size, dataBase64 },
    meta: { filename: safeName, mimeType, size },
  };
}

/** The attachment record for `cid` on this lab request, or null. */
function findAttachment(clinical, labRequestId, cid) {
  const req = (clinical?.labRequests || []).find(r => r.labRequestId === labRequestId);
  return (req?.report?.attachments || []).find(a => a.cid === cid) || null;
}

function sendAttachment(res, envelope) {
  if (!envelope || envelope._type !== 'LAB_ATTACHMENT') {
    return res.status(404).json({ success: false, error: 'Attachment not found' });
  }
  const inline = envelope.mimeType === 'application/pdf' || envelope.mimeType.startsWith('image/');
  res.setHeader('Content-Type', envelope.mimeType);
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${envelope.filename}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.send(Buffer.from(envelope.dataBase64, 'base64'));
}

module.exports = {
  TEST_CATALOG, catalogKey, catalogFor,
  normalizeReport, hashReport, legacyResults, flagFor,
  buildAttachmentEnvelope, findAttachment, sendAttachment,
  MAX_ATTACHMENT_BYTES,
};
