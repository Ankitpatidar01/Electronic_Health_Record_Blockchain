'use strict';

/**
 * identifiers.js — pseudonymous identifier normalization.
 *
 * The Security team's spec (§17.2) tightens plain SHA-256 of a low-entropy
 * patient id (brute-forceable) to a keyed construction:
 *
 *   patientIdHash = HMAC-SHA256(Knet, patientId)
 *
 * Knet is a network-wide secret held only by gateway services and never
 * written to the ledger. It is injected here via the KNET environment
 * variable (falling back to a clearly-labelled dev-only value).
 *
 * Every FHIR Patient.identifier and on-chain state key uses this hash, so a
 * full ledger copy reveals only HMAC digests — never a plaintext MRN.
 */

const crypto = require('crypto');

function getKnet() {
  return process.env.KNET || 'dev-knet-insecure-do-not-use-in-production';
}

/**
 * @param {string} patientId  e.g. "PAT-001"
 * @returns {string} "hmac-sha256:<hex digest>"
 */
function patientIdHash(patientId) {
  const digest = crypto
    .createHmac('sha256', getKnet())
    .update(String(patientId), 'utf8')
    .digest('hex');
  return `hmac-sha256:${digest}`;
}

module.exports = { patientIdHash, getKnet };
