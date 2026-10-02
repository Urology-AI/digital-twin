/**
 * Intra-operative Plane Difficulty Index (PDI) — the side-specific reference
 * standard the PIPS development framework asks for ("a prediction score cannot
 * be validated against an unstructured surgeon impression"). Twelve anchored
 * items, each scored 0–3 per side (0 = no difficulty).
 *
 * Intended calibration target: fit against an Irani G/A + periprostatic
 * crown-like-structure + reactive-stroma composite on whole-mount pathology
 * plus the video difficulty grade, with the NeuroSAFE / Tewari grade as the
 * nerve-sparing-quality anchor.
 *
 * Endpoint hierarchy: NeuroSAFE per-side level achieved (intrafascial /
 * interfascial / limited / none; RCT-proven) is the co-primary; the Schatloff
 * 5-point grade (anchored to residual nerve area on the specimen) is the
 * granular secondary. The NSQ dissection-plane domain is the nearest existing
 * plane-difficulty item but its reliability is poor (weighted kappa 0.27), so
 * it should be refined before anchoring this index. The fibrosis-to-difficulty
 * link on whole-mount pathology is unestablished and is a primary-data
 * question for the prospective cohort, not a literature-fillable term.
 *
 * RECORDED ONLY: no model reads these scores. They exist so PIPS-H's
 * provisional weights can later be fitted against a structured outcome rather
 * than a single inflammation grade. Item weighting is deliberately left flat —
 * the framework says weights are "learned only after reliability testing".
 */
export const PDI_ITEMS = [
  "Visibility of the intended fascial plane",
  "Ability of tissue layers to separate",
  "Tissue adherence or tethering",
  "Countertraction required",
  "Bleeding that obscures the plane",
  "Thermal-energy requirement near the NVB",
  "Change from intrafascial to interfascial/extrafascial dissection",
  "Unplanned reduction or abandonment of nerve sparing",
  "Time from pedicle control to bundle release",
  "Encounter with implant, clip, scar or prior-treatment field",
  "Suspected traction, crush, thermal or transection injury",
  "Surgeon confidence in preserved nerve volume and integrity (3 = low)",
] as const;

export const PDI_ITEM_COUNT = PDI_ITEMS.length;
export const PDI_MAX = PDI_ITEM_COUNT * 3;

/** Pad/truncate to PDI_ITEM_COUNT and clamp every score to 0–3. */
export function normalizePdi(raw: unknown): number[] {
  const arr = Array.isArray(raw) ? raw : [];
  return Array.from({ length: PDI_ITEM_COUNT }, (_, i) => {
    const n = Number(arr[i]);
    return Number.isFinite(n) ? Math.min(3, Math.max(0, Math.round(n))) : 0;
  });
}

export function pdiTotal(scores: readonly number[]): number {
  return scores.reduce((s, n) => s + n, 0);
}
