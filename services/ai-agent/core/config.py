"""
Configuration management for Clinical AI Agent microservice.
Loads environment variables safely with robust defaults.
"""

import os
from pathlib import Path
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseModel):
    """Microservice runtime settings."""
    app_name: str = "EHR Clinical AI Agent"
    version: str = "2.0.0"
    environment: str = os.getenv("APP_ENV", "development")
    
    # Storage paths
    data_dir: Path = BASE_DIR / "patient_data"
    medical_dir: Path = BASE_DIR / "medical_data"
    chroma_dir: Path = BASE_DIR / "chroma_db"
    
    # Engine configuration
    offline_mode: bool = os.getenv("EHR_OFFLINE_MODE", "true").lower() in ("1", "true", "yes")
    api_host: str = os.getenv("HOST", "0.0.0.0")
    api_port: int = int(os.getenv("PORT", "8000"))
    
    # Clinical governance thresholds
    systolic_critical_high: float = 180.0
    systolic_high: float = 140.0
    diastolic_critical_high: float = 120.0
    diastolic_high: float = 90.0
    spo2_critical_low: float = 90.0
    fasting_glucose_diabetic: float = 126.0
    fasting_glucose_prediabetic: float = 100.0
    hba1c_diabetic: float = 6.5

settings = Settings()
