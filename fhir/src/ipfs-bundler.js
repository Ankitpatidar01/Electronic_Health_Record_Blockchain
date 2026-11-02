'use strict';

/**
 * ipfs-bundler.js — Feature 4: wraps the existing IPFS service.
 *
 * Team D reuses the platform's `ipfs-service` (ehr-backend-v3/ipfs-service)
 * rather than reimplementing Kubo pinning. Its actual surface (routes.js):
 *
 *   POST /pin          body { json: {...}, filename? }  -> { success, cid }   (JSON objects)
 *   POST /upload       multipart "file"                 -> { success, cid }   (binary files)
 *   GET  /fetch/:cid                                    -> { success, cid, data }
 *
 * The artifact we pin is AES-256-GCM **ciphertext** (binary), so it goes through
 * /upload — not /pin. All routes except /health require the X-IPFS-Key header.
 *
 * The real client can be injected via setIpfsClient() (the service's own
 * src/ipfs.js exposes pinFile() and fetchJSON()); by default this speaks HTTP to
 * http://localhost:3006 using global fetch + FormData (Node 18+).
 */

const IPFS_URL = process.env.IPFS_SERVICE_URL || 'http://localhost:3006';
const IPFS_KEY = process.env.IPFS_SERVICE_KEY || 'change-me-in-production';

let injectedClient = null;

/** Injection point: reuse ipfs-service/src/ipfs.js (pinFile / fetchJSON). */
function setIpfsClient(client) {
  injectedClient = client;
}

/**
 * Pin an encrypted artifact (binary ciphertext) to IPFS.
 *
 * @param {Buffer|string} content
 * @returns {Promise<string>} the CID
 */
async function pinContent(content) {
  if (injectedClient && typeof injectedClient.pinFile === 'function') {
    return injectedClient.pinFile(
      Buffer.isBuffer(content) ? content : Buffer.from(content),
      `fhir-${Date.now()}.bin`,
      'application/octet-stream',
    );
  }

  const buf = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  const form = new FormData();
  form.append('file', new Blob([buf], { type: 'application/octet-stream' }), `fhir-${Date.now()}.bin`);

  let res;
  try {
    res = await fetch(`${IPFS_URL}/upload`, {
      method: 'POST',
      headers: { 'X-IPFS-Key': IPFS_KEY },
      body: form,
    });
  } catch (err) {
    throw new Error(`IPFS_UNAVAILABLE: cannot reach ${IPFS_URL} (${err.message})`);
  }
  if (!res.ok) throw new Error(`IPFS_UNAVAILABLE: upload failed (${res.status})`);
  const data = await res.json();
  return data.cid;
}

/**
 * Fetch JSON by CID (for the demo round-trip and the AI tool layer).
 * The service returns { success, cid, data }; we return data.
 */
async function fetchJson(cid) {
  let res;
  try {
    res = await fetch(`${IPFS_URL}/fetch/${cid}`, { headers: { 'X-IPFS-Key': IPFS_KEY } });
  } catch (err) {
    throw new Error(`IPFS_UNAVAILABLE: cannot reach ${IPFS_URL} (${err.message})`);
  }
  if (!res.ok) throw new Error(`IPFS_UNAVAILABLE: fetch failed (${res.status})`);
  const body = await res.json();
  return body.data;
}

module.exports = { setIpfsClient, pinContent, fetchJson, IPFS_URL, IPFS_KEY };
