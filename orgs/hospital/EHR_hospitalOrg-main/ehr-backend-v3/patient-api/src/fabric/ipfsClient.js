'use strict';

/**
 * ipfsClient.js — Thin client for ipfs-service
 *
 * patient-api never talks to Kubo directly.
 * It calls ipfs-service (port 4006) which wraps Kubo.
 */

const axios        = require('axios');
const NodeFormData = require('form-data');
const logger       = require('../config/logger');

const BASE = process.env.IPFS_SERVICE_URL  || 'http://localhost:4006';
const KEY  = process.env.IPFS_SERVICE_KEY  || '';

const client = axios.create({
  baseURL: BASE,
  timeout: 30000,
  headers: { 'X-IPFS-Key': KEY },
});

// Content-addressed writes and reads are safe to repeat, so transient failures
// (ipfs-service restarting, Kubo briefly unavailable) are retried with backoff.
const MAX_RETRIES = 3;
client.interceptors.response.use(undefined, async (error) => {
  const config = error.config;
  const status = error.response && error.response.status;
  const transient = !error.response || status === 502 || status === 503 || status === 504;
  const isUpload = config && typeof config.url === 'string' && config.url.startsWith('/upload');
  if (!config || !transient || isUpload) throw error;
  config.__attempt = (config.__attempt || 0) + 1;
  if (config.__attempt > MAX_RETRIES) throw error;
  const delay = 300 * 2 ** (config.__attempt - 1);
  logger.warn('Retrying ipfs-service call', { url: config.url, attempt: config.__attempt, delay });
  await new Promise(resolve => setTimeout(resolve, delay));
  return client.request(config);
});

// Fetch JSON from IPFS by CID
async function fetchByCID(cid) {
  const res = await client.get(`/fetch/${cid}`);
  return res.data.data;
}

// Pin a JSON object to IPFS, return CID
async function pinJSON(json, filename) {
  const res = await client.post('/pin', { json, filename });
  return res.data.cid;
}

async function initEHR(patientId, demographics) {
  const res = await client.post('/ehr/init', { patientId, demographics });
  return { cid: res.data.cid, ehr: res.data.ehr };
}

async function uploadFile(buffer, filename) {
  const form = new NodeFormData();
  form.append('file', buffer, { filename });
  const res = await client.post('/upload', form, {
    headers: form.getHeaders(),
  });
  return { cid: res.data.cid };
}

module.exports = { fetchByCID, pinJSON, initEHR, uploadFile };
