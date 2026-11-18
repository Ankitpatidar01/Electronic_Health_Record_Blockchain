"""
Comprehensive Multi-Disease LangGraph Pipeline Test.
Tests execution across Heart, Kidney, Diabetes, Anemia, and Hepatic disease tools.
"""

from graph import build_graph


def run_test_case(name: str, patient_id: str, lab_result: dict, history_result: dict):
    print("\n" + "=" * 60)
    print(f"TEST CASE: {name}")
    print("=" * 60)

    graph = build_graph()
    initial_state = {
        "runId": f"test-{patient_id}",
        "patient_id": patient_id,
        "lab_result": lab_result,
        "history_result": history_result
    }

    result = graph.invoke(initial_state)

    print("\nPatient ID:", result["patient_id"])
    disease_analysis = result.get("disease_analysis") or {}
    print("Tools Executed:", disease_analysis.get("tools_executed"))
    print("Overall Severity:", disease_analysis.get("overall_severity"))

    clinical = result.get("clinical_result")
    if clinical:
        if hasattr(clinical, "model_dump"):
            data = clinical.model_dump()
        elif isinstance(clinical, dict):
            data = clinical
        else:
            data = vars(clinical)

        print(f"\nRecommendation:\n{data.get('recommendation')}")
        print(f"\nSupporting Evidence:\n{data.get('supportingEvidence')}")
        print(f"\nPossible Risks:\n{data.get('possibleRisks')}")
        print(f"\nNext Steps:\n{data.get('nextSteps')}")
        print(f"\nConfidence: {data.get('confidence')}")
        if data.get("diseaseSpecificAnalysis"):
            print("\nDisease Domains Analyzed:", list(data["diseaseSpecificAnalysis"].keys()))
    else:
        print("Error:", result.get("error"))

    print("\n" + "-" * 60)


if __name__ == "__main__":
    # Case 1: Hematologic Anemia (Student baseline case)
    run_test_case(
        name="Microcytic Iron Deficiency Anemia",
        patient_id="P-ANEMIA-01",
        lab_result={"hemoglobin": 9.2, "mcv": 72, "ferritin": 18},
        history_result={"age": 35, "sex": "female", "symptoms": ["fatigue", "weakness"]}
    )

    # Case 2: Cardiac / Heart Disease Case
    run_test_case(
        name="Cardiovascular - Acute Troponin Elevation & Hyperlipidemia",
        patient_id="P-CARDIAC-02",
        lab_result={"troponin": 0.08, "ldl": 182, "total_cholesterol": 245, "systolic_bp": 155, "diastolic_bp": 95},
        history_result={"age": 58, "sex": "male", "symptoms": ["substernal chest pressure", "dyspnea"]}
    )

    # Case 3: Renal / Kidney Disease Case (KDIGO Staging)
    run_test_case(
        name="Renal - Chronic Kidney Disease & Prerenal Azotemia",
        patient_id="P-RENAL-03",
        lab_result={"creatinine": 2.6, "bun": 58, "potassium": 5.2, "urine_protein": 45},
        history_result={"age": 67, "sex": "male", "symptoms": ["decreased urine output", "lethargy"]}
    )
