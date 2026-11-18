import traceback
from typing import Any, Optional, Dict, List

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from graph import build_graph


app = FastAPI(
    title="Blockchain EHR Clinical Decision Support API",
    description="Multi-agent clinical reasoning service with disease-specific evaluation tools (Heart, Kidney, Diabetes, Anemia, Liver)",
    version="2.0.0"
)

# Build the LangGraph workflow once at service startup
clinical_graph = build_graph()


class ClinicalReviewRequest(BaseModel):
    patient_id: str = Field(min_length=1)
    lab_result: Optional[Dict[str, Any]] = Field(default_factory=dict)
    history_result: Optional[Dict[str, Any]] = Field(default_factory=dict)
    run_id: Optional[str] = None


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "clinical-decision-support",
        "version": "2.0.0",
        "supported_disease_tools": [
            "Heart / Cardiovascular Disease Tool",
            "Kidney / Renal Disease Tool",
            "Diabetes & Metabolic Disease Tool",
            "Hematologic & Anemia Evaluation Tool",
            "Hepatic & Liver Disease Tool"
        ]
    }


@app.post("/api/clinical-review")
def generate_clinical_review(request: ClinicalReviewRequest):
    """
    Executes the multi-agent clinical decision support pipeline:
    Lab Agent -> History Agent -> Disease Tools Node -> Clinical Reasoning Agent
    """
    initial_state = {
        "runId": request.run_id or f"run-{request.patient_id}",
        "patient_id": request.patient_id,
        "lab_result": request.lab_result if request.lab_result is not None else {},
        "history_result": request.history_result if request.history_result is not None else {}
    }

    try:
        result = clinical_graph.invoke(initial_state)

        if result.get("error") or result.get("clinical_result") is None:
            err_msg = result.get("error") or "Clinical synthesis could not be generated."
            raise HTTPException(
                status_code=502,
                detail=err_msg
            )

        clinical_result = result["clinical_result"]

        if hasattr(clinical_result, "model_dump"):
            clinical_result = clinical_result.model_dump()

        disease_analysis = result.get("disease_analysis") or {}

        return {
            "patient_id": request.patient_id,
            "run_id": initial_state["runId"],
            "clinical_result": clinical_result,
            "tools_executed": disease_analysis.get("tools_executed", clinical_result.get("toolsExecuted", [])),
            "disease_analyses": disease_analysis.get("disease_analyses", clinical_result.get("diseaseSpecificAnalysis", {})),
            "overall_severity": disease_analysis.get("overall_severity", "LOW"),
            "review_status": "PENDING_HUMAN_REVIEW"
        }

    except HTTPException:
        raise

    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(
            status_code=502,
            detail=f"Clinical decision support service failed: {str(exc)}"
        )