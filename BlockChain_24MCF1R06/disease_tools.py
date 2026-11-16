"""
Disease-Specific Clinical Evaluation Tools for Electronic Health Record System.

Provides evidence-based specialized diagnostic reasoning tools for:
- Heart / Cardiovascular Diseases (ACS, Heart Failure, Dyslipidemia, Hypertension)
- Kidney / Renal Diseases (CKD Staging via KDIGO, AKI, Azotemia, Electrolytes)
- Diabetes & Metabolic Diseases (ADA Diagnostic Criteria, Glycemic Control, DKA)
- Hematologic & Anemia Diseases (WHO Severity, Morphologic Classification, Iron Deficiency)
- Liver & Hepatic Diseases (Hepatocellular vs Cholestatic, De Ritis Ratio, Synthetic Function)
"""

from typing import Any, Dict, List, Optional
import math


def _normalize_dict_keys(d: Dict[str, Any]) -> Dict[str, Any]:
    """Convert keys to lowercase and stripped for robust matching."""
    if not isinstance(d, dict):
        return {}
    normalized = {}
    for k, v in d.items():
        key_clean = str(k).strip().lower().replace(" ", "_").replace("-", "_")
        normalized[key_clean] = v
    return normalized


def _get_val(d: Dict[str, Any], *aliases: str) -> Optional[float]:
    """Extract numeric float value from dictionary checking multiple aliases."""
    for alias in aliases:
        key = alias.strip().lower().replace(" ", "_").replace("-", "_")
        if key in d:
            val = d[key]
            if isinstance(val, (int, float)):
                return float(val)
            if isinstance(val, str):
                try:
                    # Strip any unit strings e.g. "9.2 g/dL" -> 9.2
                    cleaned = "".join(ch for ch in val if ch.isdigit() or ch in ".-")
                    if cleaned:
                        return float(cleaned)
                except ValueError:
                    pass
    return None


def _get_str_list(d: Dict[str, Any], *aliases: str) -> List[str]:
    """Extract list of strings (e.g. symptoms or history)."""
    for alias in aliases:
        key = alias.strip().lower().replace(" ", "_").replace("-", "_")
        if key in d:
            val = d[key]
            if isinstance(val, list):
                return [str(x).strip().lower() for x in val]
            if isinstance(val, str):
                return [s.strip().lower() for s in val.split(",")]
    return []


# ============================================================================
# 1. HEART / CARDIOVASCULAR DISEASE TOOL
# ============================================================================

def evaluate_heart_disease(lab_result: Dict[str, Any], history_result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Evaluates Cardiovascular / Heart Disease risk based on cardiac enzymes,
    lipid panels, hemodynamics, and cardiac symptoms.
    """
    data = _normalize_dict_keys(lab_result)
    hist = _normalize_dict_keys(history_result)
    symptoms = _get_str_list(hist, "symptoms", "chief_complaint", "signs")

    troponin = _get_val(data, "troponin", "troponin_i", "troponin_t", "trop", "hs_troponin")
    ck_mb = _get_val(data, "ck_mb", "ckmb", "creatine_kinase_mb")
    bnp = _get_val(data, "bnp", "brain_natriuretic_peptide")
    nt_probnp = _get_val(data, "nt_probnp", "nt_pro_bnp")
    cholesterol = _get_val(data, "cholesterol", "total_cholesterol", "total_chol")
    ldl = _get_val(data, "ldl", "ldl_c", "ldl_cholesterol")
    hdl = _get_val(data, "hdl", "hdl_c", "hdl_cholesterol")
    triglycerides = _get_val(data, "triglycerides", "tg", "trig")
    systolic_bp = _get_val(data, "systolic_bp", "sbp", "systolic") or _get_val(hist, "systolic_bp", "sbp", "systolic")
    diastolic_bp = _get_val(data, "diastolic_bp", "dbp", "diastolic") or _get_val(hist, "diastolic_bp", "dbp", "diastolic")

    has_cardiac_markers = any(v is not None for v in [troponin, ck_mb, bnp, nt_probnp, cholesterol, ldl, hdl, triglycerides])
    cardiac_symptoms = [s for s in symptoms if any(w in s for w in ["chest pain", "angina", "palpitation", "shortness of breath", "dyspnea", "orthopnea", "edema"])]

    if not has_cardiac_markers and not cardiac_symptoms:
        return {
            "applicable": False,
            "tool_name": "Heart Disease Evaluation Tool",
            "condition_detected": False,
            "severity": "NORMAL",
            "findings": [],
            "risk_assessment": "No cardiac-specific biomarkers or ischemic symptoms provided in the current dataset.",
            "recommended_actions": []
        }

    findings = []
    risks = []
    actions = []
    severity = "LOW"

    # Acute Coronary Syndrome (ACS) / Myocardial Injury
    if troponin is not None:
        if troponin > 0.04:  # Conventional cutoff, or high-sensitivity > 14 ng/L
            findings.append(f"Elevated Troponin ({troponin} ng/mL; reference < 0.04 ng/mL)")
            risks.append("Possible acute myocardial injury or Acute Coronary Syndrome (ACS)")
            actions.append("Obtain immediate 12-lead Electrocardiogram (ECG)")
            actions.append("Serial troponin monitoring at 3-hour and 6-hour intervals")
            actions.append("Urgent Cardiology consultation")
            severity = "CRITICAL"
        else:
            findings.append(f"Troponin within normal reference range ({troponin} ng/mL)")

    if ck_mb is not None and ck_mb > 5.0:
        findings.append(f"Elevated CK-MB ({ck_mb} ng/mL; reference < 5.0 ng/mL)")
        if severity != "CRITICAL":
            severity = "HIGH"

    # Heart Failure
    effective_bnp = bnp if bnp is not None else (nt_probnp / 3.0 if nt_probnp is not None else None)
    if effective_bnp is not None:
        if effective_bnp > 400:
            findings.append(f"Significantly elevated BNP/NT-proBNP ({bnp or nt_probnp} pg/mL)")
            risks.append("Findings consistent with decompensated heart failure / volume overload")
            actions.append("Transthoracic Echocardiogram (TTE) to evaluate Left Ventricular Ejection Fraction (LVEF)")
            actions.append("Clinical assessment for volume status and pulmonary congestion")
            if severity != "CRITICAL":
                severity = "HIGH"
        elif effective_bnp > 100:
            findings.append(f"Borderline elevated BNP ({effective_bnp:.1f} pg/mL)")
            risks.append("Mild or compensated ventricular wall stress")

    # Dyslipidemia / Atherosclerotic Risk
    lipid_abnormalities = []
    if ldl is not None:
        if ldl >= 190:
            lipid_abnormalities.append(f"Severely elevated LDL-C ({ldl} mg/dL; target < 100 mg/dL)")
            severity = max(severity, "HIGH", key=lambda x: ["LOW", "MODERATE", "HIGH", "CRITICAL"].index(x))
        elif ldl >= 160:
            lipid_abnormalities.append(f"Elevated LDL-C ({ldl} mg/dL)")
            severity = max(severity, "MODERATE", key=lambda x: ["LOW", "MODERATE", "HIGH", "CRITICAL"].index(x))
    if hdl is not None and hdl < 40:
        lipid_abnormalities.append(f"Low protective HDL-C ({hdl} mg/dL; optimal >= 50 mg/dL)")
    if triglycerides is not None and triglycerides >= 200:
        lipid_abnormalities.append(f"Hypertriglyceridemia ({triglycerides} mg/dL; normal < 150 mg/dL)")

    if lipid_abnormalities:
        findings.extend(lipid_abnormalities)
        risks.append("Elevated 10-year Atherosclerotic Cardiovascular Disease (ASCVD) risk")
        actions.append("Evaluate 10-year ASCVD risk score and consider lipid-lowering therapeutic lifestyle changes")

    # Hypertension Staging (ACC/AHA Guidelines)
    if systolic_bp is not None and diastolic_bp is not None:
        if systolic_bp >= 180 or diastolic_bp >= 120:
            findings.append(f"Hypertensive crisis blood pressure reading: {systolic_bp}/{diastolic_bp} mmHg")
            risks.append("Severe hypertension requiring acute evaluation for end-organ damage")
            actions.append("Immediate clinical evaluation for acute target organ damage (CNS, retinal, cardiac, renal)")
            severity = "CRITICAL"
        elif systolic_bp >= 140 or diastolic_bp >= 90:
            findings.append(f"Stage 2 Hypertension: {systolic_bp}/{diastolic_bp} mmHg")
            risks.append("Uncontrolled hypertension contributing to vascular and cardiac strain")
            actions.append("Regular blood pressure monitoring and cardiovascular risk factor optimization")
            if severity == "LOW":
                severity = "MODERATE"

    if cardiac_symptoms:
        findings.append(f"Reported cardiovascular symptoms: {', '.join(cardiac_symptoms)}")
        if severity == "LOW":
            severity = "MODERATE"

    condition_detected = len(risks) > 0 or severity in ("MODERATE", "HIGH", "CRITICAL")
    risk_summary = "; ".join(risks) if risks else "Cardiovascular biomarkers within evaluated normal thresholds."

    return {
        "applicable": True,
        "tool_name": "Heart Disease Evaluation Tool",
        "condition_detected": condition_detected,
        "severity": severity,
        "findings": findings,
        "risk_assessment": risk_summary,
        "recommended_actions": list(dict.fromkeys(actions))
    }


# ============================================================================
# 2. KIDNEY / RENAL DISEASE TOOL
# ============================================================================

def evaluate_kidney_disease(lab_result: Dict[str, Any], history_result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Evaluates Renal / Kidney Disease status according to KDIGO guidelines,
    calculating eGFR, staging chronic kidney disease, identifying AKI and azotemia.
    """
    data = _normalize_dict_keys(lab_result)
    hist = _normalize_dict_keys(history_result)

    creatinine = _get_val(data, "creatinine", "serum_creatinine", "cr", "creat")
    bun = _get_val(data, "bun", "blood_urea_nitrogen", "urea")
    egfr = _get_val(data, "egfr", "gfr", "estimated_gfr")
    potassium = _get_val(data, "potassium", "k", "k+")
    sodium = _get_val(data, "sodium", "na", "na+")
    urine_protein = _get_val(data, "urine_protein", "proteinuria", "microalbumin", "acr")
    age = _get_val(hist, "age") or 50.0
    sex = str(hist.get("gender") or hist.get("sex") or "male").strip().lower()

    has_renal_markers = any(v is not None for v in [creatinine, bun, egfr, potassium, urine_protein])

    if not has_renal_markers:
        return {
            "applicable": False,
            "tool_name": "Kidney Disease Evaluation Tool",
            "condition_detected": False,
            "severity": "NORMAL",
            "findings": [],
            "risk_assessment": "No renal function parameters provided in current laboratory data.",
            "recommended_actions": []
        }

    findings = []
    risks = []
    actions = []
    severity = "LOW"

    # Estimate eGFR if not directly supplied but creatinine is present (CKD-EPI simplified)
    calculated_egfr = egfr
    if calculated_egfr is None and creatinine is not None and creatinine > 0:
        is_female = sex in ("female", "f")
        k = 0.7 if is_female else 0.9
        alpha = -0.241 if is_female else -0.302
        scr_k = creatinine / k
        min_scr = min(scr_k, 1.0)
        max_scr = max(scr_k, 1.0)
        gender_multiplier = 1.012 if is_female else 1.0
        calculated_egfr = 142 * (min_scr ** alpha) * (max_scr ** -1.200) * (0.9938 ** age) * gender_multiplier
        calculated_egfr = round(calculated_egfr, 1)

    # KDIGO Chronic Kidney Disease Staging
    kdigo_stage = "Normal / Preserved"
    if calculated_egfr is not None:
        if calculated_egfr >= 90:
            kdigo_stage = "Stage 1 (eGFR >= 90; Normal or High)"
            if urine_protein and urine_protein > 30:
                findings.append(f"eGFR {calculated_egfr} mL/min/1.73m2 with proteinuria (KDIGO Stage 1)")
                risks.append("Early stage renal parenchymal injury with preserved filtration")
                severity = "MODERATE"
            else:
                findings.append(f"eGFR preserved at {calculated_egfr} mL/min/1.73m2")
        elif 60 <= calculated_egfr < 90:
            kdigo_stage = "Stage 2 (eGFR 60-89; Mild reduction)"
            findings.append(f"Mildly decreased eGFR ({calculated_egfr} mL/min/1.73m2, KDIGO Stage 2)")
            if urine_protein and urine_protein > 30:
                risks.append("Chronic kidney disease Stage 2 with albuminuria")
                severity = "MODERATE"
        elif 45 <= calculated_egfr < 60:
            kdigo_stage = "Stage 3a (eGFR 45-59; Mild-to-moderate reduction)"
            findings.append(f"Moderately decreased eGFR ({calculated_egfr} mL/min/1.73m2, KDIGO Stage 3a)")
            risks.append("Chronic Kidney Disease Stage 3a")
            actions.append("Renal function monitoring every 6 months")
            actions.append("Medication dose adjustment review for renally cleared pharmaceuticals")
            severity = "MODERATE"
        elif 30 <= calculated_egfr < 45:
            kdigo_stage = "Stage 3b (eGFR 30-44; Moderate-to-severe reduction)"
            findings.append(f"Significantly decreased eGFR ({calculated_egfr} mL/min/1.73m2, KDIGO Stage 3b)")
            risks.append("Chronic Kidney Disease Stage 3b with increased risk of progression and complications")
            actions.append("Nephrology consultation")
            actions.append("Strict avoidance of nephrotoxic medications (NSAIDs, iodinated contrast)")
            actions.append("Screen for anemia of chronic kidney disease and mineral bone disorder")
            severity = "HIGH"
        elif 15 <= calculated_egfr < 30:
            kdigo_stage = "Stage 4 (eGFR 15-29; Severely decreased)"
            findings.append(f"Severely reduced eGFR ({calculated_egfr} mL/min/1.73m2, KDIGO Stage 4)")
            risks.append("Severe renal impairment; high risk of end-stage renal disease (ESRD)")
            actions.append("Urgent Nephrology referral and vascular access planning")
            actions.append("Frequent electrolyte and acid-base monitoring")
            severity = "HIGH"
        else:
            kdigo_stage = "Stage 5 (eGFR < 15; Kidney Failure / ESRD)"
            findings.append(f"Critically low eGFR ({calculated_egfr} mL/min/1.73m2, KDIGO Stage 5)")
            risks.append("End-Stage Renal Disease (ESRD) / Uremic syndrome risk")
            actions.append("Emergency Nephrology intervention; evaluate for renal replacement therapy (dialysis)")
            severity = "CRITICAL"

    # Creatinine & Azotemia Analysis
    if creatinine is not None:
        if creatinine > 1.3:
            findings.append(f"Elevated Serum Creatinine ({creatinine} mg/dL; normal 0.7-1.3 mg/dL)")
            if severity == "LOW":
                severity = "MODERATE"
        if bun is not None and creatinine > 0:
            bun_cr_ratio = bun / creatinine
            findings.append(f"BUN: {bun} mg/dL, Creatinine: {creatinine} mg/dL (BUN/Cr Ratio: {bun_cr_ratio:.1f})")
            if bun_cr_ratio > 20:
                risks.append("Elevated BUN/Creatinine ratio (>20:1) suggests prerenal azotemia (dehydration, decreased renal perfusion)")
                actions.append("Assess volume status, hydration, and renal hemodynamic perfusion")
            elif bun_cr_ratio < 15 and creatinine > 1.4:
                risks.append("BUN/Creatinine ratio (<15:1) with elevated creatinine suggests intrinsic renal parenchymal injury")

    # Electrolyte Risks (Hyperkalemia)
    if potassium is not None:
        if potassium >= 5.5:
            findings.append(f"Severe Hyperkalemia (K+ = {potassium} mEq/L; reference 3.5-5.0 mEq/L)")
            risks.append("High risk for life-threatening cardiac arrhythmias secondary to severe hyperkalemia")
            actions.append("Urgent 12-lead ECG to evaluate for hyperkalemic peaked T waves or widened QRS")
            actions.append("Initiate immediate clinical hyperkalemia management protocol")
            severity = "CRITICAL"
        elif potassium > 5.0:
            findings.append(f"Mildly elevated Potassium (K+ = {potassium} mEq/L)")
            risks.append("Mild hyperkalemia in the setting of reduced renal clearance")
            actions.append("Dietary potassium restriction and re-evaluation")
            if severity == "LOW":
                severity = "MODERATE"

    condition_detected = len(risks) > 0 or severity in ("MODERATE", "HIGH", "CRITICAL")
    risk_summary = "; ".join(risks) if risks else "Renal biomarkers demonstrate preserved glomerular filtration."

    return {
        "applicable": True,
        "tool_name": "Kidney Disease Evaluation Tool",
        "condition_detected": condition_detected,
        "severity": severity,
        "egfr": calculated_egfr,
        "kdigo_stage": kdigo_stage,
        "findings": findings,
        "risk_assessment": risk_summary,
        "recommended_actions": list(dict.fromkeys(actions))
    }


# ============================================================================
# 3. DIABETES & METABOLIC DISEASE TOOL
# ============================================================================

def evaluate_metabolic_disease(lab_result: Dict[str, Any], history_result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Evaluates Diabetes Mellitus and Metabolic Status according to American
    Diabetes Association (ADA) criteria (HbA1c, Fasting Glucose, DKA risk).
    """
    data = _normalize_dict_keys(lab_result)
    hist = _normalize_dict_keys(history_result)

    glucose = _get_val(data, "glucose", "blood_glucose", "fasting_glucose", "fbs", "rbs")
    hba1c = _get_val(data, "hba1c", "glycated_hemoglobin", "a1c")
    ketones = _get_val(data, "ketones", "urine_ketones", "beta_hydroxybutyrate")
    bicarbonate = _get_val(data, "bicarbonate", "hco3", "co2")

    has_metabolic_markers = any(v is not None for v in [glucose, hba1c, ketones])

    if not has_metabolic_markers:
        return {
            "applicable": False,
            "tool_name": "Diabetes & Metabolic Disease Tool",
            "condition_detected": False,
            "severity": "NORMAL",
            "findings": [],
            "risk_assessment": "No glycemic or metabolic biomarkers provided.",
            "recommended_actions": []
        }

    findings = []
    risks = []
    actions = []
    severity = "LOW"
    status_label = "Euglycemic"

    # ADA Diagnostic Staging
    if hba1c is not None:
        if hba1c >= 8.5:
            status_label = "Poorly Controlled Diabetes"
            findings.append(f"Severely elevated HbA1c ({hba1c}%; target < 7.0%)")
            risks.append("Substantially increased risk for microvascular (retinopathy, nephropathy, neuropathy) and macrovascular complications")
            actions.append("Comprehensive glycemic regimen re-evaluation and intensification")
            actions.append("Screen for diabetic nephropathy (urine albumin-to-creatinine ratio)")
            actions.append("Dilated eye examination for diabetic retinopathy")
            severity = "HIGH"
        elif hba1c >= 6.5:
            status_label = "Diabetes Mellitus"
            findings.append(f"Elevated HbA1c ({hba1c}%; diagnostic cutoff >= 6.5%)")
            risks.append("Meets ADA diagnostic threshold for Diabetes Mellitus")
            actions.append("Confirm with repeat testing in the absence of unequivocal hyperglycemia")
            actions.append("Initiate diabetes self-management education and medical nutrition therapy")
            severity = "MODERATE"
        elif 5.7 <= hba1c <= 6.4:
            status_label = "Prediabetes (Impaired Glucose Regulation)"
            findings.append(f"HbA1c in prediabetes range ({hba1c}%; reference 5.7 - 6.4%)")
            risks.append("Elevated risk of developing Type 2 Diabetes Mellitus and cardiovascular disease")
            actions.append("Lifestyle modification counseling (dietary intervention, physical activity)")
            actions.append("Annual glycemic re-screening")
            severity = "MODERATE"
        else:
            findings.append(f"HbA1c within normal physiological limits ({hba1c}%)")

    if glucose is not None:
        if glucose >= 250 and (ketones is not None and ketones > 0):
            findings.append(f"Marked hyperglycemia ({glucose} mg/dL) with positive ketones")
            risks.append("Critical risk for Diabetic Ketoacidosis (DKA) or Hyperosmolar Hyperglycemic State (HHS)")
            actions.append("Emergency department evaluation for acute DKA/HHS protocol")
            actions.append("Urgent arterial/venous blood gas (pH, bicarbonate), serum osmolality, and electrolytes")
            severity = "CRITICAL"
        elif glucose >= 200:
            findings.append(f"Significantly elevated glucose ({glucose} mg/dL)")
            risks.append("Overt hyperglycemia consistent with diabetes")
            actions.append("Fasting plasma glucose or HbA1c confirmation")
            if severity == "LOW":
                severity = "HIGH"
        elif glucose >= 126:
            findings.append(f"Elevated fasting glucose ({glucose} mg/dL; diagnostic >= 126 mg/dL)")
            risks.append("Glucose level meets ADA diagnostic criteria for diabetes if fasting")
            if severity == "LOW":
                severity = "MODERATE"
        elif 100 <= glucose <= 125:
            findings.append(f"Impaired fasting glucose ({glucose} mg/dL; normal < 100 mg/dL)")
            if severity == "LOW":
                severity = "MODERATE"
        elif glucose < 70:
            findings.append(f"Hypoglycemia detected ({glucose} mg/dL; alert threshold < 70 mg/dL)")
            risks.append("Acute hypoglycemia requiring rapid clinical correction")
            actions.append("Administer fast-acting oral carbohydrates or parenteral dextrose according to hypoglycemia protocol")
            severity = "HIGH" if glucose < 54 else "MODERATE"

    condition_detected = len(risks) > 0 or severity in ("MODERATE", "HIGH", "CRITICAL")
    risk_summary = "; ".join(risks) if risks else "Glycemic parameters indicate normal glucose homeostasis."

    return {
        "applicable": True,
        "tool_name": "Diabetes & Metabolic Disease Tool",
        "condition_detected": condition_detected,
        "glycemic_status": status_label,
        "severity": severity,
        "findings": findings,
        "risk_assessment": risk_summary,
        "recommended_actions": list(dict.fromkeys(actions))
    }


# ============================================================================
# 4. HEMATOLOGIC & ANEMIA DISEASE TOOL
# ============================================================================

def evaluate_hematologic_disease(lab_result: Dict[str, Any], history_result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Evaluates Hematologic status (Anemia classification by red cell indices,
    WHO severity grading, iron deficiency vs chronic disease, platelets, leukocytes).
    """
    data = _normalize_dict_keys(lab_result)
    hist = _normalize_dict_keys(history_result)
    symptoms = _get_str_list(hist, "symptoms", "chief_complaint")

    hemoglobin = _get_val(data, "hemoglobin", "hgb", "hb")
    hematocrit = _get_val(data, "hematocrit", "hct")
    mcv = _get_val(data, "mcv", "mean_corpuscular_volume")
    mch = _get_val(data, "mch")
    ferritin = _get_val(data, "ferritin", "serum_ferritin")
    iron = _get_val(data, "iron", "serum_iron")
    platelets = _get_val(data, "platelets", "platelet_count", "plt")
    wbc = _get_val(data, "wbc", "white_blood_cells", "leukocytes")
    sex = str(hist.get("gender") or hist.get("sex") or "male").strip().lower()

    has_heme_markers = any(v is not None for v in [hemoglobin, hematocrit, mcv, ferritin, platelets, wbc])

    if not has_heme_markers:
        return {
            "applicable": False,
            "tool_name": "Hematologic & Anemia Evaluation Tool",
            "condition_detected": False,
            "severity": "NORMAL",
            "findings": [],
            "risk_assessment": "No complete blood count or hematologic parameters available.",
            "recommended_actions": []
        }

    findings = []
    risks = []
    actions = []
    severity = "LOW"
    morphology = "Normocytic"

    is_female = sex in ("female", "f")
    hb_lower_limit = 12.0 if is_female else 13.0

    # Anemia Severity & Morphology
    if hemoglobin is not None:
        if hemoglobin < hb_lower_limit:
            if hemoglobin < 8.0:
                who_severity = "Severe Anemia"
                severity = "CRITICAL"
                actions.append("Immediate evaluation for potential blood transfusion / urgent hematology support")
            elif hemoglobin < 11.0:
                who_severity = "Moderate Anemia"
                severity = "HIGH"
            else:
                who_severity = "Mild Anemia"
                severity = "MODERATE"

            findings.append(f"Low Hemoglobin ({hemoglobin} g/dL; reference {hb_lower_limit}-17.5 g/dL) - {who_severity}")

            # Morphologic Classification by MCV
            if mcv is not None:
                if mcv < 80.0:
                    morphology = "Microcytic Hypochromic"
                    findings.append(f"Microcytosis detected (MCV {mcv} fL; normal 80-100 fL)")
                    if ferritin is not None and ferritin < 30.0:
                        findings.append(f"Low Serum Ferritin ({ferritin} ng/mL; normal 30-300 ng/mL)")
                        risks.append("Findings are highly consistent with Iron Deficiency Anemia (IDA)")
                        actions.append("Investigation of source of iron loss (fecal occult blood, endoscopy/colonoscopy if indicated)")
                        actions.append("Evaluation for iron replenishment therapy under clinical guidance")
                    else:
                        risks.append("Microcytic anemia: consider iron deficiency, thalassemia trait, or anemia of chronic disease")
                        actions.append("Complete iron panel (ferritin, serum iron, TIBC, transferrin saturation)")
                elif mcv > 100.0:
                    morphology = "Macrocytic"
                    findings.append(f"Macrocytosis detected (MCV {mcv} fL; normal 80-100 fL)")
                    risks.append("Macrocytic anemia: evaluate for Vitamin B12 / Folate deficiency, myelodysplasia, or hepatic etiology")
                    actions.append("Order Serum Vitamin B12 and Folate levels")
                    actions.append("Review peripheral blood smear for hypersegmented neutrophils")
                else:
                    morphology = "Normocytic"
                    findings.append(f"Normocytic anemia (MCV {mcv} fL)")
                    risks.append("Normocytic anemia: consider anemia of chronic disease, acute blood loss, hemolysis, or renal failure")
                    actions.append("Reticulocyte count and peripheral smear examination")
            else:
                risks.append(f"Anemia ({who_severity}) requiring morphologic index evaluation")
                actions.append("Order complete red cell indices (MCV, MCH, RDW)")
        else:
            findings.append(f"Hemoglobin within normal reference range ({hemoglobin} g/dL)")

    # Platelet Evaluation
    if platelets is not None:
        if platelets < 50000:
            findings.append(f"Severe Thrombocytopenia ({platelets} /uL; normal 150,000-450,000 /uL)")
            risks.append("High risk for spontaneous bleeding and hemorrhagic complications")
            actions.append("Bleeding precautions and urgent hematologic workup")
            severity = "CRITICAL"
        elif platelets < 150000:
            findings.append(f"Mild-to-moderate Thrombocytopenia ({platelets} /uL)")
            risks.append("Decreased platelet count warrants investigation of production or consumption etiologies")
            if severity == "LOW":
                severity = "MODERATE"
        elif platelets > 450000:
            findings.append(f"Thrombocytosis ({platelets} /uL; reference < 450,000 /uL)")
            risks.append("Reactive thrombocytosis (infection/inflammation/iron deficiency) or essential thrombocythemia")

    # Leukocyte Evaluation
    if wbc is not None:
        if wbc < 3.5:
            findings.append(f"Leukopenia ({wbc} x10^3/uL; reference 4.0-11.0 x10^3/uL)")
            risks.append("Increased vulnerability to infection due to depressed white cell count")
            if severity == "LOW":
                severity = "MODERATE"
        elif wbc > 12.0:
            findings.append(f"Leukocytosis ({wbc} x10^3/uL; reference 4.0-11.0 x10^3/uL)")
            risks.append("Elevated white count indicative of systemic inflammatory or infectious response")

    condition_detected = len(risks) > 0 or severity in ("MODERATE", "HIGH", "CRITICAL")
    risk_summary = "; ".join(risks) if risks else "Hematologic parameters show preserved red and white cell cell lines."

    return {
        "applicable": True,
        "tool_name": "Hematologic & Anemia Evaluation Tool",
        "condition_detected": condition_detected,
        "severity": severity,
        "morphology": morphology,
        "findings": findings,
        "risk_assessment": risk_summary,
        "recommended_actions": list(dict.fromkeys(actions))
    }


# ============================================================================
# 5. LIVER / HEPATIC DISEASE TOOL
# ============================================================================

def evaluate_hepatic_disease(lab_result: Dict[str, Any], history_result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Evaluates Hepatic / Liver Disease status (Hepatocellular vs Cholestatic pattern,
    De Ritis AST/ALT ratio, synthetic protein function, hyperbilirubinemia).
    """
    data = _normalize_dict_keys(lab_result)
    hist = _normalize_dict_keys(history_result)

    alt = _get_val(data, "alt", "alanine_aminotransferase", "sgpt")
    ast = _get_val(data, "ast", "aspartate_aminotransferase", "sgot")
    alp = _get_val(data, "alp", "alkaline_phosphatase", "alk_phos")
    total_bili = _get_val(data, "total_bilirubin", "bilirubin", "t_bili")
    direct_bili = _get_val(data, "direct_bilirubin", "d_bili", "conjugated_bilirubin")
    albumin = _get_val(data, "albumin", "alb")
    inr = _get_val(data, "inr", "pt_inr")

    has_hepatic_markers = any(v is not None for v in [alt, ast, alp, total_bili, direct_bili, albumin, inr])

    if not has_hepatic_markers:
        return {
            "applicable": False,
            "tool_name": "Hepatic & Liver Disease Tool",
            "condition_detected": False,
            "severity": "NORMAL",
            "findings": [],
            "risk_assessment": "No liver function test (LFT) parameters present in the submitted data.",
            "recommended_actions": []
        }

    findings = []
    risks = []
    actions = []
    severity = "LOW"
    pattern = "Normal Liver Biochemistry"

    alt_high = alt is not None and alt > 45.0
    ast_high = ast is not None and ast > 40.0
    alp_high = alp is not None and alp > 120.0

    # Pattern Classification
    if (alt_high or ast_high) and alp_high:
        pattern = "Mixed Hepatocellular and Cholestatic Pattern"
        findings.append(f"Mixed transaminase and cholestatic enzyme elevations (ALT: {alt}, AST: {ast}, ALP: {alp} U/L)")
        risks.append("Complex hepatic pathology; consider drug-induced liver injury (DILI) or systemic disease")
        actions.append("Abdominal ultrasound with Doppler to evaluate biliary tree and hepatic vasculature")
        severity = "HIGH"
    elif alt_high or ast_high:
        pattern = "Hepatocellular Injury Pattern"
        findings.append(f"Elevated transaminases (ALT: {alt}, AST: {ast} U/L)")
        if (alt and alt > 200) or (ast and ast > 200):
            risks.append("Significant acute hepatocellular injury (viral, ischemic, or toxic)")
            actions.append("Acute viral hepatitis serologies (HAV, HBV, HCV)")
            actions.append("Medication and herbal supplement toxicity review")
            severity = "HIGH"
        else:
            risks.append("Mild-to-moderate hepatocellular injury (consider NAFLD/NASH, chronic hepatitis)")
            actions.append("Evaluate metabolic risk factors, lipid profile, and repeat LFTs in 4 weeks")
            severity = "MODERATE"
    elif alp_high:
        pattern = "Cholestatic Pattern"
        findings.append(f"Isolated or predominant ALP elevation ({alp} U/L; reference 40-120 U/L)")
        risks.append("Biliary obstruction or infiltrative liver disease (or osseous etiology)")
        actions.append("Obtain GGT level to confirm hepatic origin of elevated ALP")
        actions.append("Right Upper Quadrant (RUQ) abdominal ultrasound to exclude biliary ductal dilatation")
        severity = "MODERATE"

    # De Ritis Ratio (AST/ALT)
    if ast is not None and alt is not None and alt > 0:
        de_ritis = ast / alt
        if de_ritis >= 2.0 and (ast_high or alt_high):
            findings.append(f"AST/ALT De Ritis ratio >= 2.0 ({de_ritis:.2f})")
            risks.append("AST/ALT ratio >= 2 is characteristic of alcoholic liver injury or advanced cirrhotic architecture")

    # Hyperbilirubinemia / Jaundice
    if total_bili is not None:
        if total_bili >= 3.0:
            findings.append(f"Marked hyperbilirubinemia ({total_bili} mg/dL; reference < 1.2 mg/dL)")
            risks.append("Clinical jaundice with risk of hepatobiliary decompensation")
            actions.append("Evaluate conjugated vs unconjugated fractions and evaluate biliary patency")
            severity = max(severity, "HIGH", key=lambda x: ["LOW", "MODERATE", "HIGH", "CRITICAL"].index(x))
        elif total_bili > 1.2:
            findings.append(f"Elevated Total Bilirubin ({total_bili} mg/dL)")

    # Synthetic Function (Albumin / INR)
    if albumin is not None and albumin < 3.0:
        findings.append(f"Hypoalbuminemia ({albumin} g/dL; reference 3.5-5.0 g/dL)")
        risks.append("Impaired hepatic synthetic capacity or systemic protein loss/malnutrition")
        actions.append("Screen for ascites and peripheral edema")
        if severity == "LOW":
            severity = "MODERATE"

    if inr is not None and inr > 1.5:
        findings.append(f"Prolonged INR ({inr}; normal 0.8-1.2)")
        risks.append("Coagulopathy secondary to compromised hepatic synthesis of clotting factors")
        severity = max(severity, "HIGH", key=lambda x: ["LOW", "MODERATE", "HIGH", "CRITICAL"].index(x))

    condition_detected = len(risks) > 0 or severity in ("MODERATE", "HIGH", "CRITICAL")
    risk_summary = "; ".join(risks) if risks else "Liver panel reflects intact synthetic and clearance capacity."

    return {
        "applicable": True,
        "tool_name": "Hepatic & Liver Disease Tool",
        "condition_detected": condition_detected,
        "injury_pattern": pattern,
        "severity": severity,
        "findings": findings,
        "risk_assessment": risk_summary,
        "recommended_actions": list(dict.fromkeys(actions))
    }


# ============================================================================
# MASTER MULTI-DISEASE EVALUATOR REGISTRY
# ============================================================================

def run_disease_tools(lab_result: Dict[str, Any], history_result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Executes all specialized disease tools across clinical domains.
    Returns aggregated evaluations, detected conditions, and unified findings.
    """
    tools = [
        ("heart", evaluate_heart_disease),
        ("kidney", evaluate_kidney_disease),
        ("metabolic", evaluate_metabolic_disease),
        ("hematology", evaluate_hematologic_disease),
        ("hepatic", evaluate_hepatic_disease),
    ]

    executed_tools = []
    applicable_analyses = {}
    aggregated_findings = []
    aggregated_risks = []
    aggregated_actions = []
    highest_severity = "LOW"
    severity_order = ["NORMAL", "LOW", "MODERATE", "HIGH", "CRITICAL"]

    for name, tool_fn in tools:
        res = tool_fn(lab_result, history_result)
        if res.get("applicable"):
            executed_tools.append(res["tool_name"])
            applicable_analyses[name] = res
            if res.get("findings"):
                aggregated_findings.extend(res["findings"])
            if res.get("condition_detected") and res.get("risk_assessment"):
                aggregated_risks.append(f"[{res['tool_name']}]: {res['risk_assessment']}")
            if res.get("recommended_actions"):
                aggregated_actions.extend(res["recommended_actions"])
            
            tool_sev = res.get("severity", "LOW")
            if severity_order.index(tool_sev) > severity_order.index(highest_severity):
                highest_severity = tool_sev

    return {
        "tools_executed": executed_tools,
        "disease_analyses": applicable_analyses,
        "findings": aggregated_findings,
        "possible_risks": aggregated_risks,
        "recommended_actions": list(dict.fromkeys(aggregated_actions)),
        "overall_severity": highest_severity
    }
