'use strict';

const crypto = require('crypto');
const os     = require('os');
const fs     = require('fs');
const path   = require('path');
const jwt    = require('jsonwebtoken');

const { createApp }       = require('../src/app');
const { JsonStore }       = require('../src/store');
const { SandboxProvider } = require('../src/providers/sandbox');
const { createTelemetry } = require('../src/telemetry');

const JWT_SECRET = 'test-secret-test-secret-test-secret';

// In-memory stand-ins that mirror the real clients' contracts, including the
// DigiLockerContract rules that matter to the service.
class FakeIpfs {
  constructor() { this.pins = new Map(); this.failNext = 0; this.counter = 0; }
  async pinEnvelope(envelope) {
    if (this.failNext > 0) { this.failNext -= 1; throw Object.assign(new Error('IPFS service unreachable'), { status: 503, code: 'IPFS_UNAVAILABLE' }); }
    const cid = `bafkrei${crypto.createHash('sha256').update(JSON.stringify(envelope)).digest('hex').replace(/[^a-z2-7]/g, 'a').slice(0, 40)}`;
    this.pins.set(cid, JSON.parse(JSON.stringify(envelope)));
    return cid;
  }
  async fetchEnvelope(cid) {
    if (!this.pins.has(cid)) throw Object.assign(new Error('IPFS service error (404)'), { status: 502 });
    return this.pins.get(cid);
  }
  async unpin(cid) { this.pins.delete(cid); }
  async health() { return true; }
}

class FakeFabric {
  constructor() { this.docs = new Map(); this.failAnchor = false; this.tx = 0; }
  key(p, d) { return `${p}/${d}`; }
  async anchor(doc) {
    if (this.failAnchor) throw Object.assign(new Error('Peer unavailable'), { status: 503, code: 'FABRIC_UNAVAILABLE' });
    const existing = this.docs.get(this.key(doc.patientId, doc.docId));
    if (existing?.status === 'ANCHORED') throw Object.assign(new Error('already exists'), { status: 409 });
    const record = { ...doc, status: 'ANCHORED', anchoredAt: new Date().toISOString(), txId: `tx-${++this.tx}`, revocation: null };
    this.docs.set(this.key(doc.patientId, doc.docId), record);
    return record;
  }
  async get(p, d) {
    const record = this.docs.get(this.key(p, d));
    if (!record) throw Object.assign(new Error(`DigiLocker document not found: ${d}`), { status: 404 });
    return record;
  }
  async list(p) { return [...this.docs.values()].filter(doc => doc.patientId === p); }
  async verify(p, d, hash) { const record = await this.get(p, d); return { match: record.contentHash === hash }; }
  async revoke(p, d, reason) { const record = await this.get(p, d); record.status = 'REVOKED'; record.revocation = { reason }; return record; }
  async history(p, d) { const record = await this.get(p, d); return [{ txId: record.txId, timestamp: record.anchoredAt, value: record }]; }
  async health() { return true; }
}

function build() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'digilocker-test-'));
  const config = {
    mode: 'sandbox', jwtSecret: JWT_SECRET, vaultKey: crypto.randomBytes(32),
    publicUrl: 'http://service.test', portalReturnUrl: 'http://portal.test/digilocker',
    corsOrigins: ['http://portal.test'], maxDocumentBytes: 3 * 1024 * 1024, dataDir,
    dashboard: { url: '', key: '' },
  };
  const logger = { error() {}, warn() {}, info() {}, http() {}, debug() {} };
  const store = new JsonStore(dataDir);
  const provider = new SandboxProvider({ publicUrl: config.publicUrl, signingKey: crypto.randomBytes(32) });
  const ipfs = new FakeIpfs();
  const fabric = new FakeFabric();
  const telemetry = createTelemetry({ dashboard: config.dashboard, logger });
  const app = createApp({ config, store, provider, ipfs, fabric, telemetry, logger });
  return { app, config, store, provider, ipfs, fabric };
}

async function listen(app) {
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, close: () => new Promise(resolve => server.close(resolve)) };
}

const tokenFor = (patientId, role = 'patient') => jwt.sign({ patientId, role }, JWT_SECRET, { expiresIn: '5m' });

module.exports = { build, listen, tokenFor, JWT_SECRET };
