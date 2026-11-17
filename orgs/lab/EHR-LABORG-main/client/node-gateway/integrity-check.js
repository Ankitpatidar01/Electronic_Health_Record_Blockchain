'use strict';

// Scheduled Ledger-Integrity Re-Check.
// Detection only: re-fetches every IPFS payload anchored on-chain, recomputes its
// SHA-256 digest and compares it with the digest recorded at write time. It never
// repairs, re-pins or writes anything to the ledger.

const fs = require('fs');
const path = require('path');

const STATUS = {
  OK: 'OK',
  MISMATCH: 'MISMATCH',
  MISSING: 'MISSING',
};

// Every (cid, digest) pair a record anchors on-chain.
function collectTargets(resultData) {
  if (!resultData || resultData.storage !== 'ipfs') {
    return [];
  }

  const targets = [{ kind: 'payload', cid: resultData.cid, expected: resultData.digest }];

  if (resultData.reportFile) {
    targets.push({
      kind: 'reportFile',
      cid: resultData.reportFile.cid,
      expected: resultData.reportFile.digest,
    });
  }

  if (resultData.ai && resultData.ai.summaryCid) {
    targets.push({
      kind: 'aiSummary',
      cid: resultData.ai.summaryCid,
      expected: resultData.ai.summaryDigest,
    });
  }

  return targets;
}

function worstStatus(checks) {
  if (checks.some((check) => check.status === STATUS.MISSING)) {
    return STATUS.MISSING;
  }
  if (checks.some((check) => check.status === STATUS.MISMATCH)) {
    return STATUS.MISMATCH;
  }
  return STATUS.OK;
}

function createIntegrityChecker({ listRecords, fetchRaw, hash, intervalMs, logFile, logger = console }) {
  let lastReport = null;
  let running = null;
  let timer = null;

  function writeLog(entry) {
    if (!logFile) {
      return;
    }
    try {
      fs.mkdirSync(path.dirname(logFile), { recursive: true });
      fs.appendFileSync(logFile, `${JSON.stringify(entry)}\n`);
    } catch (error) {
      logger.warn(`[integrity] unable to write log file: ${error.message}`);
    }
  }

  async function checkTarget(target) {
    if (!target.cid || !target.expected) {
      return { ...target, actual: null, status: STATUS.MISSING, error: 'CID or digest missing on-chain' };
    }

    let bytes;
    try {
      bytes = await fetchRaw(target.cid);
    } catch (error) {
      return { ...target, actual: null, status: STATUS.MISSING, error: error.message };
    }

    const actual = hash(bytes);
    return {
      ...target,
      actual,
      status: actual === target.expected ? STATUS.OK : STATUS.MISMATCH,
    };
  }

  async function execute(trigger) {
    const startedAt = new Date().toISOString();
    const records = [];
    let skipped = 0;

    try {
      const all = await listRecords();

      for (const record of all) {
        const targets = collectTargets(record.resultData);
        if (targets.length === 0) {
          skipped += 1;
          continue;
        }

        const checks = [];
        for (const target of targets) {
          checks.push(await checkTarget(target));
        }

        const status = worstStatus(checks);
        records.push({ resultId: record.resultId, patientId: record.patientId, status, checks });

        if (status !== STATUS.OK) {
          for (const check of checks.filter((c) => c.status !== STATUS.OK)) {
            const entry = {
              at: new Date().toISOString(),
              resultId: record.resultId,
              kind: check.kind,
              status: check.status,
              cid: check.cid,
              expected: check.expected,
              actual: check.actual,
              error: check.error,
            };
            logger.warn(`[integrity] ${check.status} ${record.resultId}/${check.kind} expected=${check.expected} actual=${check.actual || check.error}`);
            writeLog(entry);
          }
        }
      }
    } catch (error) {
      lastReport = {
        trigger,
        startedAt,
        finishedAt: new Date().toISOString(),
        ok: false,
        error: error.message,
        summary: null,
        records: [],
      };
      logger.warn(`[integrity] run failed: ${error.message}`);
      return lastReport;
    }

    const count = (status) => records.filter((r) => r.status === status).length;
    lastReport = {
      trigger,
      startedAt,
      finishedAt: new Date().toISOString(),
      ok: true,
      summary: {
        checked: records.length,
        ok: count(STATUS.OK),
        mismatch: count(STATUS.MISMATCH),
        missing: count(STATUS.MISSING),
        skippedOnChain: skipped,
      },
      records,
    };

    logger.log(`[integrity] run complete: ${JSON.stringify(lastReport.summary)}`);
    return lastReport;
  }

  // Runs never overlap: a manual trigger during a scheduled run returns that run.
  function runOnce(trigger = 'manual') {
    if (!running) {
      running = execute(trigger).finally(() => {
        running = null;
      });
    }
    return running;
  }

  function start(initialDelayMs = 10000) {
    if (timer) {
      return;
    }
    setTimeout(() => runOnce('startup'), initialDelayMs).unref();
    timer = setInterval(() => runOnce('scheduled'), intervalMs);
    timer.unref();
  }

  function status() {
    return {
      intervalMs,
      running: Boolean(running),
      lastReport,
    };
  }

  return { runOnce, start, status };
}

module.exports = {
  STATUS,
  collectTargets,
  createIntegrityChecker,
};
