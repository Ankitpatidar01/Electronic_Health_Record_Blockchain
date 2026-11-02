'use strict';

/**
 * getFHIRResource.js — AI tool #1 (Agentic AI §4.8).
 *
 * Returns a FHIR resource by type + id. In the standalone module this reads the
 * in-memory registry; in the full system it would resolve the on-chain CID,
 * fetch the encrypted artifact from IPFS, and decrypt it — the signature the
 * Agentic-AI tool layer depends on stays the same.
 */

const registry = require('../registry');

/**
 * @param {string} resourceType
 * @param {string} id
 * @returns {object|null} the resource, or null if absent
 */
function getFHIRResource(resourceType, id) {
  return registry.get(resourceType, id);
}

module.exports = { getFHIRResource };
