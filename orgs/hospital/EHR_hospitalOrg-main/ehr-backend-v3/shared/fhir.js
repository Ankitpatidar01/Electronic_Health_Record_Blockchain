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
    // try next candidate
  }
}

if (!fhirModule) {
  try {
    fhirModule = require(path.resolve(__dirname, '../../../../../fhir/src'));
  } catch (err) {
    fhirModule = {
      toFHIR: () => null,
      validateResource: () => ({ valid: false, errors: ['FHIR module not loaded'] }),
      canonicalizeResource: (x) => JSON.stringify(x),
      patientRecordHash: () => '',
      patientIdHash: () => '',
      convert: async () => { throw new Error('FHIR module not mounted in container'); },
      buildRecord: () => null,
      getFHIRResource: async () => null,
      createFHIRResource: async () => null
    };
  }
}

module.exports = fhirModule;
