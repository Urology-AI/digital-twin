/**
 * "Demo mode" — the app running on a public URL with no Cloudflare Access
 * in front of it (root "/"). The prediction models, the
 * 3D viewer and manual case entry all work, but:
 *   - nothing is persisted (localStorage is never written), and
 *   - no saved patient data is ever loaded.
 *
 * The full clinical app lives under /clinical (Access-gated). Any other
 * path — including "/" — is demo mode.
 */
export function isDemoMode(): boolean {
  try {
    const p = window.location.pathname;
    return !p.startsWith("/clinical");
  } catch {
    return false;
  }
}
