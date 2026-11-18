'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { canonicalizeResource } = require('../src/canonicalizer');
const { patientRecordHash } = require('../src/hasher');

// The core risk from Group 4 §3.3: identical clinical content re-serialized with
// reordered keys must NOT produce a different SHA-256 digest.

const a = {
  resourceType: 'Observation',
  id: 'OBS-1',
  status: 'final',
  code: { coding: [{ system: 'http://loinc.org', code: '718-7' }] },
  valueQuantity: { value: 8.5, unit: 'g/dL' },
};

const b = {
  valueQuantity: { value: 8.5, unit: 'g/dL' },
  status: 'final',
  id: 'OBS-1',
  code: { coding: [{ system: 'http://loinc.org', code: '718-7' }] },
  resourceType: 'Observation',
};

test('JCS canonicalization is deterministic across key order', () => {
  assert.strictEqual(canonicalizeResource(a), canonicalizeResource(b));
});

test('patientRecordHash is identical for reordered keys', () => {
  assert.strictEqual(patientRecordHash(a), patientRecordHash(b));
});

test('changing a clinical value changes the digest', () => {
  const c = { ...a, valueQuantity: { value: 14.5, unit: 'g/dL' } };
  assert.notStrictEqual(patientRecordHash(a), patientRecordHash(c));
});

test('non-JCS-serializable input is rejected loudly', () => {
  assert.throws(() => canonicalizeResource({ x: undefined }), /CANONICALIZATION_ERROR/);
});
