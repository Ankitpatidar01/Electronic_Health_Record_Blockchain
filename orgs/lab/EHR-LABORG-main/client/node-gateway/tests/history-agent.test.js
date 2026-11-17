'use strict';

/**
 * Automated Test Suite for Patient History / Timeline Agent
 * 
 * Verifies all 8 mandatory acceptance test criteria:
 * 1. Successful History Retrieval
 * 2. Empty Patient History
 * 3. Invalid Context
 * 4. Chronological Ordering
 * 5. Longitudinal Trend Analysis
 * 6. Data-Access Failure Handling
 * 7. Patient Isolation Enforcement
 * 8. Missing or Inconsistent Data Handling
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { runHistoryAgent } = require('../agents/history-agent');

// Synthetic Test Fixtures
const MOCK_RECORDS = [
  {
    resultId: 'LAB-001',
    patientId: 'PAT-1001',
    testCode: 'CBC',
    collectedAt: '2026-01-10T09:00:00Z',
    status: 'REPORTED',
    resultData: {
      hemoglobin: '12.5 g/dL',
      wbc: '6000 /uL',
    },
  },
  {
    resultId: 'LAB-002',
    patientId: 'PAT-1001',
    testCode: 'CBC',
    collectedAt: '2026-03-15T10:30:00Z',
    status: 'REPORTED',
    resultData: {
      hemoglobin: '13.8 g/dL',
      wbc: '6200 /uL',
    },
  },
  {
    resultId: 'LAB-003',
    patientId: 'PAT-1001',
    testCode: 'VITALS',
    collectedAt: '2026-02-01T08:00:00Z',
    status: 'RECORDED',
    resultData: {
      'Blood Pressure': '130/85 mmHg',
      'Heart Rate': '72 bpm',
    },
  },
];

test('Test 1 — Successful History Retrieval: builds timeline and returns SUCCESS', async () => {
  const context = {
    patientId: 'PAT-1001',
    options: {
      dataProvider: async (pid) => MOCK_RECORDS.filter(r => r.patientId === pid),
    },
  };

  const result = await runHistoryAgent(context);

  assert.equal(result.status, 'SUCCESS');
  assert.equal(result.patientId, 'PAT-1001');
  assert.equal(result.historyCount, 3);
  assert.equal(result.timeline.length, 3);
  assert.ok(result.trendSummary.parametersAnalyzed > 0);
  assert.ok(result.metadata.executionTimeMs >= 0);
});

test('Test 2 — Empty Patient History: returns EMPTY contract without fabricating data', async () => {
  const context = {
    patientId: 'PAT-EMPTY-999',
    options: {
      dataProvider: async () => [],
    },
  };

  const result = await runHistoryAgent(context);

  assert.equal(result.status, 'EMPTY');
  assert.equal(result.patientId, 'PAT-EMPTY-999');
  assert.equal(result.historyCount, 0);
  assert.deepEqual(result.timeline, []);
  assert.equal(result.trendSummary.parametersAnalyzed, 0);
  assert.ok(result.warnings.length > 0);
});

test('Test 3 — Invalid Context: rejects missing or malformed patientId', async () => {
  // Case A: Null context
  const res1 = await runHistoryAgent(null);
  assert.equal(res1.status, 'ERROR');
  assert.equal(res1.error.code, 'INVALID_CONTEXT');

  // Case B: Missing patientId
  const res2 = await runHistoryAgent({});
  assert.equal(res2.status, 'ERROR');
  assert.equal(res2.error.code, 'INVALID_CONTEXT');

  // Case C: Unauthorized characters in patientId
  const res3 = await runHistoryAgent({ patientId: 'PAT<script>alert(1)</script>' });
  assert.equal(res3.status, 'ERROR');
  assert.equal(res3.error.code, 'INVALID_CONTEXT');
});

test('Test 4 — Chronological Ordering: sorts unsorted records ascendingly by timestamp', async () => {
  const unsorted = [
    { resultId: 'R3', patientId: 'P1', collectedAt: '2026-05-01T00:00:00Z', resultData: { v: '3' } },
    { resultId: 'R1', patientId: 'P1', collectedAt: '2026-01-01T00:00:00Z', resultData: { v: '1' } },
    { resultId: 'R2', patientId: 'P1', collectedAt: '2026-03-01T00:00:00Z', resultData: { v: '2' } },
  ];

  const context = {
    patientId: 'P1',
    options: { dataProvider: async () => unsorted },
  };

  const result = await runHistoryAgent(context);

  assert.equal(result.status, 'SUCCESS');
  assert.equal(result.timeline[0].sourceId, 'R1');
  assert.equal(result.timeline[1].sourceId, 'R2');
  assert.equal(result.timeline[2].sourceId, 'R3');
  assert.equal(result.timeline[0].date, '2026-01-01T00:00:00Z');
  assert.equal(result.timeline[2].date, '2026-05-01T00:00:00Z');
});

test('Test 5 — Longitudinal Trend Analysis: computes factual delta and direction', async () => {
  const trajectoryRecords = [
    { resultId: 'L1', patientId: 'P1', collectedAt: '2026-01-01T00:00:00Z', resultData: { hemoglobin: '11.0 g/dL' } },
    { resultId: 'L2', patientId: 'P1', collectedAt: '2026-02-01T00:00:00Z', resultData: { hemoglobin: '12.5 g/dL' } },
    { resultId: 'L3', patientId: 'P1', collectedAt: '2026-03-01T00:00:00Z', resultData: { hemoglobin: '13.8 g/dL' } },
  ];

  const context = {
    patientId: 'P1',
    options: { dataProvider: async () => trajectoryRecords },
  };

  const result = await runHistoryAgent(context);
  assert.equal(result.status, 'SUCCESS');

  const hbTrend = result.trendSummary.trends.find(t => t.parameter.toLowerCase() === 'hemoglobin');
  assert.ok(hbTrend);
  assert.equal(hbTrend.direction, 'INCREASING');
  assert.equal(hbTrend.firstValue, '11.0 g/dL');
  assert.equal(hbTrend.latestValue, '13.8 g/dL');
  assert.equal(hbTrend.delta, 2.8);
  assert.equal(hbTrend.unit, 'g/dL');
  assert.equal(hbTrend.observationCount, 3);
  assert.ok(hbTrend.factualStatement.includes('increased from 11.0 g/dL to 13.8 g/dL'));
});

test('Test 6 — Data-Access Failure: transparent error handling without crashing', async () => {
  const context = {
    patientId: 'P1',
    options: {
      dataProvider: async () => {
        throw new Error('Fabric gRPC connection timeout on peer0.lab');
      },
    },
  };

  const result = await runHistoryAgent(context);

  assert.equal(result.status, 'ERROR');
  assert.equal(result.error.code, 'DATA_ACCESS_FAILURE');
  assert.ok(result.error.message.includes('Fabric gRPC connection timeout'));
  assert.equal(result.historyCount, 0);
  assert.deepEqual(result.timeline, []);
});

test('Test 7 — Patient Isolation: drops foreign records and flags security warning', async () => {
  const contaminated = [
    { resultId: 'R-TARGET', patientId: 'PAT-ALPHA', collectedAt: '2026-01-01T00:00:00Z', resultData: { vitals: 'normal' } },
    { resultId: 'R-LEAKED', patientId: 'PAT-OTHER-PERSON', collectedAt: '2026-01-02T00:00:00Z', resultData: { vitals: 'confidential' } },
  ];

  const context = {
    patientId: 'PAT-ALPHA',
    options: { dataProvider: async () => contaminated },
  };

  const result = await runHistoryAgent(context);

  assert.equal(result.status, 'SUCCESS');
  assert.equal(result.historyCount, 1);
  assert.equal(result.timeline[0].sourceId, 'R-TARGET');
  assert.ok(!result.timeline.some(t => t.sourceId === 'R-LEAKED'));
  assert.ok(result.warnings.some(w => w.includes('isolation')));
});

test('Test 8 — Missing/Inconsistent Data: handles missing dates and null observations gracefully', async () => {
  const incompleteRecords = [
    { resultId: 'INCOMPLETE-1', patientId: 'P1', collectedAt: null, resultData: { glucose: '110 mg/dL' } },
    { resultId: 'INCOMPLETE-2', patientId: 'P1', collectedAt: 'invalid-date-string', resultData: null },
    { resultId: 'INCOMPLETE-3', patientId: 'P1', collectedAt: '2026-04-01T00:00:00Z', resultData: { glucose: null } },
  ];

  const context = {
    patientId: 'P1',
    options: { dataProvider: async () => incompleteRecords },
  };

  const result = await runHistoryAgent(context);

  assert.equal(result.status, 'SUCCESS');
  assert.equal(result.historyCount, 3);
  assert.ok(result.warnings.length > 0);
});
