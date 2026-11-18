'use strict';

const crypto = require('crypto');

const DASHBOARD_CID = /^(?:bafy[a-z2-7]{20,}|Qm[1-9A-HJ-NP-Za-km-z]{44})$/;

// Zero-PHI telemetry for the observability dashboard. No-ops unless both the
// dashboard URL and service key are configured. Never blocks a request.
function createTelemetry({ dashboard, fetchImpl, logger }) {
  const enabled = Boolean(dashboard.url && dashboard.key);
  const doFetch = fetchImpl || globalThis.fetch;

  const patientHash = (patientId) =>
    `hmac-sha256:${crypto.createHmac('sha256', dashboard.key).update(String(patientId)).digest('hex')}`;

  function emit(eventType, payload = {}, severity = 'INFO') {
    if (!enabled) return;
    const clean = Object.fromEntries(Object.entries(payload).filter(([key, value]) => {
      if (value === undefined || value === null) return false;
      // The dashboard envelope only accepts dag-pb CIDs; drop others instead of losing the event.
      if (key === 'cid') return DASHBOARD_CID.test(value);
      return true;
    }));
    const event = {
      schemaVersion: 1,
      eventId: `digilocker-${crypto.randomUUID()}`,
      eventType,
      timestamp: new Date().toISOString(),
      source: 'digilocker-service',
      org: 'HospitalMSP',
      severity,
      payload: clean,
    };
    void doFetch(`${dashboard.url}/internal/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-dashboard-service-key': dashboard.key },
      body: JSON.stringify({ events: [event] }),
      signal: AbortSignal.timeout(1500),
    }).catch(err => logger?.debug('Telemetry dropped', { eventType, error: err.message }));
  }

  return {
    enabled,
    patientHash,
    stage(stage, stageStatus, extra = {}) {
      emit('AGENT_STAGE_UPDATED', { agentId: 'digilocker-agent', stage, stageStatus, ...extra }, stageStatus === 'FAILED' ? 'WARNING' : 'INFO');
    },
    ipfsUploaded(extra) { emit('IPFS_UPLOAD_COMPLETED', { component: 'digilocker-service', status: 'OK', agentId: 'digilocker-agent', ...extra }); },
    ipfsFailed(errorCode) { emit('IPFS_UPLOAD_FAILED', { component: 'digilocker-service', status: 'FAILED', agentId: 'digilocker-agent', errorCode }, 'WARNING'); },
    heartbeat() { emit('AGENT_HEARTBEAT', { agentId: 'digilocker-agent', status: 'ONLINE' }); },
  };
}

module.exports = { createTelemetry };
