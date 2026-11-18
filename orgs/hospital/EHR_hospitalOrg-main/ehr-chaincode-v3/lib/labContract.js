'use strict';

const { Contract } = require('fabric-contract-api');
const {
  requireRole,
  assertReadAccess,
  now,
  getState,
  putState,
  getHistory,
} = require('./accessControl');
const { visitKey, VISIT_STATUS } = require('./visitContract');

// ─────────────────────────────────────────────────────────────────────────────
// LabContract — the diagnostic laboratory workflow.
//
// The lab is its own organisation (DiagnosticsMSP). One lab order moves through
//
//   REQUESTED ──► ACKNOWLEDGED ──► RESULT_SUBMITTED ──► APPROVED (released)
//                      ▲                  │
//                      └──── REJECTED ◄───┘   (supervisor sends it back)
//
//   • the ordering doctor creates the order      (ForwardContract:ForwardToLab)
//   • lab reception accepts the order/sample     (AcknowledgeLabRequest)
//   • a technician or radiologist enters results (SubmitLabResult)
//   • a supervisor verifies and signs            (ApproveLabResult)
//     — never the person who entered the results
//
// Each order has its own ledger record (LABREQ:<id>) holding status, who did
// each step, and the SHA-256 of the result the supervisor signed. No clinical
// values are stored on-chain: results live in the visit document on IPFS, and
// each step records the new document CID on the visit.
// ─────────────────────────────────────────────────────────────────────────────

const LAB_PREFIX = 'LABREQ';
const labKey = (id) => `${LAB_PREFIX}:${id}`;

const LAB_STATUS = {
  REQUESTED:        'REQUESTED',
  ACKNOWLEDGED:     'ACKNOWLEDGED',
  RESULT_SUBMITTED: 'RESULT_SUBMITTED',
  REJECTED:         'REJECTED',
  APPROVED:         'APPROVED',
};

const SHA256_HEX = /^[a-f0-9]{64}$/;
const LAB_STAFF  = ['labreceptionist', 'labtechnician', 'radiologist', 'labsupervisor', 'labadmin'];
const QUEUE_READERS = [...LAB_STAFF, 'doctor', 'admin'];

// Called by ForwardContract.ForwardToLab in the same transaction.
async function createLabRequest(ctx, visit, labRequestId, userId) {
  if (!labRequestId.startsWith(`${visit.visitId}-L`)) {
    throw new Error(`labRequestId '${labRequestId}' does not belong to visit ${visit.visitId}`);
  }
  if (await getState(ctx, labKey(labRequestId))) {
    throw new Error(`Lab request already exists: ${labRequestId}`);
  }
  const request = {
    docType:        'labRequest',
    labRequestId,
    visitId:        visit.visitId,
    patientId:      visit.patientId,
    status:         LAB_STATUS.REQUESTED,
    requestedBy:    userId,
    requestedAt:    now(ctx),
    acknowledgedBy: '', acknowledgedAt: '',
    submittedBy:    '', submittedAt:    '',
    resultsHash:    '',
    approvedBy:     '', approvedAt:     '',
    rejectedBy:     '', rejectedAt:     '', rejectionReason: '',
    revision:       0,
  };
  await putState(ctx, labKey(labRequestId), request);
  return request;
}

async function loadPair(ctx, visitId, labRequestId, visitCID) {
  if (!labRequestId) throw new Error('labRequestId is required');
  if (!visitCID)     throw new Error('visitCID is required');
  const visit = await getState(ctx, visitKey(visitId));
  if (!visit) throw new Error(`Visit not found: ${visitId}`);
  const request = await getState(ctx, labKey(labRequestId));
  if (!request) throw new Error(`Lab request not found: ${labRequestId}`);
  if (request.visitId !== visitId) {
    throw new Error(`Lab request ${labRequestId} does not belong to visit ${visitId}`);
  }
  return { visit, request };
}

function requireStatus(request, ...allowed) {
  if (!allowed.includes(request.status)) {
    throw new Error(
      `Lab request ${request.labRequestId} is ${request.status}; this step needs ${allowed.join(' or ')}`
    );
  }
}

async function save(ctx, visit, request, userId, visitCID, reason) {
  visit.cidHistory.push({ cid: visitCID, updatedBy: userId, updatedAt: now(ctx), reason });
  visit.visitCID = visitCID;
  await putState(ctx, visitKey(visit.visitId), visit);
  await putState(ctx, labKey(request.labRequestId), request);
  return JSON.stringify({ ...visit, labRequest: request });
}

class LabContract extends Contract {
  constructor() {
    super('LabContract');
  }

  // Lab reception accepts the order (and the sample).
  async AcknowledgeLabRequest(ctx, visitId, labRequestId, visitCID) {
    const { userId } = requireRole(ctx, 'labreceptionist', 'labadmin');
    const { visit, request } = await loadPair(ctx, visitId, labRequestId, visitCID);
    requireStatus(request, LAB_STATUS.REQUESTED);

    request.status         = LAB_STATUS.ACKNOWLEDGED;
    request.acknowledgedBy = userId;
    request.acknowledgedAt = now(ctx);
    return save(ctx, visit, request, userId, visitCID, `LAB_ACKNOWLEDGED:${labRequestId}`);
  }

  // Technician / radiologist enters the results. resultsHash is the SHA-256 of
  // the canonical result document stored in IPFS.
  async SubmitLabResult(ctx, visitId, labRequestId, visitCID, resultsHash) {
    const { userId } = requireRole(ctx, 'labtechnician', 'radiologist', 'labadmin');
    const { visit, request } = await loadPair(ctx, visitId, labRequestId, visitCID);
    requireStatus(request, LAB_STATUS.ACKNOWLEDGED, LAB_STATUS.REJECTED);
    if (!SHA256_HEX.test(resultsHash || '')) {
      throw new Error('resultsHash must be a 64-character lowercase SHA-256 hex digest');
    }

    request.status      = LAB_STATUS.RESULT_SUBMITTED;
    request.submittedBy = userId;
    request.submittedAt = now(ctx);
    request.resultsHash = resultsHash;
    request.revision   += 1;
    return save(ctx, visit, request, userId, visitCID, `LAB_RESULT_SUBMITTED:${labRequestId}`);
  }

  // Supervisor verifies and signs. The transaction itself is signed with the
  // supervisor's certificate; resultsHash must match what the technician
  // submitted, so the signature covers exactly that result.
  async ApproveLabResult(ctx, visitId, labRequestId, visitCID, resultsHash) {
    const { userId } = requireRole(ctx, 'labsupervisor', 'labadmin');
    const { visit, request } = await loadPair(ctx, visitId, labRequestId, visitCID);
    requireStatus(request, LAB_STATUS.RESULT_SUBMITTED);
    if (request.submittedBy === userId) {
      throw new Error('Results must be verified by someone other than the person who entered them');
    }
    if (resultsHash !== request.resultsHash) {
      throw new Error('resultsHash does not match the submitted result; reload the report and verify again');
    }

    request.status     = LAB_STATUS.APPROVED;
    request.approvedBy = userId;
    request.approvedAt = now(ctx);

    // Released: the visit goes back to the ordering doctor.
    if (visit.status === VISIT_STATUS.WITH_LAB) visit.status = VISIT_STATUS.WITH_DOCTOR;
    return save(ctx, visit, request, userId, visitCID, `LAB_RESULT_APPROVED:${labRequestId}`);
  }

  // Supervisor sends the result back to the bench with a reason.
  async RejectLabResult(ctx, visitId, labRequestId, visitCID, reason) {
    const { userId } = requireRole(ctx, 'labsupervisor', 'labadmin');
    const { visit, request } = await loadPair(ctx, visitId, labRequestId, visitCID);
    requireStatus(request, LAB_STATUS.RESULT_SUBMITTED);
    if (!reason || !reason.trim()) throw new Error('A reason is required to reject a result');

    request.status          = LAB_STATUS.REJECTED;
    request.rejectedBy      = userId;
    request.rejectedAt      = now(ctx);
    request.rejectionReason = reason.trim().slice(0, 500);
    return save(ctx, visit, request, userId, visitCID, `LAB_RESULT_REJECTED:${labRequestId}`);
  }

  async GetLabRequest(ctx, labRequestId) {
    const request = await getState(ctx, labKey(labRequestId));
    if (!request) throw new Error(`Lab request not found: ${labRequestId}`);
    await assertReadAccess(ctx, request.patientId, 'visits');
    return JSON.stringify(request);
  }

  async GetLabRequestHistory(ctx, labRequestId) {
    const request = await getState(ctx, labKey(labRequestId));
    if (!request) throw new Error(`Lab request not found: ${labRequestId}`);
    await assertReadAccess(ctx, request.patientId, 'visits');
    return JSON.stringify(await getHistory(ctx, labKey(labRequestId)));
  }

  // The lab work queue. status = '' returns every order.
  async ListLabRequests(ctx, status) {
    requireRole(ctx, ...QUEUE_READERS);
    if (status && !Object.values(LAB_STATUS).includes(status)) {
      throw new Error(`Unknown lab status: ${status}`);
    }
    const iterator = await ctx.stub.getStateByRange(`${LAB_PREFIX}:`, `${LAB_PREFIX};`);
    const results = [];
    while (true) {
      const res = await iterator.next();
      if (res.done) break;
      if (res.value && res.value.value && res.value.value.length > 0) {
        const request = JSON.parse(res.value.value.toString('utf8'));
        if (!status || request.status === status) results.push(request);
      }
    }
    await iterator.close();
    return JSON.stringify(results);
  }
}

module.exports = { LabContract, createLabRequest, labKey, LAB_STATUS };
