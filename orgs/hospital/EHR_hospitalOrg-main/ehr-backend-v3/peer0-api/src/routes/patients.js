'use strict';

const router = require('express').Router();
const { body, param, validationResult } = require('express-validator');
const { authenticate, requireRole, requireAnyKnownRole } = require('../middleware/auth');
const { peerContext }  = require('../middleware/peerContext');
const { wrap, parseResult } = require('../middleware/errorHandler');
const ipfsClient = require('../fabric/ipfsClient');
const { anchorFHIRRecord } = require('../../../shared/fhir-anchor');
const { runIntake } = require('../../../shared/intake');
const directory = require('../../../shared/patientDirectory');
const timeline = require('../../../shared/timeline');
const logger = require('../config/logger');

const canManage = [authenticate, requireRole('receptionist', 'admin'), peerContext];
const canRead   = [authenticate, requireAnyKnownRole, peerContext];

// ── GET /patients — ListAllPatients ──────────────────────────
router.get('/', ...canManage, wrap(async (req, res) => {
  return res.json({ success: true, data: await directory.listPatients(req.contract, ipfsClient.fetchByCID) });
}));

// ── POST /patients — RegisterPatient + InitEHR ────────────────
// 1. Register patient on blockchain
// 2. Pin empty EHR JSON to IPFS via ipfs-service
// 3. Call EhrContract:InitEHR to store the CID on-chain
router.post('/',
  ...canManage,
  [
    body('patientId').trim().notEmpty(),
    body('name').trim().notEmpty(),
    body('age').isInt({ min: 0, max: 150 }),
    body('gender').trim().notEmpty(),
    body('bloodGroup').trim().notEmpty(),
    body('contact').trim().notEmpty(),
    body('address').trim().notEmpty(),
    body('symptoms').optional({ checkFalsy: true }).isString().isLength({ min: 3, max: 1000 })
      .withMessage('Symptoms must be between 3 and 1000 characters'),
  ],
  wrap(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { patientId, name, age, gender, bloodGroup, contact, address } = req.body;
    const symptoms = String(req.body.symptoms || '').trim();
    logger.info('RegisterPatient', { patientId, userId: req.user.userId });

    // Step 1 — pin empty EHR to IPFS first (so we have the CID ready)
    const demographics = { name, age, gender, bloodGroup, contact, address };
    const { cid: ehrCID } = await ipfsClient.initEHR(patientId, demographics);
    logger.info('EHR initialised in IPFS', { patientId, ehrCID });

    // Step 2 — pin the profile document, then register on the ledger. The
    // ledger receives the profile CID and hash, never the demographics.
    const pinned = await directory.pinProfile(ipfsClient, patientId, demographics);
    const result = await req.contract.submitTransaction(
      'PatientContract:RegisterPatient', patientId, pinned.cid, pinned.hash, ehrCID
    );
    const patient = { ...parseResult(result), ...demographics, age: Number(age) };

    // Step 3 — store CID in EhrContract (creates the on-chain EHR index)
    await req.contract.submitTransaction(
      'EhrContract:InitEHR', patientId, ehrCID
    );

    // Step 4 — anchor the FHIR Patient resource (best-effort, zero-PHI on-chain)
    let fhirAnchor = null;
    try {
      fhirAnchor = await anchorFHIRRecord(req.contract, ipfsClient, {
        sourceType: 'patient',
        legacyJson: { patientId, name, age, gender, bloodGroup, contact, address },
        recordId: patientId,
        filename: `fhir-patient-${patientId}.json`,
      });
      logger.info('FHIR anchor created', { patientId, resourceType: fhirAnchor.anchor.resourceType });
    } catch (err) {
      logger.error('FHIR anchor failed (non-fatal)', { patientId, error: err.message });
    }

    // Step 5 — symptoms: provisional disease code from the template, AI
    // cross-reference, both recorded against the patient's DID. The patient is
    // already registered at this point, so a failure here is returned to the
    // caller as intakeError rather than undoing the registration.
    let intake = null;
    let intakeError = null;
    if (symptoms) {
      try {
        intake = await runIntake(req.contract, ipfsClient, {
          patientId, symptoms, age: Number(age), gender, recordedBy: req.user.userId,
        });
        logger.info('Intake recorded', {
          patientId, code: intake.provisional.code, ai: intake.aiAnalysis.status, analysisCid: intake.analysisCid,
        });
      } catch (err) {
        intakeError = err.message;
        logger.error('Intake failed', { patientId, error: err.message });
      }
    }

    logger.info('RegisterPatient complete', { patientId, ehrCID, did: patient.did });
    return res.status(201).json({ success: true, data: { ...patient, ehrCID, fhirAnchor, intake, intakeError } });
  })
);

// ── GET /patients/:id/timeline — the patient's DID and every CID on it ──
router.get('/:id/timeline', ...canRead, [param('id').trim().notEmpty()], wrap(async (req, res) => {
  return res.json({ success: true, data: await timeline.getTimeline(req.contract, req.params.id) });
}));

// ── GET /patients/:id/timeline/:seq — the document behind one entry ──
router.get('/:id/timeline/:seq', ...canRead, [param('id').trim().notEmpty(), param('seq').isInt({ min: 1 })], wrap(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, error: 'Entry number must be a positive integer' });
  return res.json({ success: true, data: await timeline.getTimelineDocument(req.contract, ipfsClient.fetchByCID, req.params.id, req.params.seq) });
}));

// ── GET /patients/:id/disease-code — current code and full history ──
router.get('/:id/disease-code', ...canRead, [param('id').trim().notEmpty()], wrap(async (req, res) => {
  const result = await req.contract.evaluateTransaction('CodeContract:GetDiseaseCode', req.params.id);
  return res.json({ success: true, data: parseResult(result) });
}));

// ── GET /patients/:id — GetPatient ───────────────────────────
router.get('/:id',
  ...canRead,
  wrap(async (req, res) => {
    const patient = await directory.readPatient(req.contract, ipfsClient.fetchByCID, req.params.id);
    if (!patient) return res.status(404).json({ success: false, error: `Patient not found: ${req.params.id}` });
    return res.json({ success: true, data: patient });
  })
);

// ── GET /patients/:id/exists — PatientExists ─────────────────
router.get('/:id/exists',
  ...canRead,
  wrap(async (req, res) => {
    const result = await req.contract.evaluateTransaction(
      'PatientContract:PatientExists', req.params.id
    );
    return res.json({ success: true, data: { patientId: req.params.id, exists: parseResult(result) } });
  })
);

// ── GET /patients/:id/visits — GetPatientVisits ──────────────
router.get('/:id/visits',
  ...canRead,
  wrap(async (req, res) => {
    const result = await req.contract.evaluateTransaction(
      'PatientContract:GetPatientVisits', req.params.id
    );
    return res.json({ success: true, data: parseResult(result) });
  })
);

// ── GET /patients/:id/visits/full — GetPatientVisitsFull ─────
router.get('/:id/visits/full',
  ...canRead,
  wrap(async (req, res) => {
    const result = await req.contract.evaluateTransaction(
      'VisitContract:GetPatientVisitsFull', req.params.id
    );
    return res.json({ success: true, data: parseResult(result) });
  })
);

// ── GET /patients/:id/history — GetPatientHistory ────────────
router.get('/:id/history',
  ...canRead,
  wrap(async (req, res) => {
    const result = await req.contract.evaluateTransaction(
      'PatientContract:GetPatientHistory', req.params.id
    );
    return res.json({ success: true, data: parseResult(result) });
  })
);

// ── PUT /patients/:id — UpdatePatientInfo ────────────────────
router.put('/:id',
  ...canManage,
  [
    param('id').trim().notEmpty(),
    body('contact').optional().isString(),
    body('address').optional().isString(),
  ],
  wrap(async (req, res) => {
    const contact = String(req.body.contact || '').trim();
    const address = String(req.body.address || '').trim();
    if (!contact && !address) return res.status(400).json({ success: false, error: 'Give a new contact number or address' });
    logger.info('UpdatePatientInfo', { patientId: req.params.id, userId: req.user.userId });

    const current = await directory.readPatient(req.contract, ipfsClient.fetchByCID, req.params.id);
    if (!current) return res.status(404).json({ success: false, error: `Patient not found: ${req.params.id}` });
    const next = { ...current, contact: contact || current.contact, address: address || current.address };
    const pinned = await directory.pinProfile(ipfsClient, req.params.id, next);
    const result = await req.contract.submitTransaction(
      'PatientContract:UpdatePatientInfo', req.params.id, pinned.cid, pinned.hash
    );
    return res.json({ success: true, data: { ...parseResult(result), ...pinned.profile } });
  })
);

// ── GET /patients/:id/ehr/cid — GetCurrentEHR CID ────────────
// Staff can get the current IPFS CID for a patient's EHR
router.get('/:id/ehr/cid',
  ...canRead,
  wrap(async (req, res) => {
    const result = await req.contract.evaluateTransaction(
      'EhrContract:GetCurrentCID', req.params.id
    );
    return res.json({ success: true, data: parseResult(result) });
  })
);

// ── GET /patients/:id/ehr/history — EHR CID history ──────────
router.get('/:id/ehr/history',
  ...canRead,
  wrap(async (req, res) => {
    const result = await req.contract.evaluateTransaction(
      'EhrContract:GetEHRCIDHistory', req.params.id
    );
    return res.json({ success: true, data: parseResult(result) });
  })
);

module.exports = router;
