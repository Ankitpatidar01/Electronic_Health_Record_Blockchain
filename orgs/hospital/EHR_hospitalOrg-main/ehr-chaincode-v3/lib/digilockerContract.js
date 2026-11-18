'use strict';

const { Contract } = require('fabric-contract-api');
const {
  getCallerIdentity,
  assertReadAccess,
  getHistory,
} = require('./accessControl');
const { patientKey } = require('./patientContract');

// ─────────────────────────────────────────────────────────────────────────────
// DigiLockerContract — anchors documents pulled from a citizen's DigiLocker.
//
// The document itself never touches the ledger. The digilocker-service:
//   1. Pulls the issued document from DigiLocker with the patient's consent
//   2. Encrypts it (AES-256-GCM) and pins the ciphertext to IPFS
//   3. Calls AnchorDocument with the hashes + CID below
//
// On-chain record (no PHI, no document content, no DigiLocker URI in clear):
//   DLDOC:<patientId>:<docId> → {
//     docId, patientId, docType, issuerId,
//     contentHash   sha256 of the plaintext document
//     cipherHash    sha256 of the encrypted bytes stored on IPFS
//     cid           IPFS CID of the encrypted bytes
//     uriHash       sha256 of the DigiLocker URI (dedupe without exposing it)
//     issuedAt, anchoredAt, anchoredBy, txId, status, revocation
//   }
//
// All timestamps come from the transaction proposal so that every endorsing
// peer computes an identical read/write set.
// ─────────────────────────────────────────────────────────────────────────────

const OBJECT_TYPE = 'DLDOC';
const SHA256      = /^[a-f0-9]{64}$/;
// CIDv0 (Qm…) or any base32 CIDv1 (bafy… dag-pb, bafk… raw leaves)
const CID         = /^(?:b[a-z2-7]{20,120}|Qm[1-9A-HJ-NP-Za-km-z]{44})$/;
const SAFE_ID     = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const DOC_TYPES   = ['LAB_REPORT', 'PRESCRIPTION', 'DISCHARGE_SUMMARY', 'IMMUNIZATION', 'HEALTH_ID', 'INSURANCE', 'OTHER'];
const WRITE_ROLES = ['patientService', 'admin'];
const STATUS      = { ANCHORED: 'ANCHORED', REVOKED: 'REVOKED' };

function txTime(ctx) {
  const ts = ctx.stub.getTxTimestamp();
  const seconds = typeof ts.seconds === 'object' && ts.seconds !== null && typeof ts.seconds.toNumber === 'function'
    ? ts.seconds.toNumber()
    : Number(ts.seconds);
  return new Date(seconds * 1000 + Math.floor((ts.nanos || 0) / 1e6)).toISOString();
}

function docKey(ctx, patientId, docId) {
  return ctx.stub.createCompositeKey(OBJECT_TYPE, [patientId, docId]);
}

function requireWriter(ctx) {
  const caller = getCallerIdentity(ctx);
  if (!WRITE_ROLES.includes(caller.role)) {
    throw new Error(
      `Access denied: role '${caller.role}' (user: ${caller.userId}) cannot anchor DigiLocker documents. ` +
      `Required: ${WRITE_ROLES.join(' or ')}`
    );
  }
  return caller;
}

// patientService (the authenticated patient) and admin always read.
// Doctors and nurses need the patient's active consent grant on the EHR section.
// Every other role is denied: these are the patient's own locker documents.
async function requireReader(ctx, patientId) {
  const caller = getCallerIdentity(ctx);
  if (WRITE_ROLES.includes(caller.role)) return caller;
  if (caller.role === 'doctor' || caller.role === 'nurse') {
    await assertReadAccess(ctx, patientId, 'ehr');
    return caller;
  }
  throw new Error(
    `Access denied: role '${caller.role}' (user: ${caller.userId}) cannot read DigiLocker anchors`
  );
}

async function readDoc(ctx, patientId, docId) {
  const bytes = await ctx.stub.getState(docKey(ctx, patientId, docId));
  if (!bytes || bytes.length === 0) return null;
  return JSON.parse(bytes.toString('utf8'));
}

function requireArg(name, value, pattern) {
  if (typeof value !== 'string' || !value) throw new Error(`${name} is required`);
  if (pattern && !pattern.test(value)) throw new Error(`${name} is malformed`);
  return value;
}

class DigiLockerContract extends Contract {
  constructor() {
    super('DigiLockerContract');
  }

  // ── AnchorDocument ────────────────────────────────────────────────────────
  async AnchorDocument(ctx, patientId, docId, docType, issuerId, contentHash, cipherHash, cid, uriHash, issuedAt) {
    const { userId } = requireWriter(ctx);

    requireArg('patientId', patientId, SAFE_ID);
    requireArg('docId', docId, SAFE_ID);
    requireArg('issuerId', issuerId, SAFE_ID);
    requireArg('contentHash', contentHash, SHA256);
    requireArg('cipherHash', cipherHash, SHA256);
    requireArg('cid', cid, CID);
    requireArg('uriHash', uriHash, SHA256);
    if (!DOC_TYPES.includes(docType)) {
      throw new Error(`docType must be one of: ${DOC_TYPES.join(', ')}`);
    }
    if (issuedAt && !Number.isFinite(Date.parse(issuedAt))) {
      throw new Error('issuedAt is malformed');
    }

    const patientBytes = await ctx.stub.getState(patientKey(patientId));
    if (!patientBytes || patientBytes.length === 0) {
      throw new Error(`Patient not found: ${patientId}`);
    }

    const existing = await readDoc(ctx, patientId, docId);
    if (existing && existing.status === STATUS.ANCHORED) {
      throw new Error(`DigiLocker document already exists: ${docId}`);
    }

    const anchoredAt = txTime(ctx);
    const record = {
      docType_: 'digilockerDocument',
      docId,
      patientId,
      docType,
      issuerId,
      contentHash,
      cipherHash,
      cid,
      uriHash,
      issuedAt:   issuedAt || '',
      anchoredAt,
      anchoredBy: userId,
      txId:       ctx.stub.getTxID(),
      status:     STATUS.ANCHORED,
      revocation: null,
      updatedAt:  anchoredAt,
    };

    await ctx.stub.putState(docKey(ctx, patientId, docId), Buffer.from(JSON.stringify(record)));
    ctx.stub.setEvent('DigiLockerDocumentAnchored', Buffer.from(JSON.stringify({
      docId, docType, contentHash, cid, anchoredAt,
    })));
    return JSON.stringify(record);
  }

  // ── GetDocument ───────────────────────────────────────────────────────────
  async GetDocument(ctx, patientId, docId) {
    await requireReader(ctx, patientId);
    const record = await readDoc(ctx, patientId, docId);
    if (!record) throw new Error(`DigiLocker document not found: ${docId}`);
    return JSON.stringify(record);
  }

  // ── ListDocuments ─────────────────────────────────────────────────────────
  async ListDocuments(ctx, patientId) {
    await requireReader(ctx, patientId);
    requireArg('patientId', patientId, SAFE_ID);
    const iterator = await ctx.stub.getStateByPartialCompositeKey(OBJECT_TYPE, [patientId]);
    const results = [];
    try {
      while (true) {
        const item = await iterator.next();
        if (item.value && item.value.value && item.value.value.length > 0) {
          results.push(JSON.parse(item.value.value.toString('utf8')));
        }
        if (item.done) break;
      }
    } finally {
      await iterator.close();
    }
    results.sort((a, b) => (a.anchoredAt < b.anchoredAt ? 1 : -1));
    return JSON.stringify(results);
  }

  // ── VerifyDocument ────────────────────────────────────────────────────────
  // Compares a freshly computed sha256 with the anchored one. Read-only.
  async VerifyDocument(ctx, patientId, docId, contentHash) {
    await requireReader(ctx, patientId);
    requireArg('contentHash', contentHash, SHA256);
    const record = await readDoc(ctx, patientId, docId);
    if (!record) throw new Error(`DigiLocker document not found: ${docId}`);
    return JSON.stringify({
      docId,
      match:        record.contentHash === contentHash,
      status:       record.status,
      anchoredHash: record.contentHash,
      anchoredAt:   record.anchoredAt,
      txId:         record.txId,
      cid:          record.cid,
    });
  }

  // ── RevokeDocument ────────────────────────────────────────────────────────
  // The patient withdraws a document from their vault. The anchor stays on the
  // ledger (history is immutable) but is marked REVOKED.
  async RevokeDocument(ctx, patientId, docId, reason) {
    const { userId } = requireWriter(ctx);
    const record = await readDoc(ctx, patientId, docId);
    if (!record) throw new Error(`DigiLocker document not found: ${docId}`);
    if (record.status === STATUS.REVOKED) {
      throw new Error(`DigiLocker document already revoked: ${docId}`);
    }
    const revokedAt = txTime(ctx);
    record.status     = STATUS.REVOKED;
    record.revocation = {
      revokedAt,
      revokedBy: userId,
      reason:    String(reason || '').slice(0, 200),
      txId:      ctx.stub.getTxID(),
    };
    record.updatedAt = revokedAt;
    await ctx.stub.putState(docKey(ctx, patientId, docId), Buffer.from(JSON.stringify(record)));
    ctx.stub.setEvent('DigiLockerDocumentRevoked', Buffer.from(JSON.stringify({ docId, revokedAt })));
    return JSON.stringify(record);
  }

  // ── GetDocumentHistory ────────────────────────────────────────────────────
  async GetDocumentHistory(ctx, patientId, docId) {
    await requireReader(ctx, patientId);
    const history = await getHistory(ctx, docKey(ctx, patientId, docId));
    return JSON.stringify(history);
  }
}

module.exports = { DigiLockerContract, DOC_TYPES };
