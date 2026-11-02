'use strict';

/**
 * visit-mapping.js — legacy visit → FHIR R4 Encounter.
 *
 * Source shape (ehr-chaincode-v3/lib/visitContract.js OpenVisit):
 *   { visitId, patientId, status, chiefComplaint, createdAt, assignedDoctor, assignedNurse }
 */

const STATUS_MAP = {
  OPEN: 'in-progress',
  WITH_DOCTOR: 'in-progress',
  WITH_NURSE: 'in-progress',
  WITH_LAB: 'in-progress',
  VISIT_FINALIZED: 'finished',
  RECORD_FINALIZED: 'finished',
  DISCHARGED: 'finished',
};

function map(v, ctx) {
  const resource = {
    resourceType: 'Encounter',
    id: v.visitId,
    status: STATUS_MAP[v.status] || 'unknown',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' },
    subject: { reference: `Patient/${v.patientId}` },
  };

  if (v.chiefComplaint) resource.reasonCode = [{ text: v.chiefComplaint }];
  if (v.createdAt) resource.period = { start: v.createdAt };

  return resource;
}

module.exports = { map };
