/**
 * Two narrow jobs (see wrangler.jsonc routes — bound to exactly these two
 * path patterns, nothing else):
 *
 * 1. /api/turso/* — Turso proxy. Holds the Turso auth token as a Worker
 *    secret so it never ships in the client bundle. The case-log
 *    schema/column-mapping logic stays in src/lib/turso.ts unchanged;
 *    only the transport moves here, as a thin pass-through of the exact
 *    SQL that code already builds.
 *
 * 2. /patient/* — SPA fallback. GitHub Pages has no server-side rewrite
 *    capability, so a fresh visit to a client-side route like
 *    /patient/<id> (no matching file) 404s. This fetches /index.html
 *    from the same custom domain instead — a same-zone fetch, which
 *    Cloudflare docs confirm bypasses Worker routing entirely and goes
 *    straight to the zone's normal origin (the plain proxied CNAME to
 *    GitHub Pages), preserving the custom-domain Host header GitHub
 *    Pages needs to serve this project without redirecting.
 *
 * Everything else on this domain (the main page load, real assets)
 * passes straight through untouched — this Worker never sees it, and has
 * no business touching Cloudflare Access or GitHub's custom-domain
 * handling, both of which already work correctly on their own.
 *
 * No route here does its own auth check. Cloudflare Access, configured
 * separately on this domain, runs before this Worker executes at all —
 * by the time a request reaches here it's already authenticated, and
 * Access injects `Cf-Access-Authenticated-User-Email` on every request
 * if you want to attribute a write to a specific clinician later.
 */
import { createClient } from "@libsql/client/web";

interface Env {
  TURSO_URL: string;
  TURSO_AUTH_TOKEN: string;
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

async function handlePatientSpaFallback(request: Request): Promise<Response> {
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
      if (pathname === "/api/turso/health") return await handleTursoHealth(env);
      if (pathname === "/api/turso/execute") return await handleTursoExecute(request, env);
      if (pathname === "/api/turso/batch") return await handleTursoBatch(request, env);
      if (pathname.startsWith("/patient/")) return await handlePatientSpaFallback(request);
      return jsonError("Not found", 404);
    } catch (err) {
      return jsonError(`Unhandled error: ${err instanceof Error ? err.message : String(err)}`, 500);
    }
  },
} satisfies ExportedHandler<Env>;
