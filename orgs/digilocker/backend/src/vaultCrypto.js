'use strict';

const crypto = require('crypto');

const ALG = 'aes-256-gcm';

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

function deriveKey(masterKey, salt, info) {
  return Buffer.from(crypto.hkdfSync('sha256', masterKey, salt, Buffer.from(info, 'utf8'), 32));
}

// Encrypts one document. Every document gets its own random salt (and so its
// own key) and nonce; patientId + docId are bound as additional authenticated
// data so a ciphertext cannot be replayed under another record.
function encryptDocument(masterKey, { patientId, docId, plaintext }) {
  const salt = crypto.randomBytes(16);
  const iv   = crypto.randomBytes(12);
  const key  = deriveKey(masterKey, salt, `ehr-digilocker:doc:${patientId}:${docId}`);
  const cipher = crypto.createCipheriv(ALG, key, iv);
  cipher.setAAD(Buffer.from(`${patientId}|${docId}`, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const envelope = {
    v: 1,
    alg: 'AES-256-GCM',
    kdf: 'HKDF-SHA256',
    docId,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
  return { envelope, contentHash: sha256(plaintext), cipherHash: sha256(ciphertext) };
}

function decryptDocument(masterKey, { patientId, docId, envelope }) {
  if (!envelope || envelope.v !== 1 || envelope.alg !== 'AES-256-GCM') {
    throw Object.assign(new Error('Unsupported vault envelope'), { status: 422, retryable: false });
  }
  const key = deriveKey(masterKey, Buffer.from(envelope.salt, 'base64'), `ehr-digilocker:doc:${patientId}:${docId}`);
  const decipher = crypto.createDecipheriv(ALG, key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAAD(Buffer.from(`${patientId}|${docId}`, 'utf8'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64');
  try {
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return { plaintext, contentHash: sha256(plaintext), cipherHash: sha256(ciphertext) };
  } catch (_) {
    throw Object.assign(new Error('Vault ciphertext failed authentication (tampered or wrong key)'), { status: 422, retryable: false });
  }
}

// Small secrets at rest (OAuth tokens in the link store).
function sealSecret(masterKey, purpose, value) {
  const iv  = crypto.randomBytes(12);
  const key = deriveKey(masterKey, Buffer.alloc(16), `ehr-digilocker:secret:${purpose}`);
  const cipher = crypto.createCipheriv(ALG, key, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map(b => b.toString('base64')).join('.');
}

function openSecret(masterKey, purpose, sealed) {
  const [iv, tag, body] = String(sealed).split('.').map(part => Buffer.from(part, 'base64'));
  const key = deriveKey(masterKey, Buffer.alloc(16), `ehr-digilocker:secret:${purpose}`);
  const decipher = crypto.createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8'));
}

const docIdFor   = (patientId, uri) => `DL-${sha256(Buffer.from(`${patientId}\n${uri}`, 'utf8')).slice(0, 24).toUpperCase()}`;
const uriHashFor = (uri) => sha256(Buffer.from(uri, 'utf8'));

module.exports = { sha256, encryptDocument, decryptDocument, sealSecret, openSecret, docIdFor, uriHashFor };
