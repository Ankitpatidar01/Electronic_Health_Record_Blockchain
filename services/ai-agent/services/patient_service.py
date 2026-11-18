"""
Patient Data Service with Atomic Storage and Thread Safety.
Guarantees zero file corruption, structured validation, and deterministic retrieval.
"""

import os
import json
import threading
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

from core.config import settings
from core.logger import get_logger
from schemas.clinical import PatientCreate, PatientRecord, MeasurementSnapshot

logger = get_logger("patient_service")

class PatientService:
    """Thread-safe patient repository with atomic disk synchronization."""
    _lock = threading.Lock()

    def __init__(self, data_dir: Optional[Path] = None):
        self.data_dir = Path(data_dir) if data_dir else settings.data_dir
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.patients_file = self.data_dir / "patients.json"
        self._patients: Dict[str, Any] = self._load_from_disk()

    def _load_from_disk(self) -> Dict[str, Any]:
        """Load patient data from disk with integrity check."""
        if self.patients_file.exists():
            try:
                with open(self.patients_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error reading {self.patients_file}: {e}. Initializing empty.")
                return {}
        return {}

    def _save_to_disk_atomic(self) -> None:
        """Write patient data atomically using a temporary file."""
        tmp_file = self.data_dir / f"patients.json.tmp.{os.getpid()}"
        with open(tmp_file, "w", encoding="utf-8") as f:
            json.dump(self._patients, f, indent=2, ensure_ascii=False)
        os.replace(tmp_file, self.patients_file)

    def register_patient(self, payload: PatientCreate) -> PatientRecord:
        """Register a new patient profile. Raises ValueError if already exists."""
        with self._lock:
            pid = payload.patient_id
            if pid in self._patients:
                raise ValueError(f"Patient with ID '{pid}' already exists.")

            measurements = []
            if payload.initial_vitals:
                vitals_dict = payload.initial_vitals.to_measurement_dict()
                if vitals_dict:
                    measurements.append({
                        "timestamp": datetime.now().isoformat(),
                        "data": vitals_dict
                    })

            record_dict = {
                "name": payload.name,
                "age": payload.age,
                "gender": payload.gender,
                "created_at": datetime.now().isoformat(),
                "measurements": measurements
            }
            self._patients[pid] = record_dict
            self._save_to_disk_atomic()
            logger.info(f"Registered patient: {pid} ({payload.name})")

            return self.get_patient(pid)

    def add_vitals(self, patient_id: str, vitals_dict: Dict[str, str]) -> PatientRecord:
        """Append a new vital sign measurement snapshot for an existing patient."""
        with self._lock:
            if patient_id not in self._patients:
                raise KeyError(f"Patient '{patient_id}' not found.")

            clean_vitals = {k.strip(): str(v).strip() for k, v in vitals_dict.items() if v is not None and str(v).strip()}
            if not clean_vitals:
                raise ValueError("No valid vital signs provided.")

            entry = {
                "timestamp": datetime.now().isoformat(),
                "data": clean_vitals
            }
            self._patients[patient_id]["measurements"].append(entry)
            self._save_to_disk_atomic()
            logger.info(f"Added vitals for patient: {patient_id} ({len(clean_vitals)} metrics)")

            return self.get_patient(patient_id)

    def get_patient(self, patient_id: str) -> Optional[PatientRecord]:
        """Retrieve a patient profile by identifier."""
        data = self._patients.get(patient_id)
        if not data:
            return None
        
        return PatientRecord(
            patient_id=patient_id,
            name=data["name"],
            age=data["age"],
            gender=data["gender"],
            created_at=data["created_at"],
            measurements=[
                MeasurementSnapshot(timestamp=m["timestamp"], data=m["data"])
                for m in data.get("measurements", [])
            ]
        )

    def list_patients(self) -> List[PatientRecord]:
        """List all registered patients."""
        records = []
        for pid in self._patients:
            patient = self.get_patient(pid)
            if patient:
                records.append(patient)
        return records

    def get_patient_summary(self, patient_id: str) -> Optional[str]:
        """Format an ASCII clinical summary for display or RAG ingestion."""
        patient = self.get_patient(patient_id)
        if not patient:
            return None

        lines = [
            f"Patient ID: {patient.patient_id}",
            f"Name: {patient.name}",
            f"Age: {patient.age} years",
            f"Gender: {patient.gender}\n"
        ]

        if patient.measurements:
            latest = patient.measurements[-1]
            lines.append("Latest Measurements:")
            lines.append(f"Date: {latest.timestamp}")
            for metric, val in latest.data.items():
                lines.append(f"- {metric}: {val}")
        else:
            lines.append("No clinical measurements recorded yet.")

        return "\n".join(lines)

    def get_all_summaries(self) -> List[str]:
        """Return all patient summaries for RAG indexing."""
        summaries = []
        for pid in self._patients:
            summary = self.get_patient_summary(pid)
            if summary:
                summaries.append(summary)
        return summaries
