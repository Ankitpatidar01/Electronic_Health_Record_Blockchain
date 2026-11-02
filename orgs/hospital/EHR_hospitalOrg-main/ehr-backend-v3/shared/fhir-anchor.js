'use strict';

/**
 * fhir-anchor.js — shared helper that converts a legacy record to FHIR R4 and
 * anchors it on-chain via FhirContract.
 *
 * Flow (Phase C):
 *   legacy JSON → FHIR (adapter) → validate → canonicalize → H(R) → pin FHIR
 *   resource to IPFS → submit FhirContract:AnchorFHIRRecord (zero-PHI anchor).
 *
 * The backend holds KNET (gateway secret) and computes both hashes here; the
 * chaincode only stores the result. `pin: false` skips the fhir module's own
 * :3006 HTTP pin — we pin through the service's existing ipfsClient (:4006).
 */

const fhir = require('./fhir');

/**
 * @param {object} contract      req.contract (fabric gateway contract)
 * @param {object} ipfsClient    the service's own src/fabric/ipfsClient (pinJSON)
 * @param {object} opts
 * @param {string} opts.sourceType   'patient' | 'visit' | 'lab-result' | ...
 * @param {object} opts.legacyJson   legacy record matching the adapter mapping
 * @param {string} opts.recordId     logical id (e.g. patientId, visitId, labRequestId)
 * @param {string} [opts.filename]   IPFS filename for the pinned FHIR resource
 */
async function anchorFHIRRecord(contract, ipfsClient, { sourceType, legacyJson, recordId, filename }) {
  const { resource, patientRecordHash, anchor } = await fhir.convert(
    sourceType,
    legacyJson,
    { recordId, pin: false },
  );

  const dataCID = await ipfsClient.pinJSON(
    resource,
    filename || `fhir-${recordId}.json`,
  );

  const resultBytes = await contract.submitTransaction(
    'FhirContract:AnchorFHIRRecord',
    anchor.patientIdHash,
    recordId,
    anchor.resourceType,
    anchor.patientRecordHash,
    dataCID,
    anchor.status || 'FINAL',
  );

  // submitTransaction returns the chaincode's return value as bytes; parse it
  // back to the anchor record JSON (mirrors middleware/errorHandler.parseResult).
  let result = null;
  if (resultBytes && resultBytes.length) {
    const str = Buffer.from(resultBytes).toString('utf8').replace(/^\0+/, '').trim();
    if (str && str !== 'null') {
      try { result = JSON.parse(str); } catch (_) { result = { value: str }; }
    }
  }

  // convert() leaves anchor.dataCID empty (it ran with pin:false); reflect the
  // CID we actually pinned here so the returned anchor is self-consistent.
  anchor.dataCID = dataCID;

  return { anchor, patientRecordHash, dataCID, result };
}

module.exports = { anchorFHIRRecord };
