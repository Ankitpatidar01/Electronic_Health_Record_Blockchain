'use strict';

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');
const { withRetry } = require('./retry');

const CONTRACT = 'DigiLockerContract';

function fabricMessage(err) {
  if (Array.isArray(err?.details)) {
    for (const detail of err.details) {
      const message = String(detail?.message || '').replace(/^chaincode response \d+,\s*/i, '').trim();
      if (message) return message;
    }
  }
  return err?.message || 'Fabric request failed';
}

// Turns a Fabric/gRPC failure into an HTTP-shaped error the routes can return.
function translate(err) {
  const message = fabricMessage(err);
  let status = 502;
  let retryable = false;
  if (/already exists/i.test(message)) status = 409;
  else if (/Access denied/i.test(message)) status = 403;
  else if (/not found/i.test(message)) status = 404;
  else if (/malformed|is required|must be one of/i.test(message)) status = 400;
  else if (/UNAVAILABLE|DEADLINE_EXCEEDED|MVCC_READ_CONFLICT|No active gateway/i.test(message) || err?.code === 14 || err?.code === 4) {
    status = 503;
    retryable = true;
  }
  return Object.assign(new Error(message), { status, retryable, code: status === 503 ? 'FABRIC_UNAVAILABLE' : 'FABRIC_ERROR' });
}

function parse(bytes) {
  if (!bytes || bytes.length === 0) return null;
  const text = Buffer.from(bytes).toString('utf8').trim();
  return text ? JSON.parse(text) : null;
}

class FabricClient {
  constructor({ fabric, logger }) {
    this.cfg = fabric;
    this.logger = logger;
    this.entry = null;
  }

  paths() {
    const base = path.isAbsolute(this.cfg.basePath) ? this.cfg.basePath : path.resolve(process.cwd(), this.cfg.basePath);
    const org  = path.join(base, 'organizations/peerOrganizations/hospital.example.com');
    return {
      tls: path.join(org, 'peers/peer0.hospital.example.com/tls/ca.crt'),
      msp: path.join(org, 'users/patientService/msp'),
    };
  }

  connect() {
    // Required lazily so unit tests can run without the gRPC stack installed.
    const { connect, signers } = require('@hyperledger/fabric-gateway');
    const grpc = require('@grpc/grpc-js');
    const { tls, msp } = this.paths();
    for (const dir of ['signcerts', 'keystore']) {
      if (!fs.existsSync(path.join(msp, dir))) {
        throw new Error(`patientService MSP is incomplete: missing ${path.join(msp, dir)}. Run the network enroll script first.`);
      }
    }
    const cert = fs.readFileSync(path.join(msp, 'signcerts', fs.readdirSync(path.join(msp, 'signcerts')).find(f => f.endsWith('.pem'))));
    const key  = fs.readFileSync(path.join(msp, 'keystore', fs.readdirSync(path.join(msp, 'keystore'))[0]));
    const client = new grpc.Client(this.cfg.peer, grpc.credentials.createSsl(fs.readFileSync(tls)), {
      'grpc.ssl_target_name_override': this.cfg.peer.split(':')[0],
      'grpc.keepalive_time_ms': 30000,
      'grpc.keepalive_timeout_ms': 10000,
    });
    const gateway = connect({
      client,
      identity: { mspId: 'HospitalMSP', credentials: cert },
      signer: signers.newPrivateKeySigner(crypto.createPrivateKey(key)),
      evaluateOptions:     () => ({ deadline: Date.now() + 10_000 }),
      endorseOptions:      () => ({ deadline: Date.now() + 30_000 }),
      submitOptions:       () => ({ deadline: Date.now() + 30_000 }),
      commitStatusOptions: () => ({ deadline: Date.now() + 60_000 }),
    });
    this.entry = { client, gateway, contract: gateway.getNetwork(this.cfg.channel).getContract(this.cfg.chaincode) };
    this.logger?.info('Fabric gateway connected', { peer: this.cfg.peer, channel: this.cfg.channel });
  }

  disconnect() {
    if (!this.entry) return;
    try { this.entry.gateway.close(); } catch (_) { /* already closed */ }
    try { this.entry.client.close(); } catch (_) { /* already closed */ }
    this.entry = null;
  }

  contract() {
    if (!this.entry) this.connect();
    return this.entry.contract;
  }

  async run(kind, fn, args) {
    try {
      return await withRetry(async (attempt) => {
        try {
          const contract = this.contract();
          const name = `${CONTRACT}:${fn}`;
          const bytes = kind === 'submit'
            ? await contract.submitTransaction(name, ...args)
            : await contract.evaluateTransaction(name, ...args);
          return parse(bytes);
        } catch (err) {
          const translated = translate(err);
          // A dead channel needs a fresh gateway before the next attempt.
          if (translated.retryable) this.disconnect();
          if (attempt > 0 && kind === 'submit' && translated.status === 409) {
            // The earlier attempt committed but its status was lost: treat as success.
            translated.committedEarlier = true;
          }
          throw translated;
        }
      }, {
        retries: 3,
        baseMs: 400,
        onRetry: (err, attempt, delay) => this.logger?.warn('Retrying Fabric call', { fn, attempt, delay, error: err.message }),
      });
    } catch (err) {
      if (err.committedEarlier && fn === 'AnchorDocument') {
        return this.run('evaluate', 'GetDocument', [args[0], args[1]]);
      }
      throw err;
    }
  }

  anchor(doc) {
    return this.run('submit', 'AnchorDocument', [
      doc.patientId, doc.docId, doc.docType, doc.issuerId,
      doc.contentHash, doc.cipherHash, doc.cid, doc.uriHash, doc.issuedAt || '',
    ]);
  }
  get(patientId, docId)                 { return this.run('evaluate', 'GetDocument', [patientId, docId]); }
  list(patientId)                       { return this.run('evaluate', 'ListDocuments', [patientId]).then(r => r || []); }
  verify(patientId, docId, contentHash) { return this.run('evaluate', 'VerifyDocument', [patientId, docId, contentHash]); }
  revoke(patientId, docId, reason)      { return this.run('submit', 'RevokeDocument', [patientId, docId, reason || '']); }
  history(patientId, docId)             { return this.run('evaluate', 'GetDocumentHistory', [patientId, docId]).then(r => r || []); }

  async health() {
    try { this.contract(); return true; } catch (_) { return false; }
  }
}

module.exports = { FabricClient, translate };
