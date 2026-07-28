/**
 * Two jobs, both in front of a GitHub Pages origin that can't do either
 * itself:
 *
 * 1. SPA fallback — deep links like /patient/<id> have no matching file on
 *    GitHub Pages, so serve index.html for them instead of a 404.
 * 2. Turso proxy — holds the Turso auth token as a Worker secret so it
 *    never ships in the client bundle. The case-log schema/column-mapping
 *    logic stays in src/lib/turso.ts unchanged; only the transport moves
 *    here, as a thin pass-through of the exact SQL that code already built.
 *
 * Neither route does its own auth check. Cloudflare Access, configured
 * separately on this same hostname/route, runs before this Worker executes
 * at all — by the time a request reaches here it's already authenticated,
 * and Access injects `Cf-Access-Authenticated-User-Email` on every request
 * if you want to attribute a write to a specific clinician later.
 */
import { createClient } from "@libsql/client/web";

interface Env {
  GITHUB_PAGES_ORIGIN: string;
  TURSO_URL: string;
  TURSO_AUTH_TOKEN: string;
}

const HAS_FILE_EXTENSION = /\.[a-zA-Z0-9]+$/;

async function handleSpaFallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const isAsset = HAS_FILE_EXTENSION.test(url.pathname);
  const upstreamPath = isAsset ? url.pathname : "/index.html";

  // GITHUB_PAGES_ORIGIN can itself carry a path prefix (project pages, e.g.
  // https://org.github.io/repo-name/). `new URL(absolutePath, base)` would
  // discard that prefix entirely — an absolute path replaces the base's
  // path rather than appending to it — so it's stitched in manually here.
  const originBase = new URL(env.GITHUB_PAGES_ORIGIN);
  const prefix = originBase.pathname.replace(/\/$/, "");
  const upstreamUrl = new URL(`${prefix}${upstreamPath}`, originBase.origin);
  const upstreamRequest = new Request(upstreamUrl, request);

  const response = await fetch(upstreamRequest);
  // SPA-fallback responses should report 200, not GitHub Pages' 404 for the
  // (nonexistent) deep-link path — the content itself is index.html.
  if (!isAsset && response.status === 404) {
    return new Response(response.body, { status: 200, headers: response.headers });
  }
  return response;
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function handleTursoExecute(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return jsonError("POST only", 405);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }
  const sql = (body as { sql?: unknown })?.sql;
  const args = (body as { args?: unknown })?.args ?? [];
  if (typeof sql !== "string" || !sql.trim()) return jsonError("Missing 'sql' string", 400);
  if (!Array.isArray(args)) return jsonError("'args' must be an array", 400);

  const client = createClient({ url: env.TURSO_URL, authToken: env.TURSO_AUTH_TOKEN });
  try {
    const result = await client.execute({ sql, args: args as (string | number | null)[] });
    return new Response(JSON.stringify({ rows: result.rows, columns: result.columns }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return jsonError(`Turso execute failed: ${err instanceof Error ? err.message : String(err)}`, 502);
  }
}

/** Real connectivity check — not just "are the env vars set", an actual round-trip to Turso. */
async function handleTursoHealth(env: Env): Promise<Response> {
  const client = createClient({ url: env.TURSO_URL, authToken: env.TURSO_AUTH_TOKEN });
  try {
    await client.execute({ sql: "SELECT 1", args: [] });
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return jsonError(`Turso unreachable: ${err instanceof Error ? err.message : String(err)}`, 502);
  }
}

interface BatchStatement {
  sql: string;
  args: (string | number | null)[];
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

  const client = createClient({ url: env.TURSO_URL, authToken: env.TURSO_AUTH_TOKEN });
  try {
    await client.batch(statements as BatchStatement[], "write");
    return new Response(JSON.stringify({ ok: true, count: statements.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return jsonError(`Turso batch failed: ${err instanceof Error ? err.message : String(err)}`, 502);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    try {
      if (pathname === "/api/turso/health") return await handleTursoHealth(env);
      if (pathname === "/api/turso/execute") return await handleTursoExecute(request, env);
      if (pathname === "/api/turso/batch") return await handleTursoBatch(request, env);
      return await handleSpaFallback(request, env);
    } catch (err) {
      return jsonError(`Unhandled error: ${err instanceof Error ? err.message : String(err)}`, 500);
    }
  },
} satisfies ExportedHandler<Env>;
