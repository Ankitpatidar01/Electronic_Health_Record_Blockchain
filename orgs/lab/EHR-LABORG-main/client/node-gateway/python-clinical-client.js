'use strict';

const PYTHON_API_URL =
  (process.env.PYTHON_CLINICAL_API_URL ||
    'http://127.0.0.1:8001').replace(/\/+$/, '');

async function runPythonClinicalReview({
  resultData,
  patientId,
  patientHistory = [],
  historyResult,
  reportText = '',
  authToken,
  runId,
}) {
  if (!patientId || !String(patientId).trim()) {
    throw new Error('patientId is required for Python clinical review.');
  }

  // Preserve the complete Hospital Agent response.
  // Older callers using patientHistory remain supported.
  let normalizedHistory;

  if (Array.isArray(historyResult)) {
    normalizedHistory = { records: historyResult };
  } else if (
    historyResult &&
    typeof historyResult === 'object'
  ) {
    normalizedHistory = { ...historyResult };
  } else {
    normalizedHistory = {
      records: Array.isArray(patientHistory) ? patientHistory : [],
    };
  }

  normalizedHistory.report_text =
    normalizedHistory.report_text || reportText || '';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(
      `${PYTHON_API_URL}/api/clinical-review`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}` } : {}),
        },
        signal: controller.signal,
        body: JSON.stringify({
          patient_id: String(patientId),
          lab_result: resultData || {},
          history_result: normalizedHistory,
          run_id: runId,
        }),
      }
    );

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(
        `Python clinical API returned HTTP ${response.status}: ` +
        responseText.slice(0, 1000)
      );
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new Error('Python clinical API returned invalid JSON.');
    }

    const clinical = result.clinical_result;

    if (!clinical || typeof clinical !== 'object') {
      throw new Error(
        'Python response does not contain clinical_result.'
      );
    }

    const generatedAt = new Date().toISOString();
    const recommendation = String(
      clinical.recommendation || 'Human clinical review required.'
    );

    return {
      ok: true,
      provider: 'python-fastapi',
      model: 'LangGraph clinical workflow',
      generatedAt,
      reportTextCharCount: String(reportText || '').length,

      labReportAnalysis: {
        summary: recommendation,
        abnormalities: Array.isArray(clinical.supportingEvidence)
          ? clinical.supportingEvidence
          : [],
        riskFlags: Array.isArray(clinical.possibleRisks)
          ? clinical.possibleRisks
          : [],
        confidence: 'unvalidated',
        source: 'python-fastapi',
      },

      clinicalDecisionSupport: {
        recommendation,
        possibleRisks: Array.isArray(clinical.possibleRisks)
          ? clinical.possibleRisks
          : [],
        nextSteps: Array.isArray(clinical.nextSteps)
          ? clinical.nextSteps
          : [],
        confidence: 'unvalidated',
        source: 'python-fastapi',
      },

      clinicalResult: clinical,
      reviewStatus: result.review_status || 'PENDING_HUMAN_REVIEW',
      disclaimer:
        'AI-generated clinical support only. A qualified clinician must review the result.',
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Python clinical API timed out after 60 seconds.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { runPythonClinicalReview };
