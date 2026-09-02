/**
 * /clinical/download — the desktop-app download page, rendered by the Worker.
 *
 * Deliberately NOT part of the React bundle. Anything under src/** triggers
 * auto-release.yml, which tags a new version and rebuilds the signed macOS
 * app; a copy tweak on a download page has no business minting a release.
 * cf-worker/** is outside those path filters, so this page deploys on its own
 * with `wrangler deploy`.
 *
 * It is served on /clinical/*, which is the scope of the only Cloudflare
 * Access application — Access runs at the edge ahead of the Worker, so this
 * page is behind the same SSO as the clinical app itself.
 *
 * The version is injected server-side (the Worker already reads the release
 * feed with RELEASES_READ_PAT), so the page needs no client-side fetch and has
 * no loading or error state.
 */

const CYAN = "#00AEEF";

/** The release tag reaches us from the GitHub API; keep only version-shaped characters. */
function safeVersion(v: string): string {
  return v.replace(/[^\w.-]/g, "");
}

export function downloadPageHtml(
  version: string,
  releasedAt: string | null,
  /** Asset names present on the release — a platform with no asset is not offered. */
  assetNames: string[] = [],
): string {
  const v = safeVersion(version);
  const macFile = `COMPASS-Digital-Twin-${v}-arm64.dmg`;
  const winFile = `COMPASS-Digital-Twin-${v}-x64.exe`;
  // Until a Windows release is actually published, the button would 404 — the
  // asset proxy can only serve what is on the release.
  const hasMac = assetNames.includes(macFile);
  const hasWin = assetNames.includes(winFile);
  const released = releasedAt
    ? new Date(releasedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : null;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<title>COMPASS Digital Twin — desktop app</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    background:
      radial-gradient(ellipse at top left, rgba(0,174,239,0.20), transparent 55%),
      radial-gradient(ellipse at bottom right, rgba(213,0,91,0.16), transparent 55%),
      #0b0f14;
    color: #e6edf3;
    font: 15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 40rem; margin: 0 auto; padding: 3.5rem 1.5rem 5rem; }
  img.logo { width: 11rem; height: auto; display: block; margin-bottom: 1.75rem; }
  h1 { font-size: 1.85rem; line-height: 1.2; letter-spacing: -0.02em; margin: 0 0 1rem; }
  h2 { font-size: 0.95rem; margin: 0 0 0.5rem; }
  p { margin: 0 0 1rem; color: #9fb0c0; }
  .card {
    border: 1px solid rgba(255,255,255,0.10);
    background: rgba(255,255,255,0.03);
    border-radius: 0.75rem;
    padding: 1.5rem;
    margin: 2rem 0;
  }
  .row + .row { margin-top: 1.5rem; }
  a.btn {
    display: block;
    text-align: center;
    padding: 0.7rem 1.25rem;
    border-radius: 0.5rem;
    font-weight: 600;
    text-decoration: none;
    border: 1px solid rgba(255,255,255,0.18);
    color: #e6edf3;
    transition: background 0.15s, border-color 0.15s;
  }
  a.btn:hover { background: rgba(255,255,255,0.07); }
  /* The platform you are on, highlighted by the script below. Without JS both
     buttons simply render in the neutral style — nothing is hidden. */
  a.btn.primary { background: ${CYAN}; border-color: ${CYAN}; color: #04121b; }
  a.btn.primary:hover { filter: brightness(1.08); }
  .note { font-size: 0.8125rem; color: #7d8fa0; margin: 0.5rem 0 0; }
  .meta { font-size: 0.75rem; color: #6b7c8c; margin-top: 1.5rem; }
  ul { padding-left: 1.15rem; color: #9fb0c0; }
  li { margin-bottom: 0.35rem; }
  code {
    font: 0.85em ui-monospace, SFMono-Regular, Menlo, monospace;
    background: rgba(255,255,255,0.07);
    padding: 0.1em 0.35em;
    border-radius: 0.25rem;
  }
  strong { color: #e6edf3; }
  .warn {
    border: 1px solid rgba(245,158,11,0.32);
    background: rgba(245,158,11,0.10);
    border-radius: 0.5rem;
    padding: 0.9rem 1.15rem;
    font-size: 0.8125rem;
    color: #f0b849;
    margin: 2rem 0 0;
  }
  .warn strong { color: #ffcf70; }
</style>
</head>
<body>
<div class="wrap">
  <img class="logo" src="/logo_dark.png" alt="Mount Sinai">
  <h1>COMPASS Digital Twin — desktop app</h1>
  <p>
    The offline build for Mac and Windows. Every prediction model, the 3D viewer and the
    case library run entirely on the machine — no network calls, no patient data leaves the
    device. Cloud features (chat, note parsing, sync and share links) are compiled out.
  </p>

  <div class="card">
    ${hasMac ? `<div class="row">
      <a class="btn" id="mac" href="/api/updates/${macFile}" download>
        Download for macOS — v${v}
      </a>
      <p class="note">macOS 12 or later, Apple Silicon (M1 and newer). Signed and notarized by Apple.</p>
    </div>` : ""}
    ${hasWin ? `<div class="row">
      <a class="btn" id="win" href="/api/updates/${winFile}" download>
        Download for Windows — v${v}
      </a>
      <p class="note">Windows 10 or later, 64-bit. Per-user install, no admin rights needed.</p>
    </div>` : `<div class="row">
      <p class="note" style="margin:0">A Windows build is not published for this release yet.</p>
    </div>`}
    ${released ? `<p class="meta">Version ${v}, released ${released}. The app updates itself after install.</p>` : ""}
  </div>

  <h2>Installing</h2>
  <ul>
    <li><strong>Mac</strong> — open the <code>.dmg</code> and drag COMPASS Digital Twin into Applications.</li>
    <li><strong>Windows</strong> — run the <code>.exe</code>; it installs for the current user, no admin rights needed.</li>
  </ul>
  <p class="warn">
    <strong>Before you install.</strong> For named Mount Sinai study staff only — do not
    forward the app or this link outside the team. Do not enter PHI: COMPASS holds no patient
    identifiers by design, so identify cases by study ID. Research tool only — not a medical
    device, not FDA cleared, and no substitute for clinical judgment. IRB STUDY-14-00050.
  </p>
</div>
<script>
  // Highlight the platform you are actually on. Progressive enhancement only:
  // with JS off, both buttons still work in the neutral style.
  try {
    var ua = navigator.userAgent;
    var id = /Windows/i.test(ua) ? "win" : /Mac/i.test(ua) ? "mac" : null;
    if (id) document.getElementById(id).classList.add("primary");
  } catch (e) {}
</script>
</body>
</html>`;
}
