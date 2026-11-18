# Multi-Disease Clinical Decision Support Agent
**Author:** Ankit Patidar  
**Roll No:** 24MCF1R06  
**Role:** Clinical Decision Support Agent Lead / Hospital Agent (Clinical Capability)  
**System:** Blockchain-Based Electronic Health Record (EHR) System  

---

## 1. Overview
This module implements an **Agentic Clinical Decision Support System** using **LangGraph**, **Gemini 2.5 Flash**, and **Pydantic**. It synthesizes multi-source patient data (laboratory biomarkers, patient history, vital signs) and executes specialized clinical evaluation tools across multiple disease domains to provide evidence-based, uncertainty-aware assistive recommendations for licensed healthcare professionals.

---

## 2. Multi-Disease Specialized Evaluation Tools
Per architectural guidelines, the agent uses modular clinical tools tailored to specific disease categories:

1. **Heart / Cardiovascular Disease Tool (`evaluate_heart_disease`)**:
   - **Biomarkers:** Troponin I/T, CK-MB, BNP/NT-proBNP, Lipid Profile (Total Cholesterol, LDL, HDL, Triglycerides), Blood Pressure (Systolic/Diastolic).
   - **Clinical Rules:** Acute Coronary Syndrome (ACS) detection (Troponin > 0.04 ng/mL), Heart Failure volume stress (BNP > 100 pg/mL), 10-year ASCVD risk stratification, ACC/AHA Hypertension Staging.
2. **Kidney / Renal Disease Tool (`evaluate_kidney_disease`)**:
   - **Biomarkers:** Serum Creatinine, Blood Urea Nitrogen (BUN), eGFR (calculated via CKD-EPI formula), Potassium ($K^+$), Proteinuria/Microalbuminuria.
   - **Clinical Rules:** KDIGO CKD Staging (Stages 1 through 5 / ESRD), Azotemia differentiation (BUN/Cr ratio > 20:1 prerenal vs < 15:1 intrinsic), Hyperkalemia arrhythmia risk ($K^+ \ge 5.2$ mEq/L).
3. **Diabetes & Metabolic Disease Tool (`evaluate_metabolic_disease`)**:
   - **Biomarkers:** Fasting Glucose, Random Glucose, HbA1c, Urine/Serum Ketones.
   - **Clinical Rules:** ADA Diagnostic Criteria (Normal, Prediabetes, Diabetes Mellitus), Diabetic Ketoacidosis (DKA) emergency alert, Hypoglycemia protocols.
4. **Hematologic & Anemia Evaluation Tool (`evaluate_hematologic_disease`)**:
   - **Biomarkers:** Complete Blood Count (Hemoglobin, Hematocrit, RBC, Platelets, WBC), RBC Indices (MCV, MCH), Iron studies (Ferritin).
   - **Clinical Rules:** WHO Anemia Grading (Mild, Moderate, Severe), Morphologic Classification (Microcytic, Normocytic, Macrocytic), Iron Deficiency Anemia (IDA) confirmation (Microcytosis + Ferritin < 30 ng/mL).
5. **Hepatic & Liver Disease Tool (`evaluate_hepatic_disease`)**:
   - **Biomarkers:** ALT, AST, Alkaline Phosphatase (ALP), Total/Direct Bilirubin, Albumin, INR.
   - **Clinical Rules:** Injury pattern categorization (Hepatocellular vs Cholestatic vs Mixed), De Ritis ratio (AST/ALT $\ge$ 2.0), Hepatic synthetic function screening.

---

## 3. LangGraph Workflow Pipeline
The multi-agent workflow is orchestrated via LangGraph as a state machine:

```
[START]
   │
   ▼
[lab_agent] (Extracts & normalizes laboratory data)
   │
   ▼
[history_agent] (Retrieves longitudinal patient records & symptoms)
   │
   ▼
[disease_tools] (Dispatches Heart, Kidney, Metabolic, Anemia, Liver tools)
   │
   ▼
[clinical_agent] (Gemini synthesizes findings into structured decision support)
   │
   ▼
 [END]
```

---

## 4. REST API Endpoints

### 1. Health & Capabilities Check
* **`GET /health`**
* Returns active status and supported disease evaluation tools.

### 2. Generate Clinical Decision Support
* **`POST /api/clinical-review`**
* **Request Body:**
  ```json
  {
    "patient_id": "patient-1001",
    "lab_result": {
      "troponin": 0.09,
      "ldl": 185,
      "creatinine": 2.4,
      "bun": 52,
      "systolic_bp": 150,
      "diastolic_bp": 92
    },
    "history_result": {
      "age": 58,
      "sex": "male",
      "symptoms": ["chest pain", "shortness of breath"]
    }
  }
  ```
* **Response:**
  Returns `clinical_result` (recommendation, supportingEvidence, possibleRisks, nextSteps, confidence) and `tools_executed`.

---

## 5. How to Run Locally

### 1. Activate Environment and Start API Server
```powershell
cd BlockChain_24MCF1R06
.\.venv\Scripts\python.exe -m uvicorn api:app --host 127.0.0.1 --port 8000 --reload
```
Access the interactive Swagger UI at: **`http://127.0.0.1:8000/docs`**

### 2. Run Test Suite
```powershell
.\.venv\Scripts\python.exe test_graph.py
```

---

## 6. Integration with Team Architecture
- **Common Contract:** Exports `AgentResult` conformant with `orchestrator/agent-contract.js`.
- **Node.js Adapter:** Invoked via `client/node-gateway/agents/clinical-agent.js`.
- **Zero-Downtime Fallback:** Embedded local JavaScript evaluation tools allow the Node orchestrator to operate even if the Python service is offline.
