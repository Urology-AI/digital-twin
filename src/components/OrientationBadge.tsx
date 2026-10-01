import { useUiStore } from "@/store/uiStore";

/**
 * Patient's Right / Left labels that follow the model's rotation.
 *
 * The mesh is rotated about its vertical axis (uiStore.targetRot.y). Facing the
 * viewer (anterior, y≈0) the patient's right is on screen-left (radiologic
 * convention); turned around (posterior, y≈π) it flips. In a pure side view
 * neither side is on the left or right of the screen, so the labels hide.
 */
export function OrientationBadge() {
  const y = useUiStore((s) => s.targetRot.y);
  const facing = Math.cos(y);
  if (Math.abs(facing) < 0.35) return null;
  const [leftLabel, rightLabel] =
    facing > 0 ? ["Patient's Right (R)", "Patient's Left (L)"] : ["Patient's Left (L)", "Patient's Right (R)"];
  return (
    <>
      <span className="glass pointer-events-none absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-md px-2 py-1 text-[10px] font-semibold tracking-wide text-muted-foreground">
        {leftLabel}
      </span>
      <span className="glass pointer-events-none absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-md px-2 py-1 text-[10px] font-semibold tracking-wide text-muted-foreground">
        {rightLabel}
      </span>
    </>
  );
}
