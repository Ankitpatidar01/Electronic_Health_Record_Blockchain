'use strict';

/**
 * legacy-to-fhir.js — Feature 1: declarative legacy-to-FHIR adapter engine.
 *
 * A new upstream format (a new lab's export, say) is onboarded by adding a
 * mapping file under ./mappings and registering it in the table below — not by
 * writing new adapter code. Each mapping is a pure `map(legacyJson, ctx)`
 * function that returns one FHIR R4 resource.
 *
 * ctx always carries the shared identifier normalizer (HMAC-SHA256(Knet,·)) so
 * every Patient.identifier and reference is hash-first, per the Security spec.
 */

const { patientIdHash } = require('../identifiers');

const mappings = {
  patient:      require('./mappings/patient-mapping'),
  visit:        require('./mappings/visit-mapping'),
  'lab-result': require('./mappings/lab-result-mapping'),
  prescription: require('./mappings/prescription-mapping'),
  condition:    require('./mappings/condition-mapping'),
  consent:      require('./mappings/consent-mapping'),
};

/**
 * Convert legacy JSON to a FHIR R4 resource.
 *
 * @param {string} sourceType  one of the registered keys above
 * @param {object} legacyJson
 * @param {object} [ctx]       extra context (e.g. { recordId })
 * @returns {object} FHIR R4 resource
 */
function toFHIR(sourceType, legacyJson, ctx = {}) {
  const mapping = mappings[sourceType];
  if (!mapping) {
    throw new Error(`No mapping registered for source type '${sourceType}'. Registered: ${Object.keys(mappings).join(', ')}`);
  }
  return mapping.map(legacyJson, { ...ctx, patientIdHash });
}

/**
 * Best-effort source-type inference from the legacy shape. The demo CLI accepts
 * an explicit --type and falls back to this.
 */
function inferSourceType(legacyJson) {
  if (!legacyJson || typeof legacyJson !== 'object') return null;
  if (legacyJson.granteeId && Array.isArray(legacyJson.sections)) return 'consent';
  if (legacyJson.medications && legacyJson.prescribedBy) return 'prescription';
  if (legacyJson.results && (legacyJson.panel || legacyJson.labRequestId)) return 'lab-result';
  if (legacyJson.diagnosisText || legacyJson.condition) return 'condition';
  if (legacyJson.chiefComplaint !== undefined || legacyJson.visitId && legacyJson.status) return 'visit';
  if (legacyJson.name && legacyJson.bloodGroup) return 'patient';
  return null;
}

module.exports = { toFHIR, inferSourceType, mappings };
