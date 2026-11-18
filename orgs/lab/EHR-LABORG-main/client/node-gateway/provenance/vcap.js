'use strict';

/**
 * VCAP (verifiable clinical AI provenance) record builder.
 *
 * Builds a tamper-evident record of one workflow run — a SHA-256 of every
 * agent's output, the governance decision and the human approval — and pins
 * it to IPFS. The returned CID is the real content address of that record.
 * The record holds hashes only: no report text and no patient identifier.
 * If IPFS is unavailable this throws, so a run can never complete with a
 * made-up provenance reference.
 */

const crypto = require('crypto');
const telemetry = require('../dashboard-telemetry');

const sha256 = (value) => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');

function buildVCAPRecord(state) {
  const agents = {};
  for (const [agentId, result] of Object.entries(state.agentResults || {})) {
    agents[agentId] = {
      status: result.status,
      confidence: result.confidence,
      outputHash: sha256(result.result || {}),
      timestamp: result.timestamp,
    };
  }
  const approval = state.humanApproval || null;
  const record = {
    schema: 'vcap.v1',
    runId: state.runId,
    patientRef: sha256(`vcap:${state.patientId}`),
    inputHash: sha256(state.initialPayload || {}),
    agents,
    humanReview: approval
      ? { decision: approval.decision, reviewerRef: sha256(`reviewer:${approval.reviewedBy}`), timestamp: approval.timestamp }
      : null,
    createdAt: new Date().toISOString(),
  };
  record.recordHash = sha256(record);
  return record;
}

async function buildAndAnchorVCAP(state, options = {}) {
  const addJsonToIpfs = options.addJsonToIpfs || require('../ipfs').addJsonToIpfs;
  const record = buildVCAPRecord(state);
  const started = Date.now();
  try {
    const stored = await addJsonToIpfs(record, { fileName: `vcap-${state.runId}.json` });
    telemetry.emit('VCAP_ANCHORED', {
      agentId: 'governance-agent', status: 'ANCHORED', recordHash: record.recordHash, durationMs: Date.now() - started,
    }, { source: 'lab-gateway' });
    telemetry.traceStage('governance-agent', 'VCAP_ANCHORED', 'DONE', { recordHash: record.recordHash, cid: stored.cid });
    return stored.cid;
  } catch (error) {
    telemetry.emit('VCAP_VERIFICATION_FAILED', {
      agentId: 'governance-agent', status: 'FAILED', errorCode: 'VCAP_IPFS_STORE_FAILED', durationMs: Date.now() - started,
    }, { source: 'lab-gateway', severity: 'WARNING' });
    telemetry.traceStage('governance-agent', 'VCAP_ANCHORED', 'FAILED', { errorCode: 'VCAP_IPFS_STORE_FAILED' });
    throw new Error(`Provenance record could not be stored on IPFS: ${error.message}`);
  }
}

module.exports = { buildAndAnchorVCAP, buildVCAPRecord };
