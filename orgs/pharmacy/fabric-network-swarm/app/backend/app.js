'use strict';

/**
 * Pharmacy backend.
 *
 * What is real here:
 *   - Every /api route (except the status routes) requires a staff JWT issued
 *     by the hospital peer2-api login, verified with the shared JWT_SECRET.
 *   - Bill documents are pinned to the shared IPFS node; if IPFS is down the
 *     request fails, no hash is invented.
 *   - Dispensing a hospital prescription is NOT done here. The pharmacy portal
 *     calls peer2-api (/pharmacist/visits/:id/dispense), which submits
 *     VisitContract:DispenseMedication to the ledger.
 *
 * What is NOT on the ledger:
 *   - Inventory, pharmacy bills, the pharmacy staff list and the pharmacy
 *     access list are kept in this service's own JSON store (data/
 *     pharmacy_store.json). The `ehr` chaincode has no pharmacy inventory or
 *     billing contract. Responses carry `ledger: false` so nothing downstream
 *     can present these as blockchain records.
 */

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const FormData = require('form-data');
const crypto = require('crypto');
const store = require('./store');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ── CONFIG ───────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const IPFS_API = process.env.IPFS_API || 'http://ipfs.ehr.local:5001/api/v0';
const JWT_SECRET = process.env.JWT_SECRET || '';
const STORAGE = 'pharmacy-local-store';

const ROLES = {
  STAFF: ['pharmacist', 'inventory', 'billing', 'manager'],
  STOCK: ['inventory', 'manager'],
  DEDUCT: ['pharmacist', 'inventory', 'billing', 'manager'],
  BILLING: ['billing', 'manager'],
  PATIENT: ['pharmacist', 'billing', 'manager'],
  MANAGER: ['manager'],
};

// ── AUTH (HS256 JWT from the hospital login, verified without extra deps) ─────
function b64urlDecode(s) {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function verifyToken(token) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not configured for the pharmacy backend');
  const parts = String(token).split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const header = JSON.parse(b64urlDecode(parts[0]).toString('utf8'));
  if (header.alg !== 'HS256') throw new Error('Invalid token');
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${parts[0]}.${parts[1]}`).digest();
  const given = b64urlDecode(parts[2]);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) throw new Error('Invalid token');
  const payload = JSON.parse(b64urlDecode(parts[1]).toString('utf8'));
  if (payload.exp && Date.now() / 1000 >= payload.exp) throw new Error('Token expired');
  return payload;
}

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  try {
    req.user = verifyToken(header.slice(7));
    next();
  } catch (err) {
    const status = /configured/.test(err.message) ? 500 : 401;
    return res.status(status).json({ success: false, message: err.message });
  }
}

const allow = (roles) => [authenticate, (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: `Role '${req.user.role}' is not allowed to do this` });
  }
  next();
}];

const requireBody = (...fields) => (req, res, next) => {
  for (const f of fields) {
    if (req.body[f] === undefined || req.body[f] === null || req.body[f] === '') {
      return res.status(400).json({ success: false, message: `Missing ${f}` });
    }
  }
  next();
};

const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(`[${req.method} ${req.path}]`, err.message);
    res.status(status).json({ success: false, message: err.message });
  }
};

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// ── IPFS ─────────────────────────────────────────────────────────────────────
async function ipfsAdd(jsonData) {
  const form = new FormData();
  form.append('file', Buffer.from(JSON.stringify(jsonData, null, 2)), { filename: 'record.json' });
  try {
    const response = await axios.post(`${IPFS_API}/add`, form, { headers: form.getHeaders(), timeout: 8000 });
    if (response.data && response.data.Hash) return response.data.Hash;
    throw new Error('IPFS returned no hash');
  } catch (e) {
    throw httpError(502, `IPFS is unavailable, the bill was not saved (${e.message})`);
  }
}

async function checkIpfsStatus() {
  try {
    const response = await axios.post(`${IPFS_API}/id`, null, { timeout: 2500 });
    if (response.data && response.data.ID) return 'UP';
  } catch (e) { /* reported as DOWN below */ }
  return 'DOWN';
}

// ── STATUS (public) ──────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'pharmacy-backend', storage: STORAGE, ledger: false });
});

app.get('/api/ipfs-status', wrap(async (req, res) => {
  res.json({ status: await checkIpfsStatus() });
}));

app.get('/api/network-status', wrap(async (req, res) => {
  res.json({
    service: 'UP',
    ipfs: await checkIpfsStatus(),
    storage: STORAGE,
    ledger: false,
    note: 'Inventory and pharmacy bills are stored by the pharmacy service, not on the ledger. Dispensing is recorded on the ledger through the hospital peer2 API.',
  });
}));

app.get('/api/roles', (req, res) => {
  res.json({
    roles: [
      { role: 'manager', description: 'Pharmacy administrator: staff list, audit, inventory' },
      { role: 'billing', description: 'Billing officer: creates pharmacy bills' },
      { role: 'inventory', description: 'Stock officer: manages medicine stock levels' },
      { role: 'pharmacist', description: 'Dispensing pharmacist: fulfils hospital prescriptions' },
    ],
  });
});

// ── STAFF LIST ───────────────────────────────────────────────────────────────
app.post('/api/register-employee', ...allow(ROLES.MANAGER), requireBody('userId', 'role', 'name'), wrap(async (req, res) => {
  const { userId, role, name, metadata = {} } = req.body;
  const employee = store.registerEmployee(userId, role, name, { ...metadata, registeredBy: req.user.userId });
  res.json({ success: true, ledger: false, employee });
}));

app.get('/api/employees', ...allow(ROLES.MANAGER), wrap(async (req, res) => {
  res.json(store.getAllEmployees());
}));

// ── PHARMACY PATIENT RECORDS ─────────────────────────────────────────────────
app.post('/api/create-patient', ...allow(ROLES.BILLING), requireBody('patientId'), wrap(async (req, res) => {
  const { patientId, name, age } = req.body;
  res.json({ success: true, ledger: false, patient: store.createPatient(patientId, name, age) });
}));

app.get('/api/patient/:id', ...allow(ROLES.STAFF), wrap(async (req, res) => {
  const patient = store.getPatientProfile(req.params.id);
  if (!patient) throw httpError(404, `No pharmacy record for patient ${req.params.id}`);
  res.json(patient);
}));

app.get('/api/patient/:id/access-list', ...allow(ROLES.STAFF), wrap(async (req, res) => {
  res.json(store.getAccessList(req.params.id));
}));

app.post('/api/grant-access', ...allow(ROLES.PATIENT), requireBody('patientId', 'requesterId'), wrap(async (req, res) => {
  res.json({ success: true, ledger: false, result: store.grantAccess(req.body.patientId, req.body.requesterId) });
}));

app.post('/api/revoke-access', ...allow(ROLES.PATIENT), requireBody('patientId', 'requesterId'), wrap(async (req, res) => {
  res.json({ success: true, ledger: false, result: store.revokeAccess(req.body.patientId, req.body.requesterId) });
}));

// ── BILLING ──────────────────────────────────────────────────────────────────
async function processBilling(req, res) {
  const {
    patientId,
    medicineList,
    amount,
    name: templateName = 'Custom Prescription',
    templateId = 'custom',
    billId = `BILL_${Date.now()}`,
  } = req.body;

  if (!patientId) throw httpError(400, 'Missing patientId');
  if (!Array.isArray(medicineList) || medicineList.length === 0) throw httpError(400, 'Missing medicineList');
  const resolvedAmount = Number(amount);
  if (!Number.isFinite(resolvedAmount) || resolvedAmount < 0) throw httpError(400, 'Missing or invalid amount');

  // Check stock for every line before anything is written, so a bill is never
  // saved for medicine that is not there.
  const inventory = store.getAllInventory();
  for (const med of medicineList) {
    if (!med.itemId) continue;
    const item = inventory.find(i => i.itemId === med.itemId);
    const qty = parseInt(med.quantity, 10) || 0;
    if (!item) throw httpError(409, `Item ${med.itemId} is not in inventory`);
    if ((parseInt(item.quantity, 10) || 0) < qty) {
      throw httpError(409, `Insufficient stock for ${item.name} (${item.itemId}). Requested: ${qty}, in stock: ${item.quantity}`);
    }
  }

  const issuedBy = req.user.userId;
  const doc = {
    billId, patientId, templateName, templateId, medicineList,
    amount: resolvedAmount, issuedBy, issuedAt: new Date().toISOString(),
  };
  const ipfsHash = await ipfsAdd(doc);

  if (!store.checkPatientExists(patientId)) store.createPatient(patientId);
  const bill = store.createBill(billId, patientId, issuedBy, resolvedAmount, medicineList, ipfsHash, templateName);
  for (const med of medicineList) {
    if (med.itemId && med.quantity) store.deductInventoryItem(med.itemId, med.quantity);
  }

  res.json({ success: true, ledger: false, billId, ipfsHash, bill });
}

app.post('/api/billing', ...allow(ROLES.BILLING), wrap(processBilling));
app.post('/api/prescription', ...allow(ROLES.BILLING), wrap(processBilling));

app.get('/api/bills/patient/:id', ...allow(ROLES.STAFF), wrap(async (req, res) => {
  res.json(store.getPatientBills(req.params.id));
}));

app.get('/api/bills/audit', ...allow(ROLES.MANAGER), wrap(async (req, res) => {
  res.json(store.getAllBills());
}));

// ── INVENTORY ────────────────────────────────────────────────────────────────
app.get('/api/inventory', ...allow(ROLES.STAFF), wrap(async (req, res) => {
  res.json(store.getAllInventory());
}));

app.post('/api/inventory', ...allow(ROLES.STOCK), requireBody('itemId', 'name', 'quantity'), wrap(async (req, res) => {
  const { itemId, name, quantity, price = 0, unit = 'tablets' } = req.body;
  if (!(parseInt(quantity, 10) > 0)) throw httpError(400, 'quantity must be a positive number');
  res.json({ success: true, ledger: false, item: store.addInventoryItem(itemId, name, quantity, price, unit, req.user.userId) });
}));

app.post('/api/inventory/deduct', ...allow(ROLES.DEDUCT), requireBody('itemId', 'quantity'), wrap(async (req, res) => {
  if (!(parseInt(req.body.quantity, 10) > 0)) throw httpError(400, 'quantity must be a positive number');
  try {
    res.json({ success: true, ledger: false, item: store.deductInventoryItem(req.body.itemId, req.body.quantity) });
  } catch (e) {
    throw httpError(409, e.message);
  }
}));

// ── START ────────────────────────────────────────────────────────────────────
if (require.main === module) {
  if (!JWT_SECRET) console.error('[pharmacy] JWT_SECRET is not set: every authenticated route will return 500.');
  app.listen(PORT, HOST, () => {
    console.log(`Pharmacy backend on http://${HOST}:${PORT} (storage: ${STORAGE}, IPFS: ${IPFS_API})`);
  });
}

module.exports = { app, verifyToken };
