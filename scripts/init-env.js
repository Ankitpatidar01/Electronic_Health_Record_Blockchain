#!/usr/bin/env node
'use strict';

// Creates/updates the root .env and per-service .env files.
//   - generates missing secrets (never overwrites a value that is already set)
//   - adds keys introduced by newer versions of .env.example
//   - writes service-level .env files (only when absent) so services can also
//     run outside Docker, e.g. via start-sequential.ps1 on Windows
// Safe to run repeatedly. Works on Linux, macOS and Windows.

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

const ROOT = path.resolve(__dirname, '..');
const GENERATED = {
  JWT_SECRET:            () => crypto.randomBytes(48).toString('base64url'),
  IPFS_SERVICE_KEY:      () => crypto.randomBytes(24).toString('base64url'),
  DASHBOARD_SERVICE_KEY: () => crypto.randomBytes(24).toString('base64url'),
  DIGILOCKER_VAULT_KEY:  () => crypto.randomBytes(32).toString('hex'),
};
const PLACEHOLDER = /^(|change[-_ ]?me.*|change_this.*|replace[-_ ]with.*)$/i;

function parse(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=(.*)$/.exec(line);
    if (match) values[match[1]] = match[2].replace(/\s+#.*$/, '').trim();
  }
  return values;
}

function initRoot() {
  const examplePath = path.join(ROOT, '.env.example');
  const envPath     = path.join(ROOT, '.env');
  const example     = fs.readFileSync(examplePath, 'utf8');
  const created     = !fs.existsSync(envPath);
  let text          = created ? example : fs.readFileSync(envPath, 'utf8');
  const current     = parse(text);
  const notes       = [];

  // Keys present in the template but missing from an older .env.
  const missing = Object.entries(parse(example)).filter(([key]) => !(key in current));
  if (missing.length) {
    text = text.replace(/\s*$/, '\n') + '\n# Added by scripts/init-env.js\n' + missing.map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
    for (const [key, value] of missing) current[key] = value;
    notes.push(`added ${missing.length} new key(s): ${missing.map(([k]) => k).join(', ')}`);
  }

  for (const [key, make] of Object.entries(GENERATED)) {
    if (!PLACEHOLDER.test(current[key] ?? '')) continue;
    const value = make();
    const line = new RegExp(`^\\s*${key}\\s*=.*$`, 'm');
    text = line.test(text) ? text.replace(line, `${key}=${value}`) : `${text.replace(/\s*$/, '\n')}${key}=${value}\n`;
    current[key] = value;
    notes.push(`generated ${key}`);
  }

  if (created || notes.length) fs.writeFileSync(envPath, text, { mode: 0o600 });
  console.log(`[init-env] ${created ? 'created' : 'checked'} .env${notes.length ? ` (${notes.join('; ')})` : ''}`);
  return current;
}

function writeServiceEnv(relDir, lines) {
  const dir  = path.join(ROOT, relDir);
  const file = path.join(dir, '.env');
  if (!fs.existsSync(dir) || fs.existsSync(file)) return;
  fs.writeFileSync(file, lines.join('\n') + '\n', { mode: 0o600 });
  console.log(`[init-env] created ${path.join(relDir, '.env')}`);
}

function initServices(env) {
  const backend = 'orgs/hospital/EHR_hospitalOrg-main/ehr-backend-v3';
  const shared = [
    `NODE_ENV=${env.NODE_ENV || 'development'}`,
    `JWT_SECRET=${env.JWT_SECRET}`,
    `JWT_EXPIRES_IN=${env.JWT_EXPIRES_IN || '8h'}`,
    `FABRIC_CHANNEL=${env.FABRIC_CHANNEL || 'ehrchannel'}`,
    `FABRIC_CHAINCODE=${env.FABRIC_CHAINCODE || 'ehr'}`,
    'IPFS_SERVICE_URL=http://localhost:4006',
    `IPFS_SERVICE_KEY=${env.IPFS_SERVICE_KEY}`,
    'LOG_LEVEL=info',
  ];
  writeServiceEnv(`${backend}/peer0-api`,   ['PORT=4001', 'PEER_ADDRESS=localhost:7051', ...shared]);
  writeServiceEnv(`${backend}/peer1-api`,   ['PORT=4002', 'PEER_ADDRESS=localhost:9051', ...shared]);
  writeServiceEnv(`${backend}/peer2-api`,   ['PORT=4003', 'PEER_ADDRESS=localhost:10051', ...shared]);
  writeServiceEnv(`${backend}/extorg-api`,  ['PORT=4004', 'DIAG_PEER_ADDRESS=localhost:8051', 'PROV_PEER_ADDRESS=localhost:11051', ...shared]);
  writeServiceEnv(`${backend}/patient-api`, ['PORT=4005', 'PEER_ADDRESS=localhost:7051', 'SQLITE_PATH=./data/patients.db', ...shared]);
  writeServiceEnv(`${backend}/ipfs-service`, [
    'PORT=4006', 'IPFS_API_URL=http://localhost:5001', 'IPFS_GATEWAY_URL=http://localhost:8090',
    'MAX_BODY_SIZE=5mb', `IPFS_SERVICE_KEY=${env.IPFS_SERVICE_KEY}`,
  ]);
  writeServiceEnv('orgs/digilocker/backend', [
    'PORT=4007', `NODE_ENV=${env.NODE_ENV || 'development'}`,
    `JWT_SECRET=${env.JWT_SECRET}`,
    `DIGILOCKER_VAULT_KEY=${env.DIGILOCKER_VAULT_KEY}`,
    `DIGILOCKER_MODE=${env.DIGILOCKER_MODE || 'sandbox'}`,
    `DIGILOCKER_CLIENT_ID=${env.DIGILOCKER_CLIENT_ID || ''}`,
    `DIGILOCKER_CLIENT_SECRET=${env.DIGILOCKER_CLIENT_SECRET || ''}`,
    `DIGILOCKER_PUBLIC_URL=${env.DIGILOCKER_PUBLIC_URL || 'http://localhost:4007'}`,
    `DIGILOCKER_PORTAL_RETURN_URL=${env.DIGILOCKER_PORTAL_RETURN_URL || 'http://localhost:5174/digilocker'}`,
    `CORS_ALLOWED_ORIGINS=${env.DIGILOCKER_CORS_ALLOWED_ORIGINS || 'http://localhost:5174,http://localhost'}`,
    'PEER_ADDRESS=localhost:7051',
    `FABRIC_CHANNEL=${env.FABRIC_CHANNEL || 'ehrchannel'}`, `FABRIC_CHAINCODE=${env.FABRIC_CHAINCODE || 'ehr'}`,
    'IPFS_SERVICE_URL=http://localhost:4006', `IPFS_SERVICE_KEY=${env.IPFS_SERVICE_KEY}`,
    'DASHBOARD_EVENT_API_URL=http://localhost:4010', `DASHBOARD_SERVICE_KEY=${env.DASHBOARD_SERVICE_KEY}`,
  ]);

  // dashboard-api keeps its own richer .env; create it from its template with
  // the shared secrets filled in when it does not exist yet.
  const dashDir = path.join(ROOT, backend, 'dashboard-api');
  const dashEnv = path.join(dashDir, '.env');
  if (fs.existsSync(path.join(dashDir, '.env.example')) && !fs.existsSync(dashEnv)) {
    const text = fs.readFileSync(path.join(dashDir, '.env.example'), 'utf8')
      .replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${env.JWT_SECRET}`)
      .replace(/^DASHBOARD_SERVICE_KEY=.*$/m, `DASHBOARD_SERVICE_KEY=${env.DASHBOARD_SERVICE_KEY}`);
    fs.writeFileSync(dashEnv, text, { mode: 0o600 });
    console.log(`[init-env] created ${path.join(backend, 'dashboard-api', '.env')}`);
  }
}

function report(env) {
  const todo = [];
  if ((env.DIGILOCKER_MODE || 'sandbox') === 'live' && (!env.DIGILOCKER_CLIENT_ID || !env.DIGILOCKER_CLIENT_SECRET)) {
    todo.push('DIGILOCKER_MODE=live needs DIGILOCKER_CLIENT_ID and DIGILOCKER_CLIENT_SECRET in .env');
  }
  if (!env.GEMINI_API_KEY) {
    todo.push('optional: set GEMINI_API_KEY in .env to enable Gemini-backed lab report extraction (the agent is rule-based without it)');
  }
  for (const item of todo) console.log(`[init-env] ACTION: ${item}`);
}

const env = initRoot();
initServices(env);
report(env);
