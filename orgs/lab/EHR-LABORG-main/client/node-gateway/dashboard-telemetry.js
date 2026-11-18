'use strict';

// Zero-PHI telemetry for the observability dashboard (dashboard-api
// POST /internal/events → WebSocket /api/dashboard/ws).
//
// No-ops unless DASHBOARD_EVENT_API_URL and DASHBOARD_SERVICE_KEY are set.
// Never throws and never blocks the caller. Only identifiers, hashes, CIDs,
// durations and status codes are sent: no patient ids, names or report text.

const crypto = require('crypto');

const ORGS = ['HospitalMSP', 'DiagnosticsMSP', 'ProviderMSP'];
const SAFE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
// The dashboard envelope accepts dag-pb CIDs only.
const CID = /^(?:bafy[a-z2-7]{20,}|Qm[1-9A-HJ-NP-Za-km-z]{44})$/;

function settings() {
  const url = (process.env.DASHBOARD_EVENT_API_URL || '').replace(/\/$/, '');
  const key = process.env.DASHBOARD_SERVICE_KEY || '';
  const org = process.env.DASHBOARD_EVENT_ORG || 'DiagnosticsMSP';
  return { url, key, org, enabled: Boolean(url && key && ORGS.includes(org)) };
}

function isEnabled() {
  return settings().enabled;
}

function patientHash(patientId) {
  const { key } = settings();
  if (!key || !patientId) return undefined;
  return `hmac-sha256:${crypto.createHmac('sha256', key).update(String(patientId)).digest('hex')}`;
}

function safeCode(value, fallback) {
  const cleaned = String(value || '').replace(/[^A-Za-z0-9._:-]/g, '_').slice(0, 64);
  return SAFE.test(cleaned) ? cleaned : fallback;
}

function emit(eventType, payload = {}, options = {}) {
  const { url, key, org, enabled } = settings();
  if (!enabled || typeof fetch !== 'function') return;

  const clean = {};
  for (const [field, value] of Object.entries(payload)) {
    if (value === undefined || value === null || value === '') continue;
    if (field === 'cid' && !CID.test(String(value))) continue;
    clean[field] = value;
  }

  const event = {
    schemaVersion: 1,
    eventId: `${options.source || 'lab-gateway'}-${crypto.randomUUID()}`,
    eventType,
    timestamp: new Date().toISOString(),
    source: options.source || 'lab-gateway',
    org,
    severity: options.severity || 'INFO',
    payload: clean,
  };
  if (options.correlationId && SAFE.test(options.correlationId)) event.correlationId = options.correlationId;

  void fetch(`${url}/internal/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-dashboard-service-key': key },
    body: JSON.stringify({ events: [event] }),
    signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(1500) : undefined,
  }).catch(() => {});
}

// One step of the report pipeline shown in the dashboard's agent trace.
// stage: REPORT_RECEIVED | OCR_PARSING | FHIR_CONVERSION | ENCRYPTED_IPFS_STORED |
//        RECORD_ANCHORED | AGENT_PROCESSING | GOVERNANCE | HUMAN_REVIEW | VCAP_ANCHORED | VCAP_VERIFIED
// stageStatus: DONE | FAILED | SKIPPED | PENDING | WAITING_HUMAN
function traceStage(agentId, stage, stageStatus, extra = {}, options = {}) {
  emit('AGENT_STAGE_UPDATED', { agentId, stage, stageStatus, ...extra }, {
    ...options,
    severity: stageStatus === 'FAILED' ? 'WARNING' : 'INFO',
  });
}

function startHeartbeat(agentIds, intervalMs = 15000) {
  if (!isEnabled()) return null;
  const beat = () => agentIds.forEach(agentId => emit('AGENT_HEARTBEAT', { agentId, status: 'ONLINE' }));
  beat();
  const timer = setInterval(beat, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();
  return timer;
}

module.exports = { emit, traceStage, startHeartbeat, patientHash, safeCode, isEnabled };
