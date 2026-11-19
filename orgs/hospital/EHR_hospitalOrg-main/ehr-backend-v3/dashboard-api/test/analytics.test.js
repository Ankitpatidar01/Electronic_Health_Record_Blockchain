'use strict';

// Analytics and explorer endpoints over real HTTP, fed through the same ingest
// route the gateways use.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const authorization = require('../config/authorization.json');
const topology = require('../config/topology.json');
const { createApp } = require('../src/app');
const { NdjsonEventStore } = require('../src/store/NdjsonEventStore');
const { StreamTicketStore } = require('../src/realtime/StreamTicketStore');
const { MetricsService } = require('../src/aggregation/metrics');
const { stats, parseRange } = require('../src/routes/analytics');

const organizations = ['HospitalMSP', 'DiagnosticsMSP', 'ProviderMSP'];
const secret = 'analytics-test-secret';
const serviceKey = 'analytics-service-key';
const TX1 = 'a'.repeat(64);
const TX2 = 'b'.repeat(64);

test('stats computes avg, min, max, median and p95', () => {
  const s = stats([10, 20, 30, 40, 1000]);
  assert.deepEqual(s, { count: 5, avg: 220, min: 10, max: 1000, median: 30, p95: 1000 });
  assert.deepEqual(stats([]), { count: 0, avg: null, min: null, max: null, median: null, p95: null });
  const many = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.equal(stats(many).p95, 95);
  assert.equal(stats(many).median, 50);
});

test('parseRange validates input and picks a bucket', () => {
  const now = Date.parse('2026-11-19T12:00:00Z');
  assert.equal(parseRange({}, now).bucket, 'hour');
  assert.equal(parseRange({ from: '2026-10-01T00:00:00Z', to: '2026-11-01T00:00:00Z' }, now).bucket, 'day');
  assert.throws(() => parseRange({ from: 'nope' }, now), /valid date-times/);
  assert.throws(() => parseRange({ from: '2026-11-02T00:00:00Z', to: '2026-11-01T00:00:00Z' }, now), /earlier/);
  assert.throws(() => parseRange({ bucket: 'minute' }, now), /bucket/);
});

test('summary and explorer are computed from ingested events and collector state', async (t) => {
  const originalLog = console.log;
  console.log = () => {};
  t.after(() => { console.log = originalLog; });
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'dashboard-analytics-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const store = await NdjsonEventStore.open({ directory, organizations });
  const previous = process.env.DASHBOARD_JWT_SECRETS;
  process.env.DASHBOARD_JWT_SECRETS = secret;

  const now = Date.now();
  const iso = (offsetMs) => new Date(now - offsetMs).toISOString();
  const blocks = [
    { blockNumber: 7, blockHash: 'h7', previousHash: 'h6', dataHash: 'd7', txCount: 1, sizeBytes: 4000, txIds: [TX1], timestamp: iso(120000), channel: 'ehrchannel' },
    { blockNumber: 8, blockHash: 'h8', previousHash: 'h7', dataHash: 'd8', txCount: 1, sizeBytes: 6000, txIds: [TX2], timestamp: iso(60000), channel: 'ehrchannel' },
  ];
  const ledger = {
    patients: 3, visits: { total: 4, byStatus: { OPEN: 4 } }, dids: 3, documents: 17,
    labRequests: { total: 2, byStatus: { APPROVED: 2 } },
    diseaseCodes: { patientsWithCode: 3, provisional: 1, confirmed: 2, doctorDecisions: 2, decisionsWithAiSuggestion: 2, matchedAiSuggestion: 1, matchedProvisional: 1 },
  };
  const app = createApp({
    authorization, store, tickets: new StreamTicketStore(), serviceKey, fabric: { organizations }, topology,
    heartbeatMonitor: { getAgentStates: () => ({}), accept: () => {} },
    healthPoller: { states: new Map(), getStatus: () => ({ status: 'CONNECTED', targets: { a: { status: 'UP' }, b: { status: 'DOWN' } } }) },
    collector: {
      getStatus: () => ({ status: 'CONNECTED', lastProcessedBlock: '8', currentHeight: '9' }),
      getRecentBlocks: () => [...blocks].reverse(),
      getLedgerStats: async () => ledger,
    },
    eventHub: { publish: () => {} },
    metrics: new MetricsService({ store }), alertEngine: { list: () => [], acknowledge: async () => null },
    apiRateLimit: 10000, corsAllowedOrigins: [], ingestMaxBatchSize: 50, ingestRateLimit: 1000,
  });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await store.close();
    if (previous === undefined) delete process.env.DASHBOARD_JWT_SECRETS; else process.env.DASHBOARD_JWT_SECRETS = previous;
  });

  const base = (eventType, timestamp, extra) => ({
    schemaVersion: 1, eventId: `t-${Math.random().toString(36).slice(2)}${Date.now()}`, eventType, timestamp,
    source: 'peer0-api', org: 'HospitalMSP', severity: 'INFO', ...extra,
  });
  const CID = 'bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy';
  const events = [
    base('TRANSACTION_COMMITTED', iso(120000), { source: 'fabric-block-listener', txId: TX1, blockNumber: 7, channel: 'ehrchannel',
      payload: { chaincode: 'ehr', functionName: 'PatientContract:RegisterPatient', creatorMsp: 'HospitalMSP', validationCode: 0 } }),
    base('MVCC_CONFLICT', iso(60000), { source: 'fabric-block-listener', org: 'DiagnosticsMSP', severity: 'WARNING', txId: TX2, blockNumber: 8, channel: 'ehrchannel',
      payload: { chaincode: 'ehr', functionName: 'LabContract:SubmitLabResult', creatorMsp: 'DiagnosticsMSP', validationCode: 11, reasonCode: 'MVCC_READ_CONFLICT' } }),
    ...[100, 200, 300, 2000].map((durationMs) => base('TRANSACTION_TIMED', iso(90000), {
      payload: { component: 'peer0-api', chaincode: 'ehr', functionName: 'PatientContract:RegisterPatient', creatorMsp: 'HospitalMSP', status: 'COMMITTED', durationMs, submitMs: now - 90000 - durationMs, commitMs: now - 90000 } })),
    base('TRANSACTION_TIMED', iso(80000), { severity: 'WARNING',
      payload: { component: 'peer0-api', chaincode: 'ehr', functionName: 'VisitContract:OpenVisit', creatorMsp: 'HospitalMSP', status: 'FAILED', errorCode: 'ACCESS_DENIED', durationMs: 50, submitMs: now - 80050, commitMs: now - 80000 } }),
    base('IPFS_UPLOAD_COMPLETED', iso(70000), { source: 'ipfs-service', payload: { component: 'ipfs-service', status: 'OK', durationMs: 40, byteLength: 1500, cid: CID } }),
    base('IPFS_RETRIEVAL_COMPLETED', iso(65000), { source: 'ipfs-service', payload: { component: 'ipfs-service', status: 'OK', durationMs: 12, byteLength: 1500, cid: CID } }),
    base('AGENT_EXECUTION_COMPLETED', iso(60000), { payload: { agentId: 'symptom-agent', status: 'COMPLETED', durationMs: 1800, model: 'gemini-2.5-flash' } }),
    base('AGENT_EXECUTION_FAILED', iso(50000), { severity: 'WARNING', payload: { agentId: 'symptom-agent', status: 'FAILED', durationMs: 25000, errorCode: 'MODEL_UNAVAILABLE' } }),
  ];
  const ingest = await fetch(`${origin}/internal/events`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-dashboard-service-key': serviceKey }, body: JSON.stringify({ events }),
  });
  const ingestBody = await ingest.json();
  assert.deepEqual(ingestBody.results.filter((r) => !r.accepted), [], 'every event passes the envelope validator');

  const token = (role) => jwt.sign({ userId: `t-${role}`, role, mspId: 'HospitalMSP', peer: 'peer0.hospital' }, secret, { algorithm: 'HS256', expiresIn: '5m' });
  const get = (route, role = 'admin') => fetch(`${origin}/api/dashboard${route}`, { headers: role ? { authorization: `Bearer ${token(role)}` } : {} });

  assert.equal((await get('/analytics/summary', null)).status, 401);
  assert.equal((await get('/analytics/summary', 'nurse')).status, 403);
  assert.equal((await get('/analytics/summary?from=bad')).status, 400);

  const response = await get('/analytics/summary');
  assert.equal(response.status, 200);
  const data = (await response.json()).data;

  assert.equal(data.sources.fabric.status, 'CONNECTED');
  assert.deepEqual(
    { p: data.overview.patients, r: data.overview.records, tx: data.overview.transactions, up: data.overview.healthTargetsUp, of: data.overview.healthTargetsTotal, h: data.overview.blockHeight },
    { p: 3, r: 17, tx: 2, up: 1, of: 2, h: '9' });
  assert.equal(data.transactions.committed, 1);
  assert.equal(data.transactions.failed, 1);
  assert.equal(data.transactions.successRate, 0.5);
  assert.deepEqual(data.transactions.byType.map((x) => x.name).sort(), ['RegisterPatient', 'SubmitLabResult']);
  assert.deepEqual(data.transactions.byOrganization.map((x) => x.name).sort(), ['DiagnosticsMSP', 'HospitalMSP']);
  assert.equal(data.transactions.series.reduce((n, b) => n + b.total, 0), 2);

  assert.deepEqual(
    { c: data.latency.count, avg: data.latency.avg, min: data.latency.min, max: data.latency.max, med: data.latency.median, p95: data.latency.p95, f: data.latency.failedSubmissions },
    { c: 4, avg: 650, min: 100, max: 2000, med: 200, p95: 2000, f: 1 });
  assert.equal(data.latency.byFunction[0].name, 'RegisterPatient');

  assert.equal(data.blocks.count, 2);
  assert.equal(data.blocks.averageIntervalSec, 60);
  assert.equal(data.blocks.averageSizeBytes, 5000);
  assert.equal(data.blocks.averageTxPerBlock, 1);

  assert.equal(data.ipfs.uploads.count, 1);
  assert.equal(data.ipfs.uploads.totalBytes, 1500);
  assert.equal(data.ipfs.retrievals.avg, 12);
  assert.equal(data.ipfs.series.at(-1).cumulativeBytes, 1500);

  const agent = data.agents.items.find((a) => a.agentId === 'symptom-agent');
  assert.deepEqual({ e: agent.executions, c: agent.completed, f: agent.failed }, { e: 2, c: 1, f: 1 });
  assert.equal(data.agents.codeMatch.aiMatchRate, 0.5);

  // Explorer
  const list = (await (await get('/explorer/blocks?limit=1')).json()).data;
  assert.equal(list.items.length, 1);
  assert.equal(list.items[0].blockNumber, 8);
  assert.equal(list.items[0].txIds, undefined);

  const block = (await (await get('/explorer/blocks/8')).json()).data;
  assert.equal(block.transactions.length, 1);
  assert.deepEqual(
    { id: block.transactions[0].txId, type: block.transactions[0].type, org: block.transactions[0].organization, valid: block.transactions[0].valid },
    { id: TX2, type: 'SubmitLabResult', org: 'DiagnosticsMSP', valid: false });
  assert.equal((await get('/explorer/blocks/999')).status, 404);
  assert.equal((await get('/explorer/blocks/abc')).status, 400);

  const tx = (await (await get(`/explorer/transactions/${TX1}`)).json()).data;
  assert.deepEqual({ b: tx.blockNumber, type: tx.type, contract: tx.contract, valid: tx.valid }, { b: 7, type: 'RegisterPatient', contract: 'PatientContract', valid: true });
  assert.equal((await get(`/explorer/transactions/${'c'.repeat(64)}`)).status, 404);

  // Existing routes still answer.
  assert.equal((await get('/overview')).status, 200);
});
