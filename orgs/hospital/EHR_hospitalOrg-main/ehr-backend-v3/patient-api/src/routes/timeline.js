'use strict';

/**
 * timeline.js — the patient's own DID, the CIDs recorded on it, and their
 * disease-code history.
 *
 * GET /timeline            DID record + every entry, oldest first
 * GET /timeline/:seq       the document stored at one entry's CID
 * GET /timeline/code       current disease code and its full history
 */

const router = require('express').Router();
const { authenticate }      = require('../middleware/auth');
const { fabricContext }     = require('../middleware/fabricContext');
const { wrap, parseResult } = require('../middleware/errorHandler');
const { fetchByCID }        = require('../fabric/ipfsClient');
const timeline = require('../../../shared/timeline');

const secured = [authenticate, fabricContext];

router.get('/', ...secured, wrap(async (req, res) => {
  return res.json({ success: true, data: await timeline.getTimeline(req.contract, req.patient.patientId) });
}));

router.get('/code', ...secured, wrap(async (req, res) => {
  const result = await req.contract.evaluateTransaction('CodeContract:GetDiseaseCode', req.patient.patientId);
  return res.json({ success: true, data: parseResult(result) });
}));

router.get('/:seq', ...secured, wrap(async (req, res) => {
  if (!/^[1-9][0-9]{0,7}$/.test(req.params.seq)) {
    return res.status(400).json({ success: false, error: 'Entry number must be a positive integer' });
  }
  const data = await timeline.getTimelineDocument(req.contract, fetchByCID, req.patient.patientId, req.params.seq, { forPatient: true });
  return res.json({ success: true, data });
}));

module.exports = router;
