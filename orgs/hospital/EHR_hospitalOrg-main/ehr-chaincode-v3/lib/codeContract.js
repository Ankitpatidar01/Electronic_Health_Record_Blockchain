'use strict';

const { Contract } = require('fabric-contract-api');
const { requireRole, assertReadAccess, getCallerIdentity, now, getState, putState } = require('./accessControl');
const did = require('./did');

// ─────────────────────────────────────────────────────────────────────────────
// CodeContract — the shared disease-code template and each patient's code history.
//
//   CODETPL            → the template every organisation uses: its IPFS CID,
//                        version and SHA-256, plus every earlier version
//   DCODE:<patientId>  → current code and an append-only history
//
// A code is first assigned provisionally at registration (matched from the
// symptoms against the template). After consultation a doctor confirms or
// changes it. Every step is a new history entry with old code, new code, who,
// why and when; nothing is overwritten.
// ─────────────────────────────────────────────────────────────────────────────

const TEMPLATE_KEY = 'CODETPL';
const codeKey = (patientId) => `DCODE:${patientId}`;

const ICD10_RE  = /^[A-Z][0-9]{2}(\.[0-9A-Z]{1,4})?$/;
const CID_RE    = /^(?:b[a-z2-7]{20,120}|Qm[1-9A-HJ-NP-Za-km-z]{44})$/;
const SHA256_RE = /^[a-f0-9]{64}$/;

function parseCodes(json) {
  let list;
  try { list = JSON.parse(json || '[]'); } catch (_) { throw new Error('aiCodesJson must be a JSON array of codes'); }
  if (!Array.isArray(list)) throw new Error('aiCodesJson must be a JSON array of codes');
  return [...new Set(list.map(String).filter(c => ICD10_RE.test(c)))].slice(0, 10);
}

class CodeContract extends Contract {
  constructor() {
    super('CodeContract');
  }

  // Hospital administrator publishes a template version.
  async SetTemplate(ctx, cid, version, sha256, codeSystem) {
    const { userId } = requireRole(ctx, 'admin');
    if (!CID_RE.test(cid || ''))       throw new Error('cid is not a valid IPFS CID');
    if (!SHA256_RE.test(sha256 || '')) throw new Error('sha256 must be a 64-character lowercase hex digest');
    if (!version)                      throw new Error('version is required');

    const template = (await getState(ctx, TEMPLATE_KEY)) || { docType: 'codeTemplate', history: [] };
    if (template.cid === cid) throw new Error('This template version is already current');
    if (template.cid) {
      template.history.push({ cid: template.cid, version: template.version, sha256: template.sha256, setBy: template.setBy, setAt: template.setAt });
    }
    template.cid = cid;
    template.version = String(version);
    template.sha256 = sha256;
    template.codeSystem = codeSystem || 'ICD-10';
    template.setBy = userId;
    template.setAt = now(ctx);
    await putState(ctx, TEMPLATE_KEY, template);
    return JSON.stringify(template);
  }

  async GetTemplate(ctx) {
    getCallerIdentity(ctx);
    const template = await getState(ctx, TEMPLATE_KEY);
    return JSON.stringify(template || null);
  }

  // Reception records the code matched from the symptoms given at registration
  // (or when a new visit is opened), with the codes the AI agent suggested.
  async AssignProvisionalCode(ctx, patientId, code, name, visitId, aiCodesJson, analysisCid) {
    const { userId, role, mspId } = requireRole(ctx, 'receptionist', 'admin');
    if (!ICD10_RE.test(code || '')) throw new Error(`'${code}' is not a valid ICD-10 code`);
    if (analysisCid && !CID_RE.test(analysisCid)) throw new Error('analysisCid is not a valid IPFS CID');
    const template = await getState(ctx, TEMPLATE_KEY);
    if (!template || !template.cid) throw new Error('No disease-code template has been published');
    if (!(await did.readJson(ctx, `PATIENT:${patientId}`))) throw new Error(`Patient not found: ${patientId}`);

    const didRecord = await did.ensureDid(ctx, patientId);
    const record = (await getState(ctx, codeKey(patientId))) || {
      docType: 'diseaseCode', patientId, did: didRecord.did, currentCode: '', currentName: '', status: '', history: [],
    };
    record.history.push({
      seq: record.history.length + 1, action: 'PROVISIONAL',
      oldCode: record.currentCode, newCode: code, name: String(name || '').slice(0, 160),
      by: userId, role, mspId,
      reason: 'Matched from reported symptoms against the code template',
      visitId: visitId || '', templateCid: template.cid, templateVersion: template.version,
      aiSuggestedCodes: parseCodes(aiCodesJson), analysisCid: analysisCid || '',
      timestamp: now(ctx), txId: ctx.stub.getTxID(),
    });
    record.currentCode = code;
    record.currentName = String(name || '').slice(0, 160);
    record.status = 'PROVISIONAL';
    await putState(ctx, codeKey(patientId), record);
    return JSON.stringify(record);
  }

  // Doctor confirms the current code (same code) or changes it (reason required).
  async UpdateDiseaseCode(ctx, patientId, newCode, name, reason, visitId) {
    const { userId, role, mspId } = requireRole(ctx, 'doctor');
    if (!ICD10_RE.test(newCode || '')) throw new Error(`'${newCode}' is not a valid ICD-10 code`);
    const template = await getState(ctx, TEMPLATE_KEY);
    if (!template || !template.cid) throw new Error('No disease-code template has been published');
    if (!(await did.readJson(ctx, `PATIENT:${patientId}`))) throw new Error(`Patient not found: ${patientId}`);

    const didRecord = await did.ensureDid(ctx, patientId);
    const record = (await getState(ctx, codeKey(patientId))) || {
      docType: 'diseaseCode', patientId, did: didRecord.did, currentCode: '', currentName: '', status: '', history: [],
    };
    const same = record.currentCode === newCode;
    if (same && record.status === 'CONFIRMED') throw new Error(`Code ${newCode} is already confirmed`);
    const why = String(reason || '').trim();
    if (!same && why.length < 3) throw new Error('A reason is required when changing the code');

    const lastProvisional = [...record.history].reverse().find(h => h.action === 'PROVISIONAL');
    const aiCodes = lastProvisional ? lastProvisional.aiSuggestedCodes : [];
    record.history.push({
      seq: record.history.length + 1, action: same ? 'CONFIRMED' : 'CHANGED',
      oldCode: record.currentCode, newCode, name: String(name || '').slice(0, 160),
      by: userId, role, mspId,
      reason: why.slice(0, 500) || 'Confirmed after consultation',
      visitId: visitId || '', templateCid: template.cid, templateVersion: template.version,
      aiSuggestedCodes: aiCodes,
      matchesAiSuggestion: aiCodes.includes(newCode),
      matchesProvisional: lastProvisional ? lastProvisional.newCode === newCode : false,
      timestamp: now(ctx), txId: ctx.stub.getTxID(),
    });
    record.currentCode = newCode;
    record.currentName = String(name || '').slice(0, 160);
    record.status = 'CONFIRMED';
    await putState(ctx, codeKey(patientId), record);
    return JSON.stringify(record);
  }

  async GetDiseaseCode(ctx, patientId) {
    await assertReadAccess(ctx, patientId, 'visits');
    const record = await getState(ctx, codeKey(patientId));
    return JSON.stringify(record || { patientId, currentCode: '', currentName: '', status: '', history: [] });
  }
}

module.exports = { CodeContract };
