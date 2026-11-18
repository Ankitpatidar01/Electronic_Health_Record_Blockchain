'use strict';

/**
 * Clinical Decision Support Agent adapter.
 *
 * Delegates to the Clinical AI Agent microservice (services/ai-agent,
 * POST /api/v1/agent/analyze-report). It never invents a recommendation: when the
 * service is not configured or cannot be reached, the result says so and
 * carries no clinical content, and governance then blocks auto-completion.
 */

const { AgentResult, AgentStatus } = require('../orchestrator/agent-contract');

const AGENT_ID = 'clinical-agent';
const DISCLAIMER = 'AI-generated decision support. Not a diagnosis. Must be reviewed by a licensed clinician.';

function serviceUrl() {
  return (process.env.CLINICAL_AI_AGENT_URL || '').replace(/\/$/, '');
}

function asLines(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(item => (typeof item === 'string' ? item : JSON.stringify(item)));
  return [typeof value === 'string' ? value : JSON.stringify(value)];
}

// Builds the text handed to the service from what the earlier agents found.
function buildReportText(labResult, historyResult) {
  const lab = (labResult && labResult.result) || {};
  const history = (historyResult && historyResult.result) || {};
  const lines = [
    ...asLines(lab.summary).map(text => `Lab summary: ${text}`),
    ...asLines(lab.findings).map(text => `Finding: ${text}`),
    ...asLines(lab.abnormalities).map(text => `Abnormality: ${text}`),
    ...asLines(lab.riskFlags).map(text => `Risk flag: ${text}`),
    ...asLines(history.trendSummary).map(text => `History trend: ${text}`),
  ];
  return lines.join('\n').slice(0, 6000);
}

function unavailable(reason, metadata = {}) {
  return new AgentResult({
    agentId: AGENT_ID,
    status: AgentStatus.WARNING,
    confidence: 'low',
    result: { available: false, recommendation: null, possibleRisks: [], nextSteps: [] },
    errors: [reason],
    metadata: { source: 'clinical-ai-agent', disclaimer: DISCLAIMER, ...metadata },
  });
}

async function runClinicalAgent(context, labResult, historyResult, options = {}) {
  const url = options.url !== undefined ? options.url : serviceUrl();
  const doFetch = options.fetchImpl || globalThis.fetch;
  if (!url) return unavailable('Clinical decision-support service is not configured (set CLINICAL_AI_AGENT_URL).');

  const reportText = buildReportText(labResult, historyResult);
  if (reportText.length < 10) return unavailable('No lab findings were available to analyse.');

  let attempt = 0;
  for (;;) {
    try {
      const res = await doFetch(`${url}/api/v1/agent/analyze-report`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          patient_id: String(context.patientId),
          report_text: reportText,
          report_type: (context.metadata && context.metadata.testCode) || 'General Lab Report',
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) {
        const error = new Error(`Clinical AI agent responded ${res.status}`);
        error.retryable = res.status >= 500;
        throw error;
      }
      const body = await res.json();
      const followups = Array.isArray(body.suggested_followups) ? body.suggested_followups : [];
      const abnormal = Array.isArray(body.abnormalities_flagged) ? body.abnormalities_flagged : [];
      return new AgentResult({
        agentId: AGENT_ID,
        status: AgentStatus.SUCCESS,
        confidence: abnormal.length ? 'medium' : 'high',
        result: {
          available: true,
          recommendation: followups.length ? followups.join(' ') : 'No follow-up was suggested for these findings.',
          possibleRisks: abnormal,
          nextSteps: followups,
          findings: Array.isArray(body.findings) ? body.findings : [],
          provenanceHash: body.provenance_hash || null,
        },
        metadata: { source: 'clinical-ai-agent', disclaimer: DISCLAIMER, runId: context.runId },
      });
    } catch (error) {
      const transient = error.retryable !== false && (error.retryable === true || error.name === 'TimeoutError' || error.name === 'TypeError');
      if (transient && attempt < 2) {
        attempt += 1;
        await new Promise(resolve => setTimeout(resolve, options.retryDelayMs !== undefined ? options.retryDelayMs : 400 * attempt));
        continue;
      }
      return unavailable(`Clinical decision-support service is unavailable: ${error.message}`, { attempts: attempt + 1 });
    }
  }
}

module.exports = { runClinicalAgent, buildReportText, AGENT_ID };
