'use strict';

const { Contract } = require('fabric-contract-api');
const {
  requireRole,
  assertReadAccess,
  getCallerIdentity,
  now,
  getState,
  putState,
  getHistory,
} = require('./accessControl');

const PATIENT_PREFIX = 'PATIENT';
const CID_RE    = /^(?:b[a-z2-7]{20,120}|Qm[1-9A-HJ-NP-Za-km-z]{44})$/;
const SHA256_RE = /^[a-f0-9]{64}$/;
const patientKey = id => `${PATIENT_PREFIX}:${id}`;

class PatientContract extends Contract {
  constructor() {
    super('PatientContract');
  }

  // ── RegisterPatient ───────────────────────────────────────────────────────
  // Receptionist/admin creates the patient master record.
  //
  // No name, contact or address is stored on the ledger. Demographics live in
  // an encrypted profile document on IPFS; the ledger keeps that document's
  // CID and a SHA-256 of its content, the patient's DID, and the EHR CID.
  async RegisterPatient(ctx, patientId, profileCID, profileHash, initialEhrCID) {
    const { userId } = requireRole(ctx, 'receptionist', 'admin');

    if (!patientId) throw new Error('patientId is required');
    if (!CID_RE.test(profileCID || '')) throw new Error('profileCID must be a valid IPFS CID');
    if (!SHA256_RE.test(profileHash || '')) throw new Error('profileHash must be a 64-character lowercase SHA-256 hex digest');

    const existing = await getState(ctx, patientKey(patientId));
    if (existing) throw new Error(`Patient already exists: ${patientId}`);

    // Exactly one DID per patient, created with the patient record. The
    // registration document is its first entry.
    const did = require('./did');
    const didRecord = await did.ensureDid(ctx, patientId);
    await did.appendEntry(ctx, patientId, { cid: profileCID, type: 'REGISTRATION', ref: 'profile' });

    const patient = {
      patientId,
      did:          didRecord.did,
      profileCID,
      profileHash,
      visitIds:     [],
      visitCount:   0,
      // IPFS EHR reference — set by backend after pinning, or via InitEHR
      ehrCID:       initialEhrCID || '',
      registeredBy: userId,
      createdAt:    now(ctx),
      updatedAt:    now(ctx),
    };

    await putState(ctx, patientKey(patientId), patient);
    return JSON.stringify(patient);
  }

  // ── GetPatient ────────────────────────────────────────────────────────────
  // Returns patient demographics + visitIds + ehrCID.
  // Access control: staff always allowed, patients own record, others need grant.
  async GetPatient(ctx, patientId) {
    await assertReadAccess(ctx, patientId, 'all');
    const patient = await getState(ctx, patientKey(patientId));
    if (!patient) throw new Error(`Patient not found: ${patientId}`);
    return JSON.stringify(patient);
  }

  // ── PatientExists ─────────────────────────────────────────────────────────
  async PatientExists(ctx, patientId) {
    getCallerIdentity(ctx);
    const patient = await getState(ctx, patientKey(patientId));
    return JSON.stringify(!!patient);
  }

  // ── GetPatientVisits ──────────────────────────────────────────────────────
  // Returns array of visitIds only (not full visit objects).
  async GetPatientVisits(ctx, patientId) {
    await assertReadAccess(ctx, patientId, 'visits');
    const patient = await getState(ctx, patientKey(patientId));
    if (!patient) throw new Error(`Patient not found: ${patientId}`);
    return JSON.stringify(patient.visitIds);
  }

  // ── GetPatientHistory ─────────────────────────────────────────────────────
  // Full blockchain tx history of the patient master record.
  async GetPatientHistory(ctx, patientId) {
    await assertReadAccess(ctx, patientId, 'all');
    const history = await getHistory(ctx, patientKey(patientId));
    return JSON.stringify(history);
  }

  // ── UpdatePatientInfo ─────────────────────────────────────────────────────
  // Admin/receptionist records a new version of the profile document
  // (contact or address changed). The new CID is appended to the DID.
  async UpdatePatientInfo(ctx, patientId, profileCID, profileHash) {
    requireRole(ctx, 'admin', 'receptionist');
    if (!CID_RE.test(profileCID || '')) throw new Error('profileCID must be a valid IPFS CID');
    if (!SHA256_RE.test(profileHash || '')) throw new Error('profileHash must be a 64-character lowercase SHA-256 hex digest');
    const patient = await getState(ctx, patientKey(patientId));
    if (!patient) throw new Error(`Patient not found: ${patientId}`);
    await require('./did').appendEntry(ctx, patientId, { cid: profileCID, type: 'PROFILE_UPDATE', ref: 'profile' });
    patient.profileCID = profileCID;
    patient.profileHash = profileHash;
    await putState(ctx, patientKey(patientId), patient);
    return JSON.stringify(patient);
  }

  // ── SetPatientEhrCID ──────────────────────────────────────────────────────
  // Called by backend after InitEHR if ehrCID was not set at registration.
  // Also used if EHR was re-pinned (e.g. migration).
  async SetPatientEhrCID(ctx, patientId, ehrCID) {
    requireRole(ctx, 'admin', 'receptionist');
    const patient = await getState(ctx, patientKey(patientId));
    if (!patient) throw new Error(`Patient not found: ${patientId}`);
    patient.ehrCID = ehrCID;
    await putState(ctx, patientKey(patientId), patient);
    return JSON.stringify(patient);
  }

  // ── ListAllPatients ───────────────────────────────────────────────────────
  // Returns all patient records. Restricted to receptionist/admin.
  async ListAllPatients(ctx) {
    requireRole(ctx, 'receptionist', 'admin');
    const iterator = await ctx.stub.getStateByRange(`${PATIENT_PREFIX}:`, `${PATIENT_PREFIX};`);
    const results = [];
    while (true) {
      const res = await iterator.next();
      if (res.done) break;
      if (res.value?.value?.length > 0) {
        results.push(JSON.parse(res.value.value.toString('utf8')));
      }
    }
    await iterator.close();
    return JSON.stringify(results);
  }

  // ── Internal: _addVisitToPatient ──────────────────────────────────────────
  // Called by VisitContract.OpenVisit. Not exposed to external callers.
  async _addVisitToPatient(ctx, patientId, visitId) {
    const patient = await getState(ctx, patientKey(patientId));
    if (!patient) throw new Error(`Patient not found: ${patientId}`);
    patient.visitIds.push(visitId);
    patient.visitCount = patient.visitIds.length;
    await putState(ctx, patientKey(patientId), patient);
  }
}

module.exports = { PatientContract, patientKey };
