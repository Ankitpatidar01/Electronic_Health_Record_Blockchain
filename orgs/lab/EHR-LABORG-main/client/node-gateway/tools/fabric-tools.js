'use strict';

/**
 * Fabric Tools Module
 * Author: Sushil (Tool Layer & VCAP Lead)
 * Module: Tool Abstraction Layer - Fabric Gateway Wrappers
 *
 * Provides a decoupled abstraction between Agent reasoning and Hyperledger Fabric.
 * Reuses existing gateway.js client methods without modifying underlying connection logic.
 */

let gateway = null;
try {
  gateway = require('../gateway');
} catch (_err) {
  // Allows mock mode and isolated testing when Fabric Gateway SDK is not locally installed
}

let ipfsTools = null;
try {
  ipfsTools = require('./ipfs-tools');
} catch (_err) {}

const MOCK_PATIENT_HISTORY = [
  {
    resultId: 'labresult1',
    patientId: 'patient-1001',
    testCode: 'CBC',
    collectedAt: '2026-04-19T08:00:00Z',
    status: 'REPORTED',
    resultData: { hemoglobin: '13.8', wbc: '6200' }
  },
  {
    resultId: 'labresult2',
    patientId: 'patient-1001',
    testCode: 'LFT',
    collectedAt: '2026-03-10T09:00:00Z',
    status: 'REPORTED',
    resultData: { alt: '42', ast: '37' }
  }
];

function getGateway() {
  if (!gateway) {
    try {
      gateway = require('../gateway');
    } catch (err) {
      throw new Error(`Fabric Gateway module unavailable: ${err.message}`);
    }
  }
  return gateway;
}

function unwrap(result) {
  if (result && Object.prototype.hasOwnProperty.call(result, 'result')) {
    return result.result;
  }
  return result;
}

/**
 * Get all lab results for a patient.
 * @param {string} patientId
 * @param {{ mock?: boolean }} options
 */
async function getPatientHistory(patientId, { mock = false } = {}) {
  if (!patientId) throw new Error('patientId is required');
  if (mock) {
    return MOCK_PATIENT_HISTORY.filter(r => r.patientId === String(patientId));
  }
  const gw = getGateway();
  const result = await gw.getLabResultsByPatient(String(patientId));
  const value = unwrap(result);
  return Array.isArray(value) ? value : [];
}

/**
 * Read a single lab result by ID.
 * @param {string} resultId
 * @param {{ mock?: boolean }} options
 */
async function getLabResult(resultId, { mock = false } = {}) {
  if (!resultId) throw new Error('resultId is required');
  if (mock) {
    return MOCK_PATIENT_HISTORY.find(r => r.resultId === String(resultId)) || null;
  }
  const gw = getGateway();
  return unwrap(await gw.readLabResult(String(resultId)));
}

/**
 * Create a new lab result on chain.
 * @param {Object} input
 * @param {{ mock?: boolean }} options
 */
async function createLabResult(input, { mock = false } = {}) {
  if (!input || typeof input !== 'object') throw new Error('input is required');
  if (mock) {
    return { peer: 'mock-peer', result: { ...input, submitted: true } };
  }
  const gw = getGateway();
  return unwrap(await gw.createLabResult(input));
}

// PDF specification alias: submitLabResult
const submitLabResult = createLabResult;

/**
 * Store AI summary metadata onto an existing lab result record.
 * Reads the existing record first, merges AI metadata, and updates on chain.
 * @param {Object} input - { resultId, resultData, ...metadataPatch }
 * @param {{ mock?: boolean }} options
 */
async function storeAISummary(input, { mock = false } = {}) {
  if (!input || typeof input !== 'object') throw new Error('input is required');
  const { resultId, resultData, ...metadataPatch } = input;
  if (!resultId) throw new Error('resultId is required');

  if (mock) {
    return { resultId, resultData: resultData || metadataPatch, updated: true, mock: true };
  }

  const gw = getGateway();
  const current = unwrap(await gw.readLabResult(String(resultId)));
  if (!current || typeof current !== 'object') {
    throw new Error(`Lab result ${resultId} could not be read before AI summary update`);
  }

  const merged = {
    ...current,
    ...metadataPatch,
    resultId: String(resultId),
    resultData: {
      ...(current.resultData && typeof current.resultData === 'object' ? current.resultData : {}),
      ...(resultData && typeof resultData === 'object' ? resultData : {})
    }
  };

  return unwrap(await gw.updateLabResult(merged));
}

/**
 * Upload payload to IPFS through Tool abstraction.
 * @param {any} payload
 * @param {{ mock?: boolean }} options
 */
async function addToIPFS(payload, { mock = false } = {}) {
  if (payload === undefined || payload === null) throw new Error('payload is required');
  if (!ipfsTools) {
    ipfsTools = require('./ipfs-tools');
  }
  return ipfsTools.addToIPFS(payload, { mock });
}

/**
 * Update an existing lab result record.
 * Supports both signatures:
 *   updateLabResult(resultId, data, options)
 *   updateLabResult(recordObject, options)
 * @param {string|Object} resultIdOrRecord
 * @param {Object} [dataOrOptions]
 * @param {Object} [options]
 */
async function updateLabResult(resultIdOrRecord, dataOrOptions, options = {}) {
  if (!resultIdOrRecord) throw new Error('resultId is required');

  let record;
  let opts = options;

  if (typeof resultIdOrRecord === 'object' && resultIdOrRecord !== null) {
    record = resultIdOrRecord;
    opts = dataOrOptions || options || {};
  } else {
    const resultId = String(resultIdOrRecord);
    const data = (typeof dataOrOptions === 'object' && dataOrOptions !== null) ? dataOrOptions : {};
    record = { resultId, ...data };
  }

  if (opts.mock) {
    return { ...record, updated: true, mock: true };
  }

  const gw = getGateway();

  // If record is missing standard fields, read current record first to preserve ledger state
  if (!record.patientId || !record.testCode) {
    try {
      const current = unwrap(await gw.readLabResult(record.resultId));
      if (current && typeof current === 'object') {
        record = {
          ...current,
          ...record,
          resultData: {
            ...(current.resultData && typeof current.resultData === 'object' ? current.resultData : {}),
            ...(record.resultData && typeof record.resultData === 'object' ? record.resultData : {}),
            ...(record.storage ? { storage: record.storage } : {}),
            ...(record.cid ? { cid: record.cid } : {}),
            ...(record.ai ? { ai: record.ai } : {}),
            ...(record.vcap ? { vcap: record.vcap } : {})
          }
        };
      }
    } catch (_err) {
      // Continue with provided record if read fails
    }
  }

  return unwrap(await gw.updateLabResult(record, opts));
}

async function appendVCAPDocument(patientId, cid, metadata = {}) {
  if (!patientId || !cid) throw new Error('patientId and cid are required for VCAP anchoring');
  const gw = getGateway();
  if (typeof gw.appendDocumentToPatientDid !== 'function') {
    throw new Error('Fabric gateway does not expose DID document anchoring');
  }
  return gw.appendDocumentToPatientDid(patientId, cid, {
    type: 'DOCUMENT',
    ref: `vcap:${String(metadata.runId || 'unknown').slice(0, 100)}`,
    note: `VCAP SHA-256: ${String(metadata.recordHash || '').slice(0, 64)}`,
    chaincodeName: process.env.LAB_EHR_CHAINCODE || 'ehr',
    peerName: process.env.LAB_PEER_ENDPOINT ? process.env.LAB_PEER_ENDPOINT.split(':')[0] : undefined,
  });
}

module.exports = {
  getPatientHistory,
  getLabResult,
  createLabResult,
  submitLabResult,
  storeAISummary,
  addToIPFS,
  updateLabResult,
  appendVCAPDocument
};
