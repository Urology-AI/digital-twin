/**
 * "Demo mode" — the app running on a public URL with no Cloudflare Access
 * in front of it (root "/", or GitHub Pages). The prediction models, the
 * 3D viewer and manual case entry all work, but:
 *   - nothing is persisted (localStorage / Turso are never written), and
 *   - no saved or shared patient data is ever loaded.
 *
 * The full clinical app lives under /clinical (Access-gated); patient
 * share links are /patient/<id> (also need the real data path). Any other
 * path — including "/" — is demo mode.
 */
export function isDemoMode(): boolean {
  try {
    const p = window.location.pathname;
    return !p.startsWith("/clinical") && !p.startsWith("/patient/");
  } catch {
    return false;
  }
}
