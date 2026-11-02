'use strict';

/**
 * ehr-fhir — Standard EHR / HL7 FHIR R4 interoperability layer (Team D).
 *
 * Public API surface. Everything else the other pillars need is reachable from
 * here: the adapter, validator, canonicalizer, hasher, identifier normalizer,
 * encryption/bundler injection points, the anchor record builder, the AI tools,
 * and the end-to-end pipeline.
 */

module.exports = {
  // Adapter
  toFHIR:            require('./adapters/legacy-to-fhir').toFHIR,
  inferSourceType:   require('./adapters/legacy-to-fhir').inferSourceType,

  // Validation / canonicalization / hashing
  validateResource:  require('./validator').validateResource,
  canonicalizeResource: require('./canonicalizer').canonicalizeResource,
  patientRecordHash: require('./hasher').patientRecordHash,
  patientIdHash:     require('./identifiers').patientIdHash,

  // Storage / anchor
  encryptArtifact:   require('./encryption').encryptArtifact,
  setEnvelopeEncryptor: require('./encryption').setEnvelopeEncryptor,
  setIpfsClient:     require('./ipfs-bundler').setIpfsClient,
  pinContent:        require('./ipfs-bundler').pinContent,
  fetchJson:         require('./ipfs-bundler').fetchJson,
  buildRecord:       require('./fabric-anchor').buildRecord,
  recordKey:         require('./fabric-anchor').recordKey,
  consentKey:        require('./fabric-anchor').consentKey,

  // AI tool layer
  getFHIRResource:   require('./tools/getFHIRResource').getFHIRResource,
  createFHIRResource: require('./tools/createFHIRResource').createFHIRResource,

  // Dashboard events
  EVENT_TYPES:       require('./events').EVENT_TYPES,
  setEventEmitter:   require('./events').setEventEmitter,

  // End-to-end
  convert:           require('./pipeline').convert,
};
