from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional


class ClinicalResult(BaseModel):

    recommendation: str = Field(
        description=(
            "A concise, non-prescriptive clinical review "
            "synthesizing laboratory data, patient history, "
            "and disease-specific tool findings."
        )
    )

    supportingEvidence: List[str] = Field(
        description=(
            "Specific supplied findings and biomarker metrics "
            "that support the clinical observations."
        )
    )

    possibleRisks: List[str] = Field(
        description=(
            "Potential concerns and clinical risks across disease "
            "domains (e.g. cardiac, renal, metabolic, hematologic, hepatic)."
        )
    )

    nextSteps: List[str] = Field(
        description=(
            "Non-prescriptive considerations and guideline-recommended "
            "diagnostic follow-ups for a qualified clinician."
        )
    )

    diseaseSpecificAnalysis: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description=(
            "Structured findings from specialized disease tools "
            "(heart, kidney, metabolic, hematologic, hepatic)."
        )
    )

    toolsExecuted: Optional[List[str]] = Field(
        default_factory=list,
        description=(
            "List of specialized disease evaluation tools executed."
        )
    )

    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description=(
            "Model-reported confidence score between 0 and 1. "
            "This is not a clinically validated probability."
        )
    )