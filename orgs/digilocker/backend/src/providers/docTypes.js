'use strict';

const DOC_TYPES = ['LAB_REPORT', 'PRESCRIPTION', 'DISCHARGE_SUMMARY', 'IMMUNIZATION', 'HEALTH_ID', 'INSURANCE', 'OTHER'];

// Maps whatever DigiLocker says about a document to the vault's categories.
function classify(...hints) {
  const text = hints.filter(Boolean).join(' ').toLowerCase();
  if (/prescri|\brx\b/.test(text)) return 'PRESCRIPTION';
  if (/discharge/.test(text)) return 'DISCHARGE_SUMMARY';
  if (/vaccin|immuni/.test(text)) return 'IMMUNIZATION';
  if (/\babha\b|health id|health account/.test(text)) return 'HEALTH_ID';
  if (/insur|policy|mediclaim/.test(text)) return 'INSURANCE';
  if (/\blab\b|laborat|diagnos|patholog|radiolog|test report|blood|report/.test(text)) return 'LAB_REPORT';
  return 'OTHER';
}

const safeId = (value, fallback = 'unknown') => {
  const cleaned = String(value || '').replace(/[^A-Za-z0-9._:-]/g, '-').replace(/^[^A-Za-z0-9]+/, '').slice(0, 64);
  return cleaned || fallback;
};

module.exports = { DOC_TYPES, classify, safeId };
