'use strict';

/**
 * condition-mapping.js — legacy diagnosis → FHIR R4 Condition.
 *
 * Source shape (IPFS visit JSON diagnosisNotes / finalDiagnosis):
 *   { patientId, visitId, diagnosisText, codeSystem, code, recordedAt }
 */

function map(c, ctx) {
  const resource = {
    resourceType: 'Condition',
    id: `${c.visitId}-COND`,
    subject: { reference: `Patient/${c.patientId}` },
    clinicalStatus: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }],
    },
  };

  if (c.codeSystem && c.code) {
    resource.code = { coding: [{ system: c.codeSystem, code: c.code, display: c.diagnosisText }] };
  } else if (c.diagnosisText) {
    resource.code = { text: c.diagnosisText };
  }

  if (c.recordedAt) resource.recordedDate = c.recordedAt;
  return resource;
}

module.exports = { map };
