import traceback
from state import ClinicalState
from clinical_agent import ClinicalAgent
from disease_tools import run_disease_tools


clinical_agent = ClinicalAgent()


def disease_tools_node(state: ClinicalState):
    """
    LangGraph Node: Dispatches specialized disease evaluation tools
    (Heart, Kidney, Diabetes/Metabolic, Hematologic, Hepatic) based on
    biomarkers in laboratory results and patient history.
    """
    print("\n[Disease Tools Node] Dispatching specialized clinical tools...")

    lab_result = state.get("lab_result") or {}
    history_result = state.get("history_result") or {}

    disease_analysis = run_disease_tools(lab_result, history_result)
    executed = disease_analysis.get("tools_executed", [])
    print(f"[Disease Tools Node] Tools executed: {executed or 'General'}")
    if disease_analysis.get("possible_risks"):
        print(f"[Disease Tools Node] Clinical risks flagged: {len(disease_analysis['possible_risks'])}")

    return {
        "disease_analysis": disease_analysis
    }


def clinical_node(state: ClinicalState):
    """
    LangGraph Node: Clinical Reasoning Agent synthesizing multi-disease tool
    findings, patient history, and laboratory results into structured decision support.
    """
    print("\n[Clinical Agent] Running synthesis...")

    lab_result = state.get("lab_result")
    history_result = state.get("history_result")
    disease_analysis = state.get("disease_analysis")

    # If disease_tools_node was bypassed, run directly
    if disease_analysis is None:
        disease_analysis = run_disease_tools(lab_result or {}, history_result or {})

    try:
        result = clinical_agent.analyze(
            lab_result=lab_result or {},
            history_result=history_result or {},
            disease_analysis=disease_analysis
        )

        print("[Clinical Agent] Multi-disease clinical synthesis generated successfully.")

        return {
            "clinical_result": result,
            "error": None
        }

    except Exception as exc:
        print(f"[Clinical Agent] Error during clinical reasoning: {exc}")
        traceback.print_exc()

        return {
            "clinical_result": None,
            "error": f"Clinical synthesis failed: {str(exc)}"
        }