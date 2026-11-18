'use strict';

/**
 * events.js — Dashboard integration events (Group 4 §9.3).
 *
 * Team D emits three events for the Dashboard team's Agent Trace UI, using the
 * platform's common event envelope:
 *
 *   { eventId, eventType, timestamp, source, peerId, severity, payload }
 *
 * The Dashboard team owns the consuming endpoint
 * (GET /api/dashboard/agents/:agentId/executions); Team D only emits. Events
 * are surfaced to a provided emitter function (injection point) and, by
 * default, no-op — so this module stays standalone.
 */

const crypto = require('crypto');

const EVENT_TYPES = {
  STARTED:   'FHIR_CONVERSION_STARTED',
  COMPLETED: 'FHIR_CONVERSION_COMPLETED',
  FAILED:    'FHIR_CONVERSION_FAILED',
};

let emitFn = null;

/** Injection point for the Dashboard team's real transport (WebSocket/SSE). */
function setEventEmitter(fn) {
  emitFn = typeof fn === 'function' ? fn : null;
}

function emit(eventType, payload, extra = {}) {
  const envelope = {
    eventId:   `evt-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`,
    eventType,
    timestamp: new Date().toISOString(),
    source:    'fhir',
    peerId:    extra.peerId || '',
    severity:  extra.severity || (eventType === EVENT_TYPES.FAILED ? 'ERROR' : 'INFO'),
    payload,
  };
  if (emitFn) emitFn(envelope);
  return envelope;
}

module.exports = { EVENT_TYPES, setEventEmitter, emit };
