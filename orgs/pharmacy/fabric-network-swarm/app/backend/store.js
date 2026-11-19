'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'pharmacy_store.json');

// The store starts empty. Stock, bills and staff are whatever the pharmacy
// staff enter through the portal; nothing is seeded.
const SCHEMA = 2;
const emptyData = () => ({ schema: SCHEMA, inventory: [], patients: {}, employees: [], bills: [] });

class PharmacyStore {
  constructor() {
    this.data = null;
    this.init();
  }

  init() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(DATA_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      if (parsed.schema === SCHEMA) {
        this.data = { ...emptyData(), ...parsed };
        return;
      }
      // Files written by earlier versions contain seeded sample records.
      // Keep the old file for reference and start clean.
      fs.renameSync(DATA_FILE, `${DATA_FILE}.pre-v${SCHEMA}`);
      console.warn('[PharmacyStore] Old store with sample data set aside; starting with an empty store.');
    }
    this.data = emptyData();
    this.save();
  }

  save() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
    fs.renameSync(tmp, DATA_FILE);
  }

  // Inventory
  getAllInventory() {
    return this.data.inventory || [];
  }

  addInventoryItem(itemId, name, quantity, price = 0, unit = 'tablets', updatedBy = '') {
    const qty = parseInt(quantity, 10) || 0;
    const prc = parseFloat(price) || 0;
    const existing = this.data.inventory.find(i => i.itemId === itemId);
    const now = new Date().toISOString();

    if (existing) {
      existing.quantity = (parseInt(existing.quantity, 10) || 0) + qty;
      if (name) existing.name = name;
      if (price) existing.price = prc;
      if (unit) existing.unit = unit;
      existing.updatedBy = updatedBy;
      existing.lastUpdated = now;
      this.save();
      return existing;
    }

    const newItem = {
      itemId, name, quantity: qty, price: prc, unit,
      docType: 'inventory', updatedBy, timestamp: now, lastUpdated: now,
    };
    this.data.inventory.unshift(newItem);
    this.save();
    return newItem;
  }

  deductInventoryItem(itemId, quantity) {
    const qty = parseInt(quantity, 10) || 0;
    const item = this.data.inventory.find(i => i.itemId === itemId);
    if (!item) {
      throw new Error(`Item ${itemId} not found in inventory`);
    }
    const currentQty = parseInt(item.quantity, 10) || 0;
    if (currentQty < qty) {
      throw new Error(`Insufficient stock for ${item.name} (${item.itemId}). Requested: ${qty}, In stock: ${currentQty}`);
    }
    item.quantity = currentQty - qty;
    item.lastUpdated = new Date().toISOString();
    this.save();
    return item;
  }

  // Patients
  checkPatientExists(patientId) {
    return Boolean(this.data.patients[patientId]);
  }

  getPatientProfile(patientId) {
    return this.data.patients[patientId] || null;
  }

  createPatient(patientId, name, age) {
    const existing = this.data.patients[patientId];
    if (existing) return existing;
    const newPatient = { patientId, accessList: [], createdAt: new Date().toISOString() };
    if (name) newPatient.name = name;
    if (age !== undefined && age !== null && age !== '') newPatient.age = parseInt(age, 10);
    this.data.patients[patientId] = newPatient;
    this.save();
    return newPatient;
  }

  getAccessList(patientId) {
    const patient = this.getPatientProfile(patientId);
    return patient ? (patient.accessList || []) : [];
  }

  grantAccess(patientId, requesterId) {
    const patient = this.createPatient(patientId);
    if (!patient.accessList) patient.accessList = [];
    if (!patient.accessList.includes(requesterId)) {
      patient.accessList.push(requesterId);
      this.save();
    }
    return { success: true, patientId, accessList: patient.accessList };
  }

  revokeAccess(patientId, requesterId) {
    const patient = this.getPatientProfile(patientId);
    if (!patient) return { success: true, patientId, accessList: [] };
    patient.accessList = (patient.accessList || []).filter(id => id !== requesterId);
    this.save();
    return { success: true, patientId, accessList: patient.accessList };
  }

  // Bills & Prescriptions
  createBill(billId, patientId, user, amount, medicineList, ipfsHash, templateName = 'Custom Prescription') {
    const newBill = {
      billId: billId || `BILL_${Date.now()}`,
      patientId,
      templateName,
      amount: parseFloat(amount) || 0,
      issuedBy: user,
      medicineList: typeof medicineList === 'string' ? JSON.parse(medicineList) : medicineList,
      ipfsHash,
      issuedAt: new Date().toISOString(),
      status: 'BILLED'
    };
    this.data.bills.unshift(newBill);
    this.save();
    return newBill;
  }

  getPatientBills(patientId) {
    return this.data.bills.filter(b => b.patientId === patientId);
  }

  getAllBills() {
    return this.data.bills || [];
  }

  // Employees
  getAllEmployees() {
    return this.data.employees || [];
  }

  registerEmployee(userId, role, name, metadata = {}) {
    const existing = this.data.employees.find(e => e.userId === userId);
    if (existing) {
      existing.role = role;
      existing.name = name;
      existing.metadata = metadata;
      this.save();
      return existing;
    }
    const newEmp = {
      userId,
      role,
      name,
      dept: metadata.dept || 'Pharmacy Services',
      metadata
    };
    this.data.employees.push(newEmp);
    this.save();
    return newEmp;
  }
}

module.exports = new PharmacyStore();
