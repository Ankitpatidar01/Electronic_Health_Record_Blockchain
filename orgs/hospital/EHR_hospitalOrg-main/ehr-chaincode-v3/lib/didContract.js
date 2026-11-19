'use strict';

const { Contract } = require('fabric-contract-api');
const { requireRole, assertReadAccess, STAFF_ROLES } = require('./accessControl');
const did = require('./did');

// Documents that are not a visit or EHR version and are added explicitly.
const DOCUMENT_TYPES = ['SYMPTOM_ANALYSIS', 'DOCUMENT', 'DIGILOCKER_DOCUMENT', 'FHIR_BUNDLE'];
const CID_RE = /^(?:b[a-z2-7]{20,120}|Qm[1-9A-HJ-NP-Za-km-z]{44})$/;
const DID_RE = /^did:ehr:[a-f0-9]{32}$/;

class DidContract extends Contract {
  constructor() {
    super('DidContract');
  }

  // The patient's DID record. Every registered patient has exactly one.
  async GetDID(ctx, patientId) {
    await assertReadAccess(ctx, patientId, 'visits');
    const record = await did.getDidByPatient(ctx, patientId);
    if (!record) throw new Error(`DID not found for patient: ${patientId}`);
    return JSON.stringify(record);
  }

  async ResolveDID(ctx, didId) {
    if (!DID_RE.test(didId || '')) throw new Error('Not a valid did:ehr identifier');
    const record = await did.readJson(ctx, did.didKey(didId));
    if (!record) throw new Error(`DID not found: ${didId}`);
    await assertReadAccess(ctx, record.patientId, 'visits');
    return JSON.stringify(record);
  }

  // Every CID recorded for the DID, oldest first.
  async ListCIDs(ctx, didId) {
    if (!DID_RE.test(didId || '')) throw new Error('Not a valid did:ehr identifier');
    const record = await did.readJson(ctx, did.didKey(didId));
    if (!record) throw new Error(`DID not found: ${didId}`);
    await assertReadAccess(ctx, record.patientId, 'visits');
    return JSON.stringify({ ...record, entries: await did.listEntries(ctx, didId) });
  }

  async GetCIDEntry(ctx, didId, seq) {
    if (!DID_RE.test(didId || '')) throw new Error('Not a valid did:ehr identifier');
    const record = await did.readJson(ctx, did.didKey(didId));
    if (!record) throw new Error(`DID not found: ${didId}`);
    await assertReadAccess(ctx, record.patientId, 'visits');
    const entry = await did.readJson(ctx, did.entryKey(didId, parseInt(seq, 10)));
    if (!entry) throw new Error(`DID entry not found: ${didId} #${seq}`);
    return JSON.stringify(entry);
  }

  // Adds a document that is neither a visit nor an EHR version (for example
  // the symptom analysis written at registration).
  async AppendDocument(ctx, patientId, cid, type, ref, note) {
    requireRole(ctx, ...STAFF_ROLES);
    if (!DOCUMENT_TYPES.includes(type)) {
      throw new Error(`type must be one of: ${DOCUMENT_TYPES.join(', ')}`);
    }
    if (!CID_RE.test(cid || '')) throw new Error('cid is not a valid IPFS CID');
    const patient = await did.readJson(ctx, `PATIENT:${patientId}`);
    if (!patient) throw new Error(`Patient not found: ${patientId}`);
    const entry = await did.appendEntry(ctx, patientId, {
      cid, type, ref: String(ref || '').slice(0, 120), note: String(note || '').slice(0, 200),
    });
    return JSON.stringify(entry);
  }
}

module.exports = { DidContract };
