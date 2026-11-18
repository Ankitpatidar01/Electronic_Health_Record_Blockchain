"""
Zero-PHI telemetry for the observability dashboard.

Posts event envelopes to dashboard-api (POST /internal/events), which fans
them out on the dashboard WebSocket stream. Disabled unless both
DASHBOARD_EVENT_API_URL and DASHBOARD_SERVICE_KEY are set. Sending happens on
daemon threads and never raises into request handling. Only agent ids, status
codes, durations and a keyed hash of the patient id are sent.
"""

import hashlib
import hmac
import json
import os
import re
import threading
import time
import urllib.request
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

AGENT_ID = "clinical-agent"
_SAFE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")
_ORGS = {"HospitalMSP", "DiagnosticsMSP", "ProviderMSP"}


def _settings() -> Dict[str, str]:
    return {
        "url": os.getenv("DASHBOARD_EVENT_API_URL", "").rstrip("/"),
        "key": os.getenv("DASHBOARD_SERVICE_KEY", ""),
        "org": os.getenv("DASHBOARD_EVENT_ORG", "HospitalMSP"),
    }


def is_enabled() -> bool:
    cfg = _settings()
    return bool(cfg["url"] and cfg["key"] and cfg["org"] in _ORGS)


def patient_hash(patient_id: Optional[str]) -> Optional[str]:
    key = _settings()["key"]
    if not key or not patient_id:
        return None
    digest = hmac.new(key.encode("utf-8"), str(patient_id).encode("utf-8"), hashlib.sha256).hexdigest()
    return f"hmac-sha256:{digest}"


def _post(url: str, key: str, body: bytes) -> None:
    try:
        request = urllib.request.Request(
            f"{url}/internal/events",
            data=body,
            method="POST",
            headers={"content-type": "application/json", "x-dashboard-service-key": key},
        )
        urllib.request.urlopen(request, timeout=1.5).close()
    except Exception:
        # Telemetry is best effort; the dashboard being down must not affect care workflows.
        pass


def emit(event_type: str, payload: Optional[Dict[str, Any]] = None, severity: str = "INFO",
         correlation_id: Optional[str] = None) -> None:
    if not is_enabled():
        return
    cfg = _settings()
    clean = {k: v for k, v in (payload or {}).items() if v is not None and v != ""}
    event: Dict[str, Any] = {
        "schemaVersion": 1,
        "eventId": f"clinical-agent-{uuid.uuid4()}",
        "eventType": event_type,
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
        "source": "clinical-ai-agent",
        "org": cfg["org"],
        "severity": severity,
        "payload": clean,
    }
    if correlation_id and _SAFE.match(correlation_id):
        event["correlationId"] = correlation_id
    body = json.dumps({"events": [event]}).encode("utf-8")
    threading.Thread(target=_post, args=(cfg["url"], cfg["key"], body), daemon=True).start()


class track:
    """Context manager that reports one agent execution (started / completed / failed)."""

    def __init__(self, patient_id: Optional[str] = None, stage: str = "AGENT_PROCESSING"):
        self.correlation_id = f"clinical-{uuid.uuid4()}"
        self.patient = patient_hash(patient_id)
        self.stage = stage
        self.started = 0.0

    def __enter__(self) -> "track":
        self.started = time.monotonic()
        emit("AGENT_EXECUTION_STARTED", {"agentId": AGENT_ID, "status": "RUNNING", "patientIdHash": self.patient},
             correlation_id=self.correlation_id)
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        duration = int((time.monotonic() - self.started) * 1000)
        failed = exc_type is not None
        emit(
            "AGENT_EXECUTION_FAILED" if failed else "AGENT_EXECUTION_COMPLETED",
            {
                "agentId": AGENT_ID,
                "status": "FAILED" if failed else "COMPLETED",
                "durationMs": duration,
                "patientIdHash": self.patient,
                "errorCode": "CLINICAL_AGENT_ERROR" if failed else None,
            },
            severity="WARNING" if failed else "INFO",
            correlation_id=self.correlation_id,
        )
        emit(
            "AGENT_STAGE_UPDATED",
            {
                "agentId": AGENT_ID,
                "stage": self.stage,
                "stageStatus": "FAILED" if failed else "DONE",
                "durationMs": duration,
                "patientIdHash": self.patient,
            },
            severity="WARNING" if failed else "INFO",
            correlation_id=self.correlation_id,
        )
        return False  # never swallow the caller's exception


def start_heartbeat(interval_seconds: float = 15.0) -> None:
    if not is_enabled():
        return

    def beat() -> None:
        while True:
            emit("AGENT_HEARTBEAT", {"agentId": AGENT_ID, "status": "ONLINE"})
            time.sleep(interval_seconds)

    threading.Thread(target=beat, daemon=True, name="dashboard-heartbeat").start()
