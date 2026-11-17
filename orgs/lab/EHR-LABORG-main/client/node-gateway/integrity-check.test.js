'use strict';

// Run with: node --test integrity-check.test.js
// Uses an in-memory ledger and IPFS store, so no Fabric network or IPFS node is needed.

const test = require('node:test');
const assert = require('node:assert');
const { sha256Hex } = require('./ipfs');
const { createIntegrityChecker } = require('./integrity-check');

const silentLogger = { log() {}, warn() {} };

// Mirrors addJsonToIpfs: stores the JSON text and records its SHA-256 on-chain.
function seed() {
  const ipfs = new Map();
  const ledger = [];

  function anchor(resultId, payload) {
    const bytes = Buffer.from(JSON.stringify(payload), 'utf8');
    const cid = `bafk-${resultId}`;
    ipfs.set(cid, bytes);
    ledger.push({
      resultId,
      patientId: `patient-${resultId}`,
      resultData: { storage: 'ipfs', cid, digest: sha256Hex(bytes), schema: 'labResultData.v1' },
    });
  }

  anchor('labresult10', { hemoglobin: '8.5', wbc: '9600' });
  anchor('labresult11', { hba1c: '8.2' });
  // Legacy record stored directly on-chain: nothing to re-check.
  ledger.push({ resultId: 'labresult1', resultData: { hemoglobin: '13.8' } });

  const checker = createIntegrityChecker({
    listRecords: async () => ledger,
    fetchRaw: async (cid) => {
      if (!ipfs.has(cid)) {
        throw new Error(`IPFS API /api/v0/cat failed (500): block not found`);
      }
      return ipfs.get(cid);
    },
    hash: sha256Hex,
    intervalMs: 60000,
    logger: silentLogger,
  });

  return { ipfs, ledger, checker };
}

test('untouched records all verify OK', async () => {
  const { checker } = seed();
  const report = await checker.runOnce();
  assert.strictEqual(report.ok, true);
  assert.deepStrictEqual(report.summary, {
    checked: 2, ok: 2, mismatch: 0, missing: 0, skippedOnChain: 1,
  });
});

test('on-chain digest changed via UpdateLabResult is flagged MISMATCH', async () => {
  const { ledger, checker } = seed();
  const record = ledger.find((r) => r.resultId === 'labresult10');
  const expected = '0'.repeat(64);
  record.resultData.digest = expected;

  const report = await checker.runOnce();
  const flagged = report.records.find((r) => r.resultId === 'labresult10');
  assert.strictEqual(flagged.status, 'MISMATCH');
  assert.strictEqual(flagged.checks[0].expected, expected);
  assert.notStrictEqual(flagged.checks[0].actual, expected);
  assert.strictEqual(report.summary.ok, 1);
});

test('payload unpinned / garbage-collected is flagged MISSING and the run continues', async () => {
  const { ipfs, checker } = seed();
  ipfs.delete('bafk-labresult11');

  const report = await checker.runOnce();
  const flagged = report.records.find((r) => r.resultId === 'labresult11');
  assert.strictEqual(flagged.status, 'MISSING');
  assert.match(flagged.checks[0].error, /block not found/);
  assert.strictEqual(report.summary.ok, 1);
});

test('hashing re-serialised JSON would give a false mismatch; raw bytes do not', () => {
  const stored = Buffer.from('{"hba1c":"8.2","note":"x"}', 'utf8');
  const reserialised = Buffer.from(JSON.stringify(JSON.parse(stored.toString()), null, 2));
  assert.notStrictEqual(sha256Hex(reserialised), sha256Hex(stored));
});

test('ledger unreachable produces a failed report instead of throwing', async () => {
  const checker = createIntegrityChecker({
    listRecords: async () => { throw new Error('14 UNAVAILABLE: peer0 unreachable'); },
    fetchRaw: async () => Buffer.alloc(0),
    hash: sha256Hex,
    intervalMs: 60000,
    logger: silentLogger,
  });
  const report = await checker.runOnce();
  assert.strictEqual(report.ok, false);
  assert.match(report.error, /UNAVAILABLE/);
});

test('concurrent triggers share one run', async () => {
  const { checker } = seed();
  const [a, b] = await Promise.all([checker.runOnce('scheduled'), checker.runOnce('manual')]);
  assert.strictEqual(a, b);
});
