/**
 * Fixed L/R orientation labels for the default anterior view. The mesh's
 * vertex-coloring code (prostateScene.ts: side = nx < 0 ? "R" : "L") bakes in
 * the standard radiologic convention — viewing the patient face-on, their
 * right side appears on screen-left — but nothing on screen said so.
 */
export function OrientationBadge() {
  return (
    <>
      <span className="glass pointer-events-none absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-md px-2 py-1 text-[10px] font-semibold tracking-wide text-muted-foreground">
        Patient's Right (R)
      </span>
      <span className="glass pointer-events-none absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-md px-2 py-1 text-[10px] font-semibold tracking-wide text-muted-foreground">
        Patient's Left (L)
      </span>
    </>
  );
}
