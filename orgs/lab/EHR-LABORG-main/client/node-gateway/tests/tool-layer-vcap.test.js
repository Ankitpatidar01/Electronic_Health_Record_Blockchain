'use strict';

/**
 * Automated Test Suite for Sushil's Tool Layer & VCAP Provenance
 *
 * Covers:
 * 1. Fabric Tools (mock mode, parameter validation, aliases)
 * 2. IPFS Tools (mock mode, JSON & Binary add, health check, sha256)
 * 3. Hospital Tools (mock mode, access gate, notes & visits)
 * 4. Pharmacy Tools (mock mode, inventory check, medication check, billing, deduct)
 * 5. VCAP Provenance (schema conformity, hashing integrity, store & anchor)
 * 6. Orchestrator Integration (VCAP compatibility with workflow state machine)
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const fabricTools = require('../tools/fabric-tools');
const ipfsTools = require('../tools/ipfs-tools');
const hospitalTools = require('../tools/hospital-tools');
const pharmacyTools = require('../tools/pharmacy-tools');
const vcap = require('../provenance/vcap');
const ExecutionState = require('../orchestrator/state');
const { AgentResult, AgentStatus } = require('../orchestrator/agent-contract');

test('Fabric Tools: getPatientHistory retrieves mock patient records', async () => {
  const history = await fabricTools.getPatientHistory('patient-1001', { mock: true });
  assert.ok(Array.isArray(history));
  assert.equal(history.length, 2);
  assert.equal(history[0].patientId, 'patient-1001');

  // Throws if patientId missing
  await assert.rejects(fabricTools.getPatientHistory('', { mock: true }), /patientId is required/);
});

test('Fabric Tools: getLabResult retrieves single record and handles non-existent', async () => {
  const result = await fabricTools.getLabResult('labresult1', { mock: true });
  assert.ok(result);
  assert.equal(result.resultId, 'labresult1');

  const missing = await fabricTools.getLabResult('non-existent', { mock: true });
  assert.equal(missing, null);

  await assert.rejects(fabricTools.getLabResult('', { mock: true }), /resultId is required/);
});

test('Fabric Tools: submitLabResult and createLabResult aliases work identically', async () => {
  const payload = { resultId: 'LR-999', patientId: 'patient-1001', testCode: 'CBC' };
  const res1 = await fabricTools.createLabResult(payload, { mock: true });
  const res2 = await fabricTools.submitLabResult(payload, { mock: true });

  assert.equal(res1.result.submitted, true);
  assert.equal(res2.result.submitted, true);
  assert.equal(res1.peer, 'mock-peer');
});

test('Fabric Tools: storeAISummary and updateLabResult mock support', async () => {
  const aiPayload = { resultId: 'labresult1', resultData: { ai: { summary: 'Normal' } } };
  const stored = await fabricTools.storeAISummary(aiPayload, { mock: true });
  assert.equal(stored.updated, true);
  assert.equal(stored.mock, true);

  const updated = await fabricTools.updateLabResult('labresult1', { status: 'COMPLETED' }, { mock: true });
  assert.equal(updated.updated, true);
  assert.equal(updated.resultId, 'labresult1');
});

test('IPFS Tools: addToIPFS and addBinary return valid mock CID', async () => {
  const cid1 = await ipfsTools.addToIPFS({ key: 'val' }, { mock: true });
  assert.match(cid1, /^Qm[A-Za-z0-9]+/);

  const cid2 = await ipfsTools.addBinary(Buffer.from('binary-data'), { mock: true });
  assert.match(cid2, /^Qm[A-Za-z0-9]+/);

  const health = await ipfsTools.health({ mock: true });
  assert.equal(health.ok, true);

  const check = await ipfsTools.checkIPFS({ mock: true });
  assert.equal(check.ok, true);

  const hashVal = await ipfsTools.sha256('sample', { mock: true });
  assert.equal(hashVal, 'mock-sha256');
});

test('Hospital Tools: getPatientVisits and getClinicalNotes with access gate', async () => {
  const visits = await hospitalTools.getPatientVisits('patient-1001', { mock: true });
  assert.equal(visits.length, 2);
  assert.equal(visits[0].diagnosis, 'Anemia');

  const notes = await hospitalTools.getClinicalNotes('patient-1001', { mock: true });
  assert.equal(notes.length, 1);
  assert.equal(notes[0].noteId, 'note-001');

  const consent = await hospitalTools.getPatientConsent('patient-1001', { mock: true });
  assert.equal(consent.allowed, true);

  const access = await hospitalTools.checkAccess('patient-1001', { mock: true });
  assert.equal(access.allowed, true);
});

test('Pharmacy Tools: checkInventory and checkMedication support string and object queries', async () => {
  const inv = await pharmacyTools.checkInventory({ medication: 'iron' }, { mock: true });
  assert.equal(inv.available, true);
  assert.equal(inv.quantity, 25);

  const medObj = await pharmacyTools.checkMedication({ medication: 'iron' }, { mock: true });
  assert.equal(medObj.available, true);

  const medStr = await pharmacyTools.checkMedication('iron', { mock: true });
  assert.equal(medStr.available, true);

  const bill = await pharmacyTools.createBill({ patientId: 'patient-1001', amount: 50 }, { mock: true });
  assert.equal(bill.created, true);
  assert.equal(bill.billId, 'mock-bill-001');

  const deduct = await pharmacyTools.deductInventory({ medication: 'iron', quantity: 2 }, { mock: true });
  assert.equal(deduct.deducted, true);
});

test('VCAP: createVCAPRecord builds blueprint-conforming record', () => {
  const record = vcap.createVCAPRecord({
    runId: 'run-test-101',
    taskId: 'analyze-lab-report',
    agentId: 'lab-agent@LabMSP',
    patientId: 'patient-1001',
    inputData: { hemoglobin: '9.2' },
    aiOutput: { summary: 'Low hemoglobin' },
    timeline: [{ step: 'lab-agent.analyze', timestamp: '2026-11-18T00:00:00Z' }],
    toolCalls: [{ tool: 'getLabResult', args: { resultId: 'LR-001' } }],
  });

  assert.equal(record.vcap.version, '1.0');
  assert.equal(record.vcap.runId, 'run-test-101');
  assert.equal(record.vcap.taskId, 'analyze-lab-report');
  assert.equal(record.vcap.agentId, 'lab-agent@LabMSP');
  assert.match(record.vcap.inputHash, /^[a-f0-9]{64}$/);
  assert.match(record.vcap.outputHash, /^[a-f0-9]{64}$/);
});

test('VCAP: buildAndAnchorVCAP integrates seamlessly with ExecutionState', async () => {
  const state = new ExecutionState('run-vcap-e2e', 'patient-1001', { testCode: 'CBC' });
  const labRes = new AgentResult({
    agentId: 'lab-agent',
    status: AgentStatus.SUCCESS,
    confidence: 'high',
    result: { summary: 'Findings processed' },
  });
  state.recordAgentResult(labRes);
  state.recordHumanApproval({ reviewedBy: 'Dr. Smith', decision: 'APPROVED' });

  const cid = await vcap.buildAndAnchorVCAP(state, { mock: true });
  assert.match(cid, /^Qm[A-Za-z0-9]+/);

  // State completes with that CID
  state.complete(cid);
  assert.equal(state.status, 'COMPLETED');
  assert.equal(state.vcapCid, cid);
});
