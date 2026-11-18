'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const { withRetry } = require('../src/retry');
const { encryptDocument, decryptDocument, docIdFor } = require('../src/vaultCrypto');
const { loadConfig } = require('../src/config');
const { classify } = require('../src/providers/docTypes');
const { buildPdf } = require('../src/providers/sandbox');

test('withRetry retries transient failures and stops on permanent ones', async () => {
  let calls = 0;
  const value = await withRetry(async () => { calls += 1; if (calls < 3) throw Object.assign(new Error('x'), { retryable: true }); return 'ok'; }, { sleep: false });
  assert.equal(value, 'ok');
  assert.equal(calls, 3);

  calls = 0;
  await assert.rejects(withRetry(async () => { calls += 1; throw Object.assign(new Error('bad input'), { retryable: false }); }, { sleep: false }));
  assert.equal(calls, 1);

  calls = 0;
  await assert.rejects(withRetry(async () => { calls += 1; throw Object.assign(new Error('down'), { code: 'ECONNREFUSED' }); }, { retries: 2, sleep: false }));
  assert.equal(calls, 3);
});

test('vault encryption round-trips and is bound to patient and document', () => {
  const key = crypto.randomBytes(32);
  const plaintext = Buffer.from('sample document bytes');
  const sealed = encryptDocument(key, { patientId: 'PAT-1', docId: 'DL-1', plaintext });
  const opened = decryptDocument(key, { patientId: 'PAT-1', docId: 'DL-1', envelope: sealed.envelope });
  assert.deepEqual(opened.plaintext, plaintext);
  assert.equal(opened.contentHash, sealed.contentHash);
  assert.throws(() => decryptDocument(key, { patientId: 'PAT-2', docId: 'DL-1', envelope: sealed.envelope }));
  assert.throws(() => decryptDocument(crypto.randomBytes(32), { patientId: 'PAT-1', docId: 'DL-1', envelope: sealed.envelope }));
  assert.notEqual(docIdFor('PAT-1', 'u'), docIdFor('PAT-2', 'u'));
});

test('config reports every missing required value', () => {
  const empty = loadConfig({});
  assert.ok(empty.problems.some(p => p.includes('JWT_SECRET')));
  assert.ok(empty.problems.some(p => p.includes('DIGILOCKER_VAULT_KEY')));
  const live = loadConfig({ JWT_SECRET: 'x', DIGILOCKER_VAULT_KEY: 'a'.repeat(64), DIGILOCKER_MODE: 'live' });
  assert.ok(live.problems.some(p => p.includes('DIGILOCKER_CLIENT_ID')));
  assert.equal(loadConfig({ JWT_SECRET: 'x', DIGILOCKER_VAULT_KEY: 'a'.repeat(64) }).problems.length, 0);
});

test('document classification and sample PDF structure', () => {
  assert.equal(classify('PRSCN', 'OPD Prescription'), 'PRESCRIPTION');
  assert.equal(classify('', 'Blood test report'), 'LAB_REPORT');
  assert.equal(classify('DRVLC', 'Driving Licence'), 'OTHER');
  const pdf = buildPdf(['hello']).toString('latin1');
  const xref = Number(/startxref\n(\d+)/.exec(pdf)[1]);
  assert.equal(pdf.slice(xref, xref + 4), 'xref');
});
