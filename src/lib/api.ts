// ── localStorage keys ─────────────────────────────────────────────────────────
// Nothing sensitive is ever stored here.
// The LLM endpoint lives on the server; the admin token is just an access credential.
const LS_API_URL      = "compass_api_url";
const LS_HEALTH_PATH  = "compass_health_path";
const LS_ADMIN_TOKEN  = "compass_admin_token";

// ── Backend URL (the Render / hosted service) ─────────────────────────────────

export function getApiUrl(): string {
  return localStorage.getItem(LS_API_URL) ?? import.meta.env.VITE_API_URL ?? "";
}

export function setApiUrl(url: string): void {
  const v = url.trim().replace(/\/$/, "");
  v ? localStorage.setItem(LS_API_URL, v) : localStorage.removeItem(LS_API_URL);
}

// ── Health check path ─────────────────────────────────────────────────────────

export function getHealthPath(): string {
  return localStorage.getItem(LS_HEALTH_PATH) ?? "/health";
}

export function setHealthPath(path: string): void {
  const v = (path.trim() || "/health").replace(/^([^/])/, "/$1");
  v === "/health"
    ? localStorage.removeItem(LS_HEALTH_PATH)
    : localStorage.setItem(LS_HEALTH_PATH, v);
}

// ── Admin token ───────────────────────────────────────────────────────────────
// Used to update the server-side LLM endpoint. Not the LLM key itself.

export function getAdminToken(): string {
  return localStorage.getItem(LS_ADMIN_TOKEN) ?? "";
}

export function setAdminToken(token: string): void {
  const v = token.trim();
  v ? localStorage.setItem(LS_ADMIN_TOKEN, v) : localStorage.removeItem(LS_ADMIN_TOKEN);
}

function adminHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${getAdminToken()}`,
  };
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

// ── Public endpoints ──────────────────────────────────────────────────────────

export interface HealthResponse {
  status: string;
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
  endpoint_set: boolean;
  error?: string;
}

/** Status indicator: calls GET /api/test — uses server's stored config, no credentials needed. */
export async function testLlmEndpoint(baseUrl = getApiUrl()): Promise<TestLlmResponse> {
  const res = await fetch(`${baseUrl}/api/test`);
  if (!res.ok) throw new Error(`Test failed (${res.status} ${res.statusText})`);
  return res.json();
}

// ── Admin endpoints (require ADMIN_TOKEN) ─────────────────────────────────────

export interface ServerConfig {
  endpoint_set: boolean;
  model: string;
}

/** Fetches current server config (endpoint_set flag + model name — endpoint URL is never returned). */
export async function fetchServerConfig(baseUrl = getApiUrl()): Promise<ServerConfig> {
  const res = await fetch(`${baseUrl}/api/config`, { headers: adminHeaders() });
  if (!res.ok) throw new Error(`Config fetch failed (${res.status})`);
  return res.json();
}

/** Updates the server-side LLM endpoint and/or model. Omit a field to leave it unchanged. */
export async function updateServerConfig(
  patch: { endpoint?: string; model?: string },
  baseUrl = getApiUrl(),
): Promise<void> {
  const res = await fetch(`${baseUrl}/api/config`, {
    method: "PATCH",
    headers: adminHeaders(),
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`Config update failed (${res.status}): ${detail}`);
  }
}

/** Test with specific values before saving (settings dialog pre-save check). Admin-only. */
export async function testLlmCustom(
  values: { endpoint?: string; model?: string },
  baseUrl = getApiUrl(),
): Promise<TestLlmResponse> {
  const res = await fetch(`${baseUrl}/api/test`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify(values),
  });
  if (!res.ok) throw new Error(`Test failed (${res.status} ${res.statusText})`);
  return res.json();
}

// ── AI endpoints ──────────────────────────────────────────────────────────────

export interface AnalyzeResponse {
  narrative: string;
  key_findings: string[];
  recommendations: string[];
}

export async function analyzePatient(
  clinical: Record<string, unknown>,
  predictions: Record<string, unknown>,
): Promise<AnalyzeResponse> {
  return post<AnalyzeResponse>("/api/analyze", { clinical, predictions });
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
  return post<ChatResponse>("/api/chat", { messages, clinical });
}
