'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { patientIdHash } = require('../src/identifiers');
const { patientRecordHash } = require('../src/hasher');

test('patientIdHash is HMAC-SHA256 and deterministic for a fixed Knet', () => {
  process.env.KNET = 'test-knet';
  const h1 = patientIdHash('PAT-001');
  const h2 = patientIdHash('PAT-001');
  assert.strictEqual(h1, h2);
  assert.match(h1, /^hmac-sha256:[0-9a-f]{64}$/);
});

test('patientIdHash differs from plain SHA-256 of the same id', () => {
  process.env.KNET = 'test-knet';
  const plain = crypto.createHash('sha256').update('PAT-001').digest('hex');
  assert.notStrictEqual(patientIdHash('PAT-001'), `sha256:${plain}`);
});

test('patientIdHash changes with a different Knet', () => {
  process.env.KNET = 'knet-A';
  const a = patientIdHash('PAT-001');
  process.env.KNET = 'knet-B';
  const b = patientIdHash('PAT-001');
  assert.notStrictEqual(a, b);
});

test('patientRecordHash is sha256 of the canonical form', () => {
  const resource = { resourceType: 'Observation', id: 'x', status: 'final' };
  assert.match(patientRecordHash(resource), /^sha256:[0-9a-f]{64}$/);
});
