'use strict';

const { AgentContext, AgentResult, AgentStatus } = require('./agent-contract');
const ExecutionState = require('./state');

// In-memory store for workflow execution states (keyed by runId)
const activeRuns = new Map();

/**
 * Agent adapters.
 *
 * Each adapter runs the real module. A module that is not installed yields an
 * explicit "unavailable" result with no clinical content — nothing is ever
 * substituted with sample data — and an error thrown by a module propagates so
 * the run is marked FAILED instead of being papered over.
 */

const telemetry = require('../dashboard-telemetry');

function loadModule(modulePath) {
  try {
    return require(modulePath);
  } catch (error) {
    if (error && error.code === 'MODULE_NOT_FOUND' && String(error.message).includes(modulePath.replace(/^\.\.\//, ''))) {
      return null;
    }
    throw error;
  }
}

function unavailableResult(agentId, what) {
  return new AgentResult({
    agentId,
    status: AgentStatus.FAILED,
    confidence: 'low',
    result: { available: false },
    errors: [`${what} is not installed on this gateway.`],
    metadata: { source: 'unavailable' },
  });
}

async function callLabAgent(context, inputPayload) {
  const mod = loadModule('../agents/lab-agent');
  if (!mod || typeof mod.runLabAgent !== 'function') return unavailableResult('lab-agent', 'The lab report agent');
  return mod.runLabAgent(context, inputPayload);
}

async function callHistoryAgent(context) {
  const mod = loadModule('../agents/history-agent');
  if (!mod || typeof mod.runHistoryAgent !== 'function') return unavailableResult('history-agent', 'The patient history agent');
  return mod.runHistoryAgent(context);
}

async function callClinicalAgent(context, labResult, historyResult, options = {}) {
  const mod = loadModule('../agents/clinical-agent');
  if (!mod || typeof mod.runClinicalAgent !== 'function') return unavailableResult('clinical-agent', 'The clinical decision-support agent');
  return mod.runClinicalAgent(context, labResult, historyResult, options);
}

async function callGovernance(context, allResults) {
  const mod = loadModule('../governance/governance');
  if (!mod || typeof mod.checkGovernance !== 'function') {
    // Fail closed: without a governance check nothing is approved.
    const result = unavailableResult('governance-agent', 'The governance check');
    result.result = { available: false, approved: false, requiresHumanReview: false, safetyFlags: ['Governance check unavailable'] };
    return result;
  }
  return mod.checkGovernance(context, allResults);
}

async function createVCAP(state) {
  const mod = loadModule('../provenance/vcap');
  if (!mod || typeof mod.buildAndAnchorVCAP !== 'function') {
    throw new Error('Provenance (VCAP) module is not installed; the run cannot be completed without a provenance record.');
  }
  return mod.buildAndAnchorVCAP(state);
}

function traceAgent(runId, agentId, result) {
  const failed = result && (result.status === AgentStatus.FAILED || result.status === 'ERROR');
  telemetry.emit(failed ? 'AGENT_EXECUTION_FAILED' : 'AGENT_EXECUTION_COMPLETED', {
    agentId,
    status: telemetry.safeCode(result && result.status, 'UNKNOWN'),
    ...(failed ? { errorCode: 'AGENT_FAILED' } : {}),
  }, { source: 'lab-orchestrator', correlationId: telemetry.safeCode(runId, undefined), severity: failed ? 'WARNING' : 'INFO' });
}

/**
 * Master Stateful Workflow Orchestrator
 * Executes the pipeline: LAB -> HISTORY -> CLINICAL -> GOVERNANCE -> HUMAN REVIEW -> VCAP
 *
 * @param {Object} payload - { runId, patientId, resultId, testCode, resultData }
 * @returns {Promise<ExecutionState>}
 */
async function runWorkflow(payload, options = {}) {
  const runId = payload.runId || `run-${Date.now()}`;
  const patientId = payload.patientId || 'patient-1001';

  const state = new ExecutionState(runId, patientId, payload);
  activeRuns.set(runId, state);

  try {
    // 1. STEP 1: LAB AGENT NODE
    state.updateAgentStart('lab-agent');
    const labContext = new AgentContext({ runId, patientId, requestingAgent: 'ORCHESTRATOR', metadata: payload });
    const labResult = await callLabAgent(labContext, payload);
    state.recordAgentResult(labResult);
    traceAgent(runId, 'lab-agent', labResult);

    // 2. STEP 2: PATIENT HISTORY AGENT NODE
    state.updateAgentStart('history-agent');
    const historyContext = new AgentContext({
      runId,
      patientId,
      requestingAgent: 'ORCHESTRATOR',
      previousResults: state.agentResults,
      metadata: payload
    });
    const historyResult = await callHistoryAgent(historyContext);
    state.recordAgentResult(historyResult);
    traceAgent(runId, 'history-agent', historyResult);

    // 3. STEP 3: CLINICAL DECISION SUPPORT AGENT NODE
    state.updateAgentStart('clinical-agent');
    const clinicalContext = new AgentContext({
      runId,
      patientId,
      requestingAgent: 'ORCHESTRATOR',
      previousResults: state.agentResults,
      metadata: payload
    });
    const clinicalResult = await callClinicalAgent(clinicalContext, labResult, historyResult, { authToken: options.authToken });
    state.recordAgentResult(clinicalResult);
    traceAgent(runId, 'clinical-agent', clinicalResult);

    // A failed clinical review must never proceed to governance or provenance.
    if (!clinicalResult || clinicalResult.status === AgentStatus.FAILED) {
      state.fail('Clinical decision-support failed; governance and VCAP were not executed.');
      return state;
    }

    // 4. STEP 4: GOVERNANCE & SAFETY CHECK
    state.updateAgentStart('governance-agent');
    const governanceContext = new AgentContext({
      runId,
      patientId,
      requestingAgent: 'ORCHESTRATOR',
      previousResults: state.agentResults,
      metadata: payload
    });
    const governanceResult = await callGovernance(governanceContext, state.agentResults);
    state.recordAgentResult(governanceResult);
    const governance = governanceResult.result || {};
    telemetry.emit('GOVERNANCE_DECISION', {
      agentId: 'governance-agent',
      status: governance.approved ? 'APPROVED' : 'BLOCKED',
      humanReviewStatus: governance.requiresHumanReview ? 'REQUIRED' : 'NOT_REQUIRED',
    }, { source: 'lab-orchestrator', correlationId: telemetry.safeCode(runId, undefined), severity: governance.approved ? 'INFO' : 'WARNING' });
    telemetry.traceStage('governance-agent', 'GOVERNANCE', governance.approved ? 'DONE' : 'FAILED', {}, { source: 'lab-orchestrator', correlationId: telemetry.safeCode(runId, undefined) });

    // A run that governance did not approve stops here.
    if (!governance.approved) {
      state.fail('Governance did not approve this run: ' + ((governance.safetyFlags || []).join('; ') || 'no reason given'));
      return state;
    }

    // 5. STEP 5: HUMAN REVIEW / APPROVAL GATE
    if (governance.requiresHumanReview) {
      state.pauseForHumanReview();
      telemetry.emit('HUMAN_REVIEW_REQUIRED', { agentId: 'governance-agent', status: 'WAITING', humanReviewStatus: 'PENDING' },
        { source: 'lab-orchestrator', correlationId: telemetry.safeCode(runId, undefined) });
      telemetry.traceStage('governance-agent', 'HUMAN_REVIEW', 'WAITING_HUMAN', {}, { source: 'lab-orchestrator', correlationId: telemetry.safeCode(runId, undefined) });
      return state;
    }

    // 6. STEP 6: VCAP PROVENANCE RECORD & COMPLETION (Auto-complete if no human review required)
    const vcapCid = await createVCAP(state);
    state.complete(vcapCid);

    return state;
  } catch (error) {
    state.fail(error.message);
    return state;
  }
}

/**
 * Handle Doctor Human Approval
 * @param {string} runId
 * @param {Object} approvalPayload - { reviewedBy, decision, comments }
 */
async function approveWorkflowRun(runId, approvalPayload) {
  const state = activeRuns.get(runId);
  if (!state) {
    throw new Error(`Run ID ${runId} not found`);
  }

  if (state.status !== 'PAUSED_FOR_HUMAN') {
    throw new Error(`Run ${runId} is not waiting for review (status: ${state.status})`);
  }
  const decision = approvalPayload && approvalPayload.decision;
  if (decision !== 'APPROVED' && decision !== 'REJECTED') {
    throw new Error("decision must be 'APPROVED' or 'REJECTED'");
  }
  if (!approvalPayload.reviewedBy || !String(approvalPayload.reviewedBy).trim()) {
    throw new Error('reviewedBy is required');
  }

  state.recordHumanApproval(approvalPayload);
  telemetry.traceStage('governance-agent', 'HUMAN_REVIEW', decision === 'APPROVED' ? 'DONE' : 'FAILED', {},
    { source: 'lab-orchestrator', correlationId: telemetry.safeCode(runId, undefined) });

  if (decision === 'APPROVED') {
    try {
      const vcapCid = await createVCAP(state);
      state.complete(vcapCid);
    } catch (error) {
      state.fail(error.message);
    }
  } else {
    state.fail(`Human reviewer rejected AI recommendation: ${approvalPayload.comments || 'No comment'}`);
  }

  return state;
}

/**
 * Retrieve execution state by runId.
 */
function getWorkflowState(runId) {
  return activeRuns.get(runId) || null;
}

module.exports = {
  runWorkflow,
  approveWorkflowRun,
  getWorkflowState,
  activeRuns,
  // Adapters, exported for unit testing
  callLabAgent,
  callHistoryAgent,
  callClinicalAgent,
  callGovernance,
  createVCAP
};
