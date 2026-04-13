import os
import json
import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any
from dotenv import load_dotenv

load_dotenv()

# Server-side defaults — used as fallback when the frontend doesn't send llm_config
_DEFAULT_ENDPOINT = os.getenv("LLM_ENDPOINT", "")
_DEFAULT_API_KEY  = os.getenv("LLM_API_KEY", "")
_DEFAULT_MODEL    = os.getenv("LLM_MODEL", "gpt-4o")

app = FastAPI(title="COMPASS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── LLM config (passed per-request from the frontend) ────────────────────────

class LlmConfig(BaseModel):
    endpoint: str = ""
    api_key: str = ""
    model: str = ""


def resolve_llm(cfg: LlmConfig | None) -> LlmConfig:
    """Merge frontend-supplied config with server env-var defaults."""
    return LlmConfig(
        endpoint = (cfg.endpoint if cfg and cfg.endpoint else _DEFAULT_ENDPOINT),
        api_key  = (cfg.api_key  if cfg and cfg.api_key  else _DEFAULT_API_KEY),
        model    = (cfg.model    if cfg and cfg.model    else _DEFAULT_MODEL),
    )


def llm_chat(messages: list[dict], cfg: LlmConfig, temperature: float = 0.3) -> str:
    if not cfg.endpoint:
        raise ValueError("LLM endpoint is not configured")
    headers = {"Content-Type": "application/json"}
    if cfg.api_key:
        headers["Authorization"] = f"Bearer {cfg.api_key}"
    payload = {"model": cfg.model, "messages": messages, "temperature": temperature}
    try:
        resp = httpx.post(cfg.endpoint, json=payload, headers=headers, timeout=60)
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]
    except httpx.HTTPStatusError as e:
        raise RuntimeError(f"LLM HTTP {e.response.status_code}: {e.response.text[:300]}")
    except Exception as e:
        raise RuntimeError(f"LLM unreachable: {str(e)}")


# ── Request / response models ─────────────────────────────────────────────────

class TestRequest(BaseModel):
    llm_config: LlmConfig | None = None

class TestResponse(BaseModel):
    ok: bool
    model: str
    endpoint: str
    error: str = ""

class AnalyzeRequest(BaseModel):
    clinical: dict[str, Any]
    predictions: dict[str, Any]
    llm_config: LlmConfig | None = None

class AnalyzeResponse(BaseModel):
    narrative: str
    key_findings: list[str]
    recommendations: list[str]

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    clinical: dict[str, Any] | None = None
    llm_config: LlmConfig | None = None

class ChatResponse(BaseModel):
    reply: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    """Server liveness check — use this path in Render's Health Check Path setting."""
    return {"status": "ok", "model": _DEFAULT_MODEL, "endpoint_set": bool(_DEFAULT_ENDPOINT)}


@app.post("/api/test", response_model=TestResponse)
def test_llm(req: TestRequest):
    """
    Sends a minimal ping to the LLM endpoint supplied by the frontend (or the
    server default). Returns ok/error so the UI can show the connection status.
    """
    cfg = resolve_llm(req.llm_config)
    if not cfg.endpoint:
        return TestResponse(ok=False, model=cfg.model, endpoint="",
                            error="LLM endpoint is not configured")
    headers = {"Content-Type": "application/json"}
    if cfg.api_key:
        headers["Authorization"] = f"Bearer {cfg.api_key}"
    payload = {"model": cfg.model, "messages": [{"role": "user", "content": "ping"}],
               "max_tokens": 1, "temperature": 0}
    try:
        resp = httpx.post(cfg.endpoint, json=payload, headers=headers, timeout=15)
        resp.raise_for_status()
        return TestResponse(ok=True, model=cfg.model, endpoint=cfg.endpoint)
    except httpx.HTTPStatusError as e:
        return TestResponse(ok=False, model=cfg.model, endpoint=cfg.endpoint,
                            error=f"HTTP {e.response.status_code}: {e.response.text[:200]}")
    except Exception as e:
        return TestResponse(ok=False, model=cfg.model, endpoint=cfg.endpoint, error=str(e))


@app.post("/api/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    cfg = resolve_llm(req.llm_config)
    system = (
        "You are a urologic oncology decision-support assistant. "
        "Given prostate cancer clinical data and model predictions, produce a concise "
        "clinical summary. Respond ONLY with valid JSON matching this schema: "
        '{"narrative": "...", "key_findings": ["...", ...], "recommendations": ["...", ...]}'
    )
    user_msg = (
        f"Patient clinical inputs: {json.dumps(req.clinical, indent=2)}\n\n"
        f"COMPASS model predictions: {json.dumps(req.predictions, indent=2)}\n\n"
        "Provide a 2-3 sentence narrative, up to 5 key findings, and up to 4 recommendations."
    )
    try:
        raw = llm_chat([{"role": "system", "content": system},
                        {"role": "user", "content": user_msg}], cfg)
    except RuntimeError as e:
        raise Exception(str(e))

    try:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        data = json.loads(cleaned)
        return AnalyzeResponse(**data)
    except Exception:
        return AnalyzeResponse(narrative=raw, key_findings=[], recommendations=[])


@app.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    cfg = resolve_llm(req.llm_config)
    system_parts = [
        "You are a urologic oncology clinical decision-support assistant for the COMPASS tool.",
        "Answer questions about prostate cancer staging, nerve-sparing, PLND, and treatment planning.",
        "Be concise and evidence-based.",
    ]
    if req.clinical:
        system_parts.append(f"\nCurrent patient context: {json.dumps(req.clinical, indent=2)}")

    messages = [{"role": "system", "content": " ".join(system_parts)}]
    for m in req.messages:
        messages.append({"role": m.role, "content": m.content})

    try:
        reply = llm_chat(messages, cfg, temperature=0.5)
    except RuntimeError as e:
        raise Exception(str(e))
    return ChatResponse(reply=reply)
