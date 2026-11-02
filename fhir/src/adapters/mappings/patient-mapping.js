'use strict';

/**
 * patient-mapping.js — legacy patient master record → FHIR R4 Patient.
 *
 * Source shape (ehr-chaincode-v3/lib/patientContract.js RegisterPatient):
 *   { patientId, name, age, gender, bloodGroup, contact, address }
 *
 * The raw patientId is never emitted; Patient.identifier carries the
 * HMAC-SHA256 digest and the human-readable MRN is deliberately omitted.
 */

const GENDER_MAP = {
  male: 'male',
  female: 'female',
  other: 'other',
};

function splitName(name) {
  const parts = String(name || '').trim().split(/\s+/);
  if (parts.length <= 1) return { given: [parts[0] || ''], family: '' };
  return { given: [parts[0]], family: parts.slice(1).join(' ') };
}

function map(p, ctx) {
  const { given, family } = splitName(p.name);
  const resource = {
    resourceType: 'Patient',
    id: p.patientId,
    identifier: [
      { system: 'urn:ehr:patient-id-hash', value: ctx.patientIdHash(p.patientId) },
    ],
    name: [{ text: p.name, family, given }],
  };

  if (p.gender && GENDER_MAP[p.gender.toLowerCase()]) resource.gender = GENDER_MAP[p.gender.toLowerCase()];
  if (p.contact) resource.telecom = [{ system: 'phone', value: p.contact }];
  if (p.address) resource.address = [{ text: p.address }];

  return resource;
}

module.exports = { map };
