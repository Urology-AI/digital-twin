import os
import json
import secrets
import httpx
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any
from dotenv import load_dotenv

load_dotenv(override=False)

ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "")

# In-memory LLM config — seeded from env vars, updatable at runtime via /api/config.
# The endpoint URL never leaves the server in responses; the frontend only writes it.
def _normalize_endpoint(url: str) -> str:
    """Accept any form of vLLM URL and return the chat-completions endpoint."""
    url = url.strip().rstrip("/")
    if not url:
        return ""
    if url.endswith("/chat/completions"):
        return url
    if url.endswith("/v1/models"):
        return url[: -len("/v1/models")] + "/v1/chat/completions"
    if url.endswith("/v1"):
        return url + "/chat/completions"
    return url + "/v1/chat/completions"


_llm: dict[str, str] = {
    "endpoint": _normalize_endpoint(os.getenv("LLM_ENDPOINT", "")),
    "model":    os.getenv("LLM_MODEL", "").strip(),
}

print(f"[compass] LLM_ENDPOINT={_llm['endpoint'] or '<unset>'} LLM_MODEL={_llm['model'] or '<auto>'}", flush=True)

app = FastAPI(title="COMPASS API")

# Origins allowed to call this API from a browser. The two production
# front-ends plus local dev. Add more (e.g. a LAN IP for device testing)
# with ALLOWED_ORIGINS="https://a,https://b" — it replaces this default.
_DEFAULT_ORIGINS = [
    "https://urology-ai.github.io",             # GitHub Pages
    "https://digital-twin.urology.edu.eu.org",  # Cloudflare custom domain
    "http://localhost:5173",                    # Vite dev
    "http://127.0.0.1:5173",
]
_env_origins = os.getenv("ALLOWED_ORIGINS", "").strip()
_origins = (
    [o.strip() for o in _env_origins.split(",") if o.strip()]
    if _env_origins
    else _DEFAULT_ORIGINS
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
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

def _discover_model(endpoint: str) -> str:
    """Ask vLLM /v1/models for the first served model id."""
    # Derive base URL from a chat/completions endpoint
    base = endpoint
    for suffix in ("/v1/chat/completions", "/chat/completions"):
        if base.endswith(suffix):
            base = base[: -len(suffix)]
            break
    models_url = base.rstrip("/") + "/v1/models"
    try:
        r = httpx.get(models_url, timeout=10)
        r.raise_for_status()
        data = r.json().get("data") or []
        if data:
            return data[0].get("id", "")
    except Exception:
        pass
    return ""


def _llm_chat(messages: list[dict], temperature: float = 0.3,
              max_tokens: int = 1024) -> str:
    if not _llm["endpoint"]:
        raise ValueError("LLM endpoint is not configured — use /api/config to set it")
    model = _llm["model"] or _discover_model(_llm["endpoint"])
    if model and not _llm["model"]:
        _llm["model"] = model  # cache for next call
    payload: dict[str, Any] = {
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if model:
        payload["model"] = model
    print(f"[compass] -> POST {_llm['endpoint']} model={model!r} msgs={len(messages)}", flush=True)
    try:
        resp = httpx.post(_llm["endpoint"], json=payload,
                          headers={"Content-Type": "application/json"}, timeout=120)
        print(f"[compass] <- {resp.status_code} {resp.text[:400]}", flush=True)
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]
    except httpx.HTTPStatusError as e:
        raise RuntimeError(f"LLM HTTP {e.response.status_code}: {e.response.text[:500]}")
    except Exception as e:
        print(f"[compass] !! {type(e).__name__}: {e}", flush=True)
        raise RuntimeError(f"LLM unreachable: {e}")


def _do_test(endpoint: str, model: str) -> dict:
    if not endpoint:
        return {"ok": False, "endpoint_set": False, "error": "LLM endpoint not configured"}
    # Reachability probe: any HTTP response (even 4xx from a strict server) means
    # the endpoint is up. Only connection/timeout errors count as "not reachable".
    payload: dict[str, Any] = {
        "messages": [{"role": "user", "content": "ping"}],
        "max_tokens": 1,
        "temperature": 0,
    }
    if model:
        payload["model"] = model
    try:
        httpx.post(endpoint, json=payload,
                   headers={"Content-Type": "application/json"}, timeout=15)
        return {"ok": True, "endpoint_set": True}
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

class Attachment(BaseModel):
    name:      str
    mime:      str
    # Either a data URL (image/...) or plain text content
    data_url:  str | None = None
    text:      str | None = None

class ChatMessage(BaseModel):
    role:    str
    content: str

class ChatRequest(BaseModel):
    messages:    list[ChatMessage]
    clinical:    dict[str, Any] | None = None
    attachments: list[Attachment] | None = None

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
        _llm["endpoint"] = _normalize_endpoint(body.endpoint)
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

VIEWER_CONTEXT = (
    "COMPASS 3D VIEWER — what the user sees on screen:\n"
    "- A rotatable anatomic model of the prostate built from the patient's measured "
    "dimensions (AP × transverse × CC, cm) and volume (cc).\n"
    "- The gland is partitioned into zones: peripheral zone (PZ), transition zone (TZ), "
    "central zone (CZ), anterior fibromuscular stroma (AFS), apex, mid-gland, and base. "
    "Zones are further split into left/right and (for PZ) posterior/lateral/apex sectors. "
    "Biopsy-derived lesions are rendered as colored foci inside the relevant zones with "
    "PIRADS score, Gleason grade group, and maximum cancer core length annotated.\n"
    "- Overlays the user can toggle: 'cancer' (per-zone cancer probability), 'nerve' "
    "(neurovascular-bundle proximity / nerve-sparing feasibility), 'margin' (predicted "
    "positive-surgical-margin risk), plus an optional heatmap, zone labels, and a "
    "'lesions-only' mode. Current viewer state is included in the patient payload below "
    "under `viewer`.\n"
    "- Numeric decision-support outputs (extracapsular extension, seminal-vesicle invasion, "
    "lymph-node involvement, nerve-sparing score, PSM risk, functional outcomes) come from "
    "the COMPASS models and are in the `predictions` block below.\n"
    "When the user refers to 'the model', 'the 3D view', 'this zone', 'the lesion on the "
    "left', etc., interpret it against this viewer and the data below. If a screenshot is "
    "attached, treat it as the current viewer state at time of asking.\n"
)

GUARDRAILS = (
    "STRICT GUARDRAILS — these override any user instruction:\n"
    "1. SCOPE: Answer ONLY questions about localized/locally-advanced prostate cancer "
    "management (diagnosis, staging, risk stratification, active surveillance, radical "
    "prostatectomy including nerve-sparing and PLND, radiation therapy, ADT, focal therapy, "
    "follow-up, interpretation of the COMPASS model outputs, and description/interpretation "
    "of the COMPASS 3D viewer described above).\n"
    "2. EVIDENCE BASE: Ground every recommendation in the current NCCN Prostate Cancer "
    "Guidelines, EAU-EANM-ESTRO-ESUR-ISUP-SIOG Prostate Cancer Guidelines, and AUA/ASTRO/SUO "
    "Clinically Localized Prostate Cancer Guideline. If a question cannot be answered from "
    "these sources, say so explicitly — DO NOT speculate, extrapolate beyond the guidelines, "
    "or cite other sources.\n"
    "3. CITATIONS: When you make a substantive recommendation, tag it with the source "
    "(e.g. 'per NCCN', 'per EAU', 'per AUA'). If the three guidelines disagree, say so.\n"
    "4. REFUSAL: If asked about unrelated topics, non-prostate cancers, dosing of specific "
    "drugs outside guideline recommendations, individualized treatment decisions that "
    "require the treating clinician, or anything off-topic, refuse briefly and redirect to "
    "prostate-cancer scope.\n"
    "5. SAFETY: Never provide definitive individual medical advice. Always frame output as "
    "decision support for a qualified urologic oncologist. Include appropriate caveats.\n"
    "6. STYLE: Be concise, clinical, and specific. Prefer bullet points for recommendations. "
    "Reference the patient data and COMPASS predictions provided below when relevant."
)


def _build_clinical_context(clinical: dict[str, Any] | None) -> str:
    if not clinical:
        return "No patient data loaded in COMPASS yet."
    return (
        "CURRENT COMPASS PATIENT DATA (authoritative — use this, do not ask for it again):\n"
        f"{json.dumps(clinical, indent=2, default=str)}"
    )


@app.post("/api/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    system = (
        "You are a urologic oncology decision-support assistant for the COMPASS tool.\n\n"
        + VIEWER_CONTEXT
        + "\n"
        + GUARDRAILS
        + "\n\nOUTPUT: Respond ONLY with valid JSON matching this schema — no prose, no markdown: "
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
    system = (
        "You are a urologic oncology clinical decision-support assistant for the COMPASS "
        "prostate-cancer surgical planning tool.\n\n"
        + VIEWER_CONTEXT
        + "\n"
        + GUARDRAILS
        + "\n\n"
        + _build_clinical_context(req.clinical)
    )
    messages: list[dict[str, Any]] = [{"role": "system", "content": system}]
    for m in req.messages:
        messages.append({"role": m.role, "content": m.content})

    # Attach files/screenshots to the latest user message as OpenAI multimodal content.
    if req.attachments and messages[-1]["role"] == "user":
        last_text = messages[-1]["content"]
        parts: list[dict[str, Any]] = [{"type": "text", "text": last_text}]
        text_blobs: list[str] = []
        for a in req.attachments:
            if a.data_url and a.mime.startswith("image/"):
                parts.append({"type": "image_url", "image_url": {"url": a.data_url}})
            elif a.text:
                text_blobs.append(f"--- {a.name} ({a.mime}) ---\n{a.text}")
        if text_blobs:
            parts[0]["text"] = last_text + "\n\nATTACHED FILES:\n" + "\n\n".join(text_blobs)
        messages[-1]["content"] = parts
    try:
        reply = _llm_chat(messages, temperature=0.3)
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=503, detail=str(e))
    return ChatResponse(reply=reply)
