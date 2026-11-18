'use strict';

// Safety properties of the multi-agent workflow: nothing is fabricated when a
// dependency is missing, governance fails closed, and provenance is real.

const test   = require('node:test');
const assert = require('node:assert/strict');

const { AgentResult, AgentStatus } = require('../orchestrator/agent-contract');
const { runClinicalAgent } = require('../agents/clinical-agent');
const { checkGovernance } = require('../governance/governance');
const { buildAndAnchorVCAP, buildVCAPRecord } = require('../provenance/vcap');
const { approveWorkflowRun, activeRuns } = require('../orchestrator/orchestrator');
const ExecutionState = require('../orchestrator/state');

const context = { runId: 'run-1', patientId: 'P001', metadata: { testCode: 'CBC' } };
const lab = new AgentResult({
  agentId: 'lab-agent',
  result: { summary: 'Hemoglobin 9.2 g/dL', abnormalities: ['Low hemoglobin'], riskFlags: [] },
  metadata: { disclaimer: 'Not a diagnosis.' },
});
const history = new AgentResult({ agentId: 'history-agent', result: { trendSummary: 'Stable' } });

test('clinical agent returns no recommendation when the service is not configured', async () => {
  const result = await runClinicalAgent(context, lab, history, { url: '' });
  assert.equal(result.status, AgentStatus.WARNING);
  assert.equal(result.result.available, false);
  assert.equal(result.result.recommendation, null);
});

test('clinical agent retries, then reports unavailable instead of inventing output', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; throw new TypeError('fetch failed'); };
  const result = await runClinicalAgent(context, lab, history, { url: 'http://clinical.test', fetchImpl, retryDelayMs: 0 });
  assert.equal(calls, 3);
  assert.equal(result.result.recommendation, null);
});

test('clinical agent maps a real service response', async () => {
  const fetchImpl = async (url, init) => {
    assert.equal(url, 'http://clinical.test/api/v1/agent/analyze-report');
    assert.match(JSON.parse(init.body).report_text, /Low hemoglobin/);
    return { ok: true, json: async () => ({ findings: ['Hb low'], abnormalities_flagged: ['Hb'], suggested_followups: ['Order ferritin'], provenance_hash: 'abc' }) };
  };
  const result = await runClinicalAgent(context, lab, history, { url: 'http://clinical.test', fetchImpl });
  assert.equal(result.status, AgentStatus.SUCCESS);
  assert.deepEqual(result.result.nextSteps, ['Order ferritin']);
});

test('governance always routes approved runs to a human and blocks failed agents', async () => {
  const clinical = new AgentResult({ agentId: 'clinical-agent', result: { available: true, recommendation: 'Order ferritin' }, metadata: { disclaimer: 'x' } });
  const ok = await checkGovernance(context, { 'lab-agent': lab, 'history-agent': history, 'clinical-agent': clinical });
  assert.equal(ok.result.approved, true);
  assert.equal(ok.result.requiresHumanReview, true);

  const failedLab = new AgentResult({ agentId: 'lab-agent', status: AgentStatus.FAILED });
  const blocked = await checkGovernance(context, { 'lab-agent': failedLab, 'history-agent': history, 'clinical-agent': clinical });
  assert.equal(blocked.result.approved, false);

  const missing = await checkGovernance(context, { 'lab-agent': lab });
  assert.equal(missing.result.approved, false);
});

test('VCAP record holds hashes only and is pinned for a real CID', async () => {
  const state = new ExecutionState('run-9', 'P001', { resultId: 'R1' });
  state.recordAgentResult(lab);
  state.recordHumanApproval({ reviewedBy: 'doctor1', decision: 'APPROVED' });
  const record = buildVCAPRecord(state);
  const text = JSON.stringify(record);
  assert.ok(!text.includes('P001') && !text.includes('doctor1') && !text.includes('Hemoglobin'));
  assert.match(record.recordHash, /^[a-f0-9]{64}$/);

  const cid = await buildAndAnchorVCAP(state, { addJsonToIpfs: async () => ({ cid: 'bafkreirealcid' }) });
  assert.equal(cid, 'bafkreirealcid');
  await assert.rejects(buildAndAnchorVCAP(state, { addJsonToIpfs: async () => { throw new Error('ipfs down'); } }), /could not be stored/);
});

test('approval is validated and only applies to runs waiting for review', async () => {
  const state = new ExecutionState('run-approve', 'P001', {});
  activeRuns.set('run-approve', state);
  await assert.rejects(approveWorkflowRun('run-approve', { decision: 'APPROVED', reviewedBy: 'doctor1' }), /not waiting for review/);
  state.pauseForHumanReview();
  await assert.rejects(approveWorkflowRun('run-approve', { decision: 'MAYBE', reviewedBy: 'doctor1' }), /decision must be/);
  await assert.rejects(approveWorkflowRun('run-approve', { decision: 'APPROVED' }), /reviewedBy is required/);
  const rejected = await approveWorkflowRun('run-approve', { decision: 'REJECTED', reviewedBy: 'doctor1', comments: 'no' });
  assert.equal(rejected.status, 'FAILED');
  activeRuns.delete('run-approve');
});
