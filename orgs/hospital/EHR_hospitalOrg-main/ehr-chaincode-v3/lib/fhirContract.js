'use strict';

const { Contract } = require('fabric-contract-api');
const {
  requireRole,
  getCallerIdentity,
  now,
  getState,
  putState,
  getHistory,
} = require('./accessControl');

// ── State key scheme ─────────────────────────────────────────────────────────
// FHIR anchor records live under RECORD~<patientIdHash>~<recordId>, matching the
// ehr-fhir module's recordKey(). Zero-PHI by construction: only a hash, a CID,
// a resource type and a status — no clinical value, narrative or code.
const RECORD_PREFIX = 'RECORD';

const anchorKey = (patientIdHash, recordId) => `${RECORD_PREFIX}~${patientIdHash}~${recordId}`;

// Union of roles that already write patient/visit/lab records across the org.
// The fhir module computes the hashes; this contract only stores them, so the
// role set mirrors the domains that legitimately produce FHIR resources.
const ANCHOR_WRITE_ROLES = [
  'receptionist', 'admin', 'doctor', 'nurse', 'pharmacist',
  'medrecordofficer', 'labreceptionist', 'labtechnician', 'radiologist',
  'labsupervisor', 'labadmin', 'patientService',
];

const PATIENT_HASH_RE = /^hmac-sha256:[0-9a-f]{64}$/;
const RECORD_HASH_RE  = /^sha256:[0-9a-f]{64}$/;

class FhirContract extends Contract {
  constructor() {
    super('FhirContract');
  }

  // ── AnchorFHIRRecord ───────────────────────────────────────────────────────
  // Stores a zero-PHI FHIR anchor. The backend computes patientIdHash (HMAC with
  // the gateway-held KNET) and patientRecordHash (VCAP H(R)) and passes them in;
  // this contract never hashes or holds PHI.
  //
  // Args:
  //   patientIdHash     - "hmac-sha256:<64-hex>"  (identifiers.patientIdHash)
  //   recordId          - logical id (e.g. "PAT-001", "PAT-001-V1", "LAB-001")
  //   resourceType      - FHIR resource type (Patient/Encounter/Observation/…)
  //   patientRecordHash - "sha256:<64-hex>"        (VCAP H(R))
  //   dataCID           - IPFS CID of the canonical FHIR artifact
  //   status            - e.g. "FINAL" (default)
  //
  // Idempotent: re-anchoring an existing key overwrites it (records are immutable
  // via GetFHIRAnchorHistory). Callers should namespace recordId to avoid silent
  // collisions across resource types.
  async AnchorFHIRRecord(ctx, patientIdHash, recordId, resourceType, patientRecordHash, dataCID, status) {
    requireRole(ctx, ...ANCHOR_WRITE_ROLES);

    if (!patientIdHash || !recordId || !resourceType || !patientRecordHash) {
      throw new Error('patientIdHash, recordId, resourceType and patientRecordHash are required');
    }
    if (!PATIENT_HASH_RE.test(patientIdHash)) {
      throw new Error('Invalid patientIdHash: expected "hmac-sha256:<64 hex>"');
    }
    if (!RECORD_HASH_RE.test(patientRecordHash)) {
      throw new Error('Invalid patientRecordHash: expected "sha256:<64 hex>"');
    }

    const key = anchorKey(patientIdHash, recordId);
    const existing = await getState(ctx, key);
    const { userId } = getCallerIdentity(ctx);

    const record = {
      recordId: key,
      resourceType,
      patientIdHash,
      patientRecordHash,
      dataCID: dataCID || '',
      status: status || 'FINAL',
      canonicalizationScheme: 'RFC8785-JCS',
      updatedBy: userId,
      createdAt: existing ? existing.createdAt : now(ctx),
      updatedAt: now(ctx),
    };

    await putState(ctx, key, record);
    return JSON.stringify(record);
  }

  // ── GetFHIRAnchor ──────────────────────────────────────────────────────────
  // Reads one anchor record.
  async GetFHIRAnchor(ctx, patientIdHash, recordId) {
    getCallerIdentity(ctx);
    if (!patientIdHash || !recordId) {
      throw new Error('patientIdHash and recordId are required');
    }
    const record = await getState(ctx, anchorKey(patientIdHash, recordId));
    if (!record) throw new Error(`FHIR anchor not found: ${patientIdHash}~${recordId}`);
    return JSON.stringify(record);
  }

  // ── ListFHIRAnchors ────────────────────────────────────────────────────────
  // Lists every anchor for a pseudonymous patient (range scan on RECORD~<hash>~).
  async ListFHIRAnchors(ctx, patientIdHash) {
    getCallerIdentity(ctx);
    if (!patientIdHash) throw new Error('patientIdHash is required');

    const prefix = `${RECORD_PREFIX}~${patientIdHash}~`;
    const iterator = await ctx.stub.getStateByRange(prefix, prefix + '\uffff');
    const results = [];
    while (true) {
      const res = await iterator.next();
      if (res.done) break;
      if (res.value && res.value.value && res.value.value.length > 0) {
        results.push(JSON.parse(res.value.value.toString('utf8')));
      }
    }
    await iterator.close();
    return JSON.stringify(results);
  }

  // ── AnchorExists ───────────────────────────────────────────────────────────
  // Cheap existence check without returning the full record.
  async AnchorExists(ctx, patientIdHash, recordId) {
    getCallerIdentity(ctx);
    if (!patientIdHash || !recordId) {
      throw new Error('patientIdHash and recordId are required');
    }
    const record = await getState(ctx, anchorKey(patientIdHash, recordId));
    return JSON.stringify({ exists: !!record });
  }

  // ── GetFHIRAnchorHistory ───────────────────────────────────────────────────
  // Full block history of an anchor key (immutable audit).
  async GetFHIRAnchorHistory(ctx, patientIdHash, recordId) {
    getCallerIdentity(ctx);
    if (!patientIdHash || !recordId) {
      throw new Error('patientIdHash and recordId are required');
    }
    const history = await getHistory(ctx, anchorKey(patientIdHash, recordId));
    return JSON.stringify(history);
  }

  // ── UpdateFHIRAnchorStatus ─────────────────────────────────────────────────
  // Idempotent status transition (e.g. FINAL → SUPERSEDED on re-anchor).
  async UpdateFHIRAnchorStatus(ctx, patientIdHash, recordId, status) {
    requireRole(ctx, 'admin', 'labadmin', 'provideradmin', 'patientService');
    if (!patientIdHash || !recordId || !status) {
      throw new Error('patientIdHash, recordId and status are required');
    }
    const key = anchorKey(patientIdHash, recordId);
    const record = await getState(ctx, key);
    if (!record) throw new Error(`FHIR anchor not found: ${patientIdHash}~${recordId}`);
    record.status = status;
    await putState(ctx, key, record);
    return JSON.stringify(record);
  }
}

module.exports = { FhirContract, anchorKey, RECORD_PREFIX };
