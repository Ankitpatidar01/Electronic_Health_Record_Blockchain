'use strict';

/**
 * fhir.js — single resolution point for the ehr-fhir module.
 *
 * The fhir module lives at repo-root `/fhir` (a cross-org asset shared by
 * hospital, lab and pharmacy). Backends reach it through this one helper so the
 * deep relative path is written once. `path.resolve` (not a symlink/npm link)
 * keeps this working on macOS, Linux, and inside any Docker build context.
 */
const path = require('path');

module.exports = require(path.resolve(__dirname, '../../../../../fhir/src'));
