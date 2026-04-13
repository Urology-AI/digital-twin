import os
import json
import secrets
import httpx
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any
from dotenv import load_dotenv

load_dotenv()

ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "")

# In-memory LLM config — seeded from env vars, updatable at runtime via /api/config.
# The endpoint URL never leaves the server in responses; the frontend only writes it.
_llm: dict[str, str] = {
    "endpoint": os.getenv("LLM_ENDPOINT", ""),
    "model":    os.getenv("LLM_MODEL", ""),
}

app = FastAPI(title="COMPASS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Auth ──────────────────────────────────────────────────────────────────────

def require_admin(request: Request) -> None:
    if not ADMIN_TOKEN:
        raise HTTPException(status_code=403, detail="ADMIN_TOKEN is not set on this server")
    if not secrets.compare_digest(
        request.headers.get("Authorization", ""),
        f"Bearer {ADMIN_TOKEN}",
    ):
        raise HTTPException(status_code=403, detail="Invalid admin token")


# ── LLM helper ────────────────────────────────────────────────────────────────

def _llm_chat(messages: list[dict], temperature: float = 0.3) -> str:
    if not _llm["endpoint"]:
        raise ValueError("LLM endpoint is not configured — use /api/config to set it")
    payload: dict[str, Any] = {"messages": messages, "temperature": temperature}
    if _llm["model"]:
        payload["model"] = _llm["model"]
    try:
        resp = httpx.post(_llm["endpoint"], json=payload,
                          headers={"Content-Type": "application/json"}, timeout=60)
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]
    except httpx.HTTPStatusError as e:
        raise RuntimeError(f"LLM HTTP {e.response.status_code}: {e.response.text[:300]}")
    except Exception as e:
        raise RuntimeError(f"LLM unreachable: {e}")


def _do_test(endpoint: str, model: str) -> dict:
    if not endpoint:
        return {"ok": False, "endpoint_set": False, "error": "LLM endpoint not configured"}
    payload: dict[str, Any] = {
        "messages": [{"role": "user", "content": "ping"}],
        "max_tokens": 1,
        "temperature": 0,
    }
    if model:
        payload["model"] = model
    try:
        resp = httpx.post(endpoint, json=payload,
                          headers={"Content-Type": "application/json"}, timeout=15)
        resp.raise_for_status()
        return {"ok": True, "endpoint_set": True}
    except httpx.HTTPStatusError as e:
        return {"ok": False, "endpoint_set": True,
                "error": f"HTTP {e.response.status_code}: {e.response.text[:200]}"}
    except Exception as e:
        return {"ok": False, "endpoint_set": True, "error": str(e)}


# ── Models ────────────────────────────────────────────────────────────────────

class ConfigUpdate(BaseModel):
    endpoint: str | None = None
    model:    str | None = None

class TestRequest(BaseModel):
    # For pre-save test in the settings dialog (admin only).
    # Omit a field to fall back to the server's stored value.
    endpoint: str | None = None
    model:    str | None = None

class AnalyzeRequest(BaseModel):
    clinical:    dict[str, Any]
    predictions: dict[str, Any]

class AnalyzeResponse(BaseModel):
    narrative:       str
    key_findings:    list[str]
    recommendations: list[str]

class ChatMessage(BaseModel):
    role:    str
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    clinical: dict[str, Any] | None = None

class ChatResponse(BaseModel):
    reply: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    """Server liveness — use this path in Render's Health Check Path setting."""
    return {"status": "ok", "endpoint_set": bool(_llm["endpoint"])}


# Config (admin-only) ─────────────────────────────────────────────────────────

@app.get("/api/config")
def get_config(request: Request):
    """
    Returns whether the LLM endpoint is configured and the model name.
    The endpoint URL itself is never returned — write-only from the browser.
    Requires: Authorization: Bearer {ADMIN_TOKEN}
    """
    require_admin(request)
    return {
        "endpoint_set": bool(_llm["endpoint"]),
        "model":        _llm["model"],
    }


@app.patch("/api/config")
def update_config(body: ConfigUpdate, request: Request):
    """
    Updates the server-side LLM endpoint (and optional model).
    Takes effect immediately — no restart needed.
    Requires: Authorization: Bearer {ADMIN_TOKEN}
    """
    require_admin(request)
    if body.endpoint is not None:
        _llm["endpoint"] = body.endpoint.strip()
    if body.model is not None:
        _llm["model"] = body.model.strip()
    return {"ok": True, "endpoint_set": bool(_llm["endpoint"]), "model": _llm["model"]}


# Test endpoints ──────────────────────────────────────────────────────────────

@app.get("/api/test")
def test_llm_stored():
    """
    Public test using the server's stored endpoint.
    Used by the status indicator — no credentials in the request or response.
    """
    return _do_test(_llm["endpoint"], _llm["model"])


@app.post("/api/test")
def test_llm_custom(body: TestRequest, request: Request):
    """
    Test with explicitly supplied values before saving (settings dialog).
    Requires: Authorization: Bearer {ADMIN_TOKEN}
    """
    require_admin(request)
    endpoint = body.endpoint.strip() if body.endpoint is not None else _llm["endpoint"]
    model    = body.model.strip()    if body.model    is not None else _llm["model"]
    return _do_test(endpoint, model)


# AI endpoints ────────────────────────────────────────────────────────────────

@app.post("/api/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
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
        raw = _llm_chat([{"role": "system", "content": system},
                         {"role": "user", "content": user_msg}])
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=503, detail=str(e))
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
        reply = _llm_chat(messages, temperature=0.5)
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=503, detail=str(e))
    return ChatResponse(reply=reply)
