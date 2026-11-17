'use strict';

// Step-by-step live demo of the Scheduled Ledger-Integrity Re-Check.
// Start the gateway with INTEGRITY_DEMO_ENDPOINTS=true, then run:
//   node integrity-demo.js
// Works against the Fabric network and in the gateway's in-memory fallback mode,
// because every step goes through the gateway's HTTP API.

const readline = require('readline');

const BASE = process.env.GATEWAY_URL || `http://localhost:${process.env.PORT || 3000}`;
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// Queue Enter presses so none are lost, whether typed live or piped in.
const pendingLines = [];
let waiting = null;
rl.on('line', () => {
  if (waiting) {
    const resolve = waiting;
    waiting = null;
    resolve();
  } else {
    pendingLines.push(true);
  }
});

function pause(message) {
  process.stdout.write(`\n>>> ${message} [press Enter]`);
  if (pendingLines.length > 0) {
    pendingLines.shift();
    process.stdout.write('\n');
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    waiting = resolve;
  });
}

async function api(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `${path} failed (${response.status})`);
  }
  return payload;
}

function short(value) {
  return value ? `${value.slice(0, 20)}...` : '-';
}

async function runCheck() {
  const report = await api('/api/integrity/run', { method: 'POST' });
  if (!report.ok) {
    throw new Error(report.error);
  }
  const s = report.summary;
  console.log(`\n  Result: ${s.ok} OK | ${s.mismatch} MISMATCH | ${s.missing} MISSING  (${s.checked} records checked)`);
  return report;
}

function showRecord(report, resultId) {
  const record = report.records.find((r) => r.resultId === resultId);
  for (const check of record.checks) {
    const detail = check.status === 'MISSING'
      ? `error: ${check.error}`
      : `expected ${short(check.expected)}  actual ${short(check.actual)}`;
    console.log(`  ${resultId} / ${check.kind.padEnd(9)} ${check.status.padEnd(8)} ${detail}`);
  }
}

function tamper(resultId, field, value) {
  return api('/api/integrity/demo/tamper', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resultId, field, value }),
  });
}

// The upload route stores the record in the background, so wait until it is readable.
async function waitForRecord(resultId) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const { result } = await api(`/api/records/${encodeURIComponent(resultId)}`);
      if (result && result.resultData && result.resultData.cid) {
        return result.resultData;
      }
    } catch (_error) {
      // Not stored yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`${resultId} was not stored within 60 seconds`);
}

async function main() {
  const resultId = `demo-${Date.now().toString().slice(-6)}`;

  console.log('=== Scheduled Ledger-Integrity Re-Check: live demo ===');

  await pause(`Step 1: create lab record ${resultId} (payload -> IPFS, CID + SHA-256 digest -> ledger)`);
  const form = new FormData();
  form.append('resultId', resultId);
  form.append('patientId', 'patient-demo');
  form.append('testCode', 'CBC');
  form.append('collectedAt', new Date().toISOString());
  form.append('status', 'REPORTED');
  form.append('resultData', JSON.stringify({ hemoglobin: '8.5', wbc: '9600' }));
  form.append('runAiAgents', 'false');
  await api('/api/records/ipfs', { method: 'POST', body: form });
  const anchored = await waitForRecord(resultId);
  console.log(`  On-chain CID:    ${anchored.cid}`);
  console.log(`  On-chain digest: ${anchored.digest}`);

  await pause('Step 2: run the integrity re-check (nothing has changed yet)');
  showRecord(await runCheck(), resultId);

  await pause('Step 3: tamper - overwrite the on-chain digest via UpdateLabResult, re-run the check');
  await tamper(resultId, 'digest', 'f'.repeat(64));
  showRecord(await runCheck(), resultId);

  await pause('Step 4: tamper - point the on-chain CID at a file that does not exist in IPFS, re-run the check (~15s timeout)');
  await tamper(resultId, 'digest', anchored.digest);
  await tamper(resultId, 'cid', 'bafkreiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  showRecord(await runCheck(), resultId);

  await pause('Step 5: restore the original CID on-chain, re-run the check (record verifies OK again)');
  await tamper(resultId, 'cid', anchored.cid);
  showRecord(await runCheck(), resultId);

  console.log(`\nMismatches are also logged to logs/integrity-recheck.log and shown on ${BASE}`);
  rl.close();
}

main().catch((error) => {
  console.error(`\nDemo failed: ${error.message}`);
  rl.close();
  process.exitCode = 1;
});
