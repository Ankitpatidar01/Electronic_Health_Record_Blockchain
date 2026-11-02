'use strict';

/**
 * registry.js — in-memory FHIR resource store backing the AI tool layer.
 *
 * In the standalone module this is a simple Map keyed `${resourceType}/${id}`.
 * In a live deployment the same get/create functions would resolve through IPFS
 * (fetch by CID + decrypt) and the Fabric ledger; the tools' public signatures
 * stay identical, so the Agentic-AI team's tool layer never changes.
 */

const store = new Map();

function key(resourceType, id) {
  return `${resourceType}/${id}`;
}

function put(resource) {
  store.set(key(resource.resourceType, resource.id), resource);
  return resource;
}

function get(resourceType, id) {
  return store.get(key(resourceType, id)) || null;
}

function clear() {
  store.clear();
}

module.exports = { put, get, clear };
