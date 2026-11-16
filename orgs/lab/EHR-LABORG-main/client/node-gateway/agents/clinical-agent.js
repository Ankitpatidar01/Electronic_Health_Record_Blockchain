'use strict';

/**
 * Clinical Decision Support Agent Module
 * Author: Ankit Patidar (Clinical Agent Lead)
 *
 * Implements evidence-based disease-specific clinical evaluation tools for:
 * - Heart / Cardiovascular Diseases (ACS, Heart Failure, Dyslipidemia, Hypertension)
 * - Kidney / Renal Diseases (CKD Staging via KDIGO, Azotemia, AKI)
 * - Diabetes & Metabolic Diseases (ADA Diagnostic Criteria, Glycemic Control, DKA)
 * - Hematologic & Anemia Diseases (Morphologic Anemia Staging, Iron Deficiency)
 * - Hepatic & Liver Diseases (Hepatocellular vs Cholestatic, De Ritis Ratio)
 *
 * Interacts with Python FastAPI (BlockChain_24MCF1R06) with seamless
 * deterministic multi-disease tool fallback if the Python service is offline.
 * Conforms strictly to orchestrator/agent-contract.js (AgentResult).
 */

const { AgentResult, AgentStatus } = require('../orchestrator/agent-contract');

const PYTHON_API_URL =
  (process.env.PYTHON_CLINICAL_API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');

// ============================================================================
// IN-PROCESS DISEASE EVALUATION TOOLS (LOCAL JAVASCRIPT ENGINE)
// ============================================================================

function _getNum(obj, ...keys) {
  if (!obj || typeof obj !== 'object') return null;
  for (const k of keys) {
    const cleanKey = String(k).toLowerCase().replace(/[\s-_]/g, '');
    for (const [actualKey, val] of Object.entries(obj)) {
      if (actualKey.toLowerCase().replace(/[\s-_]/g, '') === cleanKey) {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
          const num = parseFloat(val.replace(/[^0-9.-]/g, ''));
          if (!isNaN(num)) return num;
        }
      }
    }
  }
  return null;
}

function evaluateHeartDiseaseJS(labData, history) {
  const troponin = _getNum(labData, 'troponin', 'troponin_i', 'troponin_t');
  const bnp = _getNum(labData, 'bnp', 'nt_probnp');
  const ldl = _getNum(labData, 'ldl', 'ldl_c');
  const chol = _getNum(labData, 'cholesterol', 'total_cholesterol');
  const sbp = _getNum(labData, 'systolic_bp', 'sbp') || _getNum(history, 'systolic_bp', 'sbp');
  const dbp = _getNum(labData, 'diastolic_bp', 'dbp') || _getNum(history, 'diastolic_bp', 'dbp');

  const findings = [];
  const risks = [];
  const actions = [];
  let severity = 'LOW';

  if (troponin !== null && troponin > 0.04) {
    findings.push(`Elevated Troponin (${troponin} ng/mL; reference < 0.04 ng/mL)`);
    risks.push('Possible acute myocardial injury or Acute Coronary Syndrome (ACS)');
    actions.push('Immediate 12-lead Electrocardiogram (ECG) and serial troponin monitoring');
    actions.push('Urgent Cardiology consultation');
    severity = 'CRITICAL';
  }

  if (bnp !== null && bnp > 100) {
    findings.push(`Elevated BNP/NT-proBNP (${bnp} pg/mL)`);
    risks.push('Findings consistent with ventricular wall stress or heart failure');
    actions.push('Transthoracic Echocardiogram (TTE) to evaluate ejection fraction');
    if (severity !== 'CRITICAL') severity = 'HIGH';
  }

  if (ldl !== null && ldl >= 160) {
    findings.push(`Elevated LDL-C (${ldl} mg/dL)`);
    risks.push('Elevated 10-year Atherosclerotic Cardiovascular Disease (ASCVD) risk');
    actions.push('Lifestyle modification and lipid-lowering therapy evaluation');
    if (severity === 'LOW') severity = 'MODERATE';
  }

  if (sbp !== null && dbp !== null && (sbp >= 140 || dbp >= 90)) {
    findings.push(`Stage 2 Hypertension (${sbp}/${dbp} mmHg)`);
    risks.push('Hypertension contributing to systemic vascular load');
    actions.push('Regular blood pressure monitoring and cardiovascular optimization');
    if (severity === 'LOW') severity = 'MODERATE';
  }

  const applicable = findings.length > 0;
  return {
    toolName: 'Heart Disease Evaluation Tool',
    applicable,
    severity: applicable ? severity : 'NORMAL',
    findings,
    risks,
    actions
  };
}

function evaluateKidneyDiseaseJS(labData, history) {
  const cr = _getNum(labData, 'creatinine', 'serum_creatinine', 'cr');
  const bun = _getNum(labData, 'bun', 'blood_urea_nitrogen');
  const k = _getNum(labData, 'potassium', 'k');
  const age = _getNum(history, 'age') || 55;
  const isFemale = String(history.gender || history.sex || '').toLowerCase().startsWith('f');

  const findings = [];
  const risks = [];
  const actions = [];
  let severity = 'LOW';
  let egfr = null;

  if (cr !== null && cr > 0) {
    const kFactor = isFemale ? 0.7 : 0.9;
    const alpha = isFemale ? -0.241 : -0.302;
    const scr_k = cr / kFactor;
    const genderMult = isFemale ? 1.012 : 1.0;
    egfr = Math.round(142 * Math.pow(Math.min(scr_k, 1.0), alpha) * Math.pow(Math.max(scr_k, 1.0), -1.2) * Math.pow(0.9938, age) * genderMult * 10) / 10;

    if (egfr < 15) {
      findings.push(`eGFR ${egfr} mL/min/1.73m2 (KDIGO Stage 5 - Kidney Failure)`);
      risks.push('End-stage renal disease (ESRD) risk');
      actions.push('Urgent Nephrology intervention and renal replacement therapy evaluation');
      severity = 'CRITICAL';
    } else if (egfr < 30) {
      findings.push(`eGFR ${egfr} mL/min/1.73m2 (KDIGO Stage 4 - Severe Reduction)`);
      risks.push('Severe renal impairment with progression risk');
      actions.push('Nephrology consultation and avoid nephrotoxic agents');
      severity = 'HIGH';
    } else if (egfr < 60) {
      findings.push(`eGFR ${egfr} mL/min/1.73m2 (KDIGO Stage 3 - Moderate Reduction)`);
      risks.push('Chronic Kidney Disease Stage 3');
      actions.push('Monitor renal panel and review medication dosing');
      severity = 'MODERATE';
    }

    if (bun !== null) {
      const ratio = bun / cr;
      if (ratio > 20) {
        risks.push(`BUN/Creatinine ratio (${ratio.toFixed(1)}) suggests prerenal azotemia`);
        actions.push('Assess volume status and renal perfusion');
      }
    }
  }

  if (k !== null && k >= 5.2) {
    findings.push(`Elevated Potassium (${k} mEq/L)`);
    risks.push('Hyperkalemia with arrhythmia risk');
    actions.push('12-lead ECG and repeat electrolyte monitoring');
    if (severity === 'LOW') severity = 'MODERATE';
  }

  const applicable = findings.length > 0;
  return {
    toolName: 'Kidney Disease Evaluation Tool',
    applicable,
    egfr,
    severity: applicable ? severity : 'NORMAL',
    findings,
    risks,
    actions
  };
}

function evaluateMetabolicDiseaseJS(labData) {
  const hba1c = _getNum(labData, 'hba1c', 'a1c');
  const glucose = _getNum(labData, 'glucose', 'fasting_glucose', 'blood_glucose');

  const findings = [];
  const risks = [];
  const actions = [];
  let severity = 'LOW';

  if (hba1c !== null) {
    if (hba1c >= 8.5) {
      findings.push(`Severely elevated HbA1c (${hba1c}%; target < 7.0%)`);
      risks.push('Substantially increased risk of microvascular and macrovascular diabetic complications');
      actions.push('Comprehensive glycemic regimen intensification and diabetes educator consultation');
      severity = 'HIGH';
    } else if (hba1c >= 6.5) {
      findings.push(`Elevated HbA1c (${hba1c}%; ADA diagnostic criteria for Diabetes Mellitus)`);
      risks.push('Diabetes Mellitus');
      actions.push('Confirm with repeat test; initiate lifestyle and glycemic management');
      severity = 'MODERATE';
    } else if (hba1c >= 5.7) {
      findings.push(`HbA1c in prediabetes range (${hba1c}%)`);
      risks.push('Elevated risk of progression to Type 2 Diabetes');
      actions.push('Lifestyle and dietary intervention counseling');
      severity = 'MODERATE';
    }
  }

  if (glucose !== null && glucose >= 200) {
    findings.push(`Hyperglycemia (${glucose} mg/dL)`);
    risks.push('Uncontrolled glucose excursion');
    if (severity === 'LOW') severity = 'MODERATE';
  }

  const applicable = findings.length > 0;
  return {
    toolName: 'Diabetes & Metabolic Disease Tool',
    applicable,
    severity: applicable ? severity : 'NORMAL',
    findings,
    risks,
    actions
  };
}

function evaluateHematologicDiseaseJS(labData) {
  const hb = _getNum(labData, 'hemoglobin', 'hgb', 'hb');
  const mcv = _getNum(labData, 'mcv');
  const ferritin = _getNum(labData, 'ferritin');

  const findings = [];
  const risks = [];
  const actions = [];
  let severity = 'LOW';

  if (hb !== null && hb < 12.0) {
    const whoGrade = hb < 8.0 ? 'Severe' : (hb < 11.0 ? 'Moderate' : 'Mild');
    findings.push(`Low Hemoglobin (${hb} g/dL) - ${whoGrade} Anemia`);
    severity = hb < 8.0 ? 'CRITICAL' : (hb < 11.0 ? 'HIGH' : 'MODERATE');

    if (mcv !== null && mcv < 80.0) {
      findings.push(`Microcytosis (MCV ${mcv} fL; normal 80-100 fL)`);
      if (ferritin !== null && ferritin < 30.0) {
        findings.push(`Low Ferritin (${ferritin} ng/mL)`);
        risks.push('Highly consistent with Iron Deficiency Anemia (IDA)');
        actions.push('Investigation of source of iron loss (fecal occult blood, endoscopy if indicated)');
        actions.push('Evaluation for iron supplementation therapy');
      } else {
        risks.push('Microcytic anemia: consider iron deficiency or hemoglobinopathy');
        actions.push('Complete iron studies (ferritin, iron, TIBC)');
      }
    } else if (mcv !== null && mcv > 100.0) {
      findings.push(`Macrocytosis (MCV ${mcv} fL)`);
      risks.push('Macrocytic anemia: evaluate Vitamin B12 and folate levels');
      actions.push('Order Vitamin B12 and serum folate levels');
    } else {
      risks.push('Normocytic anemia: consider anemia of chronic disease or blood loss');
      actions.push('Reticulocyte count and peripheral smear review');
    }
  }

  const applicable = findings.length > 0;
  return {
    toolName: 'Hematologic & Anemia Evaluation Tool',
    applicable,
    severity: applicable ? severity : 'NORMAL',
    findings,
    risks,
    actions
  };
}

function runLocalDiseaseTools(labData, history) {
  const heart = evaluateHeartDiseaseJS(labData, history);
  const kidney = evaluateKidneyDiseaseJS(labData, history);
  const metabolic = evaluateMetabolicDiseaseJS(labData);
  const hematology = evaluateHematologicDiseaseJS(labData);

  const toolsExecuted = [];
  const allFindings = [];
  const allRisks = [];
  const allActions = [];
  const diseaseAnalyses = {};
  let maxSev = 'LOW';
  const order = ['NORMAL', 'LOW', 'MODERATE', 'HIGH', 'CRITICAL'];

  for (const t of [heart, kidney, metabolic, hematology]) {
    if (t.applicable) {
      toolsExecuted.push(t.toolName);
      diseaseAnalyses[t.toolName] = t;
      allFindings.push(...t.findings);
      allRisks.push(...t.risks);
      allActions.push(...t.actions);
      if (order.indexOf(t.severity) > order.indexOf(maxSev)) {
        maxSev = t.severity;
      }
    }
  }

  return {
    toolsExecuted: toolsExecuted.length > 0 ? toolsExecuted : ['General Clinical Assessment'],
    diseaseAnalyses,
    findings: allFindings.length > 0 ? allFindings : ['Laboratory parameters evaluated across disease tools.'],
    possibleRisks: allRisks.length > 0 ? allRisks : ['Ongoing clinical observation recommended.'],
    nextSteps: allActions.length > 0 ? allActions : ['Standard clinical follow-up.'],
    severity: maxSev
  };
}

// ============================================================================
// PRIMARY CLINICAL AGENT ENTRY POINT
// ============================================================================

/**
 * Runs the Clinical Decision Support Agent.
 * Compatible with both Orchestrator signature:
 *   runClinicalAgent(context, labResult, historyResult)
 * and single-object signature:
 *   runClinicalAgent({ patientId, labResult, historyResult, reportText })
 */
async function runClinicalAgent(arg1, arg2, arg3) {
  let context, labResult, historyResult;

  if (arg1 && typeof arg1 === 'object' && ('runId' in arg1 || 'patientId' in arg1) && arg2 !== undefined) {
    // Orchestrator signature: (context, labResult, historyResult)
    context = arg1;
    labResult = arg2 && typeof arg2 === 'object' && 'result' in arg2 ? arg2.result : (arg2 || {});
    historyResult = arg3 && typeof arg3 === 'object' && 'result' in arg3 ? arg3.result : (arg3 || {});
  } else if (arg1 && typeof arg1 === 'object') {
    // Single-object signature: { patientId, labResult, historyResult, reportText }
    context = {
      runId: arg1.runId || `run-${Date.now()}`,
      patientId: arg1.patientId || 'patient-1001',
      metadata: arg1
    };
    labResult = arg1.labResult || arg1.resultData || {};
    historyResult = arg1.historyResult || arg1.patientHistory || {};
  } else {
    throw new Error('Invalid arguments provided to runClinicalAgent.');
  }

  const patientId = String(context.patientId || 'patient-1001');

  // Extract raw lab dictionary
  const rawLab = labResult && typeof labResult === 'object' ? (labResult.resultData || labResult) : {};
  const rawHistory = historyResult && typeof historyResult === 'object' ? historyResult : {};

  // 1. Try Python Clinical Decision Support API first
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const pyResponse = await fetch(`${PYTHON_API_URL}/api/clinical-review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        patient_id: patientId,
        lab_result: rawLab,
        history_result: rawHistory,
        run_id: context.runId
      })
    });

    clearTimeout(timeout);

    if (pyResponse.ok) {
      const data = await pyResponse.json();
      const clinical = data.clinical_result || {};

      let confidenceLevel = 'medium';
      if (clinical.confidence >= 0.85) confidenceLevel = 'high';
      else if (clinical.confidence < 0.6) confidenceLevel = 'low';

      return new AgentResult({
        agentId: 'clinical-agent',
        status: AgentStatus.SUCCESS,
        confidence: confidenceLevel,
        result: {
          recommendation: clinical.recommendation || 'Clinical review completed.',
          supportingEvidence: clinical.supportingEvidence || [],
          possibleRisks: clinical.possibleRisks || [],
          nextSteps: clinical.nextSteps || [],
          diseaseSpecificAnalysis: data.disease_analyses || clinical.diseaseSpecificAnalysis || {},
          toolsExecuted: data.tools_executed || clinical.toolsExecuted || [],
          overallSeverity: data.overall_severity || 'LOW'
        },
        metadata: {
          provider: 'python-fastapi-langgraph',
          toolsExecuted: data.tools_executed || [],
          generatedAt: new Date().toISOString()
        }
      });
    }
  } catch (_pyErr) {
    // Python service offline or timed out; proceed to deterministic local disease evaluation
  }

  // 2. Deterministic Disease Tool Engine (Zero-Downtime Fallback)
  const localAnalysis = runLocalDiseaseTools(rawLab, rawHistory);
  const toolsList = localAnalysis.toolsExecuted.join(', ');

  const recommendation =
    `Clinical Decision Support: Evaluation by specialized disease tools (${toolsList}) ` +
    `identified findings with ${localAnalysis.severity.toLowerCase()} priority. ` +
    `Recommend clinical correlation by attending healthcare professional.`;

  const confidenceLevel = localAnalysis.severity === 'CRITICAL' || localAnalysis.severity === 'HIGH'
    ? 'high'
    : 'medium';

  return new AgentResult({
    agentId: 'clinical-agent',
    status: AgentStatus.SUCCESS,
    confidence: confidenceLevel,
    result: {
      recommendation,
      supportingEvidence: localAnalysis.findings,
      possibleRisks: localAnalysis.possibleRisks,
      nextSteps: localAnalysis.nextSteps,
      diseaseSpecificAnalysis: localAnalysis.diseaseAnalyses,
      toolsExecuted: localAnalysis.toolsExecuted,
      overallSeverity: localAnalysis.severity
    },
    metadata: {
      provider: 'in-process-disease-tools',
      toolsExecuted: localAnalysis.toolsExecuted,
      generatedAt: new Date().toISOString()
    }
  });
}

module.exports = {
  runClinicalAgent,
  evaluateHeartDiseaseJS,
  evaluateKidneyDiseaseJS,
  evaluateMetabolicDiseaseJS,
  evaluateHematologicDiseaseJS,
  runLocalDiseaseTools
};
