'use strict';

/**
 * consent-mapping.js — legacy access grant → FHIR R4 Consent.
 *
 * Source shape (ehr-chaincode-v3/lib/accessContract.js GrantAccess):
 *   { patientId, granteeId, granteeRole, sections: ["ehr","visits"], expiresAt }
 *
 * A FHIR-level consent grant and a chaincode-level grant are the SAME fact
 * represented twice (Group 4 §9.1). This resource maps 1:1 to the composite key
 * CONSENT~<patientIdHash>~<granteeId>~<scope>.
 */

function map(g, ctx) {
  const resource = {
    resourceType: 'Consent',
    id: `CONSENT-${g.granteeId}`,
    status: 'active',
    patient: { reference: `Patient/${g.patientId}` },
    category: [
      { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentcategorycodes', code: 'research', display: 'Research Information Access' }] },
    ],
    dateTime: g.grantedAt || new Date().toISOString(),
    provision: {
      type: 'permit',
      actor: [
        { role: { text: g.granteeRole || '' }, reference: { reference: `Practitioner/${g.granteeId}` } },
      ],
    },
  };

  if (g.expiresAt) resource.provision.period = { start: resource.dateTime, end: g.expiresAt };

  return resource;
}

module.exports = { map };
