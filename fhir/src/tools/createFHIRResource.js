'use strict';

/**
 * createFHIRResource.js — AI tool #2 (Agentic AI §4.8).
 *
 * The Agentic-AI orchestrator's tool layer calls this through its own
 * tool-validation/authorization layer; no agent talks to the adapter or the
 * Fabric ledger directly. This function validates the supplied payload against
 * the FHIR R4 profile + terminology, then registers it.
 */

const { validateResource } = require('../validator');
const registry = require('../registry');

/**
 * @param {string} resourceType  expected FHIR resource type
 * @param {object} payload       the FHIR resource body
 * @returns {object} the validated, registered resource
 * @throws {Error} on validation failure (SCHEMA_INVALID / TERMINOLOGY_UNBOUND)
 */
function createFHIRResource(resourceType, payload) {
  if (!payload || payload.resourceType !== resourceType) {
    throw new Error(`SCHEMA_INVALID: payload.resourceType must be '${resourceType}'`);
  }

  const { valid, errors } = validateResource(payload);
  if (!valid) {
    const detail = errors.map(e => `${e.code} @ ${e.path}`).join('; ');
    throw new Error(`FHIR validation failed: ${detail}`);
  }

  return registry.put(payload);
}

module.exports = { createFHIRResource };
