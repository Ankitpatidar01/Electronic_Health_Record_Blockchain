'use strict';

/**
 * pipeline.js — the end-to-end conversion pipeline.
 *
 *   legacy JSON → FHIR (adapter) → validate → canonicalize (RFC 8785) →
 *   SHA-256 patientRecordHash → AES-256-GCM encrypt → IPFS pin → anchor.
 *
 * Hard boundaries enforced here:
 *   - nothing is persisted until validation passes;
 *   - the canonicalizer + hasher run before any encryption;
 *   - only hash + CID + status are ever produced for anchoring (zero-PHI).
 *
 * Emits FHIR_CONVERSION_STARTED / _COMPLETED / _FAILED events (via events.js)
 * for the Dashboard team's Agent Trace.
 */

const { toFHIR } = require('./adapters/legacy-to-fhir');
const { validateResource } = require('./validator');
const { canonicalizeResource } = require('./canonicalizer');
const { patientRecordHash } = require('./hasher');
const { encryptArtifact } = require('./encryption');
const { pinContent } = require('./ipfs-bundler');
const { buildRecord } = require('./fabric-anchor');
const { EVENT_TYPES, emit } = require('./events');

/**
 * @param {string} sourceType
 * @param {object} legacyJson
 * @param {object} [opts]  { pin: boolean, peerId: string, recordId: string }
 * @returns {Promise<object>} { resource, validation, canonical, patientRecordHash, dataCID, anchor, durationMs }
 */
async function convert(sourceType, legacyJson, opts = {}) {
  const startedAt = Date.now();
  const peerId = opts.peerId || '';
  const recordId = opts.recordId || '';

  emit(EVENT_TYPES.STARTED, { sourceType, recordId }, { peerId });

  try {
    // 1. Adapter
    const resource = toFHIR(sourceType, legacyJson, opts);

    // 2. Validate (schema + terminology)
    const validation = validateResource(resource);
    if (!validation.valid) {
      emit(EVENT_TYPES.FAILED, {
        sourceType,
        recordId,
        resourceType: validation.resourceType,
        validationStatus: 'INVALID',
        errors: validation.errors,
        durationMs: Date.now() - startedAt,
      }, { peerId, severity: 'ERROR' });
      const err = new Error(`FHIR validation failed: ${validation.errors.map(e => `${e.code}@${e.path}`).join('; ')}`);
      err.code = validation.errors[0] && validation.errors[0].code;
      err.validation = validation;
      throw err;
    }

    // 3. Canonicalize + hash (VCAP H(R))
    const canonical = canonicalizeResource(resource);
    const hash = patientRecordHash(resource);

    // 4. Encrypt (AES-256-GCM envelope)
    const { content, meta } = await encryptArtifact(canonical, {
      patientId: resource.subject ? resource.subject.reference : '',
    });

    // 5. Pin to IPFS (optional in the demo)
    let dataCID = null;
    if (opts.pin) {
      dataCID = await pinContent(content);
    }

    // 6. Anchor (zero-PHI state record)
    const anchor = buildRecord({
      patientId: legacyJson.patientId || '',
      recordId: recordId || resource.id,
      resourceType: resource.resourceType,
      patientRecordHash: hash,
      dataCID: dataCID || '',
      status: resource.status || 'FINAL',
    });

    const durationMs = Date.now() - startedAt;
    emit(EVENT_TYPES.COMPLETED, {
      sourceType,
      recordId: recordId || resource.id,
      resourceType: resource.resourceType,
      validationStatus: 'VALID',
      patientRecordHash: hash,
      dataCID: dataCID || null,
      durationMs,
    }, { peerId });

    return { resource, validation, canonical, patientRecordHash: hash, encryptionMeta: meta, dataCID, anchor, durationMs };
  } catch (err) {
    // Only emit FAILED here if we didn't already emit it for a validation failure.
    if (err.code !== 'SCHEMA_INVALID' && err.code !== 'TERMINOLOGY_UNBOUND') {
      emit(EVENT_TYPES.FAILED, {
        sourceType,
        recordId,
        error: err.message,
        durationMs: Date.now() - startedAt,
      }, { peerId, severity: 'ERROR' });
    }
    throw err;
  }
}

module.exports = { convert };
