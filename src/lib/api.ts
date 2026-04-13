// ── localStorage keys ─────────────────────────────────────────────────────────
const LS_API_URL = "compass_api_url";

// ── Backend URL ───────────────────────────────────────────────────────────────

export function getApiUrl(): string {
  return localStorage.getItem(LS_API_URL) ?? import.meta.env.VITE_API_URL ?? "";
}

export function setApiUrl(url: string): void {
  const v = url.trim().replace(/\/$/, "");
  v ? localStorage.setItem(LS_API_URL, v) : localStorage.removeItem(LS_API_URL);
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
): Promise<HealthResponse> {
  const res = await fetch(`${baseUrl}/health`);
  if (!res.ok) throw new Error(`Health check failed (${res.status} ${res.statusText})`);
  return res.json();
}

export interface TestLlmResponse {
  ok: boolean;
  endpoint_set: boolean;
  error?: string;
}

/** Status indicator: calls GET /api/test — uses server's stored LLM config. */
export async function testLlmEndpoint(baseUrl = getApiUrl()): Promise<TestLlmResponse> {
  const res = await fetch(`${baseUrl}/api/test`);
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
