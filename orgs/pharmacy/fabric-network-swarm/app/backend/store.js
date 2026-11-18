'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'pharmacy_store.json');

const INITIAL_DATA = {
  inventory: [
    {
      itemId: 'MED-001',
      name: 'Amoxicillin 500mg',
      quantity: 250,
      price: 15.50,
      unit: 'capsules',
      docType: 'inventory',
      patientId: 'PAT-001',
      ipfsHash: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
      timestamp: '2026-03-10T10:00:00.000Z',
      lastUpdated: '2026-03-15T08:30:00.000Z'
    },
    {
      itemId: 'MED-002',
      name: 'Ibuprofen 400mg',
      quantity: 180,
      price: 8.25,
      unit: 'tablets',
      docType: 'inventory',
      patientId: 'PAT-001',
      ipfsHash: 'QmZtmD2qt8fJpq3CLDH8WeiuAsTueVf7xH3ppW5xVa2hGr',
      timestamp: '2026-03-10T10:05:00.000Z',
      lastUpdated: '2026-03-15T08:30:00.000Z'
    },
    {
      itemId: 'MED-003',
      name: 'Metformin 850mg',
      quantity: 340,
      price: 12.00,
      unit: 'tablets',
      docType: 'inventory',
      patientId: 'PAT-014',
      ipfsHash: 'QmSnuWmxpt943pNxD2f2nv563MGgPwnqcm1DY8GUP756Z4',
      timestamp: '2026-03-11T11:00:00.000Z',
      lastUpdated: '2026-03-14T09:15:00.000Z'
    },
    {
      itemId: 'MED-004',
      name: 'Atorvastatin 20mg',
      quantity: 120,
      price: 24.50,
      unit: 'tablets',
      docType: 'inventory',
      patientId: 'PAT-014',
      ipfsHash: 'QmR7GSQM93Cx5eAg6a6yRzNde1FQv7uL6X1o4k7zrJa3LX',
      timestamp: '2026-03-11T11:05:00.000Z',
      lastUpdated: '2026-03-14T09:15:00.000Z'
    },
    {
      itemId: 'MED-005',
      name: 'Lisinopril 10mg',
      quantity: 200,
      price: 18.00,
      unit: 'tablets',
      docType: 'inventory',
      patientId: 'PAT-021',
      ipfsHash: 'QmW2WQi7j6c7UgJTarActp7tCMjg842eqBgPU46ce7PxWG',
      timestamp: '2026-03-12T14:20:00.000Z',
      lastUpdated: '2026-03-12T14:20:00.000Z'
    },
    {
      itemId: 'MED-006',
      name: 'Paracetamol 500mg',
      quantity: 500,
      price: 5.00,
      unit: 'tablets',
      docType: 'inventory',
      patientId: 'PAT-001',
      ipfsHash: 'QmPZ9gcCEpqKTo6aq61g2nXGUhM4iCL3ewB6LDXZEKy29B',
      timestamp: '2026-03-13T09:00:00.000Z',
      lastUpdated: '2026-03-15T09:45:00.000Z'
    },
    {
      itemId: 'MED-007',
      name: 'Metoclopramide 10mg',
      quantity: 95,
      price: 9.50,
      unit: 'tablets',
      docType: 'inventory',
      patientId: 'PAT-001',
      ipfsHash: 'QmQNeY2h9YpZcEms2qKz12B5nKjF8gA6o6QZtq6K8H37fA',
      timestamp: '2026-03-13T09:05:00.000Z',
      lastUpdated: '2026-03-15T09:45:00.000Z'
    },
    {
      itemId: 'MED-008',
      name: 'Epinephrine Auto-Injector',
      quantity: 45,
      price: 85.00,
      unit: 'units',
      docType: 'inventory',
      patientId: 'PAT-021',
      ipfsHash: 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco',
      timestamp: '2026-03-14T16:00:00.000Z',
      lastUpdated: '2026-03-14T16:00:00.000Z'
    },
    {
      itemId: 'MED-009',
      name: 'Salbutamol Inhaler 100mcg',
      quantity: 60,
      price: 22.00,
      unit: 'inhalers',
      docType: 'inventory',
      patientId: 'PAT-014',
      ipfsHash: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
      timestamp: '2026-03-15T12:10:00.000Z',
      lastUpdated: '2026-03-15T12:10:00.000Z'
    },
    {
      itemId: 'MED-010',
      name: 'Hydrocortisone 100mg Injection',
      quantity: 80,
      price: 35.00,
      unit: 'vials',
      docType: 'inventory',
      patientId: 'PAT-001',
      ipfsHash: 'QmZtmD2qt8fJpq3CLDH8WeiuAsTueVf7xH3ppW5xVa2hGr',
      timestamp: '2026-03-15T12:15:00.000Z',
      lastUpdated: '2026-03-15T12:15:00.000Z'
    }
  ],
  patients: {
    'PAT-001': {
      patientId: 'PAT-001',
      name: 'Alice Smith',
      age: 32,
      certAlias: 'user1',
      accessList: ['ph_alice', 'billing_office_1', 'mgr_evelyn'],
      createdAt: '2026-01-15T09:00:00.000Z'
    },
    'PAT-014': {
      patientId: 'PAT-014',
      name: 'Bob Jones',
      age: 45,
      certAlias: 'user2',
      accessList: ['billing_office_1'],
      createdAt: '2026-02-10T11:30:00.000Z'
    },
    'PAT-021': {
      patientId: 'PAT-021',
      name: 'Carol Davis',
      age: 28,
      certAlias: 'user3',
      accessList: ['ph_alice'],
      createdAt: '2026-03-01T14:15:00.000Z'
    },
    'testuser': {
      patientId: 'testuser',
      name: 'John Doe',
      age: 40,
      certAlias: 'user4',
      accessList: ['ph_alice', 'billing_office_1'],
      createdAt: '2026-03-12T08:20:00.000Z'
    }
  },
  employees: [
    {
      userId: 'mgr_evelyn',
      role: 'manager',
      name: 'Dr. Evelyn Vance',
      dept: 'Pharmacy Administration',
      certMapped: 'admin'
    },
    {
      userId: 'ph_alice',
      role: 'billing',
      name: 'Alice Walker, PharmD',
      dept: 'Dispensing & Billing',
      certMapped: 'user10'
    },
    {
      userId: 'inv_charlie',
      role: 'inventory',
      name: 'Charlie Brown',
      dept: 'Supply Chain & Stock',
      certMapped: 'user20'
    },
    {
      userId: 'billing_office_1',
      role: 'billing',
      name: 'Central Billing Desk',
      dept: 'Outpatient Billing',
      certMapped: 'user5'
    }
  ],
  bills: [
    {
      billId: 'BILL_1710001001',
      patientId: 'PAT-001',
      templateName: 'Post-Op Recovery Pack',
      amount: 45.00,
      issuedBy: 'ph_alice',
      medicineList: [
        { name: 'Amoxicillin 500mg', quantity: '20', itemId: 'MED-001' },
        { name: 'Ibuprofen 400mg', quantity: '15', itemId: 'MED-002' }
      ],
      ipfsHash: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
      issuedAt: '2026-03-10T10:15:00.000Z',
      status: 'DISPENSED'
    },
    {
      billId: 'BILL_1710002002',
      patientId: 'PAT-014',
      templateName: 'Chronic Care Monthly',
      amount: 54.50,
      issuedBy: 'billing_office_1',
      medicineList: [
        { name: 'Metformin 850mg', quantity: '60', itemId: 'MED-003' },
        { name: 'Atorvastatin 20mg', quantity: '30', itemId: 'MED-004' }
      ],
      ipfsHash: 'QmSnuWmxpt943pNxD2f2nv563MGgPwnqcm1DY8GUP756Z4',
      issuedAt: '2026-03-11T14:30:00.000Z',
      status: 'DISPENSED'
    },
    {
      billId: 'BILL_1710003003',
      patientId: 'PAT-001',
      templateName: 'Pain Management & Relief',
      amount: 14.50,
      issuedBy: 'ph_alice',
      medicineList: [
        { name: 'Paracetamol 500mg', quantity: '30', itemId: 'MED-006' },
        { name: 'Metoclopramide 10mg', quantity: '10', itemId: 'MED-007' }
      ],
      ipfsHash: 'QmZtmD2qt8fJpq3CLDH8WeiuAsTueVf7xH3ppW5xVa2hGr',
      issuedAt: '2026-03-15T09:45:00.000Z',
      status: 'ACTIVE'
    }
  ]
};

class PharmacyStore {
  constructor() {
    this.data = null;
    this.init();
  }

  init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        this.data = JSON.parse(raw);
      } else {
        this.data = JSON.parse(JSON.stringify(INITIAL_DATA));
        this.save();
      }
    } catch (e) {
      console.warn('[PharmacyStore] Error loading storage file, using in-memory defaults:', e.message);
      this.data = JSON.parse(JSON.stringify(INITIAL_DATA));
    }
  }

  save() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (e) {
      console.error('[PharmacyStore] Failed to write data file:', e.message);
    }
  }

  // Inventory
  getAllInventory() {
    return this.data.inventory || [];
  }

  addInventoryItem(itemId, name, quantity, price = 0, unit = 'tablets', patientId = 'PAT-001', ipfsHash = '') {
    const qty = parseInt(quantity, 10) || 0;
    const prc = parseFloat(price) || 0;
    const existing = this.data.inventory.find(i => i.itemId === itemId);
    const now = new Date().toISOString();

    if (existing) {
      existing.quantity = (parseInt(existing.quantity, 10) || 0) + qty;
      if (name) existing.name = name;
      if (price) existing.price = prc;
      if (unit) existing.unit = unit;
      if (patientId) existing.patientId = patientId;
      if (ipfsHash) existing.ipfsHash = ipfsHash;
      existing.lastUpdated = now;
      this.save();
      return existing;
    }

    const newItem = {
      itemId,
      name,
      quantity: qty,
      price: prc,
      unit,
      docType: 'inventory',
      patientId: patientId || 'PAT-001',
      ipfsHash: ipfsHash || 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
      timestamp: now,
      lastUpdated: now
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
    if (!this.data.patients[patientId]) {
      // Auto-provision patient profile if valid pattern to allow frictionless testing
      this.createPatient(patientId, `Patient ${patientId}`, 30, 'user1');
    }
    return this.data.patients[patientId];
  }

  createPatient(patientId, name, age, certAlias = 'user1') {
    const newPatient = {
      patientId,
      name,
      age: parseInt(age, 10) || 30,
      certAlias,
      accessList: ['ph_alice', 'billing_office_1'],
      createdAt: new Date().toISOString()
    };
    this.data.patients[patientId] = newPatient;
    this.save();
    return newPatient;
  }

  getAccessList(patientId) {
    const patient = this.getPatientProfile(patientId);
    return patient ? (patient.accessList || []) : [];
  }

  grantAccess(patientId, requesterId) {
    const patient = this.getPatientProfile(patientId);
    if (!patient.accessList) patient.accessList = [];
    if (!patient.accessList.includes(requesterId)) {
      patient.accessList.push(requesterId);
      this.save();
    }
    return { success: true, patientId, accessList: patient.accessList };
  }

  revokeAccess(patientId, requesterId) {
    const patient = this.getPatientProfile(patientId);
    if (patient && patient.accessList) {
      patient.accessList = patient.accessList.filter(id => id !== requesterId);
      this.save();
      return { success: true, patientId, accessList: patient.accessList };
    }
    return { success: true, patientId, accessList: [] };
  }

  // Bills & Prescriptions
  createBill(billId, patientId, user, amount, medicineList, ipfsHash, templateName = 'Custom Prescription') {
    const newBill = {
      billId: billId || `BILL_${Date.now()}`,
      patientId,
      templateName,
      amount: parseFloat(amount) || 0,
      issuedBy: user || 'ph_alice',
      medicineList: typeof medicineList === 'string' ? JSON.parse(medicineList) : medicineList,
      ipfsHash,
      issuedAt: new Date().toISOString(),
      status: 'DISPENSED',
      txId: `tx_${Math.random().toString(36).substring(2, 12)}`
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
      certMapped: `user${(this.data.employees.length % 50) + 1}`,
      metadata
    };
    this.data.employees.push(newEmp);
    this.save();
    return newEmp;
  }
}

module.exports = new PharmacyStore();
