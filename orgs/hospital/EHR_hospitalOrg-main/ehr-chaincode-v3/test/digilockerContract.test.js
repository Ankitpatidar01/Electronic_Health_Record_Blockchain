'use strict';

// Unit tests for DigiLockerContract against an in-memory stub.
// Run: node --test test/digilockerContract.test.js

const test   = require('node:test');
const assert = require('node:assert/strict');
const { DigiLockerContract } = require('../lib/digilockerContract');

function makeLedger() {
  const state = new Map();
  let tx = 0;
  const ctxFor = (role, userId = role) => {
    tx += 1;
    const txId = `tx${tx}`;
    return {
      clientIdentity: {
        getAttributeValue: (name) => (name === 'role' ? role : ''),
        getMSPID: () => 'HospitalMSP',
        getID: () => `x509::/OU=client/CN=${userId}::/C=US/CN=ca`,
      },
      stub: {
        getTxID: () => txId,
        getTxTimestamp: () => ({ seconds: 1790000000 + tx, nanos: 0 }),
        createCompositeKey: (type, parts) => `\u0000${type}\u0000${parts.join('\u0000')}\u0000`,
        getState: async (key) => state.get(key) || Buffer.alloc(0),
        putState: async (key, value) => { state.set(key, Buffer.from(value)); },
        setEvent: () => {},
        getStateByPartialCompositeKey: async (type, parts) => {
          const prefix = `\u0000${type}\u0000${parts.join('\u0000')}\u0000`;
          const rows = [...state.entries()].filter(([key]) => key.startsWith(prefix));
          let index = 0;
          return {
            next: async () => (index < rows.length
              ? { value: { key: rows[index][0], value: rows[index++][1] }, done: false }
              : { done: true }),
            close: async () => {},
          };
        },
        getHistoryForKey: async () => ({ next: async () => ({ done: true }), close: async () => {} }),
      },
    };
  };
  state.set('PATIENT:PAT-001', Buffer.from(JSON.stringify({ patientId: 'PAT-001' })));
  return { state, ctxFor };
}

const H = (ch) => ch.repeat(64);
const CID = 'bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy';
const anchorArgs = ['PAT-001', 'DL-ABCDEF0123456789ABCDEF01', 'LAB_REPORT', 'sandbox.lab', H('a'), H('b'), CID, H('c'), '2026-08-14'];

test('patientService anchors, lists, verifies and revokes', async () => {
  const { ctxFor } = makeLedger();
  const contract = new DigiLockerContract();
  const record = JSON.parse(await contract.AnchorDocument(ctxFor('patientService'), ...anchorArgs));
  assert.equal(record.status, 'ANCHORED');
  assert.equal(record.anchoredBy, 'patientService');
  assert.match(record.anchoredAt, /^\d{4}-\d{2}-\d{2}T/);

  const list = JSON.parse(await contract.ListDocuments(ctxFor('patientService'), 'PAT-001'));
  assert.equal(list.length, 1);

  const good = JSON.parse(await contract.VerifyDocument(ctxFor('patientService'), 'PAT-001', anchorArgs[1], H('a')));
  const bad  = JSON.parse(await contract.VerifyDocument(ctxFor('patientService'), 'PAT-001', anchorArgs[1], H('f')));
  assert.equal(good.match, true);
  assert.equal(bad.match, false);

  await assert.rejects(contract.AnchorDocument(ctxFor('patientService'), ...anchorArgs), /already exists/);

  const revoked = JSON.parse(await contract.RevokeDocument(ctxFor('patientService'), 'PAT-001', anchorArgs[1], 'no longer needed'));
  assert.equal(revoked.status, 'REVOKED');
  await assert.rejects(contract.RevokeDocument(ctxFor('patientService'), 'PAT-001', anchorArgs[1], 'again'), /already revoked/);

  // A withdrawn document may be anchored again.
  const again = JSON.parse(await contract.AnchorDocument(ctxFor('patientService'), ...anchorArgs));
  assert.equal(again.status, 'ANCHORED');
});

test('timestamps come from the transaction, so endorsers agree', async () => {
  const { ctxFor } = makeLedger();
  const contract = new DigiLockerContract();
  const ctx = ctxFor('patientService');
  const record = JSON.parse(await contract.AnchorDocument(ctx, ...anchorArgs));
  assert.equal(record.anchoredAt, new Date(ctx.stub.getTxTimestamp().seconds * 1000).toISOString());
});

test('role and input rules are enforced', async () => {
  const { ctxFor } = makeLedger();
  const contract = new DigiLockerContract();
  await assert.rejects(contract.AnchorDocument(ctxFor('doctor'), ...anchorArgs), /Access denied/);
  await assert.rejects(contract.AnchorDocument(ctxFor('receptionist'), ...anchorArgs), /Access denied/);

  const withArg = (index, value) => anchorArgs.map((arg, i) => (i === index ? value : arg));
  await assert.rejects(contract.AnchorDocument(ctxFor('patientService'), ...withArg(0, 'PAT-404')), /Patient not found/);
  await assert.rejects(contract.AnchorDocument(ctxFor('patientService'), ...withArg(2, 'SELFIE')), /docType must be one of/);
  await assert.rejects(contract.AnchorDocument(ctxFor('patientService'), ...withArg(4, 'nothex')), /contentHash is malformed/);
  await assert.rejects(contract.AnchorDocument(ctxFor('patientService'), ...withArg(6, 'not-a-cid')), /cid is malformed/);

  await contract.AnchorDocument(ctxFor('patientService'), ...anchorArgs);
  // Doctors need the patient's consent grant; none exists here.
  await assert.rejects(contract.GetDocument(ctxFor('doctor', 'doctor1'), 'PAT-001', anchorArgs[1]), /Access denied/);
  await assert.rejects(contract.ListDocuments(ctxFor('pharmacist'), 'PAT-001'), /Access denied/);
  await assert.rejects(contract.GetDocument(ctxFor('patientService'), 'PAT-001', 'DL-MISSING'), /not found/);
});
