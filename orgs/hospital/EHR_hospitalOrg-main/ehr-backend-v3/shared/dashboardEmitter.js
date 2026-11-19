'use strict';

/**
 * dashboardEmitter.js — sends zero-PHI telemetry to the dashboard API.
 *
 * Carries only names, status codes, durations, sizes, CIDs and transaction
 * IDs. Sending never delays or fails the calling request: it is fire-and-
 * forget with a short timeout. Failures are logged (throttled), not hidden.
 *
 * Enabled when DASHBOARD_EVENT_API_URL and DASHBOARD_SERVICE_KEY are set.
 * No dependencies, so it can be loaded from any service.
 */

const http = require('http');
const https = require('https');
const crypto = require('crypto');

const URL_BASE = (process.env.DASHBOARD_EVENT_API_URL || '').replace(/\/+$/, '');
const KEY = process.env.DASHBOARD_SERVICE_KEY || '';
const ENABLED = Boolean(URL_BASE && KEY);
const SAFE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const CID = /^(?:b[a-z2-7]{20,120}|Qm[1-9A-HJ-NP-Za-km-z]{44})$/;

let lastWarn = 0;
function warn(message) {
  const now = Date.now();
  if (now - lastWarn < 60000) return;
  lastWarn = now;
  console.warn(`[dashboard-emitter] ${message}`);
}

function post(events) {
  let target;
  try { target = new URL(`${URL_BASE}/internal/events`); } catch { return warn('DASHBOARD_EVENT_API_URL is not a valid URL'); }
  const body = JSON.stringify({ events });
  const lib = target.protocol === 'https:' ? https : http;
  const req = lib.request(target, {
    method: 'POST', timeout: 2500,
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'x-dashboard-service-key': KEY },
  }, (res) => {
    let text = '';
    res.on('data', (c) => { if (text.length < 2000) text += c; });
    res.on('end', () => {
      if (res.statusCode !== 200) return warn(`dashboard API answered ${res.statusCode}`);
      try {
        const rejected = (JSON.parse(text).results || []).filter(r => !r.accepted && !r.duplicate);
        if (rejected.length) warn(`event rejected: ${rejected[0].error}`);
      } catch { /* a non-JSON 200 is not actionable */ }
    });
  });
  req.on('timeout', () => req.destroy(new Error('timeout')));
  req.on('error', (err) => warn(`could not reach the dashboard API: ${err.message}`));
  req.end(body);
}

/**
 * @param {string} eventType  registered dashboard event type
 * @param {object} options    { source, org, payload, severity?, txId?, correlationId? }
 */
function emit(eventType, { source, org, payload = {}, severity = 'INFO', txId, correlationId }) {
  if (!ENABLED) return;
  const clean = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'number') { if (Number.isFinite(value) && value >= 0) clean[key] = Math.round(value); continue; }
    if (typeof value === 'boolean') { clean[key] = value; continue; }
    if (key === 'cid') { if (CID.test(value)) clean.cid = value; continue; }
    if (SAFE.test(String(value))) clean[key] = String(value);
  }
  post([{
    schemaVersion: 1,
    eventId: `${source}-${crypto.randomUUID()}`,
    eventType,
    timestamp: new Date().toISOString(),
    source, org, severity,
    ...(txId && SAFE.test(txId) ? { txId } : {}),
    ...(correlationId && SAFE.test(correlationId) ? { correlationId } : {}),
    payload: clean,
  }]);
}

function classify(err) {
  const text = `${err && err.message} ${((err && err.details) || []).map(d => d.message).join(' ')}`;
  if (/MVCC_READ_CONFLICT/i.test(text)) return 'MVCC_CONFLICT';
  if (/Access denied/i.test(text)) return 'ACCESS_DENIED';
  if (/ENDORSEMENT_POLICY_FAILURE|endors/i.test(text)) return 'ENDORSEMENT_FAILED';
  if (/DEADLINE_EXCEEDED|DeadlineExceeded|timed out/i.test(text)) return 'TIMEOUT';
  if (/UNAVAILABLE/i.test(text)) return 'PEER_UNAVAILABLE';
  return 'CHAINCODE_REJECTED';
}

/**
 * Wrap a Fabric contract so every submitTransaction reports when it was
 * submitted, when it committed (the gateway call resolves after commit), how
 * long that took and whether it succeeded.
 */
function instrumentContract(contract, { source, org, chaincode = 'ehr' }) {
  if (!ENABLED || !contract) return contract;
  return new Proxy(contract, {
    get(target, prop, receiver) {
      if (prop !== 'submitTransaction') {
        const value = Reflect.get(target, prop, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      }
      return async (name, ...args) => {
        const submitMs = Date.now();
        try {
          const result = await target.submitTransaction(name, ...args);
          const commitMs = Date.now();
          emit('TRANSACTION_TIMED', { source, org, payload: {
            component: source, chaincode, functionName: name, creatorMsp: org,
            status: 'COMMITTED', submitMs, commitMs, durationMs: commitMs - submitMs,
          } });
          return result;
        } catch (err) {
          const failMs = Date.now();
          emit('TRANSACTION_TIMED', { source, org, severity: 'WARNING', payload: {
            component: source, chaincode, functionName: name, creatorMsp: org,
            status: 'FAILED', errorCode: classify(err), submitMs, commitMs: failMs, durationMs: failMs - submitMs,
          } });
          throw err;
        }
      };
    },
  });
}

module.exports = { emit, instrumentContract, enabled: ENABLED };
