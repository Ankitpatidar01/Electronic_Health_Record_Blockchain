'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { validateResource } = require('../src/validator');

const validObservation = {
  resourceType: 'Observation',
  id: 'OBS-1',
  status: 'final',
  subject: { reference: 'Patient/PAT-001' },
  code: { coding: [{ system: 'http://loinc.org', code: '718-7', display: 'Hemoglobin' }] },
  valueQuantity: { value: 8.5, unit: 'g/dL', system: 'http://unitsofmeasure.org', code: 'g/dL' },
};

test('a valid Observation passes', () => {
  const r = validateResource(validObservation);
  assert.strictEqual(r.valid, true, JSON.stringify(r.errors));
});

test('missing resourceType is SCHEMA_INVALID', () => {
  const r = validateResource({ id: 'x', status: 'final' });
  assert.strictEqual(r.valid, false);
  assert.strictEqual(r.errors[0].code, 'SCHEMA_INVALID');
});

test('missing required field fails with SCHEMA_INVALID', () => {
  const r = validateResource({ resourceType: 'Observation', id: 'OBS-1' }); // no status/subject/code
  assert.strictEqual(r.valid, false);
  assert.ok(r.errors.every(e => e.code === 'SCHEMA_INVALID'));
});

test('unknown LOINC code is TERMINOLOGY_UNBOUND', () => {
  const r = validateResource({
    ...validObservation,
    code: { coding: [{ system: 'http://loinc.org', code: '99999-9', display: 'Nope' }] },
  });
  assert.strictEqual(r.valid, false);
  assert.ok(r.errors.some(e => e.code === 'TERMINOLOGY_UNBOUND'));
});

test('unknown UCUM unit is TERMINOLOGY_UNBOUND', () => {
  const r = validateResource({
    ...validObservation,
    valueQuantity: { value: 8.5, unit: 'parsecs', system: 'http://unitsofmeasure.org', code: 'parsecs' },
  });
  assert.strictEqual(r.valid, false);
  assert.ok(r.errors.some(e => e.code === 'TERMINOLOGY_UNBOUND'));
});

test('unknown coding system is out of scope (not rejected)', () => {
  const r = validateResource({
    ...validObservation,
    code: { coding: [{ system: 'http://example.com/unknown', code: 'anything' }] },
  });
  assert.strictEqual(r.valid, true, JSON.stringify(r.errors));
});
