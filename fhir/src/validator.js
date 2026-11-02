'use strict';

/**
 * validator.js — Feature 2: high-performance schema + terminology validator.
 *
 * Two checks in a single pass (target <40ms p95):
 *   1. Structural conformance against the bundled FHIR R4 profile JSON-Schema
 *      for the resource's resourceType (ajv, draft-07).
 *   2. Terminology membership: any coding/quantity that uses one of our four
 *      bundled systems (LOINC / UCUM / SNOMED-CT / ICD-10) must reference a code
 *      present in the corresponding subset.
 *
 * Errors are typed so the caller (and the adapter / dashboard event) can tell
 * apart SCHEMA_INVALID (structural) from TERMINOLOGY_UNBOUND (unknown code),
 * exactly as the Group 4 proposal's Failure Handling section requires.
 */

const Ajv = require('ajv');
const path = require('path');
const fs = require('fs');

const SCHEMA_DIR = path.join(__dirname, '..', 'schemas');
const TERMINOLOGY_DIR = path.join(__dirname, '..', 'terminology');

// resourceType -> schema file
const SCHEMA_FILES = {
  Patient:           'patient.schema.json',
  Observation:       'observation.schema.json',
  DiagnosticReport:  'diagnostic-report.schema.json',
  MedicationRequest: 'medication-request.schema.json',
  Encounter:         'encounter.schema.json',
  Condition:         'condition.schema.json',
  Consent:           'consent.schema.json',
};

// system URI -> terminology subset file (code -> display or unit -> 1)
const TERMINOLOGY_SOURCES = {
  'http://loinc.org':              { file: 'loinc-subset.json', key: 'codes' },
  'http://unitsofmeasure.org':     { file: 'ucum-units.json',   key: 'units', isArray: true },
  'http://snomed.info/sct':        { file: 'snomed-subset.json', key: 'codes' },
  'http://hl7.org/fhir/sid/icd-10': { file: 'icd10-subset.json', key: 'codes' },
};

// ── Lazily compiled ajv validators, cached per resourceType ──────────────────
const ajv = new Ajv({ allErrors: true, strict: false });
const compiled = {};

// ── Lazily loaded terminology, cached ─────────────────────────────────────────
let terminology = null;

function loadTerminology() {
  if (terminology) return terminology;
  terminology = {};
  for (const [system, spec] of Object.entries(TERMINOLOGY_SOURCES)) {
    const raw = JSON.parse(fs.readFileSync(path.join(TERMINOLOGY_DIR, spec.file), 'utf8'));
    if (spec.isArray) {
      terminology[system] = new Set(raw.units);
    } else {
      terminology[system] = new Set(Object.keys(raw.codes));
    }
  }
  return terminology;
}

function compileValidator(resourceType) {
  if (compiled[resourceType]) return compiled[resourceType];
  const file = SCHEMA_FILES[resourceType];
  if (!file) return null; // resource type we do not validate structurally
  const schema = JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, file), 'utf8'));
  compiled[resourceType] = ajv.compile(schema);
  return compiled[resourceType];
}

// ── Terminology check: recursive walk for {system, code} pairs ────────────────
function checkTerminology(resource) {
  const errors = [];
  const codes = loadTerminology();

  function walk(node, jsonPath) {
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${jsonPath}[${i}]`));
      return;
    }
    if (node && typeof node === 'object') {
      // A coding / quantity carries { system, code }. Check membership only for
      // systems we bundle; unknown systems are out of scope and skipped.
      if (typeof node.system === 'string' && typeof node.code === 'string') {
        const set = codes[node.system];
        if (set && !set.has(node.code)) {
          errors.push({
            code: 'TERMINOLOGY_UNBOUND',
            path: jsonPath,
            message: `code '${node.code}' is not in the bundled ${node.system} subset`,
          });
        }
      }
      for (const [k, v] of Object.entries(node)) {
        walk(v, `${jsonPath}.${k}`);
      }
    }
  }

  walk(resource, '$');
  return errors;
}

/**
 * Validate a FHIR R4 resource.
 *
 * @param {object} resource  the resource to validate
 * @returns {{valid: boolean, resourceType: string, errors: Array<{code:string, path:string, message:string}>}}
 */
function validateResource(resource) {
  if (!resource || typeof resource !== 'object') {
    return {
      valid: false,
      resourceType: '',
      errors: [{ code: 'SCHEMA_INVALID', path: '$', message: 'resource must be an object' }],
    };
  }

  const resourceType = resource.resourceType;
  if (!resourceType) {
    return {
      valid: false,
      resourceType: '',
      errors: [{ code: 'SCHEMA_INVALID', path: '$.resourceType', message: 'resourceType is required' }],
    };
  }

  const errors = [];

  // 1. Structural conformance
  const validate = compileValidator(resourceType);
  if (validate) {
    const ok = validate(resource);
    if (!ok) {
      for (const e of validate.errors || []) {
        errors.push({
          code: 'SCHEMA_INVALID',
          path: e.instancePath || '$',
          message: e.message || 'validation failed',
        });
      }
    }
  }

  // 2. Terminology membership (only if structurally sound so far)
  if (errors.length === 0) {
    errors.push(...checkTerminology(resource));
  }

  return { valid: errors.length === 0, resourceType, errors };
}

module.exports = { validateResource, SCHEMA_FILES, TERMINOLOGY_SOURCES };
