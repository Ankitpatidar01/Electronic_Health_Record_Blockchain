'use strict';

/**
 * PATIENT HISTORY / TIMELINE AGENT
 * 
 * Component: Patient History & Longitudinal Trend Analysis
 * Ownership: Abdullah
 * Architectural Scope: client/node-gateway/agents/history-agent.js
 * 
 * Responsibilities:
 * 1. Validate incoming AgentContext and ensure patientId availability.
 * 2. Retrieve historical patient records through approved data-access interfaces.
 * 3. Enforce strict patient isolation and PHI minimization.
 * 4. Organize clinical records into a chronological timeline with date/unit preservation.
 * 5. Compute factual longitudinal parameter trends (non-diagnostic, evidence-based).
 * 6. Return a deterministic AgentResult contract.
 */

const { randomUUID } = require('crypto');

const AGENT_ID = 'history-agent';

/**
 * Emit non-blocking telemetry event to the Dashboard API if configured.
 * Strictly adheres to Zero-PHI rules (no patient names or clinical narrative).
 * @param {string} eventType - AGENT_EXECUTION_STARTED, AGENT_EXECUTION_COMPLETED, AGENT_EXECUTION_FAILED
 * @param {Object} payload - Allowed scalar fields: { agentId, status, durationMs, errorCode, fallbackUsed }
 */
function emitDashboardTelemetry(eventType, payload = {}) {
  const baseUrl = process.env.DASHBOARD_EVENT_API_URL;
  const serviceKey = process.env.DASHBOARD_SERVICE_KEY;
  const org = process.env.DASHBOARD_EVENT_ORG || 'HospitalMSP';

  if (!baseUrl || !serviceKey || !['HospitalMSP', 'DiagnosticsMSP', 'ProviderMSP'].includes(org)) {
    return; // Safely no-op if dashboard is unconfigured
  }

  const event = {
    schemaVersion: 1,
    eventId: `history-agent-${randomUUID()}`,
    eventType,
    timestamp: new Date().toISOString(),
    source: 'history-agent-emitter',
    org,
    severity: eventType === 'AGENT_EXECUTION_FAILED' ? 'WARNING' : 'INFO',
    payload: {
      agentId: 'history-agent',
      ...payload,
    },
  };

  if (typeof fetch === 'function') {
    void fetch(`${baseUrl.replace(/\/$/, '')}/internal/events`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-dashboard-service-key': serviceKey,
      },
      body: JSON.stringify({ events: [event] }),
      signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(1000) : undefined,
    }).catch(() => {});
  }
}

/**
 * Validate incoming AgentContext.
 * @param {Object} context - AgentContext received from orchestrator.
 * @returns {Object} { isValid: boolean, error: string|null, patientId: string|null }
 */
function validateContext(context) {
  if (!context || typeof context !== 'object') {
    return {
      isValid: false,
      error: 'Invalid AgentContext: Context must be a valid non-null object.',
      patientId: null,
    };
  }

  const rawPatientId = context.patientId;
  if (!rawPatientId || typeof rawPatientId !== 'string' || !rawPatientId.trim()) {
    return {
      isValid: false,
      error: 'Invalid AgentContext: patientId is mandatory and must be a non-empty string.',
      patientId: null,
    };
  }

  const patientId = rawPatientId.trim();
  // Ensure patient identifier conforms to safe alphanumeric format
  if (!/^[a-zA-Z0-9_\-]+$/.test(patientId)) {
    return {
      isValid: false,
      error: `Invalid AgentContext: patientId '${patientId}' contains unauthorized characters.`,
      patientId: null,
    };
  }

  return { isValid: true, error: null, patientId };
}

/**
 * Parse an ISO date or timestamp string into epoch milliseconds.
 * Returns null if the timestamp is missing or unparseable.
 * @param {string|number} rawDate 
 * @returns {number|null}
 */
function parseDateToMs(rawDate) {
  if (!rawDate) return null;
  const ms = Date.parse(rawDate);
  return isNaN(ms) ? null : ms;
}

/**
 * Extract numeric value and unit from an observation value string.
 * Examples:
 *   "13.8 g/dL" -> { numeric: 13.8, unit: "g/dL" }
 *   "140/90 mmHg" -> { numeric: 140, unit: "mmHg" } (primary systolic)
 *   "REPORTED" -> { numeric: null, unit: null }
 * @param {any} val 
 * @returns {{ numeric: number|null, unit: string|null, raw: string }}
 */
function parseValueAndUnit(val) {
  if (val === null || val === undefined) {
    return { numeric: null, unit: null, raw: '' };
  }

  const str = String(val).trim();
  if (!str) {
    return { numeric: null, unit: null, raw: '' };
  }

  // Handle Blood Pressure compound values (e.g., "120/80 mmHg")
  const bpMatch = str.match(/^(\d{2,3})\s*\/\s*(\d{2,3})(?:\s*([a-zA-Z/]+))?/);
  if (bpMatch) {
    return {
      numeric: parseFloat(bpMatch[1]),
      secondaryNumeric: parseFloat(bpMatch[2]),
      unit: bpMatch[3] ? bpMatch[3].trim() : 'mmHg',
      raw: str,
    };
  }

  // Handle standard decimal or integer numbers with optional unit
  const numMatch = str.match(/^([+-]?\d+(?:\.\d+)?)(?:\s*([a-zA-Z/%°µ]+[a-zA-Z0-9/%°µ]*))?/);
  if (numMatch) {
    return {
      numeric: parseFloat(numMatch[1]),
      unit: numMatch[2] ? numMatch[2].trim() : null,
      raw: str,
    };
  }

  return { numeric: null, unit: null, raw: str };
}

/**
 * Transform raw records into a validated, sorted chronological timeline.
 * @param {Array} rawRecords - Records retrieved from authorized data interface.
 * @param {string} targetPatientId - Requested patient identifier for isolation check.
 * @returns {{ timeline: Array, warnings: Array, isolationViolations: number }}
 */
function buildTimeline(rawRecords, targetPatientId) {
  const warnings = [];
  const validEntries = [];
  let isolationViolations = 0;

  if (!Array.isArray(rawRecords)) {
    return { timeline: [], warnings: ['Data source did not return an array.'], isolationViolations: 0 };
  }

  for (let i = 0; i < rawRecords.length; i++) {
    const record = rawRecords[i];
    if (!record || typeof record !== 'object') {
      warnings.push(`Record at index ${i} is null or malformed; discarded.`);
      continue;
    }

    // 1. Strict Patient Isolation Check
    const recordPid = record.patientId || record.patient_id;
    if (recordPid && String(recordPid).trim().toLowerCase() !== targetPatientId.toLowerCase()) {
      isolationViolations++;
      continue; // Strictly discard foreign patient record
    }

    // 2. Timestamp Resolution
    const rawDate = record.collectedAt || record.timestamp || record.createdAt || record.date;
    const epochMs = parseDateToMs(rawDate);
    if (epochMs === null) {
      warnings.push(`Record '${record.resultId || i}' has missing or unparseable timestamp; ordering preserved as best-effort.`);
    }

    // 3. Observations Extraction
    const observations = [];
    const rawData = record.resultData || record.observations || record.data || {};

    if (typeof rawData === 'object' && rawData !== null) {
      for (const [key, rawVal] of Object.entries(rawData)) {
        const parsed = parseValueAndUnit(rawVal);
        observations.push({
          parameter: key.trim(),
          value: parsed.raw,
          numericValue: parsed.numeric,
          unit: parsed.unit,
        });
      }
    }

    validEntries.push({
      _sortKey: epochMs !== null ? epochMs : 0,
      date: rawDate || 'UNKNOWN_DATE',
      recordType: record.testCode ? 'LAB_RESULT' : 'CLINICAL_RECORD',
      sourceId: String(record.resultId || record.id || `rec-${i}`),
      testCode: record.testCode || 'GENERAL',
      status: String(record.status || 'RECORDED'),
      observations,
    });
  }

  if (isolationViolations > 0) {
    warnings.push(`Patient isolation check filtered out ${isolationViolations} record(s) belonging to another patient.`);
  }

  // 4. Chronological Sorting (Ascending: oldest to newest)
  validEntries.sort((a, b) => a._sortKey - b._sortKey);

  // Remove internal sort key from public output
  const timeline = validEntries.map(({ _sortKey, ...rest }) => rest);

  return { timeline, warnings, isolationViolations };
}

/**
 * Perform factual, evidence-based longitudinal trend analysis.
 * Non-diagnostic and non-prescriptive.
 * @param {Array} timeline - Chronological timeline array.
 * @returns {Object} Trend summary.
 */
function analyzeTrends(timeline) {
  const parameterHistory = new Map();

  // 1. Group measurements by normalized parameter name
  for (const entry of timeline) {
    for (const obs of entry.observations) {
      if (!obs.parameter) continue;
      const paramKey = obs.parameter.toLowerCase();
      if (!parameterHistory.has(paramKey)) {
        parameterHistory.set(paramKey, {
          displayName: obs.parameter,
          snapshots: [],
        });
      }

      parameterHistory.get(paramKey).snapshots.push({
        date: entry.date,
        value: obs.value,
        numeric: obs.numericValue,
        unit: obs.unit,
      });
    }
  }

  const trends = [];
  const notablePatterns = [];

  // 2. Compute longitudinal trajectory for each parameter
  for (const [, { displayName, snapshots }] of parameterHistory.entries()) {
    const count = snapshots.length;
    if (count === 0) continue;

    const first = snapshots[0];
    const latest = snapshots[count - 1];
    const unit = latest.unit || first.unit || null;

    if (count === 1) {
      trends.push({
        parameter: displayName,
        direction: 'INSUFFICIENT_DATA',
        firstValue: first.value,
        latestValue: latest.value,
        delta: null,
        unit,
        observationCount: 1,
        factualStatement: `Single observation recorded (${latest.value}). Additional observations required to evaluate longitudinal trend.`,
      });
      continue;
    }

    // Multiple observations: inspect numeric trajectory
    const hasValidNumerics = first.numeric !== null && latest.numeric !== null;
    let direction = 'STABLE';
    let delta = null;
    let statement = '';

    if (hasValidNumerics) {
      delta = parseFloat((latest.numeric - first.numeric).toFixed(2));
      if (delta > 0) {
        direction = 'INCREASING';
        statement = `${displayName} increased from ${first.value} to ${latest.value} (+${delta}${unit ? ' ' + unit : ''}) across ${count} observation(s).`;
      } else if (delta < 0) {
        direction = 'DECREASING';
        statement = `${displayName} decreased from ${first.value} to ${latest.value} (${delta}${unit ? ' ' + unit : ''}) across ${count} observation(s).`;
      } else {
        direction = 'STABLE';
        statement = `${displayName} remained stable at ${latest.value} across ${count} observation(s).`;
      }

      // Check for fluctuations between intermediate points
      if (count > 2) {
        let prevNum = first.numeric;
        let upCount = 0;
        let downCount = 0;
        for (let i = 1; i < count; i++) {
          const curr = snapshots[i].numeric;
          if (curr !== null) {
            if (curr > prevNum) upCount++;
            if (curr < prevNum) downCount++;
            prevNum = curr;
          }
        }
        if (upCount > 0 && downCount > 0) {
          direction = 'FLUCTUATING';
          statement = `${displayName} exhibited longitudinal fluctuation between ${first.value} and ${latest.value} across ${count} observation(s).`;
        }
      }
    } else {
      direction = 'STABLE';
      statement = `${displayName} recorded across ${count} observation(s) from ${first.date} to ${latest.date}.`;
    }

    trends.push({
      parameter: displayName,
      direction,
      firstValue: first.value,
      latestValue: latest.value,
      delta,
      unit,
      observationCount: count,
      factualStatement: statement,
    });

    if (direction === 'INCREASING' || direction === 'DECREASING' || direction === 'FLUCTUATING') {
      notablePatterns.push(statement);
    }
  }

  return {
    parametersAnalyzed: trends.length,
    trends,
    notablePatterns,
  };
}

/**
 * Execute the Patient History / Timeline Agent.
 * @param {Object} context - AgentContext containing patientId and optional options.
 * @returns {Promise<Object>} AgentResult contract.
 */
async function runHistoryAgent(context) {
  const startTime = Date.now();
  const validation = validateContext(context);

  // 1. Context Validation Check
  if (!validation.isValid) {
    emitDashboardTelemetry('AGENT_EXECUTION_FAILED', {
      status: 'FAILED',
      errorCode: 'INVALID_CONTEXT',
    });
    return {
      status: 'ERROR',
      agentId: AGENT_ID,
      patientId: validation.patientId || 'UNKNOWN',
      historyCount: 0,
      timeline: [],
      trendSummary: { parametersAnalyzed: 0, trends: [], notablePatterns: [] },
      warnings: [],
      error: {
        code: 'INVALID_CONTEXT',
        message: validation.error,
      },
      metadata: {
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
    };
  }

  const { patientId } = validation;
  emitDashboardTelemetry('AGENT_EXECUTION_STARTED', { status: 'RUNNING' });
  let rawRecords = [];
  const warnings = [];

  // 2. Authorized Data Access
  try {
    if (context.options && typeof context.options.dataProvider === 'function') {
      // Injected test / mock data provider
      rawRecords = await context.options.dataProvider(patientId);
    } else {
      // Approved gateway interface
      let gateway = null;
      try {
        gateway = require('../gateway');
      } catch (requireErr) {
        warnings.push(`Gateway module notice: ${requireErr.message}. Checking resilient fallback.`);
      }

      if (gateway && typeof gateway.getLabResultsByPatient === 'function') {
        const response = await gateway.getLabResultsByPatient(patientId, context.options || {});
        rawRecords = response && response.result ? response.result : response;
      } else {
        // Built-in resilient fallback records matching gateway.js localRecords
        if (patientId === 'PAT-DEMO-001') {
          rawRecords = [
            {
              resultId: 'labresult1',
              patientId: 'PAT-DEMO-001',
              testCode: 'CBC',
              collectedAt: '2026-10-14T08:00:00Z',
              status: 'REPORTED',
              resultData: {
                hemoglobin: '13.8 g/dL',
                wbc: '6200 /uL',
                platelets: '250000 /uL',
              },
            },
            {
              resultId: 'labresult3',
              patientId: 'PAT-DEMO-001',
              testCode: 'CBC',
              collectedAt: '2026-11-01T08:30:00Z',
              status: 'REPORTED',
              resultData: {
                hemoglobin: '14.2 g/dL',
                wbc: '6100 /uL',
                platelets: '260000 /uL',
              },
            },
          ];
          warnings.push('Used resilient local records for PAT-DEMO-001.');
        } else {
          throw new Error('Approved interface getLabResultsByPatient is not available on gateway module.');
        }
      }
    }
  } catch (dataErr) {
    emitDashboardTelemetry('AGENT_EXECUTION_FAILED', {
      status: 'FAILED',
      errorCode: 'DATA_ACCESS_FAILURE',
    });
    return {
      status: 'ERROR',
      agentId: AGENT_ID,
      patientId,
      historyCount: 0,
      timeline: [],
      trendSummary: { parametersAnalyzed: 0, trends: [], notablePatterns: [] },
      warnings,
      error: {
        code: 'DATA_ACCESS_FAILURE',
        message: `Failed to retrieve patient history from approved interface: ${dataErr.message}`,
      },
      metadata: {
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // Normalize retrieved payload to array
  const recordList = Array.isArray(rawRecords) ? rawRecords : (rawRecords ? [rawRecords] : []);

  // 3. Handle Empty History Explicitly
  if (recordList.length === 0) {
    emitDashboardTelemetry('AGENT_EXECUTION_COMPLETED', {
      status: 'DONE',
      durationMs: Date.now() - startTime,
    });
    return {
      status: 'EMPTY',
      agentId: AGENT_ID,
      patientId,
      historyCount: 0,
      timeline: [],
      trendSummary: { parametersAnalyzed: 0, trends: [], notablePatterns: [] },
      warnings: ['No prior clinical records found for the requested patient identifier.'],
      metadata: {
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // 4. Chronological Timeline Construction & Patient Isolation
  const timelineResult = buildTimeline(recordList, patientId);
  const combinedWarnings = warnings.concat(timelineResult.warnings);

  // If all records were filtered out due to patient isolation violation
  if (timelineResult.timeline.length === 0) {
    emitDashboardTelemetry('AGENT_EXECUTION_COMPLETED', {
      status: 'DONE',
      durationMs: Date.now() - startTime,
    });
    return {
      status: 'EMPTY',
      agentId: AGENT_ID,
      patientId,
      historyCount: 0,
      timeline: [],
      trendSummary: { parametersAnalyzed: 0, trends: [], notablePatterns: [] },
      warnings: combinedWarnings,
      metadata: {
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // 5. Longitudinal Factual Trend Analysis
  const trendSummary = analyzeTrends(timelineResult.timeline);

  // 6. Return Structured AgentResult
  emitDashboardTelemetry('AGENT_EXECUTION_COMPLETED', {
    status: 'DONE',
    durationMs: Date.now() - startTime,
  });

  return {
    status: 'SUCCESS',
    agentId: AGENT_ID,
    patientId,
    historyCount: timelineResult.timeline.length,
    timeline: timelineResult.timeline,
    trendSummary,
    warnings: combinedWarnings,
    metadata: {
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    },
  };
}

module.exports = {
  runHistoryAgent,
  validateContext,
  buildTimeline,
  analyzeTrends,
  AGENT_ID,
};
