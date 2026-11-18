'use strict';

/**
 * IPFS Tools Module
 * Author: Sushil (Tool Layer & VCAP Lead)
 * Module: Tool Abstraction Layer - IPFS Kubo Client Wrappers
 *
 * Provides a decoupled abstraction between Agent reasoning and IPFS Off-Chain Storage.
 * Reuses existing ipfs.js client methods without modifying underlying storage logic.
 */

const crypto = require('crypto');

let ipfs = null;
try {
  ipfs = require('../ipfs');
} catch (_err) {
  // Allows mock mode and isolated testing when IPFS node is not running
}

function getIpfs() {
  if (!ipfs) {
    try {
      ipfs = require('../ipfs');
    } catch (err) {
      throw new Error(`IPFS client module unavailable: ${err.message}`);
    }
  }
  return ipfs;
}

function cidFrom(result) {
  if (typeof result === 'string') return result;
  if (!result || typeof result !== 'object') return result;
  return result.cid || result.Cid || result.Hash || result.hash || result.result || result;
}

function toBuffer(val) {
  if (Buffer.isBuffer(val)) return val;
  if (typeof val === 'string') return Buffer.from(val);
  return Buffer.from(JSON.stringify(val));
}

/**
 * Add JSON payload to IPFS.
 * @param {any} payload
 * @param {{ mock?: boolean, fileName?: string, pin?: boolean }} options
 * @returns {Promise<string>} IPFS CID
 */
async function addToIPFS(payload, { mock = false, fileName, pin } = {}) {
  if (payload === undefined || payload === null) throw new Error('payload is required');
  if (mock) return 'QmMockIPFSCid123456789';
  const client = getIpfs();
  return cidFrom(await client.addJsonToIpfs(payload, { fileName, pin }));
}

async function addJson(payload, options = {}) {
  return addToIPFS(payload, options);
}

/**
 * Add raw binary buffer to IPFS.
 * @param {Buffer} buffer
 * @param {{ mock?: boolean, fileName?: string, pin?: boolean, contentType?: string }} options
 * @returns {Promise<string>} IPFS CID
 */
async function addBinary(buffer, { mock = false, fileName, pin, contentType } = {}) {
  if (!buffer) throw new Error('buffer is required');
  if (mock) return 'QmMockBinaryCid123456789';
  const client = getIpfs();
  return cidFrom(await client.addBinaryToIpfs(buffer, { fileName, pin, contentType }));
}

/**
 * Read and parse JSON content from IPFS by CID.
 * @param {string} cid
 * @param {{ mock?: boolean }} options
 */
async function readFromIPFS(cid, { mock = false } = {}) {
  if (!cid) throw new Error('cid is required');
  if (mock) return { mock: true, cid, data: {} };
  const client = getIpfs();
  return client.readJsonFromIpfs(cid);
}

/**
 * Read raw bytes from IPFS by CID.
 * @param {string} cid
 * @param {{ mock?: boolean }} options
 */
async function readRaw(cid, { mock = false } = {}) {
  if (!cid) throw new Error('cid is required');
  if (mock) return Buffer.from(JSON.stringify({ mock: true, cid }));
  const client = getIpfs();
  return client.readRawFromIpfs(cid);
}

/**
 * Check IPFS connectivity and version status.
 * @param {{ mock?: boolean }} options
 */
async function health({ mock = false } = {}) {
  if (mock) return { ok: true, mock: true };
  const client = getIpfs();
  return client.ipfsHealth();
}

/**
 * Compute SHA-256 hash of provided data.
 * @param {any} data
 * @param {{ mock?: boolean }} options
 */
async function hash(data, { mock = false } = {}) {
  if (mock) return 'mock-sha256';
  const buf = toBuffer(data);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

module.exports = {
  addToIPFS,
  addJson,
  addBinary,
  readFromIPFS,
  readRaw,
  health,
  checkIPFS: health,
  sha256: hash
};
