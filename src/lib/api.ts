// ── localStorage keys ─────────────────────────────────────────────────────────
const LS_API_URL     = "compass_api_url";
const LS_HEALTH_PATH = "compass_health_path";
const LS_LLM_ENDPOINT = "compass_llm_endpoint";
const LS_LLM_API_KEY  = "compass_llm_api_key";
const LS_LLM_MODEL    = "compass_llm_model";

// ── Backend URL (the Render service) ─────────────────────────────────────────

/** Base URL of the COMPASS backend service. Falls back to build-time env or same-origin. */
export function getApiUrl(): string {
  return localStorage.getItem(LS_API_URL) ?? import.meta.env.VITE_API_URL ?? "";
}

export function setApiUrl(url: string): void {
  const v = url.trim().replace(/\/$/, "");
  v ? localStorage.setItem(LS_API_URL, v) : localStorage.removeItem(LS_API_URL);
}

// ── Health check path (for Render monitoring) ─────────────────────────────────

export function getHealthPath(): string {
  return localStorage.getItem(LS_HEALTH_PATH) ?? "/health";
}

export function setHealthPath(path: string): void {
  const v = (path.trim() || "/health").replace(/^([^/])/, "/$1");
  v === "/health" ? localStorage.removeItem(LS_HEALTH_PATH) : localStorage.setItem(LS_HEALTH_PATH, v);
}

// ── LLM config (sent to the backend on every AI request) ─────────────────────

export interface LlmConfig {
  endpoint: string;
  api_key: string;
  model: string;
}

export function getLlmConfig(): LlmConfig {
  return {
    endpoint: localStorage.getItem(LS_LLM_ENDPOINT) ?? "",
    api_key:  localStorage.getItem(LS_LLM_API_KEY)  ?? "",
    model:    localStorage.getItem(LS_LLM_MODEL)     ?? "",
  };
}

export function setLlmConfig(cfg: LlmConfig): void {
  cfg.endpoint ? localStorage.setItem(LS_LLM_ENDPOINT, cfg.endpoint.trim()) : localStorage.removeItem(LS_LLM_ENDPOINT);
  cfg.api_key  ? localStorage.setItem(LS_LLM_API_KEY,  cfg.api_key.trim())  : localStorage.removeItem(LS_LLM_API_KEY);
  cfg.model    ? localStorage.setItem(LS_LLM_MODEL,    cfg.model.trim())    : localStorage.removeItem(LS_LLM_MODEL);
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${getApiUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`API ${path} failed (${res.status}): ${detail}`);
  }
  return res.json() as Promise<T>;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export interface HealthResponse {
  status: string;
  model: string;
  endpoint_set: boolean;
}

export async function checkApiHealth(
  baseUrl = getApiUrl(),
  healthPath = getHealthPath(),
): Promise<HealthResponse> {
  const res = await fetch(`${baseUrl}${healthPath}`);
  if (!res.ok) throw new Error(`Health check failed (${res.status} ${res.statusText})`);
  return res.json();
}

export interface TestLlmResponse {
  ok: boolean;
  model: string;
  endpoint: string;
  error?: string;
}

/** Sends the frontend's LLM config to the backend to verify the AI connection. */
export async function testLlmEndpoint(
  baseUrl = getApiUrl(),
  llmCfg = getLlmConfig(),
): Promise<TestLlmResponse> {
  const res = await fetch(`${baseUrl}/api/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ llm_config: llmCfg }),
  });
  if (!res.ok) throw new Error(`Test request failed (${res.status} ${res.statusText})`);
  return res.json();
}

export interface AnalyzeResponse {
  narrative: string;
  key_findings: string[];
  recommendations: string[];
}

export async function analyzePatient(
  clinical: Record<string, unknown>,
  predictions: Record<string, unknown>,
): Promise<AnalyzeResponse> {
  return post<AnalyzeResponse>("/api/analyze", {
    clinical,
    predictions,
    llm_config: getLlmConfig(),
  });
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  reply: string;
}

export async function chatWithAssistant(
  messages: ChatMessage[],
  clinical?: Record<string, unknown>,
): Promise<ChatResponse> {
  return post<ChatResponse>("/api/chat", {
    messages,
    clinical,
    llm_config: getLlmConfig(),
  });
}
