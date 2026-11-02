'use strict';

/**
 * encryption.js — Feature 4: AES-256-GCM client-side envelope encryption.
 *
 * Per the Security team's envelope-encryption scheme (§17.3), each clinical
 * artifact is encrypted under a unique Data Encryption Key (DEK) which is itself
 * wrapped under a patient-scoped Key Encryption Key (KEK). Team D's bundler
 * does not reimplement that key hierarchy — it exposes an injection point so the
 * Security team's AES-256-GCM envelope routine is plugged in once it exists.
 *
 * Until then, the default implementation is a deterministic passthrough that
 * carries the canonicalized plaintext with a record of the intended algorithm.
 * It is NOT the production encryption path; it exists so the pipeline is
 * end-to-end runnable before the Security team's routine lands.
 */

const crypto = require('crypto');

let envelopeEncryptor = null;

/**
 * Injection point for the Security team's AES-256-GCM envelope-encryption
 * routine. Expected signature: (plaintextBuffer, context) => Promise<{ciphertext, iv, tag, keyRef}>.
 */
function setEnvelopeEncryptor(fn) {
  envelopeEncryptor = typeof fn === 'function' ? fn : null;
}

/**
 * Encrypt (or, until the real routine is injected, pass through) a canonical
 * JSON string for IPFS pinning.
 *
 * @param {string} canonicalJson  RFC 8785 canonical JSON (UTF-8 string)
 * @param {object} context        { patientId, artifactUUID }
 * @returns {Promise<{content: Buffer, meta: object}>}
 */
async function encryptArtifact(canonicalJson, context = {}) {
  const plaintext = Buffer.from(canonicalJson, 'utf8');

  if (envelopeEncryptor) {
    const enc = await envelopeEncryptor(plaintext, context);
    return { content: Buffer.from(enc.ciphertext), meta: enc };
  }

  // Default: AES-256-GCM with a random IV and an ephemeral key. This produces
  // real ciphertext and an authentication tag so the pipeline shape is correct;
  // key management (DEK/KEK wrapping) is owned by the Security team.
  const key = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    content: ciphertext,
    meta: {
      artifactUUID: context.artifactUUID || crypto.randomUUID(),
      alg: 'AES-256-GCM',
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      plaintextHash: crypto.createHash('sha256').update(plaintext).digest('hex'),
      keyRef: 'ephemeral://demo-key',
    },
  };
}

module.exports = { setEnvelopeEncryptor, encryptArtifact };
