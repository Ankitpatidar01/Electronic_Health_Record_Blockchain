'use strict';

// Analytics and block-explorer endpoints. Every figure is computed from live
// sources at request time: block events from the Fabric listener, timing
// events posted by the gateways, IPFS and agent telemetry, and ledger counts
// read through the observer identity. Nothing here is sample data: when a
// source is not connected the response says so and the figure is null.

const express = require('express');
const { createAuthenticate } = require('../middleware/authenticate');
const { canAccessPage } = require('../authorization');
const { badRequest, success } = require('../aggregation/query');

const TX_EVENTS = ['TRANSACTION_COMMITTED', 'TRANSACTION_FAILED', 'MVCC_CONFLICT', 'ENDORSEMENT_FAILED'];
const HOUR = 3600000;
const DAY = 86400000;
const MAX_RANGE = 366 * DAY;

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

function stats(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return { count: 0, avg: null, min: null, max: null, median: null, p95: null };
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    count: sorted.length,
    avg: Math.round(sum / sorted.length),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median: percentile(sorted, 50),
    p95: percentile(sorted, 95),
  };
}

function countBy(items, keyOf) {
  const map = new Map();
  for (const item of items) {
    const key = keyOf(item) || 'unknown';
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

function parseRange(query, now = Date.now()) {
  const to = query.to ? Date.parse(query.to) : now;
  const from = query.from ? Date.parse(query.from) : to - DAY;
  if (!Number.isFinite(from) || !Number.isFinite(to)) throw badRequest('from and to must be valid date-times.');
  if (from >= to) throw badRequest('from must be earlier than to.');
  if (to - from > MAX_RANGE) throw badRequest('The range cannot be longer than one year.');
  let bucket = query.bucket;
  if (bucket !== undefined && !['hour', 'day'].includes(bucket)) throw badRequest('bucket must be hour or day.');
  if (!bucket) bucket = to - from <= 3 * DAY ? 'hour' : 'day';
  if (bucket === 'hour' && to - from > 31 * DAY) bucket = 'day';
  return { from, to, bucket, unit: bucket === 'hour' ? HOUR : DAY };
}

// Continuous buckets across the range, so charts show gaps as zero.
function makeBuckets({ from, to, unit }) {
  const buckets = new Map();
  for (let t = Math.floor(from / unit) * unit; t <= to; t += unit) buckets.set(t, null);
  return buckets;
}

function series(range, events, timeOf, fold, empty) {
  const buckets = makeBuckets(range);
  for (const key of buckets.keys()) buckets.set(key, empty());
  for (const event of events) {
    const key = Math.floor(timeOf(event) / range.unit) * range.unit;
    if (buckets.has(key)) fold(buckets.get(key), event);
  }
  return [...buckets.entries()].map(([t, value]) => ({ timestamp: new Date(t).toISOString(), ...value }));
}

const shortFn = (name) => String(name || 'unknown').replace(/^[A-Za-z]+Contract:/, '');

function createAnalyticsRouter(config) {
  const router = express.Router();
  router.use(createAuthenticate(config.authorization));
  router.use((req, res, next) => (canAccessPage(req.dashboardUser, 'transactions', config.authorization)
    ? next()
    : res.status(403).json({ success: false, error: 'Role is not permitted to access this dashboard resource.' })));

  const inRange = (range, eventTypes) => config.store.query({
    eventTypes, since: new Date(range.from).toISOString(), until: new Date(range.to).toISOString(), sort: 'asc', limit: 1000000,
  });

  router.get('/analytics/summary', async (req, res, next) => {
    try {
      const range = parseRange(req.query);
      const collector = config.collector?.getStatus?.() || { status: 'NOT_CONNECTED', lastProcessedBlock: null, currentHeight: null };

      // ── Ledger counts ──
      let ledger = null;
      let ledgerReason = null;
      try {
        ledger = await config.collector?.getLedgerStats?.() || null;
        if (!ledger) ledgerReason = 'The dashboard is not connected to a Fabric peer.';
      } catch (error) {
        ledgerReason = 'Ledger counts could not be read from the peer.';
        config.logger?.warn?.('Ledger stats failed', { error: error.message });
      }

      // ── Network health ──
      const targets = Object.values(config.healthPoller?.getStatus?.().targets || {});
      const up = targets.filter((t) => (t.status || t) === 'UP').length;

      // ── Transactions (from committed blocks) ──
      const txEvents = inRange(range, TX_EVENTS);
      const committed = txEvents.filter((e) => e.eventType === 'TRANSACTION_COMMITTED').length;
      const failed = txEvents.length - committed;
      const seconds = (range.to - range.from) / 1000;
      const txSeries = series(range, txEvents, (e) => Date.parse(e.timestamp),
        (b, e) => {
          b.total += 1;
          if (e.eventType === 'TRANSACTION_COMMITTED') b.committed += 1; else b.failed += 1;
          b[e.org] = (b[e.org] || 0) + 1;
        },
        () => ({ total: 0, committed: 0, failed: 0 }));
      const peak = txSeries.reduce((m, b) => Math.max(m, b.total), 0);

      // ── Submit → commit time (reported by the gateways) ──
      const timed = inRange(range, ['TRANSACTION_TIMED']);
      const timedOk = timed.filter((e) => e.payload.status === 'COMMITTED');
      const byFunction = new Map();
      for (const e of timedOk) {
        const key = shortFn(e.payload.functionName);
        if (!byFunction.has(key)) byFunction.set(key, []);
        byFunction.get(key).push(e.payload.durationMs);
      }
      const latencySeries = series(range, timedOk, (e) => Date.parse(e.timestamp),
        (b, e) => { b.values.push(e.payload.durationMs); },
        () => ({ values: [] }))
        .map(({ timestamp, values }) => { const s = stats(values); return { timestamp, count: s.count, avg: s.avg, p95: s.p95 }; });

      // ── Blocks ──
      const blocks = (config.collector?.getRecentBlocks?.() || [])
        .filter((b) => { const t = Date.parse(b.timestamp); return t >= range.from && t <= range.to; })
        .sort((a, b) => a.blockNumber - b.blockNumber);
      const blockRows = blocks.map((b, i) => ({
        blockNumber: b.blockNumber, timestamp: b.timestamp, txCount: b.txCount,
        sizeBytes: Number.isFinite(b.sizeBytes) ? b.sizeBytes : null,
        intervalSec: i === 0 ? null : Math.max(0, Math.round((Date.parse(b.timestamp) - Date.parse(blocks[i - 1].timestamp)) / 1000)),
      }));
      const intervals = stats(blockRows.map((b) => b.intervalSec).filter((v) => v !== null));
      const sizes = stats(blockRows.map((b) => b.sizeBytes).filter((v) => v !== null));

      // ── IPFS ──
      const uploads = inRange(range, ['IPFS_UPLOAD_COMPLETED']);
      const retrievals = inRange(range, ['IPFS_RETRIEVAL_COMPLETED']);
      const ipfsFailures = inRange(range, ['IPFS_UPLOAD_FAILED', 'IPFS_RESOLUTION_FAILED']).length;
      let running = 0;
      const storageSeries = series(range, uploads, (e) => Date.parse(e.timestamp),
        (b, e) => { b.uploads += 1; b.bytes += e.payload.byteLength || 0; },
        () => ({ uploads: 0, bytes: 0 }))
        .map((b) => { running += b.bytes; return { ...b, cumulativeBytes: running }; });

      // ── Agents ──
      const agentEvents = inRange(range, ['AGENT_EXECUTION_COMPLETED', 'AGENT_EXECUTION_FAILED']);
      const byAgent = new Map();
      for (const e of agentEvents) {
        const id = e.payload.agentId || 'unknown';
        if (!byAgent.has(id)) byAgent.set(id, { completed: 0, failed: 0, durations: [] });
        const a = byAgent.get(id);
        if (e.eventType === 'AGENT_EXECUTION_COMPLETED') a.completed += 1; else a.failed += 1;
        if (Number.isFinite(e.payload.durationMs)) a.durations.push(e.payload.durationMs);
      }
      const dc = ledger?.diseaseCodes || null;

      res.json(success({
        range: { from: new Date(range.from).toISOString(), to: new Date(range.to).toISOString(), bucket: range.bucket },
        generatedAt: new Date().toISOString(),
        sources: {
          fabric: { status: collector.status, lastProcessedBlock: collector.lastProcessedBlock, currentHeight: collector.currentHeight },
          timing: { status: timed.length ? 'OK' : 'NO_DATA' },
          ledger: { status: ledger ? 'OK' : 'NOT_CONNECTED', reason: ledgerReason },
        },
        overview: {
          patients: ledger?.patients ?? null,
          records: ledger?.documents ?? null,
          visits: ledger?.visits?.total ?? null,
          labRequests: ledger?.labRequests?.total ?? null,
          transactions: txEvents.length,
          blockHeight: collector.currentHeight ?? null,
          organizations: config.topology.organizations.length,
          peers: config.topology.peers.length,
          healthTargetsUp: targets.length ? up : null,
          healthTargetsTotal: targets.length || null,
        },
        ledger,
        transactions: {
          total: txEvents.length, committed, failed,
          successRate: txEvents.length ? committed / txEvents.length : null,
          averageTps: txEvents.length ? txEvents.length / seconds : 0,
          peakPerBucket: peak,
          peakTps: peak / (range.unit / 1000),
          byType: countBy(txEvents, (e) => shortFn(e.payload.functionName)).slice(0, 20),
          byOrganization: countBy(txEvents, (e) => e.org),
          failuresByReason: countBy(txEvents.filter((e) => e.eventType !== 'TRANSACTION_COMMITTED'), (e) => e.payload.reasonCode || e.eventType),
          series: txSeries,
        },
        latency: {
          ...stats(timedOk.map((e) => e.payload.durationMs)),
          failedSubmissions: timed.length - timedOk.length,
          byFunction: [...byFunction.entries()].map(([name, values]) => ({ name, ...stats(values) })).sort((a, b) => b.count - a.count).slice(0, 20),
          series: latencySeries,
        },
        blocks: {
          count: blockRows.length,
          averageIntervalSec: intervals.avg, medianIntervalSec: intervals.median,
          averageTxPerBlock: blockRows.length ? Number((blockRows.reduce((n, b) => n + b.txCount, 0) / blockRows.length).toFixed(2)) : null,
          averageSizeBytes: sizes.avg, maxSizeBytes: sizes.max,
          series: blockRows.slice(-200),
        },
        ipfs: {
          uploads: { ...stats(uploads.map((e) => e.payload.durationMs)), totalBytes: uploads.reduce((n, e) => n + (e.payload.byteLength || 0), 0) },
          retrievals: { ...stats(retrievals.map((e) => e.payload.durationMs)), totalBytes: retrievals.reduce((n, e) => n + (e.payload.byteLength || 0), 0) },
          failures: ipfsFailures,
          series: storageSeries,
        },
        agents: {
          items: [...byAgent.entries()].map(([agentId, a]) => ({
            agentId, executions: a.completed + a.failed, completed: a.completed, failed: a.failed, responseMs: stats(a.durations),
          })).sort((a, b) => b.executions - a.executions),
          codeMatch: dc ? {
            doctorDecisions: dc.doctorDecisions,
            decisionsWithAiSuggestion: dc.decisionsWithAiSuggestion,
            matchedAiSuggestion: dc.matchedAiSuggestion,
            aiMatchRate: dc.decisionsWithAiSuggestion ? dc.matchedAiSuggestion / dc.decisionsWithAiSuggestion : null,
            matchedProvisional: dc.matchedProvisional,
            provisionalMatchRate: dc.doctorDecisions ? dc.matchedProvisional / dc.doctorDecisions : null,
          } : null,
        },
      }));
    } catch (error) {
      next(error);
    }
  });

  // ── Block explorer ──
  router.get('/explorer/blocks', (req, res, next) => {
    try {
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '25', 10) || 25));
      const before = req.query.before !== undefined ? parseInt(req.query.before, 10) : null;
      if (req.query.before !== undefined && !Number.isSafeInteger(before)) throw badRequest('before must be a block number.');
      const all = config.collector?.getRecentBlocks?.() || [];
      const items = all.filter((b) => before === null || b.blockNumber < before).slice(0, limit)
        .map(({ txIds, ...b }) => ({ ...b, sizeBytes: b.sizeBytes ?? null }));
      res.json(success({
        items, total: all.length,
        collector: config.collector?.getStatus?.() || { status: 'NOT_CONNECTED' },
      }));
    } catch (error) { next(error); }
  });

  router.get('/explorer/blocks/:number', (req, res, next) => {
    try {
      const number = parseInt(req.params.number, 10);
      if (!/^\d{1,15}$/.test(req.params.number)) throw badRequest('Block number is invalid.');
      const block = (config.collector?.getRecentBlocks?.() || []).find((b) => b.blockNumber === number);
      if (!block) return res.status(404).json({ success: false, error: `Block ${number} is not available from the collector.` });
      const events = config.store.query({ eventTypes: TX_EVENTS, sort: 'asc', limit: 1000000 }).filter((e) => e.blockNumber === number);
      const byTx = new Map(events.map((e) => [e.txId, e]));
      const transactions = (block.txIds || []).map((txId) => {
        const e = byTx.get(txId);
        return e ? {
          txId, type: shortFn(e.payload.functionName), contract: String(e.payload.functionName || '').split(':')[0] || null,
          chaincode: e.payload.chaincode, organization: e.org, timestamp: e.timestamp,
          valid: e.eventType === 'TRANSACTION_COMMITTED', validationCode: e.payload.validationCode, reason: e.payload.reasonCode || null,
        } : { txId, type: 'Configuration or system transaction', contract: null, chaincode: null, organization: null, timestamp: block.timestamp, valid: true, validationCode: 0, reason: null };
      });
      const { txIds, ...summary } = block;
      return res.json(success({ ...summary, sizeBytes: block.sizeBytes ?? null, transactions }));
    } catch (error) { return next(error); }
  });

  router.get('/explorer/transactions/:txId', (req, res, next) => {
    try {
      if (!/^[A-Za-z0-9]{16,128}$/.test(req.params.txId)) throw badRequest('Transaction ID is invalid.');
      const e = config.store.query({ txId: req.params.txId, eventTypes: TX_EVENTS, limit: 5 })[0];
      if (!e) return res.status(404).json({ success: false, error: 'Transaction not found in the collected blocks.' });
      return res.json(success({
        txId: e.txId, blockNumber: e.blockNumber, channel: e.channel,
        type: shortFn(e.payload.functionName), contract: String(e.payload.functionName || '').split(':')[0] || null,
        chaincode: e.payload.chaincode, organization: e.org, timestamp: e.timestamp,
        valid: e.eventType === 'TRANSACTION_COMMITTED', validationCode: e.payload.validationCode, reason: e.payload.reasonCode || null,
      }));
    } catch (error) { return next(error); }
  });

  return router;
}

module.exports = { createAnalyticsRouter, stats, percentile, parseRange };
