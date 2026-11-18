'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const { build, listen, tokenFor } = require('./helpers');

async function link(ctx, base, patientId) {
  const auth = { authorization: `Bearer ${tokenFor(patientId)}` };
  const start = await (await fetch(`${base}/link/start`, { method: 'POST', headers: auth })).json();
  const state = new URL(start.data.authorizeUrl).searchParams.get('state');
  const code = ctx.provider.issueCode(state);
  const cb = await fetch(`${base}/link/callback?state=${encodeURIComponent(state)}&code=${encodeURIComponent(code)}`, { redirect: 'manual' });
  assert.equal(cb.status, 303);
  assert.match(cb.headers.get('location'), /digilocker=linked/);
  return auth;
}

test('rejects calls without a patient token', async () => {
  const ctx = build();
  const { base, close } = await listen(ctx.app);
  try {
    assert.equal((await fetch(`${base}/status`)).status, 401);
    const staff = await fetch(`${base}/status`, { headers: { authorization: `Bearer ${tokenFor('PAT-1', 'doctor')}` } });
    assert.equal(staff.status, 403);
  } finally { await close(); }
});

test('full flow: link, list, pull, verify, download, withdraw', async () => {
  const ctx = build();
  const { base, close } = await listen(ctx.app);
  try {
    const before = await (await fetch(`${base}/status`, { headers: { authorization: `Bearer ${tokenFor('PAT-1')}` } })).json();
    assert.equal(before.data.linked, false);

    const auth = await link(ctx, base, 'PAT-1');
    const status = await (await fetch(`${base}/status`, { headers: auth })).json();
    assert.equal(status.data.linked, true);
    assert.equal(status.data.mode, 'sandbox');

    const issued = await (await fetch(`${base}/documents`, { headers: auth })).json();
    assert.ok(issued.data.documents.length >= 3);
    assert.ok(issued.data.documents.every(doc => doc.anchored === false));
    const target = issued.data.documents[0];

    const pulled = await fetch(`${base}/documents/pull`, {
      method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ uri: target.uri }),
    });
    assert.equal(pulled.status, 201);
    const record = (await pulled.json()).data;
    assert.match(record.docId, /^DL-[A-F0-9]{24}$/);
    assert.match(record.contentHash, /^[a-f0-9]{64}$/);
    assert.equal(record.status, 'ANCHORED');

    // Nothing readable is stored off-device: the pinned envelope is ciphertext.
    const envelope = ctx.ipfs.pins.get(record.cid);
    assert.equal(envelope.alg, 'AES-256-GCM');
    assert.ok(!Buffer.from(envelope.ciphertext, 'base64').toString('latin1').includes('%PDF'));

    const again = await fetch(`${base}/documents/pull`, {
      method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ uri: target.uri }),
    });
    assert.equal(again.status, 409);

    const verify = await (await fetch(`${base}/vault/${record.docId}/verify`, { headers: auth })).json();
    assert.equal(verify.data.verified, true);

    const download = await fetch(`${base}/vault/${record.docId}/download`, { headers: auth });
    assert.equal(download.status, 200);
    const bytes = Buffer.from(await download.arrayBuffer());
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    assert.ok(bytes.toString('latin1').includes('SANDBOX SAMPLE'));

    const vault = await (await fetch(`${base}/vault`, { headers: auth })).json();
    assert.equal(vault.data.length, 1);
    assert.equal(vault.data[0].name, target.name);

    const withdrawn = await fetch(`${base}/vault/${record.docId}`, { method: 'DELETE', headers: auth });
    assert.equal(withdrawn.status, 200);
    assert.equal((await fetch(`${base}/vault/${record.docId}/download`, { headers: auth })).status, 410);
  } finally { await close(); }
});

test('tampered ciphertext fails verification and download', async () => {
  const ctx = build();
  const { base, close } = await listen(ctx.app);
  try {
    const auth = await link(ctx, base, 'PAT-2');
    const issued = await (await fetch(`${base}/documents`, { headers: auth })).json();
    const record = (await (await fetch(`${base}/documents/pull`, {
      method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ uri: issued.data.documents[1].uri }),
    })).json()).data;

    const envelope = ctx.ipfs.pins.get(record.cid);
    const raw = Buffer.from(envelope.ciphertext, 'base64');
    raw[10] ^= 0xff;
    envelope.ciphertext = raw.toString('base64');

    const verify = await (await fetch(`${base}/vault/${record.docId}/verify`, { headers: auth })).json();
    assert.equal(verify.data.verified, false);
    assert.equal((await fetch(`${base}/vault/${record.docId}/download`, { headers: auth })).status, 422);
  } finally { await close(); }
});

test('one patient cannot reach another patient\'s vault or documents', async () => {
  const ctx = build();
  const { base, close } = await listen(ctx.app);
  try {
    const authA = await link(ctx, base, 'PAT-A');
    const authB = await link(ctx, base, 'PAT-B');
    const issuedA = await (await fetch(`${base}/documents`, { headers: authA })).json();
    const record = (await (await fetch(`${base}/documents/pull`, {
      method: 'POST', headers: { ...authA, 'content-type': 'application/json' }, body: JSON.stringify({ uri: issuedA.data.documents[0].uri }),
    })).json()).data;

    assert.equal((await fetch(`${base}/vault/${record.docId}/download`, { headers: authB })).status, 404);
    assert.equal((await (await fetch(`${base}/vault`, { headers: authB })).json()).data.length, 0);
    // B cannot pull A's document URI either.
    const cross = await fetch(`${base}/documents/pull`, {
      method: 'POST', headers: { ...authB, 'content-type': 'application/json' }, body: JSON.stringify({ uri: issuedA.data.documents[0].uri }),
    });
    assert.equal(cross.status, 404);
  } finally { await close(); }
});

test('a failed anchor leaves no orphaned pin and reports 503', async () => {
  const ctx = build();
  const { base, close } = await listen(ctx.app);
  try {
    const auth = await link(ctx, base, 'PAT-3');
    const issued = await (await fetch(`${base}/documents`, { headers: auth })).json();
    ctx.fabric.failAnchor = true;
    const res = await fetch(`${base}/documents/pull`, {
      method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ uri: issued.data.documents[0].uri }),
    });
    assert.equal(res.status, 503);
    assert.equal(ctx.ipfs.pins.size, 0);
  } finally { await close(); }
});

test('denied consent and replayed state do not create a link', async () => {
  const ctx = build();
  const { base, close } = await listen(ctx.app);
  try {
    const auth = { authorization: `Bearer ${tokenFor('PAT-4')}` };
    const start = await (await fetch(`${base}/link/start`, { method: 'POST', headers: auth })).json();
    const state = new URL(start.data.authorizeUrl).searchParams.get('state');
    const denied = await fetch(`${base}/link/callback?state=${encodeURIComponent(state)}&error=access_denied`, { redirect: 'manual' });
    assert.match(denied.headers.get('location'), /digilocker=denied/);
    const replay = await fetch(`${base}/link/callback?state=${encodeURIComponent(state)}&code=${encodeURIComponent(ctx.provider.issueCode(state))}`, { redirect: 'manual' });
    assert.match(replay.headers.get('location'), /digilocker=error/);
    assert.equal((await (await fetch(`${base}/status`, { headers: auth })).json()).data.linked, false);
    assert.equal((await fetch(`${base}/documents`, { headers: auth })).status, 409);
  } finally { await close(); }
});
