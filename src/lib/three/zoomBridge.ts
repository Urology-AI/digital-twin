/** Dispatched by UI controls; handled by the active Three scene hook. */
export const ZOOM_NUDGE_EVENT = "compass:nudge-zoom";

export function emitZoomNudge(deltaZ: number) {
  window.dispatchEvent(
    new CustomEvent(ZOOM_NUDGE_EVENT, { detail: { deltaZ } }),
  );
}

/**
 * Snapshot of the active 3D scene for the printed report. The scene hook
 * registers a function that renders the anterior and posterior views on a plain
 * white background and returns them as data URLs, then restores the on-screen background.
 */
let snapshotFn: (() => string[]) | null = null;

export function registerSceneSnapshot(fn: (() => string[]) | null) {
  snapshotFn = fn;
}

export function captureSceneSnapshot(): string[] {
  return snapshotFn ? snapshotFn() : [];
}
