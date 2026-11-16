from typing import TypedDict, Optional, Dict, Any, List
from schemas import ClinicalResult


class ClinicalState(TypedDict, total=False):
    runId: Optional[str]
    patient_id: str
    lab_result: dict
    history_result: dict
    disease_analysis: Optional[Dict[str, Any]]
    clinical_result: Optional[ClinicalResult]
    error: Optional[str]