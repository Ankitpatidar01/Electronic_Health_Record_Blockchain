'use strict';

/**
 * fabric-anchor.js — Feature 4 (on-chain anchoring), reference implementation.
 *
 * The Security team's state-key schema (§19.1) defines the on-chain namespace
 * Team D must slot into:
 *
 *   RECORD~<patientIdHash>~<recordId>   -> EHR metadata + CID
 *   CONSENT~<patientIdHash>~<granteeId>~<scope> -> consent grant
 *
 * This module produces those zero-PHI state records (hash + CID + status only —
 * NO clinical value, code, or narrative field exists by construction). It does
 * not talk to a live Fabric peer in this standalone phase; it is the reference
 * the chaincode/fabric integration will consume. A full ledger copy at any peer
 * reveals only hashes, CIDs, and status.
 */

const { patientIdHash } = require('./identifiers');

/**
 * Build the on-chain record for an anchored FHIR resource.
 *
 * @param {object} args
 * @param {string} args.patientId       plaintext id, hashed internally
 * @param {string} args.recordId        e.g. "DR-0001"
 * @param {string} args.resourceType    FHIR resource type
 * @param {string} args.patientRecordHash  "sha256:..."
 * @param {string} args.dataCID         IPFS CID of the encrypted artifact
 * @param {string} [args.status]        "FINAL" etc.
 */
function buildRecord({ patientId, recordId, resourceType, patientRecordHash, dataCID, status }) {
  const ph = patientIdHash(patientId);
  return {
    recordId: `${ph}~${recordId}`,
    resourceType,
    patientIdHash: ph,
    patientRecordHash,
    dataCID,
    status: status || 'FINAL',
    canonicalizationScheme: 'RFC8785-JCS',
    timestamp: new Date().toISOString(),
  };
}

/** Composite key for a consent grant, matching CONSENT~<patientIdHash>~<granteeId>~<scope>. */
function consentKey(patientId, granteeId, scope) {
  return `CONSENT~${patientIdHash(patientId)}~${granteeId}~${scope}`;
}

/** Composite key for a record, matching RECORD~<patientIdHash>~<recordId>. */
function recordKey(patientId, recordId) {
  return `RECORD~${patientIdHash(patientId)}~${recordId}`;
}

module.exports = { buildRecord, consentKey, recordKey };
