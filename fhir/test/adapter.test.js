'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { toFHIR, inferSourceType } = require('../src/adapters/legacy-to-fhir');
const { validateResource } = require('../src/validator');

const patient = {
  patientId: 'PAT-001', name: 'Rahul Sharma', age: 32, gender: 'male',
  bloodGroup: 'O+', contact: '+91-98765-43210', address: '12 MG Road, Bengaluru',
};

const lab = {
  patientId: 'PAT-001', visitId: 'PAT-001-V1', labRequestId: 'LAB-001', panel: 'CBC',
  results: { Hemoglobin: { value: 8.5, unit: 'g/dL', loinc: '718-7' } },
  submittedBy: 'labtechnician', submittedAt: '2026-09-16T10:30:00Z',
};

test('patient mapping emits a Patient with a hashed identifier', () => {
  const r = toFHIR('patient', patient);
  assert.strictEqual(r.resourceType, 'Patient');
  assert.match(r.identifier[0].value, /^hmac-sha256:/);
  assert.notStrictEqual(r.identifier[0].value, patient.patientId);
});

test('lab-result mapping emits a DiagnosticReport with contained Observations', () => {
  const r = toFHIR('lab-result', lab);
  assert.strictEqual(r.resourceType, 'DiagnosticReport');
  assert.ok(Array.isArray(r.contained));
  assert.strictEqual(r.contained[0].resourceType, 'Observation');
  assert.strictEqual(r.contained[0].code.coding[0].code, '718-7');
});

test('adapter output passes full validation', () => {
  for (const [type, input] of [['patient', patient], ['lab-result', lab]]) {
    const r = toFHIR(type, input);
    const v = validateResource(r);
    assert.strictEqual(v.valid, true, `${type}: ${JSON.stringify(v.errors)}`);
  }
});

test('inferSourceType heuristics', () => {
  assert.strictEqual(inferSourceType(patient), 'patient');
  assert.strictEqual(inferSourceType(lab), 'lab-result');
  assert.strictEqual(inferSourceType({ patientId: 'x', visitId: 'x-V1', status: 'OPEN' }), 'visit');
  assert.strictEqual(inferSourceType({ patientId: 'x', granteeId: 'd', sections: ['ehr'] }), 'consent');
});
