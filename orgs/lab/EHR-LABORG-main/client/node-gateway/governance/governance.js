'use strict';

/**
 * Governance & safety gate for the multi-agent workflow.
 *
 * Rule based and fail-closed. It never auto-approves clinical output:
 * anything carrying a recommendation, an abnormality, a risk flag or low
 * confidence is routed to a human reviewer, and a failed or missing agent
 * blocks the run.
 */

const { AgentResult, AgentStatus } = require('../orchestrator/agent-contract');

const AGENT_ID = 'governance-agent';
const REQUIRED_AGENTS = ['lab-agent', 'history-agent', 'clinical-agent'];

const list = (value) => (Array.isArray(value) ? value : value ? [value] : []);

async function checkGovernance(context, allResults) {
  const results = allResults || {};
  const checks = [];
  const safetyFlags = [];
  let blocked = false;

  for (const agentId of REQUIRED_AGENTS) {
    const entry = results[agentId] || results[`${agentId}-v1`];
    if (!entry) {
      checks.push({ check: `${agentId}:present`, passed: false });
      safetyFlags.push(`${agentId} produced no result`);
      blocked = true;
      continue;
    }
    const failed = entry.status === AgentStatus.FAILED || entry.status === 'ERROR';
    checks.push({ check: `${agentId}:completed`, passed: !failed });
    if (failed) {
      safetyFlags.push(`${agentId} failed`);
      blocked = true;
    }
    if (entry.status === AgentStatus.WARNING) safetyFlags.push(`${agentId} reported warnings`);
    if (String(entry.confidence).toLowerCase() === 'low') safetyFlags.push(`${agentId} confidence is low`);
  }

  const lab = (results['lab-agent'] && results['lab-agent'].result) || {};
  const clinical = (results['clinical-agent'] && results['clinical-agent'].result) || {};
  const abnormalities = list(lab.abnormalities);
  const riskFlags = list(lab.riskFlags);
  if (abnormalities.length) safetyFlags.push(`${abnormalities.length} abnormal lab finding(s)`);
  if (riskFlags.length) safetyFlags.push(`${riskFlags.length} risk flag(s) raised`);

  const hasRecommendation = Boolean(clinical.recommendation);
  if (clinical.available === false) safetyFlags.push('Clinical decision support was unavailable; no AI recommendation to review');

  const disclaimerVerified = ['lab-agent', 'clinical-agent'].every(agentId => {
    const meta = (results[agentId] && results[agentId].metadata) || {};
    return typeof meta.disclaimer === 'string' && meta.disclaimer.length > 0;
  });
  checks.push({ check: 'disclaimer:present', passed: disclaimerVerified });
  if (!disclaimerVerified) safetyFlags.push('Clinical disclaimer missing from agent output');

  // AI-assisted clinical content is always reviewed by a person.
  const requiresHumanReview = !blocked;

  return new AgentResult({
    agentId: AGENT_ID,
    status: blocked ? AgentStatus.FAILED : AgentStatus.HUMAN_REVIEW_REQUIRED,
    confidence: 'high',
    result: {
      approved: !blocked,
      requiresHumanReview,
      hasRecommendation,
      safetyFlags,
      disclaimerVerified,
      checks,
    },
    errors: blocked ? ['Governance blocked this run: an upstream agent failed or produced no result.'] : [],
    metadata: { source: 'rule-engine', policyVersion: '1.0', runId: context && context.runId },
  });
}

module.exports = { checkGovernance, REQUIRED_AGENTS, AGENT_ID };
