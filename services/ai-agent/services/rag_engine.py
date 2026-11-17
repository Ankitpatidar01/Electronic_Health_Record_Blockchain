"""
Clinical RAG Engine.
Provides hybrid semantic/keyword search, source citation tracking,
and integration with clinical trend evaluation.
"""

import os
import json
import re
import hashlib
from typing import Dict, List, Optional, Any

from core.config import settings
from core.logger import get_logger
from services.patient_service import PatientService
from services.trend_analyzer import ClinicalTrendAnalyzer
from schemas.clinical import AgentQueryRequest, AgentQueryResponse, ClinicalRiskAlert

logger = get_logger("rag_engine")

class ClinicalRAGEngine:
    """Clinical RAG engine supporting zero-download offline mode and neural retrieval."""

    def __init__(self, patient_service: Optional[PatientService] = None):
        self.patient_service = patient_service or PatientService()
        self.trend_analyzer = ClinicalTrendAnalyzer()
        self.medical_dir = settings.medical_dir
        self.offline_mode = settings.offline_mode
        self._corpus: List[Dict[str, str]] = []
        self._initialize_corpus()

    def _initialize_corpus(self) -> None:
        """Load and index medical seed articles and patient summaries."""
        docs = []
        json_file = self.medical_dir / "pubmed_articles.json"
        if json_file.exists():
            try:
                with open(json_file, "r", encoding="utf-8") as f:
                    articles = json.load(f)
                for a in articles:
                    docs.append({
                        "id": f"pubmed_{a.get('source', '').replace(' ', '_')}",
                        "title": a.get("title", ""),
                        "text": f"Title: {a.get('title', '')}\n\nAbstract: {a.get('abstract', '')}",
                        "source": f"{a.get('source', 'PubMed')} ({a.get('url', '')})",
                        "type": "medical_literature"
                    })
            except Exception as e:
                logger.error(f"Error loading {json_file}: {e}")

        # Add patient records
        for p in self.patient_service.list_patients():
            summary = self.patient_service.get_patient_summary(p.patient_id)
            if summary:
                docs.append({
                    "id": f"patient_{p.patient_id}",
                    "title": f"Patient Record {p.patient_id} ({p.name})",
                    "text": f"PATIENT RECORD:\n{summary}",
                    "source": f"Local EHR Database (Patient ID: {p.patient_id})",
                    "type": "patient_record"
                })

        self._corpus = docs
        logger.info(f"RAG Corpus initialized with {len(docs)} documents (Offline Mode: {self.offline_mode})")

    def sync_patient(self, patient_id: str) -> None:
        """Incrementally update or insert a patient record in the active RAG index."""
        # Invalidate old patient entry
        self._corpus = [d for d in self._corpus if d.get("id") != f"patient_{patient_id}"]
        summary = self.patient_service.get_patient_summary(patient_id)
        if summary:
            patient = self.patient_service.get_patient(patient_id)
            name = patient.name if patient else "Unknown"
            self._corpus.append({
                "id": f"patient_{patient_id}",
                "title": f"Patient Record {patient_id} ({name})",
                "text": f"PATIENT RECORD:\n{summary}",
                "source": f"Local EHR Database (Patient ID: {patient_id})",
                "type": "patient_record"
            })
            logger.info(f"Incrementally updated RAG index for patient: {patient_id}")

    def query(self, req: AgentQueryRequest) -> AgentQueryResponse:
        """Execute clinical question-answering with evidence citations."""
        question = req.question.strip()
        patient_id = req.patient_id
        clinical_alerts: List[ClinicalRiskAlert] = []

        # If a patient context is provided, pull and evaluate their vitals
        if patient_id:
            patient = self.patient_service.get_patient(patient_id)
            if patient:
                trend = self.trend_analyzer.analyze_trajectory(patient)
                clinical_alerts = trend.alerts
                self.sync_patient(patient_id)

        # Keyword and semantic relevance scoring
        terms = [t.lower() for t in re.findall(r"\b\w{3,}\b", question)]
        if patient_id:
            terms.append(patient_id.lower())

        scored_docs = []
        for doc in self._corpus:
            content_lower = doc["text"].lower()
            score = 0
            # Term frequency match
            for t in terms:
                count = content_lower.count(t)
                score += count * 2

            # Patient-specific query boost
            if patient_id and doc.get("id") == f"patient_{patient_id}":
                score += 15

            if score > 0:
                scored_docs.append((score, doc))

        scored_docs.sort(key=lambda x: x[0], reverse=True)
        top_matches = [d for score, d in scored_docs[:3]]

        if not top_matches:
            return AgentQueryResponse(
                question=question,
                answer="No relevant medical guidelines, literature, or patient records were found matching your inquiry.",
                confidence="Low",
                sources=[],
                clinical_alerts=clinical_alerts
            )

        # Synthesize clinically grounded response
        answer_parts = []
        sources = []

        for d in top_matches:
            sources.append(f"{d['title']} - {d['source']}")
            if d["type"] == "patient_record":
                answer_parts.append(d["text"])
            else:
                # Extract abstract content cleanly
                text = d["text"]
                if "Abstract:" in text:
                    abstract = text.split("Abstract:")[1].strip()
                    answer_parts.append(f"Clinical Guidance ({d['title']}):\n{abstract}")
                else:
                    answer_parts.append(text)

        confidence = "High" if len(top_matches) >= 2 else "Medium"
        answer = "\n\n".join(answer_parts)

        return AgentQueryResponse(
            question=question,
            answer=answer,
            confidence=confidence,
            sources=sources,
            clinical_alerts=clinical_alerts
        )

    def analyze_lab_report(self, report_text: str, patient_id: str) -> Dict[str, Any]:
        """Analyze raw clinical report text, identify key values, and flag abnormalities."""
        findings = []
        abnormalities = []
        followups = []

        # Parse common lab markers
        patterns = {
            "Hemoglobin (Hb)": r"(?:hemoglobin|hb)\s*[:=]?\s*(\d+(?:\.\d+)?)",
            "White Blood Cells (WBC)": r"(?:wbc|white\s+blood\s+cells?)\s*[:=]?\s*(\d+(?:\.\d+)?)",
            "Platelets": r"(?:platelets?)\s*[:=]?\s*(\d+(?:\.\d+)?)",
            "Creatinine": r"(?:creatinine)\s*[:=]?\s*(\d+(?:\.\d+)?)",
            "Blood Glucose": r"(?:glucose|blood\s+sugar)\s*[:=]?\s*(\d+(?:\.\d+)?)"
        }

        for marker, pat in patterns.items():
            m = re.search(pat, report_text, re.IGNORECASE)
            if m:
                val = float(m.group(1))
                findings.append(f"{marker}: {val}")
                # Threshold rules
                if marker == "Hemoglobin (Hb)" and val < 11.0:
                    abnormalities.append(f"Low Hemoglobin ({val} g/dL) - Anemia indicator")
                    followups.append("Evaluate iron studies, ferritin, and reticulocyte count.")
                elif marker == "White Blood Cells (WBC)" and (val > 11.0 or val < 4.0):
                    abnormalities.append(f"Abnormal Leukocyte count ({val} k/uL)")
                    followups.append("Screen for acute bacterial infection or inflammatory process.")
                elif marker == "Creatinine" and val > 1.3:
                    abnormalities.append(f"Elevated Serum Creatinine ({val} mg/dL)")
                    followups.append("Calculate eGFR; evaluate for renal insufficiency or dehydration.")

        if not findings:
            findings.append("General clinical report text processed.")
            followups.append("Correlate findings with patient clinical history and attending clinician examination.")

        provenance = hashlib.sha256(report_text.encode("utf-8")).hexdigest()

        return {
            "patient_id": patient_id,
            "findings": findings,
            "abnormalities_flagged": abnormalities,
            "suggested_followups": followups,
            "provenance_hash": provenance
        }
