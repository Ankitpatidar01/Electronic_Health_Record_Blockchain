'use strict';

/**
 * timeline.js — a patient's DID and the documents behind each CID on it.
 * Used by the reception, doctor and patient APIs.
 */

const { parse } = require('./diseaseCodes');

async function getTimeline(contract, patientId) {
  const record = parse(await contract.evaluateTransaction('DidContract:GetDID', patientId));
  return parse(await contract.evaluateTransaction('DidContract:ListCIDs', record.did));
}

// Lab results are released to the patient only once verified, and the AI
// cross-reference is written for the doctor, not for the patient.
function redactForPatient(doc) {
  if (doc && doc._type === 'SYMPTOM_ANALYSIS') {
    const { aiAnalysis, templateMatch, ...rest } = doc;
    return rest;
  }
  if (doc && Array.isArray(doc.labRequests)) {
    return {
      ...doc,
      labRequests: doc.labRequests.map(r => (r.status === 'APPROVED' ? r : { ...r, report: null, results: {}, resultsHash: '' })),
    };
  }
  return doc;
}

/** The ledger entry and the document stored at its CID. */
async function getTimelineDocument(contract, fetchByCID, patientId, seq, { forPatient = false } = {}) {
  const record = parse(await contract.evaluateTransaction('DidContract:GetDID', patientId));
  const entry = parse(await contract.evaluateTransaction('DidContract:GetCIDEntry', record.did, String(seq)));
  let document = await fetchByCID(entry.cid);
  if (document && document._type === 'LAB_ATTACHMENT') {
    const { dataBase64, ...meta } = document; // file bytes are served by the attachment routes
    document = meta;
  }
  if (forPatient) document = redactForPatient(document);
  return { entry, document };
}

module.exports = { getTimeline, getTimelineDocument, redactForPatient };
