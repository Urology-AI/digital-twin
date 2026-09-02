/**
 * Narrow jobs only (see wrangler.jsonc routes — bound to exactly these
 * path patterns, nothing else):
 *
 * 1. /api/turso/* — Turso proxy. Holds the Turso auth token as a Worker
 *    secret so it never ships in the client bundle. The case-log
 *    schema/column-mapping logic stays in src/lib/turso.ts unchanged;
 *    only the transport moves here, as a thin pass-through of the exact
 *    SQL that code already builds.
 *
 * 2. /patient/* and /clinical/* — SPA fallback. GitHub Pages has no
 *    server-side rewrite capability, so a fresh visit to a client-side
 *    route (no matching file) 404s. This fetches /index.html from the
 *    same custom domain instead — a same-zone fetch, which Cloudflare
 *    docs confirm bypasses Worker routing entirely and goes straight to
 *    the zone's normal origin (the plain proxied CNAME to GitHub Pages),
 *    preserving the custom-domain Host header GitHub Pages needs to
 *    serve this project without redirecting.
 *
 * Root ("/") and anything else passes straight through untouched — this
 * Worker never sees it. Cloudflare Access has exactly one application,
 * scoped to /clinical/* only; root and /patient/* are genuinely public by
 * having no Access application on them at all, not by a bypass rule (no
 * path-precedence ambiguity between competing apps that way).
 *
 * No route here does its own auth check — by the time a request reaches
 * this Worker on /clinical/*, Access has already authenticated it, and
 * injects `Cf-Access-Authenticated-User-Email` on every request if you
 * want to attribute a write to a specific clinician later.
 */
import { createClient } from "@libsql/client/web";

interface Env {
  TURSO_URL: string;
  TURSO_AUTH_TOKEN: string;
  // Fine-grained, read-only PAT for the PRIVATE releases repo. Held here as a
  // Worker secret so the desktop app can ship with no credential at all —
  // before this, every build carried the token inside the bundle, where any
  // user could extract it and it could not be rotated without a new release.
  RELEASES_READ_PAT?: string;
  // Optional — bound only once the `ratelimits` namespace is provisioned
  // (see wrangler.jsonc). Absent in local dev / before first provision, so
  // every use is guarded with `?.`.
  TURSO_RL?: { limit(opts: { key: string }): Promise<{ success: boolean }> };
  // Google Generative Language API key (free tier: aistudio.google.com/apikey).
  //   npx wrangler secret put GEMINI_API_KEY
  GEMINI_API_KEY?: string;
}

// COMPASS's own Gemini call lives here so the API key never ships in the
// client bundle — the browser hits this Worker same-origin at /api/chat.
// NOTE: the Google Generative Language API is NOT covered by a BAA. The
// client de-identifies before sending (src/lib/deidentify.ts) and this
// Worker logs status codes only — never prompt or response text.
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = (model: string, key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
const MAX_CHAT_BODY_BYTES = 600_000; // room for a base64 screenshot
// `model` is caller-supplied and is interpolated into the Gemini URL PATH.
// Unvalidated, a value like "../../v1beta/tunedModels/x" walks to a different
// Google API path with our key attached. Host is pinned, so this is not full
// SSRF, but the key must only ever be spent on the path we intend.
const MODEL_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;

/**
 * Origin allowlist — the two front-ends that legitimately call this proxy.
 * A browser on any other site gets its request rejected. (Non-browser
 * clients send no Origin header and so aren't stopped here — the SQL
 * allowlist below is the real guard; this is defence in depth.)
 */
const ALLOWED_ORIGINS = new Set([
  "https://digital-twin.urology.edu.eu.org",
  "https://urology-ai.github.io",
  "http://localhost:5173", // vite dev
  "http://localhost:4173", // vite preview
]);

/**
 * SQL allowlist. The proxy is public (no Access application on /api/*), so
 * without this any caller could `SELECT * FROM patient_shares` and dump
 * every shared patient record — or `SELECT * FROM sqlite_master` to map the
 * whole schema. Only the exact statements src/lib/turso.ts issues are
 * permitted:
 *  - patient_shares (holds identified records) — full statement + arg count.
 *  - case_log (de-identified research log) — the one SELECT it runs, plus
 *    the CREATE/ALTER shapes its schema-evolution path emits.
 * There is deliberately NO bare "select " allowance: a generic SELECT prefix
 * would re-open arbitrary reads of any non-patient_shares table (and the
 * schema). Anything not matched below is refused.
 */
function normalizeSql(sql: string): string {
  return sql.trim().replace(/\s+/g, " ").replace(/;\s*$/, "");
}

const SHARE_GET = "SELECT record FROM patient_shares WHERE id = ?";
const SHARE_PUT =
  "INSERT OR REPLACE INTO patient_shares (id, record, created_at) VALUES (?, ?, ?)";
const SHARE_CREATE =
  "CREATE TABLE IF NOT EXISTS patient_shares ( id TEXT PRIMARY KEY, record TEXT NOT NULL, created_at TEXT NOT NULL )";
// The single read pullCases() issues (src/lib/turso.ts) — case_log is the
// de-identified research log, so a full-table read of it is by design.
const CASE_LOG_SELECT = "SELECT * FROM case_log ORDER BY date DESC";

const ALLOWED_SQL_PREFIXES = [
  "create table if not exists case_log ",
  "alter table case_log add column ",
  "insert or replace into case_log ",
];

function isAllowedSql(sql: string, args: unknown[]): boolean {
  const s = normalizeSql(sql);
  if (s === SHARE_GET) return args.length === 1;
  if (s === SHARE_PUT) return args.length === 3;
  if (s === SHARE_CREATE) return true;
  if (s === CASE_LOG_SELECT) return args.length === 0;
  // Nothing else may touch patient_shares, and no other SELECT is allowed.
  if (/patient_shares/i.test(s) || /^select\b/i.test(s)) return false;
  const low = s.toLowerCase();
  return ALLOWED_SQL_PREFIXES.some((p) => low.startsWith(p));
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * @libsql/client/web (the HTTP-based build that runs in Workers) requires
 * an https:// URL — it does not accept the libsql:// connection string
 * Turso hands you in its dashboard. Normalize either form here.
 */
function tursoClient(env: Env) {
  const url = env.TURSO_URL.replace(/^libsql:\/\//, "https://");
  return createClient({ url, authToken: env.TURSO_AUTH_TOKEN });
}

type Args = (string | number | null)[];

/**
 * GET for reads (?sql=...&args=[...] as query params), POST for writes
 * (JSON body) — matches how the two are actually used: pullCases() only
 * ever SELECTs, pushCases()'s ensureSchema() only ever CREATE/ALTERs.
 */
async function handleTursoExecute(request: Request, env: Env): Promise<Response> {
  let sql: unknown;
  let args: unknown;

  if (request.method === "GET") {
    const params = new URL(request.url).searchParams;
    sql = params.get("sql");
    try {
      args = params.has("args") ? JSON.parse(params.get("args")!) : [];
    } catch {
      return jsonError("'args' query param must be JSON", 400);
    }
  } else if (request.method === "POST") {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body", 400);
    }
    sql = (body as { sql?: unknown })?.sql;
    args = (body as { args?: unknown })?.args ?? [];
  } else {
    return jsonError("GET or POST only", 405);
  }

  if (typeof sql !== "string" || !sql.trim()) return jsonError("Missing 'sql' string", 400);
  if (!Array.isArray(args)) return jsonError("'args' must be an array", 400);
  if (!isAllowedSql(sql, args)) return jsonError("SQL statement not permitted", 403);

  try {
    const result = await tursoClient(env).execute({ sql, args: args as Args });
    // libsql's Row objects support both row[0] and row.columnName access but
    // are NOT plain arrays — JSON.stringify on them directly does not
    // reliably carry the actual values across. Force each row into a real
    // array first.
    const rows = result.rows.map((row) => Array.from(row));
    return new Response(JSON.stringify({ rows, columns: result.columns }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return jsonError(`Turso execute failed: ${err instanceof Error ? err.message : String(err)}`, 502);
  }
}

/** Real connectivity check — not just "are the env vars set", an actual round-trip to Turso. */
async function handleTursoHealth(env: Env): Promise<Response> {
  try {
    await tursoClient(env).execute({ sql: "SELECT 1", args: [] });
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return jsonError(`Turso unreachable: ${err instanceof Error ? err.message : String(err)}`, 502);
  }
}

interface BatchStatement {
  sql: string;
  args: Args;
}

async function handleTursoBatch(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return jsonError("POST only", 405);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }
  const statements = (body as { statements?: unknown })?.statements;
  if (!Array.isArray(statements) || statements.length === 0) {
    return jsonError("Missing non-empty 'statements' array", 400);
  }
  for (const s of statements as BatchStatement[]) {
    if (typeof s.sql !== "string" || !Array.isArray(s.args)) {
      return jsonError("Each statement needs 'sql' (string) and 'args' (array)", 400);
    }
    if (!isAllowedSql(s.sql, s.args)) return jsonError("SQL statement not permitted", 403);
  }

  try {
    await tursoClient(env).batch(statements as BatchStatement[], "write");
    return new Response(JSON.stringify({ ok: true, count: statements.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return jsonError(`Turso batch failed: ${err instanceof Error ? err.message : String(err)}`, 502);
  }
}

// Baseline security headers for the HTML documents this Worker serves.
// Kept deliberately conservative (no CSP) so it can't break the SPA; a full
// CSP belongs in a Cloudflare Transform Rule where it can be tuned safely.
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cross-Origin-Opener-Policy": "same-origin",
};

function withSecurityHeaders(response: Response, status = response.status): Response {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
  return new Response(response.body, { status, headers });
}

// ── /api/chat — COMPASS's own Gemini call ─────────────────────────────────────
// The browser POSTs an OpenAI-style body ({ messages, temperature?, max_tokens?,
// model? }) to this same-origin route; the Worker translates to Gemini's
// generateContent, calls Google with the server-held key, and translates the
// reply back to the OpenAI shape src/lib/api.ts already expects.

interface OaPart { type: "text" | "image_url"; text?: string; image_url?: { url: string } }
interface OaMessage { role: "system" | "user" | "assistant"; content: string | OaPart[] }
interface GeminiPart { text?: string; inline_data?: { mime_type: string; data: string } }

function toGeminiParts(content: string | OaPart[]): GeminiPart[] {
  if (typeof content === "string") return [{ text: content }];
  const parts: GeminiPart[] = [];
  for (const p of content) {
    if (p.type === "text" && p.text) parts.push({ text: p.text });
    else if (p.type === "image_url" && p.image_url?.url?.startsWith("data:")) {
      const m = /^data:([^;]+);base64,(.*)$/s.exec(p.image_url.url);
      if (m) parts.push({ inline_data: { mime_type: m[1], data: m[2] } });
    }
  }
  return parts.length ? parts : [{ text: "" }];
}

interface GeminiBody {
  system_instruction?: { parts: GeminiPart[] };
  contents: { role: "user" | "model"; parts: GeminiPart[] }[];
  generationConfig: { temperature: number; maxOutputTokens: number };
}

function oaToGemini(messages: OaMessage[], temperature: number, maxTokens: number): GeminiBody {
  const sys = messages.filter((m) => m.role === "system").map((m) => toGeminiParts(m.content)).flat();
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: (m.role === "assistant" ? "model" : "user") as "user" | "model", parts: toGeminiParts(m.content) }));
  const body: GeminiBody = { contents, generationConfig: { temperature, maxOutputTokens: maxTokens } };
  if (sys.length) body.system_instruction = { parts: sys };
  return body;
}

async function handleChat(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  const cors: Record<string, string> = {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : "null",
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  const reply = (obj: unknown, status: number) =>
    new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...cors } });

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return reply({ error: "POST only" }, 405);
  if (origin && !ALLOWED_ORIGINS.has(origin)) return reply({ error: "Origin not allowed" }, 403);
  if (!env.GEMINI_API_KEY) return reply({ error: "Chat not configured on server" }, 503);

  // Content-Length is a hint the client can simply omit (chunked encoding), so
  // it is only a cheap early-out. The authoritative check is on the bytes we
  // actually read, below.
  if (Number(request.headers.get("Content-Length") || 0) > MAX_CHAT_BODY_BYTES) {
    return reply({ error: "Request too large" }, 413);
  }
  if (env.TURSO_RL) {
    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const { success } = await env.TURSO_RL.limit({ key: `chat:${ip}` });
    if (!success) return reply({ error: "Rate limit exceeded — slow down" }, 429);
  }

  let parsed: { messages?: OaMessage[]; temperature?: number; max_tokens?: number; model?: string };
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return reply({ error: "Could not read body" }, 400);
  }
  if (new TextEncoder().encode(raw).length > MAX_CHAT_BODY_BYTES) {
    return reply({ error: "Request too large" }, 413);
  }
  try {
    parsed = JSON.parse(raw);
  } catch {
    return reply({ error: "Invalid JSON" }, 400);
  }
  if (!Array.isArray(parsed.messages) || parsed.messages.length === 0) {
    return reply({ error: "Missing 'messages'" }, 400);
  }

  const model = typeof parsed.model === "string" && parsed.model.trim() ? parsed.model.trim() : GEMINI_MODEL;
  if (!MODEL_NAME.test(model)) return reply({ error: "Invalid 'model'" }, 400);
  const geminiBody = oaToGemini(
    parsed.messages,
    typeof parsed.temperature === "number" ? parsed.temperature : 0.3,
    typeof parsed.max_tokens === "number" ? parsed.max_tokens : 1024,
  );

  let res: Response;
  try {
    res = await fetch(GEMINI_URL(model, env.GEMINI_API_KEY), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });
  } catch (err) {
    return reply({ error: `Gemini unreachable: ${err instanceof Error ? err.message : String(err)}` }, 502);
  }

  if (!res.ok) {
    // Google's error bodies can echo request content — surface status only.
    return reply({ error: `Gemini error ${res.status}` }, 502);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  };
  if (data.promptFeedback?.blockReason) {
    return reply({ error: `Blocked by safety filter (${data.promptFeedback.blockReason})` }, 502);
  }
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();

  // OpenAI-shaped so src/lib/api.ts needs no special-casing.
  return reply({ choices: [{ message: { role: "assistant", content: text } }] }, 200);
}

async function handleSpaFallback(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const indexUrl = new URL("/index.html", url.origin);
  const response = await fetch(new Request(indexUrl, request));
  // Report 200, not GitHub Pages' 404 for the (nonexistent) deep-link path
  // — the content itself is index.html, so the client-side router can run.
  return withSecurityHeaders(response, response.status === 404 ? 200 : response.status);
}

// ── /api/updates/* — update feed for the desktop app and the web app ─────────
//
// electron-updater's "generic" provider fetches <base>/latest-mac.yml and then
// each file named in it, so the two routes below are all it needs. The GitHub
// token stays in Worker secrets: the app authenticates to nothing, holds no
// credential, and the token can be rotated without shipping a build.
//
// The releases repo is private deliberately (the .dmg must not be publicly
// downloadable), which is why this cannot just be a redirect — a redirect
// cannot carry the Authorization header, so the asset is streamed through.

const RELEASES_REPO = "Urology-AI/digital-twin-releases";

// Only these names are ever proxied. Without an allowlist this route would be
// an open proxy for any asset on any release, and path traversal in the name
// would let a caller reach other GitHub API paths entirely.
const ASSET_NAME =
  /^(latest-mac\.yml|latest\.yml|COMPASS-Digital-Twin-\d+\.\d+\.\d+-(?:arm64\.(?:dmg|zip|zip\.blockmap)|x64\.exe(?:\.blockmap)?))$/;

interface GhAsset { name: string; url: string; size: number }
interface GhRelease { tag_name: string; published_at: string; assets: GhAsset[] }

async function latestRelease(env: Env): Promise<GhRelease | null> {
  if (!env.RELEASES_READ_PAT) return null;
  const res = await fetch(`https://api.github.com/repos/${RELEASES_REPO}/releases/latest`, {
    headers: {
      Authorization: `Bearer ${env.RELEASES_READ_PAT}`,
      Accept: "application/vnd.github+json",
      // GitHub rejects API requests without one.
      "User-Agent": "compass-update-feed",
    },
  });
  if (!res.ok) return null;
  return (await res.json()) as GhRelease;
}

// What version is current. The web app polls this to offer a reload; it
// carries no asset URLs and is safe to cache briefly.
async function handleUpdateLatest(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  const cors = {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : "null",
    Vary: "Origin",
  };
  if (!env.RELEASES_READ_PAT) return jsonError("Update feed not configured on server", 503);
  const release = await latestRelease(env);
  if (!release) return jsonError("Could not reach the release feed", 502);
  return new Response(
    JSON.stringify({
      version: release.tag_name.replace(/^v/, ""),
      releasedAt: release.published_at,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
        ...cors,
      },
    },
  );
}

// latest-mac.yml and the .zip/.dmg the updater then downloads.
async function handleUpdateAsset(name: string, request: Request, env: Env): Promise<Response> {
  if (!ASSET_NAME.test(name)) return jsonError("Not found", 404);
  if (!env.RELEASES_READ_PAT) return jsonError("Update feed not configured on server", 503);

  const release = await latestRelease(env);
  if (!release) return jsonError("Could not reach the release feed", 502);
  const asset = release.assets.find((a) => a.name === name);
  if (!asset) return jsonError("Not found", 404);

  // Accept: octet-stream turns the API asset URL into the bytes themselves
  // (via a redirect fetch follows for us). Range is forwarded so the updater
  // can resume an interrupted download of a ~110 MB file.
  const range = request.headers.get("Range");
  const upstream = await fetch(asset.url, {
    method: request.method === "HEAD" ? "HEAD" : "GET",
    headers: {
      Authorization: `Bearer ${env.RELEASES_READ_PAT}`,
      Accept: "application/octet-stream",
      "User-Agent": "compass-update-feed",
      ...(range ? { Range: range } : {}),
    },
  });
  if (!upstream.ok && upstream.status !== 206) {
    return jsonError(`Upstream returned ${upstream.status}`, 502);
  }

  // Pass the body straight through; strip upstream headers we don't control.
  const headers = new Headers();
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges", "etag"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (!headers.has("content-type")) {
    headers.set("Content-Type", name.endsWith(".yml") ? "text/yaml" : "application/octet-stream");
  }
  // The yml changes every release; the immutable, version-named binaries don't.
  headers.set("Cache-Control", name.endsWith(".yml") ? "public, max-age=300" : "public, max-age=86400");
  return new Response(upstream.body, { status: upstream.status, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    try {
      if (pathname.startsWith("/api/turso/")) {
        const origin = request.headers.get("Origin");
        if (origin && !ALLOWED_ORIGINS.has(origin)) {
          return jsonError("Origin not allowed", 403);
        }
        // Per-IP rate limit on the DB-backed endpoints. Defence against
        // scraping / cost-abuse now that the SQL allowlist (not the Origin
        // header) is the real guard. No-ops until the binding is provisioned.
        if (env.TURSO_RL) {
          const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
          const { success } = await env.TURSO_RL.limit({ key: ip });
          if (!success) return jsonError("Rate limit exceeded — slow down", 429);
        }
      }
      if (pathname === "/api/chat") return await handleChat(request, env);
      if (pathname === "/api/updates/latest.json") return await handleUpdateLatest(request, env);
      if (pathname.startsWith("/api/updates/")) {
        if (request.method !== "GET" && request.method !== "HEAD") {
          return jsonError("GET only", 405);
        }
        return await handleUpdateAsset(pathname.slice("/api/updates/".length), request, env);
      }
      if (pathname === "/api/turso/health") return await handleTursoHealth(env);
      if (pathname === "/api/turso/execute") return await handleTursoExecute(request, env);
      if (pathname === "/api/turso/batch") return await handleTursoBatch(request, env);
      if (pathname.startsWith("/patient/") || pathname.startsWith("/clinical")) {
        return await handleSpaFallback(request);
      }
      return jsonError("Not found", 404);
    } catch (err) {
      return jsonError(`Unhandled error: ${err instanceof Error ? err.message : String(err)}`, 500);
    }
  },
} satisfies ExportedHandler<Env>;
