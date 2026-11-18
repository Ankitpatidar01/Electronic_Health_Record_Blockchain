'use strict';

/**
 * Hospital Tools Module
 * Author: Sushil (Tool Layer & VCAP Lead)
 * Module: Tool Abstraction Layer - Hospital Organization HTTP Bridges
 *
 * Provides safe REST HTTP interfaces to query Hospital organization data
 * (via extorg-api on port 3004) while enforcing patient consent and access rules.
 */

const BASE_URL = process.env.HOSPITAL_API_URL || process.env.HOSPITAL_EXTORG_API || 'http://localhost:3004';
const VISITS_PATH = process.env.HOSPITAL_VISITS_PATH || '/api/visits/patient/:patientId';
const NOTES_PATH = process.env.HOSPITAL_NOTES_PATH || '/api/clinical-notes/patient/:patientId';
const CONSENT_PATH = process.env.HOSPITAL_CONSENT_PATH || process.env.HOSPITAL_ACCESS_CHECK_PATH || '';
const SUMMARY_PATH = process.env.HOSPITAL_SUMMARY_PATH || '/api/clinical-summary';

const MOCK_VISITS = [
  { visitId: 'visit-001', patientId: 'patient-1001', diagnosis: 'Anemia', medications: [], date: '2026-04-19' },
  { visitId: 'visit-002', patientId: 'patient-1001', diagnosis: 'Fatigue', medications: [], date: '2026-03-10' }
];

const MOCK_NOTES = [
  { noteId: 'note-001', patientId: 'patient-1001', note: 'Follow-up consultation.', date: '2026-04-19' }
];

function urlFor(path, patientId, context = {}) {
  const replacements = {
    patientId: String(patientId),
    requesterId: String(context.requesterId || context.agentId || context.userId || ''),
    section: String(context.section || 'all'),
  };
  const resolved = path.replace(/:([A-Za-z0-9_]+)/g, (_, key) => encodeURIComponent(replacements[key] ?? ''));
  return `${BASE_URL.replace(/\/$/, '')}/${resolved.replace(/^\//, '')}`;
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    throw new Error(`Hospital API ${response.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }
  return body;
}

function unwrap(body) {
  if (body && Object.prototype.hasOwnProperty.call(body, 'result')) return body.result;
  if (body && Object.prototype.hasOwnProperty.call(body, 'data')) return body.data;
  return body;
}

function resolveOptions(context, options) {
  if (context && typeof context === 'object' && context.mock !== undefined && (!options || Object.keys(options).length === 0)) {
    return { ctx: {}, opts: context };
  }
  return { ctx: context || {}, opts: options || {} };
}

/**
 * Check and verify patient consent record before accessing EHR data.
 * @param {string} patientId
 * @param {Object} [context]
 * @param {{ mock?: boolean }} [options]
 */
async function getPatientConsent(patientId, context = {}, options = {}) {
  if (!patientId) throw new Error('patientId is required');
  const { ctx, opts } = resolveOptions(context, options);

  if (opts.mock) {
    return { patientId: String(patientId), allowed: true, mock: true };
  }

  if (!CONSENT_PATH) {
    throw new Error('HOSPITAL_CONSENT_PATH must be configured for AccessContract.CheckAccess()');
  }

  return unwrap(await request(urlFor(CONSENT_PATH, patientId, ctx)));
}

/**
 * Verify patient access authorization. Fails closed if consent is denied.
 * @param {string} patientId
 * @param {Object} [context]
 * @param {{ mock?: boolean }} [options]
 */
async function checkAccess(patientId, context = {}, options = {}) {
  const { ctx, opts } = resolveOptions(context, options);
  const consent = await getPatientConsent(patientId, ctx, opts);
  if (!consent || consent.allowed === false || consent.access === false || consent.granted === false) {
    throw new Error('Patient consent/access denied');
  }
  return consent;
}

/**
 * Retrieve patient visits from Hospital organization.
 * @param {string} patientId
 * @param {{ mock?: boolean }} options
 */
async function getPatientVisits(patientId, { mock = false } = {}) {
  if (!patientId) throw new Error('patientId is required');
  await checkAccess(patientId, {}, { mock });
  if (mock) {
    return MOCK_VISITS.filter(v => v.patientId === String(patientId));
  }
  return unwrap(await request(urlFor(VISITS_PATH, patientId)));
}

/**
 * Retrieve clinical notes from Hospital organization.
 * @param {string} patientId
 * @param {{ mock?: boolean }} options
 */
async function getClinicalNotes(patientId, { mock = false } = {}) {
  if (!patientId) throw new Error('patientId is required');
  await checkAccess(patientId, {}, { mock });
  if (mock) {
    return MOCK_NOTES.filter(n => n.patientId === String(patientId));
  }
  return unwrap(await request(urlFor(NOTES_PATH, patientId)));
}

/**
 * Record clinical summary back to Hospital organization.
 * @param {Object} input
 * @param {{ mock?: boolean }} options
 */
async function recordClinicalSummary(input, { mock = false } = {}) {
  if (!input || typeof input !== 'object') throw new Error('input is required');
  if (mock) {
    return { ...input, recorded: true, mock: true };
  }
  return unwrap(await request(`${BASE_URL.replace(/\/$/, '')}/${SUMMARY_PATH.replace(/^\//, '')}`, {
    method: 'POST',
    body: JSON.stringify(input)
  }));
}

// Alias for cross-compatibility
async function getPatientHistory(patientId, options = {}) {
  return getPatientVisits(patientId, options);
}

module.exports = {
  getPatientVisits,
  getClinicalNotes,
  getPatientConsent,
  checkAccess,
  recordClinicalSummary,
  getPatientHistory
};
