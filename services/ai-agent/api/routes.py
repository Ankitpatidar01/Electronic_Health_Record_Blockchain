"""
FastAPI REST Routes for Clinical AI Agent Microservice.
Provides secure, documented endpoints for external services (e.g. Node.js Lab Gateway, Hospital EHR).
"""

from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query

from schemas.clinical import (
    PatientCreate,
    PatientRecord,
    VitalSignInput,
    TrendAnalysisResult,
    AgentQueryRequest,
    AgentQueryResponse,
    LabReportAnalysisRequest,
    LabReportAnalysisResponse,
)
from services.patient_service import PatientService
from services.trend_analyzer import ClinicalTrendAnalyzer
from services.rag_engine import ClinicalRAGEngine
from core.logger import get_logger
from core import telemetry
from core.auth import require_staff

logger = get_logger("api_routes")
# Every route needs a signed-in staff token (patient data is read and written here).
router = APIRouter(prefix="/api/v1", tags=["Clinical AI Agent"], dependencies=[Depends(require_staff)])

# Service singletons
patient_service = PatientService()
trend_analyzer = ClinicalTrendAnalyzer()
rag_engine = ClinicalRAGEngine(patient_service=patient_service)

# ==========================================
# 1. Patient & Vitals Endpoints
# ==========================================

@router.post("/patients", response_model=PatientRecord, status_code=status.HTTP_201_CREATED)
def register_patient(payload: PatientCreate):
    """Register a new patient with optional baseline vitals."""
    try:
        record = patient_service.register_patient(payload)
        rag_engine.sync_patient(record.patient_id)
        return record
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        logger.error(f"Error registering patient: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")

@router.get("/patients", response_model=List[PatientRecord])
def list_patients():
    """List all registered patients in the system."""
    return patient_service.list_patients()

@router.get("/patients/{patient_id}", response_model=PatientRecord)
def get_patient(patient_id: str):
    """Retrieve complete patient profile and historical vitals."""
    patient = patient_service.get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Patient '{patient_id}' not found.")
    return patient

@router.post("/patients/{patient_id}/vitals", response_model=TrendAnalysisResult)
def record_patient_vitals(patient_id: str, vitals: VitalSignInput):
    """
    Append a new timestamped vitals snapshot for a patient.
    Immediately returns clinical trend analysis and risk alerts.
    """
    try:
        measurement_dict = vitals.to_measurement_dict()
        if not measurement_dict:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one vital sign metric must be provided.")

        patient = patient_service.add_vitals(patient_id, measurement_dict)
        rag_engine.sync_patient(patient_id)
        return trend_analyzer.analyze_trajectory(patient)
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error recording vitals: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/patients/{patient_id}/trends", response_model=TrendAnalysisResult)
def get_patient_trends(patient_id: str):
    """Get clinical trajectory, historical deltas, and risk alerts for a patient."""
    patient = patient_service.get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Patient '{patient_id}' not found.")
    return trend_analyzer.analyze_trajectory(patient)

# ==========================================
# 2. Clinical RAG & Inference Endpoints
# ==========================================

@router.post("/agent/query", response_model=AgentQueryResponse)
def query_clinical_agent(req: AgentQueryRequest):
    """
    Query the Medical RAG assistant.
    Retrieves evidence from peer-reviewed literature and contextual patient records.
    """
    try:
        with telemetry.track(req.patient_id):
            return rag_engine.query(req)
    except Exception as e:
        logger.error(f"Error querying clinical agent: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/agent/analyze-report", response_model=LabReportAnalysisResponse)
def analyze_lab_report(req: LabReportAnalysisRequest):
    """
    Analyze raw lab report text (e.g. from Node.js Lab Gateway).
    Extracts markers, detects abnormalities, and computes cryptographic provenance.
    """
    try:
        with telemetry.track(req.patient_id):
            result = rag_engine.analyze_lab_report(req.report_text, req.patient_id)
        return LabReportAnalysisResponse(
            patient_id=result["patient_id"],
            report_type=req.report_type or "General Lab Report",
            findings=result["findings"],
            abnormalities_flagged=result["abnormalities_flagged"],
            suggested_followups=result["suggested_followups"],
            provenance_hash=result["provenance_hash"]
        )
    except Exception as e:
        logger.error(f"Error analyzing lab report: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
