'use strict';

/**
 * diseaseCodes.js — the disease-code template (ICD-10) and symptom matching.
 *
 * The template is one JSON document on IPFS. Its CID, version and SHA-256 are
 * recorded on the ledger (CodeContract:SetTemplate), so every organisation
 * resolves the same version. Nothing here reads the bundled file at request
 * time: the bundled file is only what the hospital admin publishes.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const BUNDLED = path.join(__dirname, 'icd10-template.json');

function parse(bytes) {
  if (!bytes || bytes.length === 0) return null;
  const text = Buffer.from(bytes).toString('utf8').trim();
  return !text || text === 'null' ? null : JSON.parse(text);
}

const sha256 = (obj) => crypto.createHash('sha256').update(JSON.stringify(obj), 'utf8').digest('hex');

/**
 * Publish the bundled template if the ledger has none, or has a different one.
 * Runs with the hospital administrator's identity when peer0-api starts.
 */
async function publishTemplate(adminContract, ipfs, logger) {
  const bundled = JSON.parse(fs.readFileSync(BUNDLED, 'utf8'));
  const digest = sha256(bundled);
  const current = parse(await adminContract.evaluateTransaction('CodeContract:GetTemplate'));
  if (current && current.sha256 === digest) {
    logger.info('Disease-code template is current', { cid: current.cid, version: current.version });
    return current;
  }
  const cid = await ipfs.pinJSON(bundled, `disease-code-template-${bundled.version}.json`);
  const result = parse(await adminContract.submitTransaction(
    'CodeContract:SetTemplate', cid, bundled.version, digest, bundled.codeSystem
  ));
  logger.info('Disease-code template published', { cid, version: bundled.version, replaced: current ? current.cid : null });
  return result;
}

// Template documents are immutable per CID, so they are cached by CID.
const cache = new Map();

/** The template currently recorded on the ledger, fetched from IPFS and verified. */
async function loadTemplate(contract, ipfs) {
  const onChain = parse(await contract.evaluateTransaction('CodeContract:GetTemplate'));
  if (!onChain || !onChain.cid) {
    const err = new Error('No disease-code template has been published on the ledger');
    err.status = 503;
    throw err;
  }
  if (!cache.has(onChain.cid)) {
    const doc = await ipfs.fetchByCID(onChain.cid);
    if (sha256(doc) !== onChain.sha256) {
      const err = new Error('The disease-code template on IPFS does not match the hash recorded on the ledger');
      err.status = 502;
      throw err;
    }
    cache.clear();
    cache.set(onChain.cid, doc);
  }
  return { ...onChain, document: cache.get(onChain.cid) };
}

const normalise = (text) => ` ${String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;

/**
 * Match free-text symptoms against the template keywords.
 * A longer keyword phrase is stronger evidence than a single word, and a
 * specific condition outranks a bare symptom code (R..) on equal evidence.
 * Returns matches best-first; `provisional` is the top match or the template's
 * fallback code when nothing matches.
 */
function matchSymptoms(symptoms, templateDoc) {
  const text = normalise(symptoms);
  const matches = [];
  for (const entry of templateDoc.codes) {
    const hits = (entry.keywords || []).filter(k => text.includes(normalise(k)));
    if (hits.length === 0) continue;
    const words = hits.reduce((n, k) => n + k.trim().split(/\s+/).length, 0);
    const specific = entry.code.startsWith('R') ? 0 : 1;
    matches.push({ code: entry.code, name: entry.name, matchedKeywords: hits, score: words * 2 + specific });
  }
  matches.sort((a, b) => b.score - a.score || a.code.localeCompare(b.code));
  const fallback = templateDoc.codes.find(c => c.code === templateDoc.fallbackCode) || { code: 'R69', name: 'Unknown and unspecified causes of morbidity' };
  const provisional = matches[0]
    ? { code: matches[0].code, name: matches[0].name, matched: true }
    : { code: fallback.code, name: fallback.name, matched: false };
  return { provisional, matches: matches.slice(0, 5) };
}

function findCode(templateDoc, code) {
  return templateDoc.codes.find(c => c.code === String(code || '').trim().toUpperCase()) || null;
}

function searchCodes(templateDoc, query) {
  const q = String(query || '').trim().toLowerCase();
  const list = templateDoc.codes.map(({ code, name }) => ({ code, name }));
  if (!q) return list;
  return list.filter(c => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
}

module.exports = { publishTemplate, loadTemplate, matchSymptoms, findCode, searchCodes, parse };
