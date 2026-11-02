'use strict';

/**
 * canonicalizer.js — RFC 8785 JSON Canonicalization Scheme (JCS).
 *
 * Deterministic serialization is the single hardest requirement of this module
 * (Group 4 §3.3): the Security team's VCAP requires a patientRecordHash that is
 * reproducible by any party re-computing it from the same clinical facts, and
 * plain JSON.stringify() is NOT deterministic across key ordering.
 *
 * RFC 8785 mandates:
 *   1. object keys sorted lexicographically (byte-wise on UTF-8),
 *   2. no insignificant whitespace,
 *   3. numbers normalized per the ECMAScript Number::toString grammar,
 *   4. strings in normalized UTF-8, no unnecessary escaping.
 *
 * We delegate to the `canonicalize` package (erdtman/canonicalize), the
 * reference JCS implementation used across the JSON-LD / JCS ecosystem, and
 * expose the result as a shared library function so the Security team's
 * VerifyVCAP can recompute the identical digest. Any value that is not
 * JCS-serializable (e.g. undefined, NaN) is rejected loudly — a canonicalization
 * error must never silently produce a divergent digest.
 */

const canonicalize = require('canonicalize');

/**
 * RFC 8785 §3.2.2.3 forbids undefined, NaN, and ±Infinity — they MUST cause an
 * error, not a silent coercion. The `canonicalize` package is lenient here
 * (drops undefined, coerces NaN/Infinity → null), which would produce a digest
 * that disagrees with a strict verifier. We enforce strictness ourselves.
 */
function assertJcsSerializable(node, path = '$') {
  if (node === undefined) {
    throw new Error(`CANONICALIZATION_ERROR: undefined value at ${path}`);
  }
  if (typeof node === 'number' && !Number.isFinite(node)) {
    throw new Error(`CANONICALIZATION_ERROR: non-finite number at ${path}`);
  }
  if (typeof node === 'function' || typeof node === 'symbol') {
    throw new Error(`CANONICALIZATION_ERROR: unsupported type at ${path}`);
  }
  if (node !== null && typeof node === 'object') {
    const proto = Object.getPrototypeOf(node);
    if (proto !== Object.prototype && proto !== Array.prototype && proto !== null) {
      throw new Error(`CANONICALIZATION_ERROR: non-plain object at ${path}`);
    }
    if (Array.isArray(node)) {
      node.forEach((item, i) => assertJcsSerializable(item, `${path}[${i}]`));
    } else {
      for (const [k, v] of Object.entries(node)) assertJcsSerializable(v, `${path}.${k}`);
    }
  }
}

/**
 * @param {object} obj  any JSON-safe object
 * @returns {string} canonical byte form (UTF-8 string)
 * @throws {Error} "CANONICALIZATION_ERROR: ..." if the input is not JCS-serializable
 */
function canonicalizeResource(obj) {
  assertJcsSerializable(obj);
  const out = canonicalize(obj);
  if (out === undefined) {
    throw new Error('CANONICALIZATION_ERROR: input is not RFC 8785 JCS-serializable');
  }
  return out;
}

module.exports = { canonicalizeResource };
