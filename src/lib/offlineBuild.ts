/**
 * True in the packaged offline macOS app (the Electron build sets VITE_OFFLINE=1
 * at build time). Everything runs locally in this build: the prediction models,
 * the 3D viewer and manual case entry work exactly as on the web, but every
 * network-backed feature is compiled out —
 *   - Cloudflare Access sign-in / identity,
 *   - the web app's update check.
 * No login, no server, no data ever leaves the machine.
 */
export const isOfflineBuild = (): boolean => import.meta.env.VITE_OFFLINE === "1";
