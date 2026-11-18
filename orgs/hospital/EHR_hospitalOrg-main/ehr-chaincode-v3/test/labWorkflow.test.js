'use strict';

// Lab workflow, org-scoped admin role and deterministic timestamps,
// exercised against an in-memory ledger.
// Run: node --test test/labWorkflow.test.js

const test   = require('node:test');
const assert = require('node:assert/strict');
const { PatientContract } = require('../lib/patientContract');
const { VisitContract }   = require('../lib/visitContract');
const { ForwardContract } = require('../lib/forwardContract');
const { LabContract }     = require('../lib/labContract');

const MSP = {
  receptionist: 'HospitalMSP', doctor: 'HospitalMSP', nurse: 'HospitalMSP',
  labreceptionist: 'DiagnosticsMSP', labtechnician: 'DiagnosticsMSP',
  labsupervisor: 'DiagnosticsMSP', radiologist: 'DiagnosticsMSP',
  insuranceofficer: 'ProviderMSP',
};

function makeLedger() {
  const state = new Map();
  let tx = 0;
  const iter = (rows) => {
    let i = 0;
    return {
      next: async () => (i < rows.length ? { value: { key: rows[i][0], value: rows[i++][1] }, done: false } : { done: true }),
      close: async () => {},
    };
  };
  // ctxFor(certRole, userId, mspId)
  const ctxFor = (role, userId = role, mspId = MSP[role] || 'HospitalMSP') => {
    tx += 1;
    return {
      clientIdentity: {
        getAttributeValue: (name) => (name === 'role' ? role : ''),
        getMSPID: () => mspId,
        getID: () => `x509::/OU=client/CN=${userId}::/C=US/CN=ca`,
      },
      stub: {
        getTxID: () => `tx${tx}`,
        getTxTimestamp: () => ({ seconds: 1790000000 + tx, nanos: 0 }),
        getState: async (key) => state.get(key) || Buffer.alloc(0),
        putState: async (key, value) => { state.set(key, Buffer.from(value)); },
        getStateByRange: async (start, end) =>
          iter([...state.entries()].filter(([k]) => k >= start && k < end).sort()),
        getHistoryForKey: async () => iter([]),
        setEvent: () => {},
      },
    };
  };
  return { state, ctxFor };
}

const CID = (n) => `bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s5${String(n).padStart(3, 'a')}`;
const HASH = 'a'.repeat(64);

async function orderedVisit() {
  const ledger = makeLedger();
  const { ctxFor } = ledger;
  const patients = new PatientContract();
  const visits = new VisitContract();
  const forward = new ForwardContract();
  await patients.RegisterPatient(ctxFor('receptionist'), 'PAT-1', 'N', '40', 'M', 'O+', '9', 'addr', CID(1));
  const visit = JSON.parse(await visits.OpenVisit(ctxFor('receptionist'), 'PAT-1', '', CID(2)));
  await visits.AssignDoctor(ctxFor('receptionist'), visit.visitId, 'doctor', CID(3));
  await forward.ForwardToLab(ctxFor('doctor'), visit.visitId, `${visit.visitId}-L1`, CID(4));
  return { ...ledger, visitId: visit.visitId, labId: `${visit.visitId}-L1`, lab: new LabContract(), forward };
}

test('order → acknowledge → submit → approve, each step recorded under the real actor', async () => {
  const { ctxFor, visitId, labId, lab } = await orderedVisit();

  let r = JSON.parse(await lab.GetLabRequest(ctxFor('labtechnician'), labId));
  assert.equal(r.status, 'REQUESTED');
  assert.equal(r.requestedBy, 'doctor');

  r = JSON.parse(await lab.AcknowledgeLabRequest(ctxFor('labreceptionist'), visitId, labId, CID(5)));
  assert.equal(r.labRequest.status, 'ACKNOWLEDGED');

  r = JSON.parse(await lab.SubmitLabResult(ctxFor('labtechnician'), visitId, labId, CID(6), HASH));
  assert.equal(r.labRequest.status, 'RESULT_SUBMITTED');
  assert.equal(r.status, 'WITH_LAB');

  r = JSON.parse(await lab.ApproveLabResult(ctxFor('labsupervisor'), visitId, labId, CID(7), HASH));
  assert.equal(r.labRequest.status, 'APPROVED');
  assert.equal(r.labRequest.submittedBy, 'labtechnician');
  assert.equal(r.labRequest.approvedBy, 'labsupervisor');
  assert.equal(r.status, 'WITH_DOCTOR');
  assert.equal(r.visitCID, CID(7));
});

test('steps cannot be skipped, repeated or done by the wrong role', async () => {
  const { ctxFor, visitId, labId, lab, forward } = await orderedVisit();

  await assert.rejects(lab.SubmitLabResult(ctxFor('labtechnician'), visitId, labId, CID(5), HASH), /needs ACKNOWLEDGED/);
  await assert.rejects(lab.AcknowledgeLabRequest(ctxFor('labtechnician'), visitId, labId, CID(5)), /Access denied/);
  await assert.rejects(lab.AcknowledgeLabRequest(ctxFor('labreceptionist'), visitId, 'PAT-9-V1-L1', CID(5)), /not found/);
  await assert.rejects(forward.ForwardToLab(ctxFor('doctor'), visitId, labId, CID(5)), /already exists/);
  await assert.rejects(forward.ForwardToLab(ctxFor('doctor'), visitId, 'OTHER-V1-L1', CID(5)), /does not belong/);

  await lab.AcknowledgeLabRequest(ctxFor('labreceptionist'), visitId, labId, CID(5));
  await assert.rejects(lab.AcknowledgeLabRequest(ctxFor('labreceptionist'), visitId, labId, CID(6)), /needs REQUESTED/);
  await assert.rejects(lab.ApproveLabResult(ctxFor('labsupervisor'), visitId, labId, CID(6), HASH), /needs RESULT_SUBMITTED/);
  await assert.rejects(lab.SubmitLabResult(ctxFor('labtechnician'), visitId, labId, CID(6), 'not-a-hash'), /SHA-256/);

  await lab.SubmitLabResult(ctxFor('labtechnician'), visitId, labId, CID(6), HASH);
  await assert.rejects(lab.ApproveLabResult(ctxFor('labtechnician'), visitId, labId, CID(7), HASH), /Access denied/);
  await assert.rejects(lab.ApproveLabResult(ctxFor('labsupervisor'), visitId, labId, CID(7), 'b'.repeat(64)), /does not match/);
});

test('the person who entered a result cannot verify it, even as lab admin', async () => {
  const { ctxFor, visitId, labId, lab } = await orderedVisit();
  const labAdmin = () => ctxFor('admin', 'labadmin', 'DiagnosticsMSP');
  await lab.AcknowledgeLabRequest(labAdmin(), visitId, labId, CID(5));
  await lab.SubmitLabResult(labAdmin(), visitId, labId, CID(6), HASH);
  await assert.rejects(lab.ApproveLabResult(labAdmin(), visitId, labId, CID(7), HASH), /someone other than/);
  const r = JSON.parse(await lab.ApproveLabResult(ctxFor('labsupervisor'), visitId, labId, CID(7), HASH));
  assert.equal(r.labRequest.status, 'APPROVED');
});

test('supervisor can reject; technician resubmits; queue lists by status', async () => {
  const { ctxFor, visitId, labId, lab } = await orderedVisit();
  await lab.AcknowledgeLabRequest(ctxFor('labreceptionist'), visitId, labId, CID(5));
  await lab.SubmitLabResult(ctxFor('labtechnician'), visitId, labId, CID(6), HASH);
  await assert.rejects(lab.RejectLabResult(ctxFor('labsupervisor'), visitId, labId, CID(7), ' '), /reason is required/);
  let r = JSON.parse(await lab.RejectLabResult(ctxFor('labsupervisor'), visitId, labId, CID(7), 'haemolysed sample'));
  assert.equal(r.labRequest.status, 'REJECTED');
  assert.equal(r.status, 'WITH_LAB');

  assert.equal(JSON.parse(await lab.ListLabRequests(ctxFor('labtechnician'), 'REJECTED')).length, 1);
  assert.equal(JSON.parse(await lab.ListLabRequests(ctxFor('labtechnician'), 'APPROVED')).length, 0);
  await assert.rejects(lab.ListLabRequests(ctxFor('insuranceofficer'), ''), /Access denied/);

  r = JSON.parse(await lab.SubmitLabResult(ctxFor('labtechnician'), visitId, labId, CID(8), 'c'.repeat(64)));
  assert.equal(r.labRequest.revision, 2);
});

test('admin role is scoped to its organisation', async () => {
  const { ctxFor } = makeLedger();
  const patients = new PatientContract();
  const args = ['PAT-2', 'N', '30', 'F', 'A+', '9', 'addr', CID(1)];
  await assert.rejects(patients.RegisterPatient(ctxFor('admin', 'provideradmin', 'ProviderMSP'), ...args), /Access denied/);
  await assert.rejects(patients.RegisterPatient(ctxFor('admin', 'labadmin', 'DiagnosticsMSP'), ...args), /Access denied/);
  const p = JSON.parse(await patients.RegisterPatient(ctxFor('admin', 'hospitaladmin', 'HospitalMSP'), ...args));
  assert.equal(p.registeredBy, 'hospitaladmin');
});

test('timestamps come from the transaction, not the wall clock', async () => {
  const { ctxFor } = makeLedger();
  const patients = new PatientContract();
  const p = JSON.parse(await patients.RegisterPatient(ctxFor('receptionist'), 'PAT-3', 'N', '30', 'F', 'A+', '9', 'addr', CID(1)));
  assert.equal(p.createdAt, new Date((1790000000 + 1) * 1000).toISOString());
  assert.equal(p.updatedAt, p.createdAt);
});
