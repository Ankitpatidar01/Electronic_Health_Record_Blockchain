'use strict';

/**
 * patientDirectory.js — patient demographics.
 *
 * Name, age, sex, blood group, contact and address are NOT on the ledger.
 * They live in a profile document on IPFS (encrypted by ipfs-service). The
 * ledger's patient record holds that document's CID and a SHA-256 of its
 * content, so the profile can be located and verified.
 *
 * readPatient / listPatients return the ledger record merged with the profile
 * so callers see one object: { patientId, did, name, age, ... , visitIds, ehrCID }.
 */

const crypto = require('crypto');

const FIELDS = ['name', 'age', 'gender', 'bloodGroup', 'contact', 'address'];

function parse(bytes) {
  if (!bytes || bytes.length === 0) return null;
  const text = Buffer.from(bytes).toString('utf8').replace(/^\0+/, '').trim();
  return !text || text === 'null' ? null : JSON.parse(text);
}

function buildProfile(patientId, input) {
  return {
    _type: 'PATIENT_PROFILE', _version: 1, patientId,
    name: String(input.name || '').trim(),
    age: Number(input.age),
    gender: String(input.gender || '').trim(),
    bloodGroup: String(input.bloodGroup || '').trim(),
    contact: String(input.contact || '').trim(),
    address: String(input.address || '').trim(),
    updatedAt: new Date().toISOString(),
  };
}

const profileHash = (profile) => crypto.createHash('sha256').update(JSON.stringify(profile), 'utf8').digest('hex');

async function pinProfile(ipfs, patientId, input) {
  const profile = buildProfile(patientId, input);
  const cid = await ipfs.pinJSON(profile, `patient-profile-${patientId}.json`);
  return { profile, cid, hash: profileHash(profile) };
}

// Profile documents are immutable per CID.
const cache = new Map();

async function loadProfile(fetchByCID, onChain) {
  if (!onChain.profileCID) return {};          // record written before profiles moved off-chain
  if (!cache.has(onChain.profileCID)) {
    const doc = await fetchByCID(onChain.profileCID);
    if (profileHash(doc) !== onChain.profileHash) {
      throw new Error(`Profile of ${onChain.patientId} does not match the hash recorded on the ledger`);
    }
    if (cache.size > 2000) cache.clear();
    cache.set(onChain.profileCID, doc);
  }
  const doc = cache.get(onChain.profileCID);
  return Object.fromEntries(FIELDS.map(f => [f, doc[f]]));
}

/** Ledger record merged with demographics, or null when the patient does not exist. */
async function readPatient(contract, fetchByCID, patientId) {
  let onChain;
  try {
    onChain = parse(await contract.evaluateTransaction('PatientContract:GetPatient', patientId));
  } catch (err) {
    const text = `${err.message} ${(err.details || []).map(d => d.message).join(' ')}`;
    if (/Patient not found/i.test(text)) return null;
    throw err;
  }
  if (!onChain) return null;
  return { ...onChain, ...(await loadProfile(fetchByCID, onChain)) };
}

async function listPatients(contract, fetchByCID) {
  const all = parse(await contract.evaluateTransaction('PatientContract:ListAllPatients')) || [];
  const out = [];
  for (const onChain of all) {
    try {
      out.push({ ...onChain, ...(await loadProfile(fetchByCID, onChain)) });
    } catch (err) {
      out.push({ ...onChain, profileError: 'Profile could not be loaded' });
    }
  }
  return out;
}

module.exports = { pinProfile, readPatient, listPatients, profileHash, FIELDS };
