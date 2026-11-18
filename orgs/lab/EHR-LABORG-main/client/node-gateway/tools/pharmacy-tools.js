'use strict';

/**
 * Pharmacy Tools Module
 * Author: Sushil (Tool Layer & VCAP Lead)
 * Module: Tool Abstraction Layer - Pharmacy Organization HTTP Bridges
 *
 * Provides safe REST HTTP interfaces to query Pharmacy organization data
 * (runs on mychannel, separate network on port 3000) via off-chain HTTP.
 */

const BASE_URL = process.env.PHARMACY_API_URL || 'http://localhost:3000';
const INVENTORY_PATH = process.env.PHARMACY_INVENTORY_PATH || '/api/inventory';
const BILL_PATH = process.env.PHARMACY_BILL_PATH || '/api/billing';
const DEDUCT_PATH = process.env.PHARMACY_DEDUCT_PATH || '/api/inventory/deduct';

const MOCK_INVENTORY = [
  { medication: 'iron', quantity: 25, available: true },
  { medication: 'paracetamol', quantity: 100, available: true }
];

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    throw new Error(`Pharmacy API ${response.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }
  return body;
}

function unwrap(body) {
  if (body && Object.prototype.hasOwnProperty.call(body, 'result')) return body.result;
  if (body && Object.prototype.hasOwnProperty.call(body, 'data')) return body.data;
  return body;
}

/**
 * Check drug inventory stock levels.
 * @param {Object|string} [input] - { medication } or medication string
 * @param {{ mock?: boolean }} [options]
 */
async function checkInventory(input = {}, { mock = false } = {}) {
  const query = typeof input === 'string' ? { medication: input } : (input || {});

  if (mock) {
    if (query.medication) {
      const match = MOCK_INVENTORY.find(x => x.medication.toLowerCase() === String(query.medication).toLowerCase());
      return match || { medication: query.medication, quantity: 0, available: false };
    }
    return MOCK_INVENTORY;
  }

  const inventory = unwrap(await request(INVENTORY_PATH));
  if (!query.medication) return inventory;

  const wanted = String(query.medication).toLowerCase();
  const items = Array.isArray(inventory) ? inventory : [];
  return items.find(item => String(item.name || item.medication || item.itemId || '').toLowerCase() === wanted)
    || { medication: query.medication, quantity: 0, available: false };
}

/**
 * Check medication availability.
 * @param {Object|string} input - { medication } or medication string
 * @param {{ mock?: boolean }} [options]
 */
async function checkMedication(input = {}, { mock = false } = {}) {
  const medication = typeof input === 'string' ? input : (input.medication || input.name || input.drug);
  if (!medication) throw new Error('medication is required');

  if (mock) {
    return { medication, available: true, quantity: 25, mock: true };
  }
  return checkInventory({ medication }, { mock: false });
}

/**
 * Submit billing record to Pharmacy organization.
 * @param {Object} input
 * @param {{ mock?: boolean }} [options]
 */
async function createBill(input, { mock = false } = {}) {
  if (!input || typeof input !== 'object') throw new Error('input is required');
  if (mock) {
    return { billId: 'mock-bill-001', ...input, created: true, mock: true };
  }
  return unwrap(await request(BILL_PATH, { method: 'POST', body: JSON.stringify(input) }));
}

/**
 * Deduct inventory for fulfilled medication.
 * @param {Object} input
 * @param {{ mock?: boolean }} [options]
 */
async function deductInventory(input, { mock = false } = {}) {
  if (!input || typeof input !== 'object') throw new Error('input is required');
  if (mock) {
    return { ...input, deducted: true, mock: true };
  }
  return unwrap(await request(DEDUCT_PATH, { method: 'POST', body: JSON.stringify(input) }));
}

module.exports = {
  checkInventory,
  checkMedication,
  createBill,
  deductInventory
};
