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
}

/**
 * Origin allowlist — the two front-ends that legitimately call this proxy.
 * A browser on any other site gets its request rejected. (Non-browser
 * clients send no Origin header and so aren't stopped here — the SQL
 * allowlist below is the real guard; this is defence in depth.)
 */
const ALLOWED_ORIGINS = new Set([
  "https://digital-twin.urology.edu.eu.org",
  "https://urology-ai.github.io",
]);

/**
 * SQL allowlist. The proxy is public (no Access application on /api/*), so
 * without this any caller could `SELECT * FROM patient_shares` and dump
 * every shared patient record. Only the exact statements src/lib/turso.ts
 * issues are permitted:
 *  - patient_shares (holds identified records) — matched exactly, incl. arg count.
 *  - case_log (de-identified research log) — matched by statement shape.
 * Anything else is refused.
 */
function normalizeSql(sql: string): string {
  return sql.trim().replace(/\s+/g, " ").replace(/;\s*$/, "");
}

const SHARE_GET = "SELECT record FROM patient_shares WHERE id = ?";
const SHARE_PUT =
  "INSERT OR REPLACE INTO patient_shares (id, record, created_at) VALUES (?, ?, ?)";
const SHARE_CREATE =
  "CREATE TABLE IF NOT EXISTS patient_shares ( id TEXT PRIMARY KEY, record TEXT NOT NULL, created_at TEXT NOT NULL )";

function sqlAllowed(sql: string, args: unknown[]): boolean {
  const s = normalizeSql(sql);
  if (s === SHARE_GET) return args.length === 1;
  if (s === SHARE_PUT) return args.length === 3;
  if (s === SHARE_CREATE) return true;
  if (s === "SELECT 1") return true;
  if (s === "SELECT * FROM case_log ORDER BY date DESC") return true;
  if (s.startsWith("CREATE TABLE IF NOT EXISTS case_log (")) return true;
  if (s.startsWith("ALTER TABLE case_log ADD COLUMN ")) return true;
  if (s.startsWith("INSERT OR REPLACE INTO case_log (")) return true;
  return false;
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
  if (!sqlAllowed(sql, args)) return jsonError("Statement not allowed", 403);

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
    if (!sqlAllowed(s.sql, s.args)) return jsonError("Statement not allowed", 403);
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

async function handleSpaFallback(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const indexUrl = new URL("/index.html", url.origin);
  const response = await fetch(new Request(indexUrl, request));
  // Report 200, not GitHub Pages' 404 for the (nonexistent) deep-link path
  // — the content itself is index.html, so the client-side router can run.
  if (response.status === 404) {
    return new Response(response.body, { status: 200, headers: response.headers });
  }
  return response;
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
