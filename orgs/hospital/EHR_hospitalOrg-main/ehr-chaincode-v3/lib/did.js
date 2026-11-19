'use strict';

// did.js — one decentralised identifier per patient, and the ordered list of
// IPFS CIDs produced for that patient.
//
//   DIDIDX:<patientId>          → did
//   DID:<did>                   → { did, patientId, createdAt, createdBy, entryCount, lastCid }
//   DIDCID:<did>:<seq 8 digits> → { seq, cid, type, ref, note, timestamp, txId, mspId, userId, role }
//
// Entries are written in the same transaction as the change that produced the
// CID, so the list cannot drift from the visit and EHR records. accessControl's
// putState calls syncFromRecord for every visit and EHR write; documents that
// belong to neither are added with DidContract:AppendDocument.

const crypto = require('crypto');

const DID_PREFIX   = 'DID';
const IDX_PREFIX   = 'DIDIDX';
const ENTRY_PREFIX = 'DIDCID';

const didKey   = (did) => `${DID_PREFIX}:${did}`;
const idxKey   = (patientId) => `${IDX_PREFIX}:${patientId}`;
const entryKey = (did, seq) => `${ENTRY_PREFIX}:${did}:${String(seq).padStart(8, '0')}`;

function makeDid(patientId) {
  return `did:ehr:${crypto.createHash('sha256').update(String(patientId), 'utf8').digest('hex').slice(0, 32)}`;
}

function txTime(ctx) {
  const ts = ctx.stub.getTxTimestamp();
  const seconds = typeof ts.seconds === 'object' && ts.seconds !== null && typeof ts.seconds.toNumber === 'function'
    ? ts.seconds.toNumber()
    : Number(ts.seconds);
  return new Date(seconds * 1000 + Math.floor((ts.nanos || 0) / 1e6)).toISOString();
}

function caller(ctx) {
  // Lazy: accessControl requires this module.
  return require('./accessControl').getCallerIdentity(ctx);
}

async function readJson(ctx, key) {
  const bytes = await ctx.stub.getState(key);
  if (!bytes || bytes.length === 0) return null;
  return JSON.parse(bytes.toString('utf8'));
}

// A transaction does not see its own writes, so the DID record being built in
// this transaction is kept on the context.
function txCache(ctx) {
  if (!ctx.__didCache) Object.defineProperty(ctx, '__didCache', { value: new Map(), enumerable: false });
  return ctx.__didCache;
}

/** Returns the patient's DID record, creating it if the patient has none yet. */
async function ensureDid(ctx, patientId) {
  const cache = txCache(ctx);
  if (cache.has(patientId)) return cache.get(patientId);

  const did = makeDid(patientId);
  let record = await readJson(ctx, didKey(did));
  if (!record) {
    const { userId, mspId } = caller(ctx);
    record = {
      docType: 'did', did, patientId,
      createdAt: txTime(ctx), createdBy: userId, createdByMsp: mspId,
      entryCount: 0, lastCid: '', updatedAt: txTime(ctx),
    };
    await ctx.stub.putState(idxKey(patientId), Buffer.from(did));
    await ctx.stub.putState(didKey(did), Buffer.from(JSON.stringify(record)));
  }
  cache.set(patientId, record);
  return record;
}

/** Appends one CID to the patient's DID. `actor` overrides the caller for back-filled history. */
async function appendEntry(ctx, patientId, { cid, type, ref = '', note = '' }, actor) {
  if (!cid) throw new Error('cid is required for a DID entry');
  const record = await ensureDid(ctx, patientId);
  const who = actor || caller(ctx);
  const seq = record.entryCount + 1;
  const entry = {
    docType: 'didEntry', did: record.did, seq, cid, type, ref, note,
    timestamp: actor && actor.timestamp ? actor.timestamp : txTime(ctx),
    txId: ctx.stub.getTxID(),
    mspId: who.mspId || '', userId: who.userId || '', role: who.role || '',
    ...(actor ? { backfilled: true } : {}),
  };
  record.entryCount = seq;
  record.lastCid = cid;
  record.updatedAt = txTime(ctx);
  await ctx.stub.putState(entryKey(record.did, seq), Buffer.from(JSON.stringify(entry)));
  await ctx.stub.putState(didKey(record.did), Buffer.from(JSON.stringify(record)));
  return entry;
}

// Reason recorded in a cidHistory entry → timeline entry type.
const TYPE_BY_REASON = {
  VISIT_OPENED: 'VISIT_OPENED',
  DOCTOR_ASSIGNED: 'ASSIGNMENT', NURSE_ASSIGNED: 'ASSIGNMENT',
  DIAGNOSIS_NOTES_UPDATED: 'CONSULTATION',
  PRESCRIPTION_UPDATED: 'PRESCRIPTION',
  VITALS_RECORDED: 'VITALS',
  CARE_NOTE_ADDED: 'CARE_NOTE',
  FORWARD_TO_NURSE: 'FORWARD', FORWARD_TO_DOCTOR: 'FORWARD',
  FORWARD_TO_LAB: 'LAB_ORDER',
  LAB_ACKNOWLEDGED: 'LAB_ACCEPTED',
  LAB_RESULT_SUBMITTED: 'LAB_RESULT',
  LAB_RESULT_REJECTED: 'LAB_RESULT_RETURNED',
  LAB_RESULT_APPROVED: 'LAB_RESULT_VERIFIED',
  MEDICATION_DISPENSED: 'DISPENSE',
  VISIT_FINALIZED: 'VISIT_FINALIZED',
  RECORD_FINALIZED: 'RECORD_FINALIZED',
  DISCHARGED: 'DISCHARGE',
  CLAIM_SUBMITTED: 'CLAIM', CLAIM_AUDITED: 'CLAIM', CLAIM_PROCESSED: 'CLAIM',
  EHR_INITIALISED: 'EHR_CREATED',
};

function typeFor(reason, isEhr) {
  const head = String(reason || '').split(':')[0].trim().toUpperCase().replace(/\s+/g, '_');
  return TYPE_BY_REASON[head] || (isEhr ? 'EHR_UPDATE' : 'VISIT_UPDATE');
}

/**
 * Called by putState for visit and EHR records: every cidHistory entry not yet
 * on the DID is appended. History that predates the DID feature is back-filled
 * under its original author and time.
 */
async function syncFromRecord(ctx, obj, isEhr) {
  if (!obj || !obj.patientId || !Array.isArray(obj.cidHistory)) return;
  const done = Number.isInteger(obj.didSynced) ? obj.didSynced : 0;
  const last = obj.cidHistory.length - 1;
  for (let i = done; i <= last; i += 1) {
    const h = obj.cidHistory[i];
    if (!h || !h.cid) continue;
    const reason = String(h.reason || '');
    const ref = isEhr ? (h.section && h.section !== 'all' ? `ehr:${h.section}` : 'ehr')
      : (reason.includes(':') ? reason.slice(reason.indexOf(':') + 1) : obj.visitId);
    const actor = i === last ? null : { userId: h.updatedBy, mspId: '', role: '', timestamp: h.updatedAt };
    await appendEntry(ctx, obj.patientId, { cid: h.cid, type: typeFor(reason, isEhr), ref, note: isEhr ? reason : '' }, actor);
  }
  obj.didSynced = obj.cidHistory.length;
}

async function getDidByPatient(ctx, patientId) {
  const cached = txCache(ctx).get(patientId);
  if (cached) return cached;
  return readJson(ctx, didKey(makeDid(patientId)));
}

async function listEntries(ctx, did) {
  const iterator = await ctx.stub.getStateByRange(`${ENTRY_PREFIX}:${did}:`, `${ENTRY_PREFIX}:${did};`);
  const out = [];
  while (true) {
    const res = await iterator.next();
    if (res.done) break;
    if (res.value && res.value.value && res.value.value.length > 0) {
      out.push(JSON.parse(res.value.value.toString('utf8')));
    }
  }
  await iterator.close();
  return out.sort((a, b) => a.seq - b.seq);
}

module.exports = {
  makeDid, didKey, idxKey, entryKey, readJson,
  ensureDid, appendEntry, syncFromRecord, getDidByPatient, listEntries, txTime,
};
