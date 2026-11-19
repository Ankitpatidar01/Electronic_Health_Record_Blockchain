'use strict';

/**
 * fhir.js — single resolution point for the ehr-fhir module.
 *
 * Supports both container environment (/fhir/src) and host relative paths.
 * Fails gracefully with a stub if the module is not mounted, preventing crash on boot.
 */
const path = require('path');
const fs = require('fs');

let fhirModule = null;
let loadError = null;

const candidatePaths = [
  '/fhir/src',
  path.resolve(__dirname, '../../../../../fhir/src'),
  path.resolve(__dirname, '../../../../../../fhir/src')
];

for (const candidate of candidatePaths) {
  try {
    if (fs.existsSync(candidate)) {
      fhirModule = require(candidate);
      break;
    }
  } catch (err) {
    loadError = err; // usually a missing dependency of the module; try the next path
  }
}

if (!fhirModule) {
  try {
    fhirModule = require(path.resolve(__dirname, '../../../../../fhir/src'));
  } catch (err) {
    loadError = loadError || err;
    const reason = `FHIR module could not be loaded: ${loadError.message.split('\n')[0]}`;
    // Loud on purpose: every FHIR anchor will fail until this is fixed.
    console.error(`[fhir] ${reason}`);
    fhirModule = {
      toFHIR: () => null,
      validateResource: () => ({ valid: false, errors: [reason] }),
      canonicalizeResource: (x) => JSON.stringify(x),
      patientRecordHash: () => '',
      patientIdHash: () => '',
      convert: async () => { throw new Error(reason); },
      buildRecord: () => null,
      getFHIRResource: async () => null,
      createFHIRResource: async () => null
    };
  }
}

module.exports = fhirModule;
