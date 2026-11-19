'use strict';

/**
 * intake.js — what happens to the symptoms entered at registration or when a
 * visit is opened:
 *   1. match them against the published code template → provisional code
 *   2. run the symptom analysis agent
 *   3. pin the intake document (symptoms, match, AI output) to IPFS
 *   4. append its CID to the patient's DID
 *   5. record the provisional code, with the AI-suggested codes, on the ledger
 */

const codes = require('./diseaseCodes');
const { analyseSymptoms } = require('./symptomAgent');
const { emit } = require('./dashboardEmitter');

async function runIntake(contract, ipfs, { patientId, symptoms, age, gender, visitId = '', recordedBy }) {
  const template = await codes.loadTemplate(contract, ipfs);
  const match = codes.matchSymptoms(symptoms, template.document);
  const ai = await analyseSymptoms({ symptoms, age, gender }, template.document);
  emit(ai.status === 'OK' ? 'AGENT_EXECUTION_COMPLETED' : 'AGENT_EXECUTION_FAILED', {
    source: 'peer0-api', org: 'HospitalMSP', severity: ai.status === 'OK' ? 'INFO' : 'WARNING',
    payload: {
      agentId: 'symptom-agent', status: ai.status === 'OK' ? 'COMPLETED' : 'FAILED',
      durationMs: ai.durationMs, model: ai.model,
      ...(ai.status === 'OK' ? {} : { errorCode: 'MODEL_UNAVAILABLE' }),
    },
  });

  const intake = {
    _type: 'SYMPTOM_ANALYSIS', _version: 1,
    patientId, visitId, recordedBy, recordedAt: new Date().toISOString(),
    symptoms,
    template: { cid: template.cid, version: template.version, codeSystem: template.codeSystem },
    templateMatch: match,
    aiAnalysis: ai,
  };
  const cid = await ipfs.pinJSON(intake, `intake-${patientId}${visitId ? `-${visitId}` : ''}.json`);

  await contract.submitTransaction('DidContract:AppendDocument', patientId, cid, 'SYMPTOM_ANALYSIS', visitId, 'Symptoms and AI cross-reference');
  const record = codes.parse(await contract.submitTransaction(
    'CodeContract:AssignProvisionalCode',
    patientId, match.provisional.code, match.provisional.name, visitId,
    JSON.stringify(ai.suggestedCodes.map(c => c.code)), cid
  ));

  return { analysisCid: cid, provisional: match.provisional, templateMatch: match, aiAnalysis: ai, diseaseCode: record };
}

module.exports = { runIntake };
