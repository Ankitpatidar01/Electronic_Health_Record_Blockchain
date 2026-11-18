'use strict';

/**
 * VCAP (Verifiable Clinical AI Provenance) Module
 * Author: Sushil (Tool Layer & VCAP Lead)
 * Module: Provenance Ledger & Audit Trail Builder
 *
 * Builds a tamper-evident, privacy-preserving cryptographic audit record of
 * the multi-agent workflow (SHA-256 digests of all agent inputs and outputs,
 * governance checks, and clinician approval) and anchors the record on IPFS
 * and the Hyperledger Fabric ledger.
 */

const crypto = require('crypto');

let telemetry = null;
try {
  telemetry = require('../dashboard-telemetry');
} catch (_err) {
  telemetry = { emit: () => {}, traceStage: () => {} };
}

let ipfsTool = null;
try {
  ipfsTool = require('../tools/ipfs-tools');
} catch (_err) {
  try {
    ipfsTool = require('../ipfs');
  } catch (_e) {}
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

function sha256(value) {
  const input = Buffer.isBuffer(value)
    ? value
    : Buffer.from(typeof value === 'string' ? value : stableStringify(value));
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Build privacy-preserving VCAP record conforming to schema vcap.v1
 * Contains hashes only: no raw PHI, patient identifiers, or clinical narrative.
 * @param {Object} state - ExecutionState instance
 * @returns {Object} VCAP Record
 */
function buildVCAPRecord(state) {
  if (!state || !state.runId) {
    throw new Error('executionState with runId is required');
  }

  const agents = {};
  for (const [agentId, result] of Object.entries(state.agentResults || {})) {
    agents[agentId] = {
      status: result && result.status,
      confidence: result && result.confidence,
      outputHash: sha256(result && result.result ? result.result : {}),
      timestamp: result && result.timestamp,
    };
  }

  const approval = state.humanApproval || null;
  const record = {
    schema: 'vcap.v1',
    runId: String(state.runId),
    patientRef: sha256(`vcap:${state.patientId || ''}`),
    inputHash: sha256(state.initialPayload || {}),
    agents,
    humanReview: approval
      ? {
          decision: approval.decision,
          reviewerRef: approval.reviewedBy ? sha256(`reviewer:${approval.reviewedBy}`) : undefined,
          timestamp: approval.timestamp,
        }
      : null,
    createdAt: new Date().toISOString(),
  };

  record.recordHash = sha256(record);
  return record;
}

/**
 * Build VCAP record and anchor on IPFS.
 * Primary entry point used by orchestrator.js
 * @param {Object} executionState
 * @param {Object} [options]
 * @returns {Promise<string>} IPFS CID
 */
async function buildAndAnchorVCAP(executionState, options = {}) {
  const record = buildVCAPRecord(executionState);
  const started = Date.now();
  const isMock = Boolean(options.mock || process.env.MOCK_IPFS === 'true');

  const storeFn = options.addJsonToIpfs
    || options.addToIPFS
    || (ipfsTool && ipfsTool.addToIPFS)
    || (ipfsTool && ipfsTool.addJsonToIpfs);

  if (!storeFn) {
    throw new Error('IPFS storage function is unavailable');
  }

  try {
    const stored = await storeFn(record, {
      mock: isMock,
      fileName: `vcap-${executionState.runId}.json`,
    });

    const cid = typeof stored === 'string'
      ? stored
      : stored && (stored.cid || stored.Hash || stored.hash);

    if (!cid) {
      throw new Error('IPFS storage did not return a CID');
    }

    if (telemetry && typeof telemetry.emit === 'function') {
      telemetry.emit('VCAP_ANCHORED', {
        agentId: 'governance-agent',
        status: 'ANCHORED',
        recordHash: record.recordHash,
        durationMs: Date.now() - started,
      }, { source: 'lab-gateway' });
    }

    if (telemetry && typeof telemetry.traceStage === 'function') {
      telemetry.traceStage('governance-agent', 'VCAP_ANCHORED', 'DONE', {
        recordHash: record.recordHash,
        cid,
      });
    }

    return cid;
  } catch (error) {
    if (telemetry && typeof telemetry.emit === 'function') {
      telemetry.emit('VCAP_VERIFICATION_FAILED', {
        agentId: 'governance-agent',
        status: 'FAILED',
        errorCode: 'VCAP_IPFS_STORE_FAILED',
        durationMs: Date.now() - started,
      }, { source: 'lab-gateway', severity: 'WARNING' });
    }

    if (telemetry && typeof telemetry.traceStage === 'function') {
      telemetry.traceStage('governance-agent', 'VCAP_ANCHORED', 'FAILED', {
        errorCode: 'VCAP_IPFS_STORE_FAILED',
      });
    }

    throw new Error(`Provenance record could not be stored on IPFS: ${error.message}`);
  }
}

/**
 * Standalone VCAP Record Generator matching Architecture Blueprint specification.
 * Supports both ExecutionState input and modular parameter dictionaries.
 * @param {Object} input
 * @returns {Object} { vcap: { version: '1.0', ... } }
 */
function createVCAPRecord(input = {}) {
  if (input && input.runId && input.agentResults) {
    return buildVCAPRecord(input);
  }

  const {
    runId,
    taskId,
    agentId,
    agentVersion = '1.0.0',
    organization = 'LabMSP',
    orchestratorId = 'ehr-orchestrator',
    timeline = [],
    toolCalls = [],
    inputData = null,
    aiOutput = null,
    aiOutputCid = null,
    humanReviewed = false,
    humanReviewedBy = null,
    humanReviewedAt = null,
    fabricTxId = null,
    governance = null,
    humanApproval = null,
  } = input;

  if (!runId) throw new Error('runId is required');
  if (!taskId) throw new Error('taskId is required');
  if (!agentId) throw new Error('agentId is required');

  return {
    vcap: {
      version: '1.0',
      runId: String(runId),
      taskId: String(taskId),
      agentId: String(agentId),
      agentVersion: String(agentVersion),
      organization: String(organization),
      orchestratorId: String(orchestratorId),
      timeline,
      toolCalls,
      inputHash: sha256(inputData),
      outputHash: sha256(aiOutput),
      aiOutputCid,
      humanReviewed: Boolean(humanReviewed),
      humanReviewedBy,
      humanReviewedAt,
      fabricTxId,
      ...(governance ? { governance } : {}),
      ...(humanApproval ? { humanApproval } : {}),
    },
  };
}

/**
 * Store VCAP Record to IPFS.
 * @param {Object} vcapRecord
 * @param {Object} [options]
 */
async function storeVCAP(vcapRecord, options = {}) {
  if (!vcapRecord || typeof vcapRecord !== 'object') {
    throw new Error('vcapRecord is required');
  }
  const storeFn = options.addToIPFS || (ipfsTool && ipfsTool.addToIPFS);
  if (!storeFn) throw new Error('IPFS tool unavailable');
  return storeFn(vcapRecord, options);
}

/**
 * Build and Store VCAP record in a single workflow step.
 * @param {Object} input
 * @param {Object} [options]
 */
async function buildAndStoreVCAP(input = {}, options = {}) {
  const record = createVCAPRecord(input);
  const cidResult = await storeVCAP(record, options);
  const cid = typeof cidResult === 'string' ? cidResult : (cidResult && cidResult.cid) || null;
  if (record.vcap) {
    record.vcap.cid = cid;
  }
  return { record, cid };
}

/**
 * Anchor VCAP CID onto the Hyperledger Fabric ledger via supplied anchor callback.
 * @param {string} cid
 * @param {Function} anchorFn
 * @param {{ mock?: boolean }} [options]
 */
async function anchorVCAP(cid, anchorFn, { mock = false } = {}) {
  if (!cid) throw new Error('cid is required');
  if (typeof anchorFn !== 'function') throw new Error('anchorFn is required');
  if (mock) return { cid, txId: 'mock-vcap-tx-001' };

  const result = await anchorFn(cid);
  return {
    cid,
    txId: result && (result.txId || result.transactionId || result.txid) || null,
    result,
  };
}

module.exports = {
  sha256,
  buildVCAPRecord,
  createVCAPRecord,
  buildVCAP: createVCAPRecord,
  buildAndAnchorVCAP,
  storeVCAP,
  buildAndStoreVCAP,
  anchorVCAP,
};
