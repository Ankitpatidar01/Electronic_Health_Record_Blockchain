"""Integration tests for FastAPI endpoints."""
import pytest
from fastapi.testclient import TestClient
from main import app

@pytest.fixture
def client():
    return TestClient(app)

def test_health_check(client: TestClient):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data

def test_patient_registration_and_retrieval(client: TestClient):
    payload = {
        "patient_id": "API_TEST_01",
        "name": "Integration Subject",
        "age": 42,
        "gender": "Male",
        "initial_vitals": {
            "blood_pressure": "125/82 mmHg",
            "heart_rate": "74 bpm"
        }
    }
    # Register (or handle if already registered from previous run)
    resp = client.post("/api/v1/patients", json=payload)
    assert resp.status_code in (201, 409)

    get_resp = client.get("/api/v1/patients/API_TEST_01")
    assert get_resp.status_code == 200
    pdata = get_resp.json()
    assert pdata["name"] == "Integration Subject"

def test_append_vitals_and_trend(client: TestClient):
    vitals_payload = {
        "blood_pressure": "190/125 mmHg",
        "oxygen_saturation": "88%"
    }
    resp = client.post("/api/v1/patients/API_TEST_01/vitals", json=vitals_payload)
    assert resp.status_code == 200
    trend = resp.json()
    assert trend["status"] == "CRITICAL_ACTION_REQUIRED"
    assert len(trend["alerts"]) >= 1

def test_agent_query(client: TestClient):
    query_payload = {
        "question": "What is hypertension and how is it staged?",
        "patient_id": "API_TEST_01"
    }
    resp = client.post("/api/v1/agent/query", json=query_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["answer"]) > 0
    assert data["confidence"] in ("High", "Medium", "Low")
    assert len(data["sources"]) > 0

def test_lab_report_analysis(client: TestClient):
    lab_payload = {
        "patient_id": "API_TEST_01",
        "report_text": "CBC Panel: Hemoglobin: 9.8 g/dL, WBC: 14.2 k/uL, Platelets: 230k",
        "report_type": "Hematology"
    }
    resp = client.post("/api/v1/agent/analyze-report", json=lab_payload)
    assert resp.status_code == 200
    analysis = resp.json()
    assert len(analysis["findings"]) >= 2
    assert len(analysis["abnormalities_flagged"]) >= 1
    assert len(analysis["provenance_hash"]) == 64
