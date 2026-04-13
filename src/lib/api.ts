/**
 * COMPASS backend API client.
 * Set VITE_API_URL in your environment (or GitHub Actions secret) to point at
 * the deployed Render service.  Falls back to localhost for local dev.
 */

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClinicalData {
  age?: number;
  psa?: number;
  clinical_stage?: string;
  grade_group?: number;
  cores_positive?: number;
  cores_total?: number;
  prostate_volume?: number;
  extra_fields?: Record<string, unknown>;
}

export interface Predictions {
  ece_probability?: number;
  svi_probability?: number;
  lni_probability?: number;
  psm_probability?: number;
  bcr_probability?: number;
  upgrading_probability?: number;
  extra_predictions?: Record<string, unknown>;
}

export interface AnalyzeRequest {
  patient_id?: string;
  clinical_data: ClinicalData;
  predictions?: Predictions;
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

export interface ChatRequest {
  message: string;
  patient_context?: Record<string, unknown>;
  history?: ChatMessage[];
}

export interface ChatResponse {
  response: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`COMPASS API ${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Generate a structured clinical narrative for a patient case. */
export function analyzePatient(req: AnalyzeRequest): Promise<AnalyzeResponse> {
  return post<AnalyzeResponse>("/api/analyze", req);
}

/** Send a chat message to the clinical assistant. */
export function chatWithAssistant(req: ChatRequest): Promise<ChatResponse> {
  return post<ChatResponse>("/api/chat", req);
}

/** Returns true if the backend is reachable. */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
