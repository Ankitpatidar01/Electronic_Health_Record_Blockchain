"""Unit tests for ClinicalTrendAnalyzer."""
import pytest
from services.trend_analyzer import ClinicalTrendAnalyzer
from schemas.clinical import PatientRecord, MeasurementSnapshot

@pytest.fixture
def analyzer():
    return ClinicalTrendAnalyzer()

def test_hypertensive_crisis_detection(analyzer: ClinicalTrendAnalyzer):
    vitals = {"Blood Pressure": "195/125 mmHg"}
    alerts = analyzer.evaluate_vitals(vitals)
    assert len(alerts) == 1
    assert alerts[0].severity == "CRITICAL"
    assert alerts[0].parameter == "Blood Pressure"
    assert "Crisis" in alerts[0].message

def test_stage2_hypertension_detection(analyzer: ClinicalTrendAnalyzer):
    vitals = {"Blood Pressure": "150/92 mmHg"}
    alerts = analyzer.evaluate_vitals(vitals)
    assert len(alerts) == 1
    assert alerts[0].severity == "WARNING"
    assert "Stage 2" in alerts[0].message

def test_hypoxemia_detection(analyzer: ClinicalTrendAnalyzer):
    vitals = {"Oxygen Saturation": "87%"}
    alerts = analyzer.evaluate_vitals(vitals)
    assert len(alerts) == 1
    assert alerts[0].severity == "CRITICAL"
    assert "hypoxemia" in alerts[0].message.lower()

def test_hypoglycemia_detection(analyzer: ClinicalTrendAnalyzer):
    vitals = {"Blood Sugar": "58 mg/dL"}
    alerts = analyzer.evaluate_vitals(vitals)
    assert len(alerts) == 1
    assert alerts[0].severity == "CRITICAL"
    assert "hypoglycemia" in alerts[0].message.lower()

def test_normal_vitals_no_alerts(analyzer: ClinicalTrendAnalyzer):
    vitals = {
        "Blood Pressure": "118/76 mmHg",
        "Heart Rate": "72 bpm",
        "Blood Sugar": "90 mg/dL",
        "Oxygen Saturation": "99%",
        "Temperature": "98.4°F"
    }
    alerts = analyzer.evaluate_vitals(vitals)
    assert len(alerts) == 0

def test_patient_trajectory_analysis(analyzer: ClinicalTrendAnalyzer):
    patient = PatientRecord(
        patient_id="P_TREND",
        name="Diana Prince",
        age=29,
        gender="Female",
        created_at="2026-10-27T00:00:00",
        measurements=[
            MeasurementSnapshot(timestamp="2026-10-27T01:00:00", data={"Blood Pressure": "120/80 mmHg"}),
            MeasurementSnapshot(timestamp="2026-10-27T02:00:00", data={"Blood Pressure": "185/122 mmHg"})
        ]
    )
    trend = analyzer.analyze_trajectory(patient)
    assert trend.total_snapshots == 2
    assert trend.status == "CRITICAL_ACTION_REQUIRED"
    assert len(trend.alerts) >= 1
