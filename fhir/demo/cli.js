#!/usr/bin/env node
'use strict';

/**
 * demo/cli.js — end-to-end pipeline demo.
 *
 *   node demo/cli.js examples/legacy-lab-result.json [--type lab-result] [--pin] [--events]
 *
 * Prints: the FHIR resource, its RFC 8785 canonical form, the SHA-256
 * patientRecordHash (VCAP H(R)), the AES-256-GCM encryption metadata, the IPFS
 * CID (with --pin), and the zero-PHI Fabric anchor record. Repeated runs with
 * the same input produce the identical patientRecordHash — the determinism
 * guarantee that makes VCAP tamper-detection possible.
 */

const fs = require('fs');
const path = require('path');
const {
  convert,
  inferSourceType,
  setEventEmitter,
} = require('../src');

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { pin: false, events: false, type: null, file: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--pin') opts.pin = true;
    else if (a === '--events') opts.events = true;
    else if (a === '--type') opts.type = args[++i];
    else if (!opts.file) opts.file = a;
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv);
  if (!opts.file) {
    console.error('Usage: node demo/cli.js <legacy.json> [--type patient|visit|lab-result|prescription|condition|consent] [--pin] [--events]');
    process.exit(1);
  }

  const filePath = path.resolve(opts.file);
  const legacy = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const sourceType = opts.type || inferSourceType(legacy);
  if (!sourceType) {
    console.error('Could not infer source type. Pass --type explicitly.');
    process.exit(1);
  }

  if (opts.events) {
    setEventEmitter(env => console.log('[event]', env.eventType, JSON.stringify(env.payload)));
  }

  try {
    const result = await convert(sourceType, legacy, { pin: opts.pin });
    console.log('── Legacy input ───────────────────────────');
    console.log(JSON.stringify(legacy, null, 2));
    console.log('\n── FHIR R4 resource (' + sourceType + ' → ' + result.resource.resourceType + ') ──');
    console.log(JSON.stringify(result.resource, null, 2));
    console.log('\n── RFC 8785 canonical JSON ────────────────');
    console.log(result.canonical);
    console.log('\n── patientRecordHash (VCAP H(R)) ──────────');
    console.log(result.patientRecordHash);
    console.log('\n── Encryption (AES-256-GCM) meta ──────────');
    console.log(JSON.stringify(result.encryptionMeta, null, 2));
    if (opts.pin) {
      console.log('\n── IPFS CID ───────────────────────────────');
      console.log(result.dataCID);
    }
    console.log('\n── Fabric anchor (zero-PHI state record) ──');
    console.log(JSON.stringify(result.anchor, null, 2));
    console.log('\n── durationMs:', result.durationMs);
  } catch (err) {
    console.error('\n✗ conversion failed:', err.message);
    if (err.validation) {
      console.error(JSON.stringify(err.validation, null, 2));
    }
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
