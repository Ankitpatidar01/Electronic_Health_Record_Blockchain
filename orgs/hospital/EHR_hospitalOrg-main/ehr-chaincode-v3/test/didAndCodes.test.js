'use strict';

// One DID per patient with an ordered CID list, and the disease-code history.
// Run: node --test test/didAndCodes.test.js

const test   = require('node:test');
const assert = require('node:assert/strict');
const { PatientContract }  = require('../lib/patientContract');
const { EhrContract }      = require('../lib/ehrContract');
const { VisitContract }    = require('../lib/visitContract');
const { ClinicalContract } = require('../lib/clinicalContract');
const { ForwardContract }  = require('../lib/forwardContract');
const { LabContract }      = require('../lib/labContract');
const { DidContract }      = require('../lib/didContract');
const { CodeContract }     = require('../lib/codeContract');

const MSP = { labreceptionist: 'DiagnosticsMSP', labtechnician: 'DiagnosticsMSP', labsupervisor: 'DiagnosticsMSP', insuranceofficer: 'ProviderMSP' };

function makeLedger() {
  const state = new Map();
  let tx = 0;
  const iter = (rows) => { let i = 0; return {
    next: async () => (i < rows.length ? { value: { key: rows[i][0], value: rows[i++][1] }, done: false } : { done: true }),
    close: async () => {} }; };
  // Like Fabric, a transaction reads committed state only: writes are buffered
  // and applied when the next context is created.
  let pending = [];
  const ctxFor = (role, userId = role, mspId = MSP[role] || 'HospitalMSP') => {
    for (const [k, v] of pending) state.set(k, v);
    pending = [];
    tx += 1;
    const id = `tx${tx}`;
    return {
      clientIdentity: {
        getAttributeValue: (name) => (name === 'role' ? role : ''),
        getMSPID: () => mspId,
        getID: () => `x509::/OU=client/CN=${userId}::/C=US/CN=ca`,
      },
      stub: {
        getTxID: () => id,
        getTxTimestamp: () => ({ seconds: 1790000000 + tx, nanos: 0 }),
        getState: async (key) => state.get(key) || Buffer.alloc(0),
        putState: async (key, value) => { pending.push([key, Buffer.from(value)]); },
        getStateByRange: async (start, end) => iter([...state.entries()].filter(([k]) => k >= start && k < end).sort()),
        getHistoryForKey: async () => iter([]),
        setEvent: () => {},
      },
    };
  };
  return { state, ctxFor };
}

// Digits mapped to letters so the value stays valid base32.
const CID = (n) => `bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s5${String(n).padStart(3, '0').replace(/\d/g, d => 'abcdefghij'[d])}`;
const HASH = 'a'.repeat(64);

async function registered() {
  const ledger = makeLedger();
  const { ctxFor } = ledger;
  const p = JSON.parse(await new PatientContract().RegisterPatient(ctxFor('receptionist'), 'PAT-1', 'N', '40', 'M', 'O+', '9', 'addr', CID(1)));
  await new EhrContract().InitEHR(ctxFor('receptionist'), 'PAT-1', CID(1));
  return { ...ledger, patient: p, did: new DidContract(), codes: new CodeContract() };
}

test('registration creates exactly one DID and the registration CID is entry 1', async () => {
  const { ctxFor, patient, did } = await registered();
  assert.match(patient.did, /^did:ehr:[a-f0-9]{32}$/);

  const record = JSON.parse(await did.GetDID(ctxFor('receptionist'), 'PAT-1'));
  assert.equal(record.did, patient.did);
  assert.equal(record.patientId, 'PAT-1');

  const list = JSON.parse(await did.ListCIDs(ctxFor('receptionist'), patient.did));
  assert.equal(list.entries.length, 1);
  assert.deepEqual(
    { seq: list.entries[0].seq, type: list.entries[0].type, cid: list.entries[0].cid, userId: list.entries[0].userId, mspId: list.entries[0].mspId },
    { seq: 1, type: 'REGISTRATION', cid: CID(1), userId: 'receptionist', mspId: 'HospitalMSP' }
  );
  await assert.rejects(new PatientContract().RegisterPatient(ctxFor('receptionist'), 'PAT-1', 'N', '40', 'M', 'O+', '9', 'addr', CID(1)), /already exists/);
});

test('every visit, consultation, prescription, lab and EHR change appends a CID in order', async () => {
  const { ctxFor, patient, did } = await registered();
  const visits = new VisitContract(), clinical = new ClinicalContract(), forward = new ForwardContract(), lab = new LabContract();

  const v = JSON.parse(await visits.OpenVisit(ctxFor('receptionist'), 'PAT-1', '', CID(2)));
  await visits.AssignDoctor(ctxFor('receptionist'), v.visitId, 'doctor', CID(3));
  await clinical.UpdateDiagnosisNotes(ctxFor('doctor'), v.visitId, CID(4));
  await clinical.UpdatePrescription(ctxFor('doctor'), v.visitId, CID(5));
  await forward.ForwardToLab(ctxFor('doctor'), v.visitId, `${v.visitId}-L1`, CID(6));
  await lab.AcknowledgeLabRequest(ctxFor('labreceptionist'), v.visitId, `${v.visitId}-L1`, CID(7));
  await lab.SubmitLabResult(ctxFor('labtechnician'), v.visitId, `${v.visitId}-L1`, CID(8), HASH);
  await lab.ApproveLabResult(ctxFor('labsupervisor'), v.visitId, `${v.visitId}-L1`, CID(9), HASH);
  await did.AppendDocument(ctxFor('receptionist'), 'PAT-1', CID(10), 'SYMPTOM_ANALYSIS', v.visitId, '');

  const { entries, entryCount } = JSON.parse(await did.ListCIDs(ctxFor('doctor'), patient.did));
  assert.equal(entryCount, 10);
  assert.deepEqual(entries.map(e => e.seq), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(entries.map(e => e.cid), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(CID));
  assert.deepEqual(entries.map(e => e.type), [
    'REGISTRATION', 'VISIT_OPENED', 'ASSIGNMENT', 'CONSULTATION', 'PRESCRIPTION',
    'LAB_ORDER', 'LAB_ACCEPTED', 'LAB_RESULT', 'LAB_RESULT_VERIFIED', 'SYMPTOM_ANALYSIS',
  ]);
  const labResult = entries[7];
  assert.equal(labResult.userId, 'labtechnician');
  assert.equal(labResult.mspId, 'DiagnosticsMSP');
  assert.equal(labResult.ref, `${v.visitId}-L1`);
  assert.match(labResult.timestamp, /^\d{4}-\d{2}-\d{2}T/);

  const one = JSON.parse(await did.GetCIDEntry(ctxFor('doctor'), patient.did, '5'));
  assert.equal(one.cid, CID(5));
});

test('DID reads follow patient access rules; AppendDocument validates its input', async () => {
  const { ctxFor, patient, did } = await registered();
  await assert.rejects(did.ListCIDs(ctxFor('', 'outsider', 'OtherMSP'), patient.did), /Access denied/);
  await assert.rejects(did.ListCIDs(ctxFor('doctor'), 'did:ehr:nope'), /Not a valid/);
  await assert.rejects(did.AppendDocument(ctxFor('receptionist'), 'PAT-1', 'not-a-cid', 'DOCUMENT', '', ''), /valid IPFS CID/);
  await assert.rejects(did.AppendDocument(ctxFor('receptionist'), 'PAT-1', CID(2), 'VISIT_OPENED', '', ''), /type must be one of/);
  await assert.rejects(did.AppendDocument(ctxFor('receptionist'), 'PAT-404', CID(2), 'DOCUMENT', '', ''), /Patient not found/);
});

test('template: only the hospital admin publishes; versions are kept', async () => {
  const { ctxFor, codes } = await registered();
  assert.equal(JSON.parse(await codes.GetTemplate(ctxFor('doctor'))), null);
  await assert.rejects(codes.SetTemplate(ctxFor('doctor'), CID(20), '1', HASH, 'ICD-10'), /Access denied/);
  await assert.rejects(codes.SetTemplate(ctxFor('admin', 'labadmin', 'DiagnosticsMSP'), CID(20), '1', HASH, 'ICD-10'), /Access denied/);
  await assert.rejects(codes.AssignProvisionalCode(ctxFor('receptionist'), 'PAT-1', 'J06.9', 'URI', '', '[]', ''), /No disease-code template/);

  await codes.SetTemplate(ctxFor('admin', 'hospitaladmin'), CID(20), '1', HASH, 'ICD-10');
  await assert.rejects(codes.SetTemplate(ctxFor('admin', 'hospitaladmin'), CID(20), '1', HASH, 'ICD-10'), /already current/);
  const t = JSON.parse(await codes.SetTemplate(ctxFor('admin', 'hospitaladmin'), CID(21), '2', 'b'.repeat(64), 'ICD-10'));
  assert.equal(t.cid, CID(21));
  assert.equal(t.history.length, 1);
  assert.equal(t.history[0].cid, CID(20));
});

test('provisional code, doctor change and confirmation are each a new history entry', async () => {
  const { ctxFor, patient, codes } = await registered();
  await codes.SetTemplate(ctxFor('admin', 'hospitaladmin'), CID(20), '1', HASH, 'ICD-10');

  await assert.rejects(codes.AssignProvisionalCode(ctxFor('receptionist'), 'PAT-1', 'flu', '', '', '[]', ''), /not a valid ICD-10/);
  await assert.rejects(codes.AssignProvisionalCode(ctxFor('doctor'), 'PAT-1', 'J06.9', '', '', '[]', ''), /Access denied/);
  let r = JSON.parse(await codes.AssignProvisionalCode(ctxFor('receptionist'), 'PAT-1', 'J06.9', 'Acute URI', 'PAT-1-V1', '["J11.1","A90","junk"]', CID(30)));
  assert.equal(r.status, 'PROVISIONAL');
  assert.equal(r.did, patient.did);
  assert.deepEqual(r.history[0].aiSuggestedCodes, ['J11.1', 'A90']);

  await assert.rejects(codes.UpdateDiseaseCode(ctxFor('receptionist'), 'PAT-1', 'A90', 'Dengue', 'x', ''), /Access denied/);
  await assert.rejects(codes.UpdateDiseaseCode(ctxFor('doctor'), 'PAT-1', 'A90', 'Dengue', '', ''), /reason is required/);
  r = JSON.parse(await codes.UpdateDiseaseCode(ctxFor('doctor'), 'PAT-1', 'A90', 'Dengue fever', 'NS1 antigen positive', 'PAT-1-V1'));
  assert.equal(r.currentCode, 'A90');
  assert.equal(r.status, 'CONFIRMED');
  const changed = r.history[1];
  assert.deepEqual(
    { action: changed.action, oldCode: changed.oldCode, newCode: changed.newCode, by: changed.by, reason: changed.reason,
      ai: changed.matchesAiSuggestion, prov: changed.matchesProvisional },
    { action: 'CHANGED', oldCode: 'J06.9', newCode: 'A90', by: 'doctor', reason: 'NS1 antigen positive', ai: true, prov: false }
  );
  assert.match(changed.timestamp, /^\d{4}-/);
  assert.ok(changed.txId);

  await assert.rejects(codes.UpdateDiseaseCode(ctxFor('doctor'), 'PAT-1', 'A90', 'Dengue fever', '', ''), /already confirmed/);

  // A later visit: new provisional code, then the doctor confirms it unchanged.
  await codes.AssignProvisionalCode(ctxFor('receptionist'), 'PAT-1', 'K29.7', 'Gastritis', 'PAT-1-V2', '["K21.9"]', '');
  r = JSON.parse(await codes.UpdateDiseaseCode(ctxFor('doctor'), 'PAT-1', 'K29.7', 'Gastritis', '', 'PAT-1-V2'));
  assert.deepEqual(r.history.map(h => h.action), ['PROVISIONAL', 'CHANGED', 'PROVISIONAL', 'CONFIRMED']);
  assert.deepEqual(r.history.map(h => `${h.oldCode}>${h.newCode}`), ['>J06.9', 'J06.9>A90', 'A90>K29.7', 'K29.7>K29.7']);
  assert.equal(r.history[3].matchesProvisional, true);
  assert.equal(r.history[3].matchesAiSuggestion, false);

  const read = JSON.parse(await codes.GetDiseaseCode(ctxFor('doctor'), 'PAT-1'));
  assert.equal(read.history.length, 4);
  await assert.rejects(codes.GetDiseaseCode(ctxFor('', 'outsider', 'OtherMSP'), 'PAT-1'), /Access denied/);
});

test('StatsContract returns counts only, to admin and observer', async () => {
  const { ctxFor, codes } = await registered();
  const { StatsContract } = require('../lib/statsContract');
  const stats = new StatsContract();
  await codes.SetTemplate(ctxFor('admin', 'hospitaladmin'), CID(20), '1', HASH, 'ICD-10');
  await codes.AssignProvisionalCode(ctxFor('receptionist'), 'PAT-1', 'J06.9', 'URI', '', '["A90"]', '');
  await codes.UpdateDiseaseCode(ctxFor('doctor'), 'PAT-1', 'A90', 'Dengue fever', 'NS1 positive', '');
  const v = JSON.parse(await new VisitContract().OpenVisit(ctxFor('receptionist'), 'PAT-1', '', CID(2)));
  await new VisitContract().AssignDoctor(ctxFor('receptionist'), v.visitId, 'doctor', CID(3));
  await new ForwardContract().ForwardToLab(ctxFor('doctor'), v.visitId, `${v.visitId}-L1`, CID(4));

  await assert.rejects(stats.GetStats(ctxFor('doctor')), /Access denied/);
  const s = JSON.parse(await stats.GetStats(ctxFor('observer', 'dashboardobserver')));
  assert.deepEqual(s, {
    patients: 1,
    visits: { total: 1, byStatus: { WITH_LAB: 1 } },
    dids: 1,
    documents: 4,
    labRequests: { total: 1, byStatus: { REQUESTED: 1 } },
    diseaseCodes: {
      patientsWithCode: 1, provisional: 0, confirmed: 1,
      doctorDecisions: 1, decisionsWithAiSuggestion: 1, matchedAiSuggestion: 1, matchedProvisional: 0,
    },
  });
});
