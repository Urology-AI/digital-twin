import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Release builds (CI) pass the version from the git tag; otherwise fall back
// to package.json. Shown in the About panel on both web and desktop.
const pkgVersion = JSON.parse(readFileSync(path.join(__dirname, "package.json"), "utf8")).version as string;
const appVersion = process.env.VITE_APP_VERSION || pkgVersion;

/**
 * Content-Security-Policy, injected into the built index.html only.
 *
 * It matters most in the packaged Electron app: the app:// origin holds every
 * saved case in localStorage and there is no server in front of it to set a
 * header. script-src 'self' is the load-bearing directive — no inline script,
 * no eval, so an injection has nothing to execute; object-src / base-uri /
 * form-action / frame-ancestors close the usual bypasses.
 *
 * Build-only on purpose: the dev server's React Fast Refresh preamble is an
 * INLINE script, so applying this in dev would break `npm run dev` outright.
 *
 * Two deliberate relaxations:
 *  - style-src 'unsafe-inline': React style props and the Three.js canvas set
 *    element styles directly; without it the UI loses its layout entirely.
 *  - connect-src allows https: and localhost, because the AI settings dialog
 *    lets a site point COMPASS at its OWN vLLM endpoint (src/lib/api.ts) —
 *    typically a lab host or http://localhost:8000. So connect-src is not the
 *    exfiltration boundary here; the opt-in AI gate and de-identification are.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https: http://localhost:* http://127.0.0.1:*",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  // No frame-ancestors: it is ignored when delivered via <meta> (and the
  // browser logs an error for it). Clickjacking is covered by the Worker's
  // X-Frame-Options: DENY header instead — see cf-worker/src/index.ts.
].join("; ");

function cspPlugin() {
  return {
    name: "compass-csp",
    apply: "build" as const,
    transformIndexHtml(html: string) {
      return html.replace(
        "<head>",
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

export default defineConfig({
  // Absolute asset URLs, required for deep-link routes like /patient/<id> —
  // with a relative base, a browser landing directly on that path would
  // resolve assets relative to /patient/ instead of the real root and 404.
  // (Previously "./" for hosting under an unknown subpath e.g. GitHub Pages;
  // not compatible with patient-link routing, so fixed to the real root.)
  base: "/",
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [react(), cspPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
  },
});
