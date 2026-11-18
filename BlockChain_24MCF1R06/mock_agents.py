from state import ClinicalState


def lab_agent(state: ClinicalState):
    print("\n[Lab Agent] Running...")

    # Use supplied laboratory data when available.
    if state.get("lab_result") is not None:
        lab_result = state["lab_result"]
        print("[Lab Agent] Using supplied laboratory data.")
    else:
        # Synthetic data for local demonstration only.
        lab_result = {
            "hemoglobin": 9.2,
            "mcv": 72,
            "ferritin": 18
        }
        print("[Lab Agent] Using synthetic demonstration data.")

    return {
        "lab_result": lab_result
    }


def history_agent(state: ClinicalState):
    print("\n[History Agent] Running...")

    # Use supplied patient-history data when available.
    if state.get("history_result") is not None:
        history_result = state["history_result"]
        print("[History Agent] Using supplied history data.")
    else:
        # Synthetic data for local demonstration only.
        history_result = {
            "age": 35,
            "symptoms": [
                "fatigue",
                "weakness"
            ],
            "medical_history": [
                "No known chronic illness"
            ]
        }
        print("[History Agent] Using synthetic demonstration data.")

    return {
        "history_result": history_result
    }