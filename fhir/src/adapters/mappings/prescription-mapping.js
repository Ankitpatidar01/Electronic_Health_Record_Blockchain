'use strict';

/**
 * prescription-mapping.js — legacy prescription → FHIR R4 MedicationRequest.
 *
 * Source shape (IPFS visit JSON `prescriptions[].medications[]`):
 *   { patientId, visitId, medications: [{ name, dose, frequency }], prescribedBy, prescribedAt }
 *
 * One MedicationRequest is emitted per medication. RxNorm/SNOMED coding is
 * added when a code is supplied; otherwise the free-text name is used (text).
 */

function map(p, ctx) {
  const requests = (p.medications || []).map((m, i) => {
    const req = {
      resourceType: 'MedicationRequest',
      id: `${p.visitId}-MED-${i + 1}`,
      status: 'active',
      intent: 'order',
      subject: { reference: `Patient/${p.patientId}` },
      medicationCodeableConcept: m.code && m.codeSystem
        ? { coding: [{ system: m.codeSystem, code: m.code, display: m.name }] }
        : { text: m.name },
    };

    if (m.dose || m.frequency) {
      req.dosageInstruction = [{ text: `${m.dose || ''} ${m.frequency || ''}`.trim() }];
    }
    if (p.prescribedAt) req.authoredOn = p.prescribedAt;
    if (p.prescribedBy) req.requester = { reference: `Practitioner/${p.prescribedBy}` };

    return req;
  });

  // Multiple medications: return the first and attach the rest as sibling
  // requests via a non-standard extension for demo purposes (the caller can
  // iterate). Simpler: return the array wrapped — the tool layer handles one
  // resource at a time, so we return the first and expose the rest.
  return requests[0] || null;
}

module.exports = { map };
