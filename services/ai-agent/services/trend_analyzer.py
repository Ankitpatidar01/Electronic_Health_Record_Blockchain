"""
Clinical Trend Analyzer & Governance Rule Engine.
Performs deterministic anomaly detection, trajectory analysis, and clinical risk evaluation.
"""

import re
from typing import Dict, List, Optional, Tuple, Any
from core.config import settings
from core.logger import get_logger
from schemas.clinical import PatientRecord, ClinicalRiskAlert, TrendAnalysisResult

logger = get_logger("trend_analyzer")

class ClinicalTrendAnalyzer:
    """Evaluates vital trends and raises actionable clinical risk alerts."""

    @staticmethod
    def _parse_bp(bp_str: str) -> Optional[Tuple[float, float]]:
        """Extract systolic and diastolic numbers from string like '140/90 mmHg'."""
        match = re.search(r"(\d{2,3})\s*/\s*(\d{2,3})", bp_str)
        if match:
            return float(match.group(1)), float(match.group(2))
        return None

    @staticmethod
    def _parse_numeric(val_str: str) -> Optional[float]:
        """Extract first floating-point number from string like '95 mg/dL' or '98.6°F'."""
        match = re.search(r"(\d+(?:\.\d+)?)", val_str)
        if match:
            return float(match.group(1))
        return None

    def evaluate_vitals(self, vitals: Dict[str, str]) -> List[ClinicalRiskAlert]:
        """Apply deterministic medical thresholds to a snapshot of vital signs."""
        alerts: List[ClinicalRiskAlert] = []

        # 1. Blood Pressure Analysis
        bp_val = vitals.get("Blood Pressure")
        if bp_val:
            parsed_bp = self._parse_bp(bp_val)
            if parsed_bp:
                sys_val, dia_val = parsed_bp
                if sys_val >= settings.systolic_critical_high or dia_val >= settings.diastolic_critical_high:
                    alerts.append(ClinicalRiskAlert(
                        parameter="Blood Pressure",
                        severity="CRITICAL",
                        value=bp_val,
                        message="Hypertensive Crisis threshold exceeded.",
                        recommendation="Immediate emergency medical evaluation required. Check for end-organ damage."
                    ))
                elif sys_val >= settings.systolic_high or dia_val >= settings.diastolic_high:
                    alerts.append(ClinicalRiskAlert(
                        parameter="Blood Pressure",
                        severity="WARNING",
                        value=bp_val,
                        message="Stage 2 Hypertension detected.",
                        recommendation="Schedule cardiovascular risk assessment and review antihypertensive regimen."
                    ))

        # 2. Oxygen Saturation (SpO2)
        spo2_val = vitals.get("Oxygen Saturation") or vitals.get("SpO2")
        if spo2_val:
            num_spo2 = self._parse_numeric(spo2_val)
            if num_spo2 is not None:
                if num_spo2 < settings.spo2_critical_low:
                    alerts.append(ClinicalRiskAlert(
                        parameter="Oxygen Saturation",
                        severity="CRITICAL",
                        value=spo2_val,
                        message="Severe hypoxemia detected (SpO2 < 90%).",
                        recommendation="Administer supplemental oxygen immediately and evaluate airway/pulmonary etiology."
                    ))
                elif num_spo2 < 95.0:
                    alerts.append(ClinicalRiskAlert(
                        parameter="Oxygen Saturation",
                        severity="WARNING",
                        value=spo2_val,
                        message="Mild to moderate desaturation (SpO2 90-94%).",
                        recommendation="Monitor continuously; perform pulmonary auscultation and pulse oximetry recheck."
                    ))

        # 3. Blood Glucose
        bs_val = vitals.get("Blood Sugar") or vitals.get("Blood Glucose")
        if bs_val:
            num_bs = self._parse_numeric(bs_val)
            if num_bs is not None:
                if num_bs < 70.0:
                    alerts.append(ClinicalRiskAlert(
                        parameter="Blood Sugar",
                        severity="CRITICAL",
                        value=bs_val,
                        message="Acute hypoglycemia detected (< 70 mg/dL).",
                        recommendation="Administer fast-acting oral carbohydrates or IV dextrose per hypoglycemia protocol."
                    ))
                elif num_bs >= settings.fasting_glucose_diabetic:
                    alerts.append(ClinicalRiskAlert(
                        parameter="Blood Sugar",
                        severity="WARNING",
                        value=bs_val,
                        message="Hyperglycemia consistent with diagnostic diabetes range (>= 126 mg/dL).",
                        recommendation="Order glycated hemoglobin (HbA1c) and initiate glycemic control management."
                    ))

        # 4. Heart Rate
        hr_val = vitals.get("Heart Rate")
        if hr_val:
            num_hr = self._parse_numeric(hr_val)
            if num_hr is not None:
                if num_hr > 120.0:
                    alerts.append(ClinicalRiskAlert(
                        parameter="Heart Rate",
                        severity="WARNING",
                        value=hr_val,
                        message="Significant resting tachycardia (> 120 bpm).",
                        recommendation="Perform 12-lead ECG; assess for infection, dehydration, or arrhythmia."
                    ))
                elif num_hr < 50.0:
                    alerts.append(ClinicalRiskAlert(
                        parameter="Heart Rate",
                        severity="WARNING",
                        value=hr_val,
                        message="Marked resting bradycardia (< 50 bpm).",
                        recommendation="Assess for symptomatic bradycardia, medication effect, or conduction block."
                    ))

        # 5. Temperature
        temp_val = vitals.get("Temperature")
        if temp_val:
            num_temp = self._parse_numeric(temp_val)
            if num_temp is not None:
                # Detect whether Fahrenheit or Celsius
                is_celsius = "c" in temp_val.lower() or num_temp < 45.0
                febrile = num_temp >= 38.0 if is_celsius else num_temp >= 100.4
                if febrile:
                    alerts.append(ClinicalRiskAlert(
                        parameter="Temperature",
                        severity="INFO",
                        value=temp_val,
                        message="Febrile state (pyrexia) identified.",
                        recommendation="Screen for underlying infectious focus; monitor hydration and antipyretic therapy."
                    ))

        return alerts

    def analyze_trajectory(self, patient: PatientRecord) -> TrendAnalysisResult:
        """Analyze trajectory over all historical measurement snapshots."""
        snapshots = patient.measurements
        total_snaps = len(snapshots)

        if total_snaps == 0:
            return TrendAnalysisResult(
                patient_id=patient.patient_id,
                total_snapshots=0,
                status="STABLE",
                alerts=[],
                latest_vitals={},
                historical_trajectory={}
            )

        latest_vitals = snapshots[-1].data
        alerts = self.evaluate_vitals(latest_vitals)

        # Build parameter trajectory
        trajectory: Dict[str, List[Dict[str, Any]]] = {}
        for snap in snapshots:
            ts = snap.timestamp
            for metric, val in snap.data.items():
                if metric not in trajectory:
                    trajectory[metric] = []
                trajectory[metric].append({
                    "timestamp": ts,
                    "value": val,
                    "numeric": self._parse_numeric(val)
                })

        # Determine overall clinical status
        status = "STABLE"
        if any(a.severity == "CRITICAL" for a in alerts):
            status = "CRITICAL_ACTION_REQUIRED"
        elif any(a.severity == "WARNING" for a in alerts):
            status = "MONITORING_REQUIRED"

        return TrendAnalysisResult(
            patient_id=patient.patient_id,
            total_snapshots=total_snaps,
            status=status,
            alerts=alerts,
            latest_vitals=latest_vitals,
            historical_trajectory=trajectory
        )
