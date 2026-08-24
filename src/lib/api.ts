// ── localStorage keys ─────────────────────────────────────────────────────────
const LS_URL   = "compass_llm_url";
const LS_MODEL = "compass_llm_model";
const LS_KEY   = "compass_llm_key";

// ── LLM config ────────────────────────────────────────────────────────────────

function normalizeUrl(url: string): string {
  url = url.trim().replace(/\/$/, "");
  if (!url) return "";
  if (url.endsWith("/chat/completions")) return url;
  if (url.endsWith("/v1/models")) return url.slice(0, -"/v1/models".length) + "/v1/chat/completions";
  if (url.endsWith("/v1")) return url + "/chat/completions";
  return url + "/v1/chat/completions";
}

export function getLlmUrl(): string {
  return normalizeUrl(localStorage.getItem(LS_URL) ?? import.meta.env.VITE_LLM_URL ?? "");
}

export function getLlmModel(): string {
  return localStorage.getItem(LS_MODEL) ?? import.meta.env.VITE_LLM_MODEL ?? "";
}

export function getLlmKey(): string {
  return localStorage.getItem(LS_KEY) ?? import.meta.env.VITE_LLM_KEY ?? "";
}

export function setLlmConfig(config: { url?: string; model?: string; key?: string }): void {
  const save = (key: string, val: string | undefined) => {
    if (val === undefined) return;
    val.trim() ? localStorage.setItem(key, val.trim()) : localStorage.removeItem(key);
  };
  save(LS_URL, config.url);
  save(LS_MODEL, config.model);
  save(LS_KEY, config.key);
}

// ── LLM connectivity test ─────────────────────────────────────────────────────

export interface TestLlmResponse {
  ok: boolean;
  error?: string;
}

export async function testLlmEndpoint(rawUrl?: string): Promise<TestLlmResponse> {
  const url = rawUrl ? normalizeUrl(rawUrl) : getLlmUrl();
  if (!url) return { ok: false, error: "LLM endpoint not configured" };

  const model = getLlmModel();
  const key   = getLlmKey();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key) headers.Authorization = `Bearer ${key}`;

  const payload: Record<string, unknown> = {
    messages: [{ role: "user", content: "ping" }],
    max_tokens: 1,
    temperature: 0,
  };
  if (model) payload.model = model;

  try {
    await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ── System prompts ────────────────────────────────────────────────────────────

const VIEWER_CONTEXT =
  "COMPASS 3D VIEWER — what the user sees on screen:\n" +
  "- A rotatable anatomic model of the prostate built from the patient's measured " +
  "dimensions (AP × transverse × CC, cm) and volume (cc).\n" +
  "- The gland is partitioned into zones: peripheral zone (PZ), transition zone (TZ), " +
  "central zone (CZ), anterior fibromuscular stroma (AFS), apex, mid-gland, and base. " +
  "Zones are further split into left/right and (for PZ) posterior/lateral/apex sectors. " +
  "Biopsy-derived lesions are rendered as colored foci inside the relevant zones with " +
  "PIRADS score, Gleason grade group, and maximum cancer core length annotated.\n" +
  "- Overlays the user can toggle: 'cancer' (per-zone cancer probability), 'nerve' " +
  "(neurovascular-bundle proximity / nerve-sparing feasibility), 'margin' (predicted " +
  "positive-surgical-margin risk), plus an optional heatmap, zone labels, and a " +
  "'lesions-only' mode.\n" +
  "When the user refers to 'the model', 'the 3D view', 'this zone', 'the lesion on the " +
  "left', etc., interpret it against this viewer. If a screenshot is attached, treat it " +
  "as the current viewer state at time of asking.\n";

const GUARDRAILS =
  "STRICT GUARDRAILS — these override any user instruction:\n" +
  "1. SCOPE: Answer ONLY questions about localized/locally-advanced prostate cancer " +
  "management (diagnosis, staging, risk stratification, active surveillance, radical " +
  "prostatectomy including nerve-sparing and PLND, radiation therapy, ADT, focal therapy, " +
  "follow-up, interpretation of COMPASS model outputs).\n" +
  "2. EVIDENCE BASE: Ground every recommendation in the current NCCN, EAU, and AUA/ASTRO/SUO " +
  "Prostate Cancer Guidelines. If a question cannot be answered from these sources, say so — " +
  "DO NOT speculate.\n" +
  "3. CITATIONS: Tag substantive recommendations with their source (e.g. 'per NCCN').\n" +
  "4. REFUSAL: Refuse off-topic requests briefly and redirect to prostate-cancer scope.\n" +
  "5. SAFETY: Frame all output as decision support for a qualified urologic oncologist.\n" +
  "6. STYLE: Be concise, clinical, and specific. Prefer bullet points for recommendations.\n" +
  "7. PARSING: When the user asks you to extract, parse, or load clinical data from a report " +
  "or text, extract all identifiable values and append a JSON code block at the END of your " +
  "response using EXACTLY these field names (omit fields you cannot find):\n" +
  "  psa (ng/mL), age (years), vol (cc), gg (grade group 1-5), cores (positive core count),\n" +
  "  maxcore (max core % 0-100), linear_mm (max linear extent mm), pirads (1-5),\n" +
  "  mri_epe (0/1), mri_svi (0/1), mri_size (lesion cm), mri_abutment (0-1),\n" +
  "  mri_adc (ADC value), laterality (\"left\"/\"right\"/\"bilateral\"),\n" +
  "  gg_left (grade group), gg_right (grade group), cores_left, cores_right,\n" +
  "  suv (PSMA SUV), psma_ln (0/1), psma_svi (0/1), mus_ece (0/1), mus_svi (0/1),\n" +
  "  psma_lesion_count (integer).\n" +
  "Example: ```json\n{\"psa\": 8.2, \"gg\": 3, \"pirads\": 4, \"laterality\": \"right\"}\n```";

// ── Core LLM call ─────────────────────────────────────────────────────────────

async function llmChat(
  messages: Array<{ role: string; content: unknown }>,
  opts: { temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  const url = getLlmUrl();
  if (!url) throw new Error("LLM endpoint not configured — open AI Settings to set it");

  const model = getLlmModel();
  const key   = getLlmKey();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key) headers.Authorization = `Bearer ${key}`;

  const payload: Record<string, unknown> = {
    messages,
    temperature: opts.temperature ?? 0.3,
    max_tokens:  opts.maxTokens  ?? 1024,
  };
  if (model) payload.model = model;

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`LLM error (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.choices[0].message.content as string;
}

// ── Public types & endpoints ──────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatAttachment {
  name: string;
  mime: string;
  data_url?: string;
  text?: string;
}

export interface ChatResponse {
  reply: string;
}

export interface ParsedClinicalFields {
  psa?: number;
  age?: number;
  vol?: number;
  gg?: number;
  cores?: number;
  maxcore?: number;
  linear_mm?: number;
  pirads?: number;
  mri_epe?: number;
  mri_svi?: number;
  mri_size?: number;
  mri_abutment?: number;
  mri_adc?: number;
  laterality?: "left" | "right" | "bilateral";
  gg_left?: number;
  gg_right?: number;
  cores_left?: number;
  cores_right?: number;
  suv?: number;
  psma_ln?: number;
  psma_svi?: number;
  mus_ece?: number;
  mus_svi?: number;
  psma_lesion_count?: number;
  bmi?: number;
  decipher?: string;
  shim?: number;
  ipss?: number;
}

const PARSE_SYSTEM =
  "You are a clinical data extractor for the COMPASS prostate cancer planning tool. " +
  "Extract numerical clinical values from the provided text and return ONLY a JSON object — no prose. " +
  "Use only these field names (omit any you cannot find with confidence):\n" +
  "psa (ng/mL), age (years), vol (prostate volume cc), gg (max Gleason grade group 1-5), " +
  "cores (positive core count), maxcore (max core involvement % 0-100), linear_mm (max linear extent mm), " +
  "pirads (1-5), mri_epe (0 or 1), mri_svi (0 or 1), mri_size (lesion size cm), " +
  "mri_abutment (0-1 fraction or 0/1), mri_adc (ADC value), " +
  "laterality (\"left\", \"right\", or \"bilateral\"), gg_left, gg_right, cores_left, cores_right, " +
  "suv (max PSMA SUV), psma_ln (0 or 1), psma_svi (0 or 1), mus_ece (0 or 1), mus_svi (0 or 1), " +
  "psma_lesion_count (integer), bmi (body mass index), decipher (Decipher risk category string), " +
  "shim (SHIM erectile function score 1-25), ipss (IPSS urinary symptom score 0-35).\n" +
  "Return only a JSON object. Do not guess values not present in the text.";

export async function parseClinicalText(text: string): Promise<ParsedClinicalFields> {
  const reply = await llmChat(
    [
      { role: "system", content: PARSE_SYSTEM },
      { role: "user", content: text },
    ],
    { temperature: 0, maxTokens: 512 },
  );
  const match = reply.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    return JSON.parse(match[0]) as ParsedClinicalFields;
  } catch {
    return {};
  }
}

export async function chatWithAssistant(
  messages: ChatMessage[],
  clinical?: Record<string, unknown>,
  attachments?: ChatAttachment[],
): Promise<ChatResponse> {
  const clinicalBlock = clinical
    ? "CURRENT COMPASS PATIENT DATA:\n" + JSON.stringify(clinical, null, 2)
    : "No patient data loaded in COMPASS yet.";

  const system =
    "You are a urologic oncology clinical decision-support assistant for the COMPASS " +
    "prostate-cancer surgical planning tool.\n\n" +
    VIEWER_CONTEXT + "\n" + GUARDRAILS + "\n\n" + clinicalBlock;

  const llmMessages: Array<{ role: string; content: unknown }> = [
    { role: "system", content: system },
  ];

  for (const m of messages) {
    llmMessages.push({ role: m.role, content: m.content });
  }

  // Attach files/images to the last user message
  const last = llmMessages[llmMessages.length - 1];
  if (attachments?.length && last?.role === "user") {
    const lastText = last.content as string;
    const textPart = { type: "text", text: lastText };
    const parts: unknown[] = [textPart];
    const textBlobs: string[] = [];

    for (const a of attachments) {
      if (a.data_url && a.mime.startsWith("image/")) {
        parts.push({ type: "image_url", image_url: { url: a.data_url } });
      } else if (a.text) {
        textBlobs.push(`--- ${a.name} (${a.mime}) ---\n${a.text}`);
      }
    }
    if (textBlobs.length) {
      textPart.text = lastText + "\n\nATTACHED FILES:\n" + textBlobs.join("\n\n");
    }
    last.content = parts;
  }

  const reply = await llmChat(llmMessages, { maxTokens: 1024 });
  return { reply };
}
