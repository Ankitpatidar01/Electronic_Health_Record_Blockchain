'use strict';

/**
 * Mock Verification Script for Sushil's Tool Layer & VCAP Provenance
 * Usage: node tools/test-mock.js
 */

(async () => {
  const fabric = require('./fabric-tools');
  const ipfs = require('./ipfs-tools');
  const hospital = require('./hospital-tools');
  const pharmacy = require('./pharmacy-tools');
  const vcap = require('../provenance/vcap');

  console.log('--- 1. Testing Fabric Tools (Mock) ---');
  const history = await fabric.getPatientHistory('patient-1001', { mock: true });
  if (!Array.isArray(history) || history.length !== 2) throw new Error('fabric.getPatientHistory mock failed');
  if (!await fabric.getLabResult('labresult1', { mock: true })) throw new Error('fabric.getLabResult mock failed');
  if (!(await fabric.createLabResult({ resultId: 'x' }, { mock: true })).result.submitted) throw new Error('fabric.createLabResult mock failed');
  if (!(await fabric.submitLabResult({ resultId: 'x' }, { mock: true })).result.submitted) throw new Error('fabric.submitLabResult mock failed');
  if (!(await fabric.storeAISummary({ resultId: 'x', resultData: { ai: {} } }, { mock: true })).updated) throw new Error('fabric.storeAISummary mock failed');
  if (!(await fabric.addToIPFS({ hello: 'world' }, { mock: true })).startsWith('QmMock')) throw new Error('fabric.addToIPFS mock failed');
  if (!(await fabric.updateLabResult('labresult1', { status: 'UPDATED' }, { mock: true })).updated) throw new Error('fabric.updateLabResult mock failed');
  console.log('  ✔ Fabric tools mock passed');

  console.log('--- 2. Testing IPFS Tools (Mock) ---');
  if (!(await ipfs.addToIPFS({ hello: 'world' }, { mock: true })).startsWith('QmMock')) throw new Error('ipfs.addToIPFS mock failed');
  if (!(await ipfs.addJson({ hello: 'world' }, { mock: true })).startsWith('QmMock')) throw new Error('ipfs.addJson mock failed');
  if (!(await ipfs.addBinary(Buffer.from('hello'), { mock: true })).startsWith('QmMock')) throw new Error('ipfs.addBinary mock failed');
  if (!(await ipfs.health({ mock: true })).ok) throw new Error('ipfs.health mock failed');
  if (!(await ipfs.checkIPFS({ mock: true })).ok) throw new Error('ipfs.checkIPFS alias failed');
  if ((await ipfs.sha256('test', { mock: true })) !== 'mock-sha256') throw new Error('ipfs.sha256 mock failed');
  console.log('  ✔ IPFS tools mock passed');

  console.log('--- 3. Testing Hospital Tools (Mock) ---');
  if ((await hospital.getPatientVisits('patient-1001', { mock: true })).length !== 2) throw new Error('hospital.getPatientVisits mock failed');
  if ((await hospital.getClinicalNotes('patient-1001', { mock: true })).length !== 1) throw new Error('hospital.getClinicalNotes mock failed');
  if (!(await hospital.getPatientConsent('patient-1001', { mock: true })).allowed) throw new Error('hospital consent mock failed');
  if (!(await hospital.checkAccess('patient-1001', { mock: true })).allowed) throw new Error('hospital access mock failed');
  if (!(await hospital.checkAccess('patient-1001', {}, { mock: true })).allowed) throw new Error('hospital access with context mock failed');
  if (!(await hospital.recordClinicalSummary({ patientId: 'patient-1001' }, { mock: true })).recorded) throw new Error('hospital summary mock failed');
  console.log('  ✔ Hospital tools mock passed');

  console.log('--- 4. Testing Pharmacy Tools (Mock) ---');
  if (!(await pharmacy.checkInventory({ medication: 'iron' }, { mock: true })).available) throw new Error('pharmacy.checkInventory mock failed');
  if (!(await pharmacy.checkMedication({ medication: 'iron' }, { mock: true })).available) throw new Error('pharmacy.checkMedication mock failed');
  if (!(await pharmacy.checkMedication('iron', { mock: true })).available) throw new Error('pharmacy.checkMedication string param mock failed');
  if (!(await pharmacy.createBill({ patientId: 'patient-1001' }, { mock: true })).created) throw new Error('pharmacy.createBill mock failed');
  if (!(await pharmacy.deductInventory({ medication: 'iron', quantity: 1 }, { mock: true })).deducted) throw new Error('pharmacy.deductInventory mock failed');
  console.log('  ✔ Pharmacy tools mock passed');

  console.log('--- 5. Testing VCAP Provenance Module ---');
  const record = vcap.createVCAPRecord({
    runId: 'run-1',
    taskId: 'analyze-lab-report',
    agentId: 'lab-agent@LabMSP',
    patientId: 'patient-1001',
    inputData: { x: 1 },
    aiOutput: { y: 2 },
    timeline: [{ step: 'lab-agent.analyze', startedAt: '2026-01-01T00:00:00Z', endedAt: '2026-01-01T00:00:01Z' }],
    toolCalls: [{ tool: 'getLabResult', args: { resultId: 'labresult1' }, at: '2026-01-01T00:00:00Z' }]
  });
  if (record.vcap.version !== '1.0' || !record.vcap.inputHash || !record.vcap.outputHash) throw new Error('VCAP build failed');

  const stored = await vcap.buildAndStoreVCAP(
    { runId: 'run-2', taskId: 'test', agentId: 'lab-agent@LabMSP', inputData: 'in', aiOutput: 'out' },
    { mock: true, addToIPFS: async () => 'QmMockVCAPCid123' }
  );
  if (!stored.cid || !stored.record.vcap.cid) throw new Error('VCAP IPFS mock storage failed');

  const anchored = await vcap.anchorVCAP('QmMockVCAPCid123', async () => {}, { mock: true });
  if (anchored.txId !== 'mock-vcap-tx-001') throw new Error('VCAP anchor mock failed');
  console.log('  ✔ VCAP provenance mock passed');

  console.log('\n=======================================');
  console.log('       ALL MOCK TESTS PASSED           ');
  console.log('=======================================');
})().catch(err => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
