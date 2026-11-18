'use strict';

const crypto  = require('crypto');
const express = require('express');
const jwt     = require('jsonwebtoken');

const { encryptDocument, decryptDocument, sealSecret, openSecret, docIdFor, uriHashFor } = require('./vaultCrypto');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const fail = (status, message, code) => Object.assign(new Error(message), { status, code, retryable: false });
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const DOC_ID = /^DL-[A-F0-9]{24}$/;

function createRouter({ config, store, provider, ipfs, fabric, telemetry, logger }) {
  const router = express.Router();

  // ── auth: the patient portal's own JWT ──────────────────────────────────────
  function authenticate(req, res, next) {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return next(fail(401, 'Missing or malformed Authorization header'));
    try {
      const claims = jwt.verify(header.slice(7), config.jwtSecret, { algorithms: ['HS256'] });
      if (claims.role !== 'patient' || typeof claims.patientId !== 'string' || !claims.patientId) {
        return next(fail(403, 'Only patients can use the DigiLocker vault'));
      }
      req.patientId = claims.patientId;
      return next();
    } catch (err) {
      return next(fail(401, err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token'));
    }
  }

  async function sessionFor(patientId) {
    const link = store.getLink(patientId);
    if (!link) throw fail(409, 'DigiLocker is not linked for this account', 'NOT_LINKED');
    if (link.mode !== provider.mode) {
      store.deleteLink(patientId);
      throw fail(409, 'DigiLocker link belongs to a different mode. Link again.', 'NOT_LINKED');
    }
    let tokens;
    try {
      tokens = openSecret(config.vaultKey, 'oauth-tokens', link.tokens);
    } catch (_) {
      store.deleteLink(patientId);
      throw fail(409, 'DigiLocker link could not be read. Link again.', 'NOT_LINKED');
    }
    try {
      const fresh = await provider.refresh(tokens);
      if (fresh !== tokens) store.putLink(patientId, { ...link, tokens: sealSecret(config.vaultKey, 'oauth-tokens', fresh) });
      return fresh;
    } catch (err) {
      if (err.code === 'RELINK_REQUIRED') store.deleteLink(patientId);
      throw err;
    }
  }

  const returnTo = (result, extra = {}) => {
    const url = new URL(config.portalReturnUrl);
    url.searchParams.set('digilocker', result);
    for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, value);
    return url.toString();
  };

  // ── health ──────────────────────────────────────────────────────────────────
  router.get('/health', wrap(async (req, res) => {
    const [ipfsOk, fabricOk] = await Promise.all([ipfs.health(), fabric.health()]);
    res.status(200).json({
      success: true,
      service: 'digilocker-service',
      status: ipfsOk && fabricOk ? 'ok' : 'degraded',
      mode: provider.mode,
      dependencies: { ipfs: ipfsOk ? 'ok' : 'unavailable', fabric: fabricOk ? 'ok' : 'unavailable' },
      time: new Date().toISOString(),
    });
  }));

  // ── link status ─────────────────────────────────────────────────────────────
  router.get('/status', authenticate, (req, res) => {
    const link = store.getLink(req.patientId);
    const linked = Boolean(link && link.mode === provider.mode);
    res.json({
      success: true,
      data: {
        mode: provider.mode,
        linked,
        account: linked ? link.account : null,
        linkedAt: linked ? link.linkedAt : null,
      },
    });
  });

  // ── start OAuth ─────────────────────────────────────────────────────────────
  router.post('/link/start', authenticate, (req, res) => {
    const state = crypto.randomBytes(32).toString('base64url');
    const codeVerifier = crypto.randomBytes(48).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    store.putPending(state, { patientId: req.patientId, codeVerifier, expiresAt: Date.now() + 10 * 60_000 });
    res.json({ success: true, data: { mode: provider.mode, authorizeUrl: provider.authorizeUrl({ state, codeChallenge }) } });
  });

  // ── OAuth redirect target (browser navigation, no bearer token) ─────────────
  router.get('/link/callback', wrap(async (req, res) => {
    const { code, state, error } = req.query;
    const pending = typeof state === 'string' ? store.takePending(state) : null;
    if (!pending) return res.redirect(303, returnTo('error', { reason: 'expired' }));
    if (error || typeof code !== 'string') return res.redirect(303, returnTo('denied'));
    try {
      const { tokens, account } = await provider.exchangeCode({
        code, state, codeVerifier: pending.codeVerifier, subject: pending.patientId,
      });
      store.putLink(pending.patientId, {
        mode: provider.mode,
        account,
        linkedAt: new Date().toISOString(),
        tokens: sealSecret(config.vaultKey, 'oauth-tokens', tokens),
      });
      logger.info('DigiLocker linked', { mode: provider.mode });
      return res.redirect(303, returnTo('linked'));
    } catch (err) {
      logger.warn('DigiLocker link failed', { error: err.message });
      return res.redirect(303, returnTo('error', { reason: 'exchange' }));
    }
  }));

  // ── unlink ──────────────────────────────────────────────────────────────────
  router.delete('/link', authenticate, wrap(async (req, res) => {
    const link = store.getLink(req.patientId);
    if (link) {
      try { await provider.revoke(openSecret(config.vaultKey, 'oauth-tokens', link.tokens)); } catch (_) { /* best effort */ }
      store.deleteLink(req.patientId);
    }
    res.json({ success: true, data: { linked: false } });
  }));

  // ── sandbox consent simulator ───────────────────────────────────────────────
  if (provider.mode === 'sandbox') {
    router.get('/sandbox/authorize', (req, res) => {
      const state = typeof req.query.state === 'string' ? req.query.state : '';
      const base = `${config.publicUrl}/sandbox/decision?state=${encodeURIComponent(state)}`;
      res.type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sandbox consent simulator</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#090D16;color:#F8FAFC;font:15px/1.55 Inter,system-ui,sans-serif}
main{max-width:460px;margin:24px;padding:28px;border-radius:20px;border:1px solid rgba(255,255,255,.1);background:rgba(17,24,39,.85)}
.tag{display:inline-block;padding:4px 10px;border-radius:999px;background:rgba(245,158,11,.15);color:#fbbf24;font-size:11px;font-weight:700;letter-spacing:.08em}
h1{font-size:20px;margin:14px 0 8px}p{color:#CBD5E1;margin:0 0 12px}ul{color:#CBD5E1;padding-left:18px;margin:0 0 20px}
.row{display:flex;gap:10px}a{flex:1;text-align:center;padding:11px 14px;border-radius:999px;font-weight:700;text-decoration:none}
.allow{background:#2563EB;color:#fff}.deny{border:1px solid rgba(255,255,255,.18);color:#CBD5E1}</style></head>
<body><main><span class="tag">SANDBOX SIMULATOR</span>
<h1>Simulated document-locker consent</h1>
<p>This page is a local test simulator. It is <strong>not</strong> DigiLocker and is not affiliated with it. No real account or document is involved.</p>
<p>The EHR patient portal is asking to:</p>
<ul><li>List the sample documents issued to a simulated holder</li><li>Download the ones you choose into your encrypted vault</li></ul>
<div class="row"><a class="deny" href="${escapeHtml(base)}&amp;decision=deny">Deny</a><a class="allow" href="${escapeHtml(base)}&amp;decision=allow">Allow</a></div>
</main></body></html>`);
    });

    router.get('/sandbox/decision', (req, res) => {
      const state = typeof req.query.state === 'string' ? req.query.state : '';
      const target = new URL(`${config.publicUrl}/link/callback`);
      target.searchParams.set('state', state);
      if (req.query.decision === 'allow') target.searchParams.set('code', provider.issueCode(state));
      else target.searchParams.set('error', 'access_denied');
      res.redirect(303, target.toString());
    });
  }

  // ── issued documents in the linked locker ───────────────────────────────────
  router.get('/documents', authenticate, wrap(async (req, res) => {
    const tokens = await sessionFor(req.patientId);
    const issued = await provider.listIssued(tokens, req.patientId);
    let anchored = null;
    try {
      anchored = new Map((await fabric.list(req.patientId)).map(doc => [doc.docId, doc]));
    } catch (err) {
      logger.warn('Ledger unavailable while listing issued documents', { error: err.message });
    }
    res.json({
      success: true,
      data: {
        ledgerAvailable: anchored !== null,
        documents: issued.map(item => {
          const docId = docIdFor(req.patientId, item.uri);
          const onChain = anchored?.get(docId);
          return { ...item, docId, anchored: onChain?.status === 'ANCHORED', anchoredAt: onChain?.status === 'ANCHORED' ? onChain.anchoredAt : null };
        }),
      },
    });
  }));

  // ── pull → encrypt → IPFS → anchor ──────────────────────────────────────────
  router.post('/documents/pull', authenticate, wrap(async (req, res) => {
    const uri = req.body?.uri;
    if (typeof uri !== 'string' || !uri || uri.length > 512) throw fail(400, 'uri is required');
    const patientId = req.patientId;
    const docId = docIdFor(patientId, uri);
    const started = Date.now();
    const patientIdHash = telemetry.enabled ? telemetry.patientHash(patientId) : undefined;

    const existing = await fabric.get(patientId, docId).catch(err => { if (err.status === 404) return null; throw err; });
    if (existing?.status === 'ANCHORED') {
      return res.status(409).json({ success: false, error: 'This document is already anchored in your vault', code: 'ALREADY_ANCHORED', data: existing });
    }

    const tokens = await sessionFor(patientId);
    const file = await provider.fetchFile(tokens, uri, patientId);
    if (!file.buffer?.length) throw fail(502, 'DigiLocker returned an empty document');
    if (file.buffer.length > config.maxDocumentBytes) {
      throw fail(413, `Document is larger than the ${Math.floor(config.maxDocumentBytes / 1024)} KB vault limit`);
    }
    telemetry.stage('REPORT_RECEIVED', 'DONE', { patientIdHash });

    const { envelope, contentHash, cipherHash } = encryptDocument(config.vaultKey, { patientId, docId, plaintext: file.buffer });

    let cid;
    try {
      cid = await ipfs.pinEnvelope(envelope, `${docId}.vault.json`);
      telemetry.ipfsUploaded({ cid, byteLength: file.buffer.length, durationMs: Date.now() - started });
      telemetry.stage('ENCRYPTED_IPFS_STORED', 'DONE', { patientIdHash, recordHash: contentHash, cid });
    } catch (err) {
      telemetry.ipfsFailed(err.code || 'IPFS_ERROR');
      telemetry.stage('ENCRYPTED_IPFS_STORED', 'FAILED', { patientIdHash, errorCode: err.code || 'IPFS_ERROR' });
      throw err;
    }

    let record;
    try {
      record = await fabric.anchor({
        patientId, docId, docType: file.docType, issuerId: file.issuerId,
        contentHash, cipherHash, cid, uriHash: uriHashFor(uri), issuedAt: file.issuedAt,
      });
    } catch (err) {
      // Do not leave an orphaned ciphertext pinned when the anchor did not land.
      await ipfs.unpin(cid);
      telemetry.stage('RECORD_ANCHORED', 'FAILED', { patientIdHash, errorCode: err.code || 'FABRIC_ERROR' });
      throw err;
    }

    store.putDocument(patientId, docId, { name: file.name, issuer: file.issuer, mime: file.mime, size: file.buffer.length });
    telemetry.stage('RECORD_ANCHORED', 'DONE', { patientIdHash, recordHash: contentHash, cid, durationMs: Date.now() - started });
    logger.info('DigiLocker document anchored', { docId, cid, txId: record?.txId });
    return res.status(201).json({ success: true, data: { ...record, ...store.getDocument(patientId, docId) } });
  }));

  // ── vault (ledger is the source of truth) ───────────────────────────────────
  router.get('/vault', authenticate, wrap(async (req, res) => {
    const records = await fabric.list(req.patientId);
    res.json({ success: true, data: records.map(record => ({ ...record, ...(store.getDocument(req.patientId, record.docId) || {}) })) });
  }));

  async function loadDocument(patientId, docId) {
    if (!DOC_ID.test(docId)) throw fail(400, 'Invalid document id');
    const record = await fabric.get(patientId, docId);
    if (!record) throw fail(404, 'Document not found');
    return record;
  }

  router.get('/vault/:docId/verify', authenticate, wrap(async (req, res) => {
    const record = await loadDocument(req.patientId, req.params.docId);
    const checks = { ciphertextIntact: false, decrypts: false, matchesLedger: false };
    let detail = null;
    try {
      const envelope = await ipfs.fetchEnvelope(record.cid);
      const opened = decryptDocument(config.vaultKey, { patientId: req.patientId, docId: record.docId, envelope });
      checks.decrypts = true;
      checks.ciphertextIntact = opened.cipherHash === record.cipherHash;
      const onChain = await fabric.verify(req.patientId, record.docId, opened.contentHash);
      checks.matchesLedger = onChain.match === true;
    } catch (err) {
      if (err.status === 503) throw err;
      detail = err.message;
    }
    const verified = checks.ciphertextIntact && checks.decrypts && checks.matchesLedger;
    telemetry.stage('VCAP_VERIFIED', verified ? 'DONE' : 'FAILED', {
      recordHash: record.contentHash, cid: record.cid,
      patientIdHash: telemetry.enabled ? telemetry.patientHash(req.patientId) : undefined,
    });
    res.json({
      success: true,
      data: { docId: record.docId, verified, checks, detail, status: record.status, contentHash: record.contentHash, cid: record.cid, txId: record.txId, anchoredAt: record.anchoredAt },
    });
  }));

  router.get('/vault/:docId/download', authenticate, wrap(async (req, res) => {
    const record = await loadDocument(req.patientId, req.params.docId);
    if (record.status !== 'ANCHORED') throw fail(410, 'This document was withdrawn from the vault');
    const envelope = await ipfs.fetchEnvelope(record.cid);
    const opened = decryptDocument(config.vaultKey, { patientId: req.patientId, docId: record.docId, envelope });
    if (opened.contentHash !== record.contentHash) throw fail(422, 'Stored document no longer matches its ledger anchor');
    const meta = store.getDocument(req.patientId, record.docId) || {};
    const filename = `${String(meta.name || record.docId).replace(/[^A-Za-z0-9 ._-]/g, '_')}${meta.mime === 'application/pdf' ? '.pdf' : ''}`;
    res.set({
      'content-type': meta.mime || 'application/octet-stream',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    });
    res.send(opened.plaintext);
  }));

  router.get('/vault/:docId/history', authenticate, wrap(async (req, res) => {
    await loadDocument(req.patientId, req.params.docId);
    const history = await fabric.history(req.patientId, req.params.docId);
    res.json({ success: true, data: history.map(entry => ({ txId: entry.txId, timestamp: entry.timestamp, status: entry.value?.status || null })) });
  }));

  router.delete('/vault/:docId', authenticate, wrap(async (req, res) => {
    const record = await loadDocument(req.patientId, req.params.docId);
    if (record.status !== 'ANCHORED') throw fail(409, 'This document was already withdrawn');
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 200) : 'Withdrawn by patient';
    const revoked = await fabric.revoke(req.patientId, record.docId, reason);
    await ipfs.unpin(record.cid);
    res.json({ success: true, data: revoked });
  }));

  return router;
}

module.exports = { createRouter };
