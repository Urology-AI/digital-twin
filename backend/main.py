"""
COMPASS Digital Twin – FastAPI backend
Orchestrates Claude LLM calls for clinical narrative generation and Q&A.
"""

import json
import os

import anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any, Dict, List, Optional

load_dotenv()

app = FastAPI(title="COMPASS Digital Twin API", version="1.0.0")

ALLOWED_ORIGINS = [
    "https://urology-ai.github.io",
    "http://localhost:5173",
    "http://localhost:4173",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

SYSTEM_PROMPT = """You are a clinical decision support assistant for the COMPASS Digital Twin \
platform, specialized in prostate cancer treatment planning. You help urologists interpret \
patient data, machine learning predictions, and provide evidence-based clinical insights.

When analyzing patient data:
- Use precise medical terminology appropriate for board-certified urologists
- Reference specific prediction values with clinical context
- Consider multi-parametric MRI findings, PSA kinetics, biopsy grade group, and staging data
- Provide balanced risk-benefit analysis
- Always note that AI predictions are decision-support tools, not diagnostic conclusions
- Keep responses concise and clinically actionable"""


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@app.get("/health")
def health():
    return {"status": "ok", "service": "compass-api"}


# ---------------------------------------------------------------------------
# /api/analyze  – structured clinical narrative
# ---------------------------------------------------------------------------


class ClinicalData(BaseModel):
    age: Optional[int] = None
    psa: Optional[float] = None
    clinical_stage: Optional[str] = None
    grade_group: Optional[int] = None
    cores_positive: Optional[int] = None
    cores_total: Optional[int] = None
    prostate_volume: Optional[float] = None
    extra_fields: Optional[Dict[str, Any]] = None


class Predictions(BaseModel):
    ece_probability: Optional[float] = None
    svi_probability: Optional[float] = None
    lni_probability: Optional[float] = None
    psm_probability: Optional[float] = None
    bcr_probability: Optional[float] = None
    upgrading_probability: Optional[float] = None
    extra_predictions: Optional[Dict[str, Any]] = None


class AnalyzeRequest(BaseModel):
    patient_id: Optional[str] = None
    clinical_data: ClinicalData
    predictions: Optional[Predictions] = None


class AnalyzeResponse(BaseModel):
    narrative: str
    key_findings: List[str]
    recommendations: List[str]


def _build_analyze_prompt(req: AnalyzeRequest) -> str:
    parts = ["Analyze the following prostate cancer patient case:\n"]

    cd = req.clinical_data
    if cd.age is not None:
        parts.append(f"- Age: {cd.age} years")
    if cd.psa is not None:
        parts.append(f"- PSA: {cd.psa} ng/mL")
    if cd.clinical_stage:
        parts.append(f"- Clinical Stage: {cd.clinical_stage}")
    if cd.grade_group is not None:
        parts.append(f"- Grade Group (ISUP): {cd.grade_group}")
    if cd.cores_positive is not None and cd.cores_total is not None:
        parts.append(f"- Positive Cores: {cd.cores_positive}/{cd.cores_total}")
    if cd.prostate_volume is not None:
        parts.append(f"- Prostate Volume: {cd.prostate_volume} mL")
    for k, v in (cd.extra_fields or {}).items():
        parts.append(f"- {k}: {v}")

    if req.predictions:
        p = req.predictions
        parts.append("\nML Model Predictions (probabilities):")
        mapping = [
            ("ece_probability", "ECE (Extracapsular Extension)"),
            ("svi_probability", "SVI (Seminal Vesicle Invasion)"),
            ("lni_probability", "LNI (Lymph Node Involvement)"),
            ("psm_probability", "PSM (Positive Surgical Margins)"),
            ("bcr_probability", "BCR (Biochemical Recurrence)"),
            ("upgrading_probability", "Pathologic Upgrading"),
        ]
        for attr, label in mapping:
            val = getattr(p, attr)
            if val is not None:
                parts.append(f"- {label}: {val:.1%}")
        for k, v in (p.extra_predictions or {}).items():
            parts.append(f"- {k}: {v}")

    parts += [
        "\nRespond ONLY with a JSON object (no markdown fences) in this exact shape:",
        '{"narrative": "<2-3 sentence clinical summary>",',
        ' "key_findings": ["<finding 1>", "..."],',
        ' "recommendations": ["<recommendation 1>", "..."]}',
    ]
    return "\n".join(parts)


@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest):
    prompt = _build_analyze_prompt(req)
    try:
        message = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip()
        # Strip accidental markdown fences
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        result = json.loads(raw)
        return AnalyzeResponse(
            narrative=result.get("narrative", ""),
            key_findings=result.get("key_findings", []),
            recommendations=result.get("recommendations", []),
        )
    except json.JSONDecodeError:
        # Graceful fallback: surface raw text
        return AnalyzeResponse(narrative=raw, key_findings=[], recommendations=[])
    except anthropic.APIError as e:
        raise HTTPException(status_code=502, detail=f"LLM error: {e}")


# ---------------------------------------------------------------------------
# /api/chat  – conversational clinical assistant
# ---------------------------------------------------------------------------


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    patient_context: Optional[Dict[str, Any]] = None
    history: Optional[List[ChatMessage]] = None


class ChatResponse(BaseModel):
    response: str


@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    messages: List[Dict[str, str]] = []

    for msg in req.history or []:
        messages.append({"role": msg.role, "content": msg.content})

    user_content = req.message
    if req.patient_context:
        ctx = json.dumps(req.patient_context, indent=2)
        user_content = f"Patient Context:\n{ctx}\n\nQuestion: {req.message}"

    messages.append({"role": "user", "content": user_content})

    try:
        message = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=messages,
        )
        return ChatResponse(response=message.content[0].text)
    except anthropic.APIError as e:
        raise HTTPException(status_code=502, detail=f"LLM error: {e}")
