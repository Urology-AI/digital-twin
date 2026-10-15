/**
 * Hosts the COMPASS web app on Cloudflare (Workers static assets — see the
 * `assets` block in wrangler.jsonc). No patient data passes through this
 * Worker: there is no database, no share-link store and no AI proxy.
 * Everything clinical stays in the clinician's browser.
 *
 * Static files (the built app in ../dist) are served by the asset layer
 * directly, with single-page-application fallback for client-side routes such
 * as /clinical/... . Only the paths in `run_worker_first` reach this code:
 *
 * 1. /api/updates/* — update feed for the desktop app and the web app's
 *    version check. Holds RELEASES_READ_PAT so the shipped app carries no
 *    credential of its own.
 *
 * 2. /clinical/download — a Worker-rendered page (see downloadPage.ts).
 *
 * Cloudflare Access has exactly one application, scoped to /clinical/*; it
 * authenticates at the edge before requests reach this Worker or the assets.
 * Root ("/") is the public demo.
 */
import { downloadPageHtml } from "./downloadPage";

interface Env {
  // Fine-grained, read-only PAT for the PRIVATE releases repo. Held here as a
  // Worker secret so the desktop app can ship with no credential at all —
  // before this, every build carried the token inside the bundle, where any
  // user could extract it and it could not be rotated without a new release.
  RELEASES_READ_PAT?: string;
  // The built app (../dist), served by the static-assets layer.
  ASSETS: Fetcher;
}

/**
 * Origin allowlist for the web app's version check (/api/updates/latest.json).
 */
const ALLOWED_ORIGINS = new Set([
  "https://digital-twin.urology.edu.eu.org",
  "http://localhost:5173", // vite dev
  "http://localhost:4173", // vite preview
]);

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
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

// The download page for the desktop app. Served here rather than from the React
// bundle so that editing it never triggers a rebuild of the signed apps — see
// the header of downloadPage.ts.
async function handleDownloadPage(env: Env): Promise<Response> {
  if (!env.RELEASES_READ_PAT) return jsonError("Update feed not configured on server", 503);
  const release = await latestRelease(env);
  if (!release) return jsonError("Could not reach the release feed", 502);
  const html = downloadPageHtml(
    release.tag_name.replace(/^v/, ""),
    release.published_at,
    release.assets.map((a) => a.name),
  );
  return withSecurityHeaders(
    new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        // Access-gated and version-bearing: never store it in a shared cache.
        "Cache-Control": "no-store",
      },
    }),
  );
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
      if (pathname === "/api/updates/latest.json") return await handleUpdateLatest(request, env);
      if (pathname.startsWith("/api/updates/")) {
        if (request.method !== "GET" && request.method !== "HEAD") {
          return jsonError("GET only", 405);
        }
        return await handleUpdateAsset(pathname.slice("/api/updates/".length), request, env);
      }
      // Any other /api path is not an endpoint — never answer it with the SPA.
      if (pathname.startsWith("/api/")) return jsonError("Not found", 404);
      // A Worker-rendered page, not a client-side route.
      if (pathname === "/clinical/download" || pathname === "/clinical/download/") {
        return await handleDownloadPage(env);
      }
      return await env.ASSETS.fetch(request);
    } catch (err) {
      return jsonError(`Unhandled error: ${err instanceof Error ? err.message : String(err)}`, 500);
    }
  },
} satisfies ExportedHandler<Env>;
