const LS_URL_KEY = "compass_api_url";
const LS_HEALTH_KEY = "compass_health_path";
const DEFAULT_HEALTH_PATH = "/health";

/** Returns the API base URL: localStorage override → build-time env → same-origin ("") */
export function getApiUrl(): string {
  return localStorage.getItem(LS_URL_KEY) ?? import.meta.env.VITE_API_URL ?? "";
}

export function setApiUrl(url: string): void {
  const trimmed = url.trim().replace(/\/$/, "");
  if (trimmed) {
    localStorage.setItem(LS_URL_KEY, trimmed);
  } else {
    localStorage.removeItem(LS_URL_KEY);
  }
}

/** Returns the health check path (used for Test Connection and Render monitoring) */
export function getHealthPath(): string {
  return localStorage.getItem(LS_HEALTH_KEY) ?? DEFAULT_HEALTH_PATH;
}

export function setHealthPath(path: string): void {
  const trimmed = path.trim() || DEFAULT_HEALTH_PATH;
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (withSlash === DEFAULT_HEALTH_PATH) {
    localStorage.removeItem(LS_HEALTH_KEY);
  } else {
    localStorage.setItem(LS_HEALTH_KEY, withSlash);
  }
}

export interface HealthResponse {
  status: string;
  model: string;
  endpoint_set: boolean;
}

export interface AnalyzeResponse {
  narrative: string;
  key_findings: string[];
  recommendations: string[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  reply: string;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const base = getApiUrl();
  const res = await fetch(`${base}${path}`, {
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

export async function checkApiHealth(
  baseUrl = getApiUrl(),
  healthPath = getHealthPath()
): Promise<HealthResponse> {
  const res = await fetch(`${baseUrl}${healthPath}`);
  if (!res.ok) throw new Error(`Health check failed (${res.status} ${res.statusText})`);
  return res.json();
}

export interface TestLlmResponse {
  ok: boolean;
  model: string;
  endpoint?: string;
  error?: string;
}

/** Asks the backend to send a minimal ping to its configured LLM endpoint. */
export async function testLlmEndpoint(baseUrl = getApiUrl()): Promise<TestLlmResponse> {
  const res = await fetch(`${baseUrl}/api/test`);
  if (!res.ok) throw new Error(`Test request failed (${res.status} ${res.statusText})`);
  return res.json();
}

export async function analyzePatient(
  clinical: Record<string, unknown>,
  predictions: Record<string, unknown>
): Promise<AnalyzeResponse> {
  return post<AnalyzeResponse>("/api/analyze", { clinical, predictions });
}

export async function chatWithAssistant(
  messages: ChatMessage[],
  clinical?: Record<string, unknown>
): Promise<ChatResponse> {
  return post<ChatResponse>("/api/chat", { messages, clinical });
}
