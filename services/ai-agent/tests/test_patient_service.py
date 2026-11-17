"""Unit tests for PatientService."""
import pytest
import shutil
from pathlib import Path

from services.patient_service import PatientService
from schemas.clinical import PatientCreate, VitalSignInput

@pytest.fixture
def temp_patient_service(tmp_path: Path):
    """Fixture providing an isolated PatientService instance."""
    service = PatientService(data_dir=tmp_path)
    yield service
    shutil.rmtree(tmp_path, ignore_errors=True)

def test_register_patient(temp_patient_service: PatientService):
    payload = PatientCreate(
        patient_id="TEST_P001",
        name="Alice Smith",
        age=34,
        gender="Female",
        initial_vitals=VitalSignInput(blood_pressure="120/80 mmHg", heart_rate="72 bpm")
    )
    record = temp_patient_service.register_patient(payload)
    assert record.patient_id == "TEST_P001"
    assert record.name == "Alice Smith"
    assert len(record.measurements) == 1
    assert record.measurements[0].data["Blood Pressure"] == "120/80 mmHg"

def test_duplicate_patient_error(temp_patient_service: PatientService):
    payload = PatientCreate(patient_id="DUP01", name="Bob", age=50, gender="Male")
    temp_patient_service.register_patient(payload)
    with pytest.raises(ValueError, match="already exists"):
        temp_patient_service.register_patient(payload)

def test_add_vitals_trajectory(temp_patient_service: PatientService):
    payload = PatientCreate(patient_id="TRAJ01", name="Charlie", age=60, gender="Male")
    temp_patient_service.register_patient(payload)

    temp_patient_service.add_vitals("TRAJ01", {"Blood Pressure": "130/85 mmHg", "Blood Sugar": "110 mg/dL"})
    temp_patient_service.add_vitals("TRAJ01", {"Blood Pressure": "145/92 mmHg", "Blood Sugar": "135 mg/dL"})

    record = temp_patient_service.get_patient("TRAJ01")
    assert record is not None
    assert len(record.measurements) == 2
    assert record.measurements[-1].data["Blood Pressure"] == "145/92 mmHg"
