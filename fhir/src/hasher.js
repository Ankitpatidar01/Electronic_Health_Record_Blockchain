'use strict';

/**
 * hasher.js — VCAP H(R) digest generation.
 *
 * patientRecordHash = SHA-256(canonicalize(fhirResource))
 *
 * This is the ONLY field Team D contributes to the Security team's VCAP tuple
 * V = { H(R), H(P), F(M), H(S), t, σ }. Team D does not compute H(P), F(M),
 * H(S), or σ — those remain the Security/AI teams' responsibility (Group 4 §9.1).
 *
 * SHA-256 is used because it matches Fabric's native hashing, so no additional
 * primitive is introduced.
 */

const crypto = require('crypto');
const { canonicalizeResource } = require('./canonicalizer');

/**
 * @param {object} fhirResource  a canonicalizable FHIR R4 resource
 * @returns {string} "sha256:<hex digest>" over the RFC 8785 canonical form
 */
function patientRecordHash(fhirResource) {
  const canonical = canonicalizeResource(fhirResource);
  const digest = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  return `sha256:${digest}`;
}

module.exports = { patientRecordHash };
