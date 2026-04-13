import os
import json
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any
from dotenv import load_dotenv

load_dotenv()

LLM_ENDPOINT = os.getenv("LLM_ENDPOINT", "")  # e.g. https://your-llm-host/v1/chat/completions
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o")

app = FastAPI(title="COMPASS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def llm_chat(messages: list[dict], temperature: float = 0.3) -> str:
    if not LLM_ENDPOINT:
        raise HTTPException(status_code=503, detail="LLM_ENDPOINT not configured")
    headers = {"Content-Type": "application/json"}
    if LLM_API_KEY:
        headers["Authorization"] = f"Bearer {LLM_API_KEY}"
    payload = {"model": LLM_MODEL, "messages": messages, "temperature": temperature}
    try:
        resp = httpx.post(LLM_ENDPOINT, json=payload, headers=headers, timeout=60)
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"LLM error: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM unreachable: {str(e)}")


# ── Models ────────────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    clinical: dict[str, Any]
    predictions: dict[str, Any]

class AnalyzeResponse(BaseModel):
    narrative: str
    key_findings: list[str]
    recommendations: list[str]

class ChatMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    clinical: dict[str, Any] | None = None

class ChatResponse(BaseModel):
    reply: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "model": LLM_MODEL, "endpoint_set": bool(LLM_ENDPOINT)}


@app.get("/api/test")
def test_llm():
    """
    Sends a minimal ping to the configured LLM endpoint.
    Returns success/failure so the frontend can verify the AI backend is reachable.
    """
    if not LLM_ENDPOINT:
        return {"ok": False, "error": "LLM_ENDPOINT is not set", "model": LLM_MODEL}
    headers = {"Content-Type": "application/json"}
    if LLM_API_KEY:
        headers["Authorization"] = f"Bearer {LLM_API_KEY}"
    payload = {
        "model": LLM_MODEL,
        "messages": [{"role": "user", "content": "ping"}],
        "max_tokens": 1,
        "temperature": 0,
    }
    try:
        resp = httpx.post(LLM_ENDPOINT, json=payload, headers=headers, timeout=15)
        resp.raise_for_status()
        return {"ok": True, "model": LLM_MODEL, "endpoint": LLM_ENDPOINT}
    except httpx.HTTPStatusError as e:
        return {"ok": False, "model": LLM_MODEL, "endpoint": LLM_ENDPOINT,
                "error": f"HTTP {e.response.status_code}: {e.response.text[:200]}"}
    except Exception as e:
        return {"ok": False, "model": LLM_MODEL, "endpoint": LLM_ENDPOINT,
                "error": str(e)}


@app.post("/api/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    cx = req.clinical
    px = req.predictions

    system = (
        "You are a urologic oncology decision-support assistant. "
        "Given prostate cancer clinical data and model predictions, produce a concise "
        "clinical summary. Respond ONLY with valid JSON matching this schema: "
        '{"narrative": "...", "key_findings": ["...", ...], "recommendations": ["...", ...]}'
    )

    user_msg = (
        f"Patient clinical inputs: {json.dumps(cx, indent=2)}\n\n"
        f"COMPASS model predictions: {json.dumps(px, indent=2)}\n\n"
        "Provide a 2-3 sentence narrative, up to 5 key findings, and up to 4 recommendations."
    )

    raw = llm_chat([
        {"role": "system", "content": system},
        {"role": "user", "content": user_msg},
    ])

    try:
        # Strip markdown fences if present
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        data = json.loads(cleaned)
        return AnalyzeResponse(**data)
    except Exception:
        # Fallback: return raw as narrative
        return AnalyzeResponse(
            narrative=raw,
            key_findings=[],
            recommendations=[],
        )


@app.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    system_parts = [
        "You are a urologic oncology clinical decision-support assistant for the COMPASS tool.",
        "Answer questions about prostate cancer staging, nerve-sparing, PLND, and treatment planning.",
        "Be concise and evidence-based.",
    ]
    if req.clinical:
        system_parts.append(
            f"\nCurrent patient context: {json.dumps(req.clinical, indent=2)}"
        )

    messages = [{"role": "system", "content": " ".join(system_parts)}]
    for m in req.messages:
        messages.append({"role": m.role, "content": m.content})

    reply = llm_chat(messages, temperature=0.5)
    return ChatResponse(reply=reply)
