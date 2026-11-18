import os
import traceback
from typing import Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

from langchain_google_genai import ChatGoogleGenerativeAI
from schemas import ClinicalResult
from disease_tools import run_disease_tools


class ClinicalAgent:

    def __init__(self, model_name: str = "gemini-2.5-flash"):
        self.model_name = os.getenv("GEMINI_MODEL", model_name)
        try:
            self.model = ChatGoogleGenerativeAI(
                model=self.model_name,
                temperature=0
            )
            self.structured_model = self.model.with_structured_output(
                ClinicalResult
            )
        except Exception as e:
            print(f"[Clinical Agent] Warning: LLM model initialization: {e}")
            self.model = None
            self.structured_model = None

    def analyze(
        self,
        lab_result: dict,
        history_result: dict,
        disease_analysis: Optional[dict] = None
    ) -> ClinicalResult:
        # Run disease-specific tools across heart, kidney, metabolic, hematologic, hepatic
        if disease_analysis is None:
            disease_analysis = run_disease_tools(lab_result, history_result)

        tools_executed = disease_analysis.get("tools_executed", [])
        disease_results = disease_analysis.get("disease_analyses", {})
        tool_findings = disease_analysis.get("findings", [])
        tool_risks = disease_analysis.get("possible_risks", [])
        tool_actions = disease_analysis.get("recommended_actions", [])

        prompt = f"""
You are the Clinical Reasoning Agent in a healthcare Electronic Health Record system.
Your task is to synthesize the provided laboratory results, patient history, and
evidence-based disease-specific tool evaluations.

LABORATORY RESULTS:
{lab_result}

PATIENT HISTORY:
{history_result}

SPECIALIZED DISEASE TOOLS EXECUTED:
{tools_executed}

EVALUATION FINDINGS FROM DISEASE TOOLS:
Findings: {tool_findings}
Identified Clinical Risks: {tool_risks}
Guideline Recommendations: {tool_actions}

Requirements:
1. Synthesize the laboratory results, patient history, and disease tool outputs.
2. Provide a concise, professional clinical recommendation.
3. Identify possible risks across relevant organ systems (e.g. cardiac, renal, metabolic, hematologic).
4. Provide appropriate next steps for professional clinical follow-up.
5. Provide a confidence value between 0.0 and 1.0 based on clinical evidence completeness.
6. Do not invent information that is not present in the input.
7. Do not provide a definitive diagnosis; use uncertainty-aware terminology ("may indicate", "could be consistent with").
8. Do not prescribe specific medications, dosages, or definitive treatment regimens.
9. Populate diseaseSpecificAnalysis with the tool outputs and toolsExecuted with the list of tools run.
10. The output is assistive decision support for a qualified healthcare professional, not a final medical order.
"""

        if self.structured_model is not None:
            try:
                result = self.structured_model.invoke(prompt)
                # Ensure diseaseSpecificAnalysis and toolsExecuted are preserved
                if not result.diseaseSpecificAnalysis:
                    result.diseaseSpecificAnalysis = disease_results
                if not result.toolsExecuted:
                    result.toolsExecuted = tools_executed
                return result
            except Exception as exc:
                print(f"[Clinical Agent] LLM invocation failed: {exc}. Falling back to deterministic disease tool synthesis.")

        # Deterministic Fallback Synthesis when LLM is unavailable or fails
        return self._generate_fallback_synthesis(
            lab_result=lab_result,
            history_result=history_result,
            disease_analysis=disease_analysis
        )

    def _generate_fallback_synthesis(
        self,
        lab_result: dict,
        history_result: dict,
        disease_analysis: dict
    ) -> ClinicalResult:
        """Deterministic clinical decision support synthesis built from disease tools."""
        tools_executed = disease_analysis.get("tools_executed", [])
        disease_results = disease_analysis.get("disease_analyses", {})
        findings = disease_analysis.get("findings", [])
        risks = disease_analysis.get("possible_risks", [])
        actions = disease_analysis.get("recommended_actions", [])
        severity = disease_analysis.get("overall_severity", "LOW")

        if not findings:
            findings = ["Supplied laboratory values evaluated across disease tools."]

        if risks:
            recommendation = (
                f"Evaluation by specialized disease tools ({', '.join(tools_executed)}) identified potential clinical "
                f"concerns with {severity.lower()} severity. Findings warrant review by a qualified healthcare professional."
            )
            confidence = 0.85 if severity in ("HIGH", "CRITICAL") else 0.75
        else:
            recommendation = (
                f"Laboratory and history data evaluated by specialized disease tools ({', '.join(tools_executed) or 'General'}). "
                "Parameters appear within non-critical reference thresholds. Clinical correlation is recommended."
            )
            confidence = 0.70

        if not risks:
            risks = ["Ongoing clinical observation recommended."]

        if not actions:
            actions = ["Routine clinical follow-up as scheduled by the attending physician."]

        return ClinicalResult(
            recommendation=recommendation,
            supportingEvidence=findings[:8],
            possibleRisks=risks[:6],
            nextSteps=actions[:6],
            diseaseSpecificAnalysis=disease_results,
            toolsExecuted=tools_executed,
            confidence=confidence
        )