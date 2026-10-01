/**
 * vNext side-specific EPE (left / right).
 *
 * Source: COMPASS_vNext_ECE_SideLocalizer_Shadow_Candidate_2026-09-30.json,
 * version vNext-ece-side-shadow-candidate-2026-09-30, SHA-256
 * ffe264fb3ec9c10fbbc8a0350f8af0eb0af11aec39665b2cc242e8ccdc341f8d.
 * Status: SHADOW RESEARCH CANDIDATE. Not part of the frozen global ECE model,
 * not externally validated. 606 patients, 1,212 sides, 241 side EPE events;
 * grouped-CV AUC 0.736, 2024-25 temporal AUC 0.693.
 *
 * Three inputs: the frozen global vNext ECE logit, the biopsy grade group on
 * that side, and whether ExactVu localized a lesion to that side. Missing
 * inputs take the frozen training mean (neutral); missing is never negative.
 * No clamps.
 */
import type { OptionalPredictor, Prostate3DInputV1 } from "@/types/patient";
import type { LesionRow } from "@/types/lesion";
import type { ModalityStatus } from "@/types/patient";
import { zoneKeyToSide } from "@/lib/utils/helpers";
import { assignTier, lockedLinearPredictor, sigmoid, type LockedFeature } from "./common";

export const SIDE_EPE_VERSION = "vNext-ece-side-shadow-candidate-2026-09-30";

const INTERCEPT = -1.5990305373807367;

const FEATURES: readonly LockedFeature[] = [
  { name: "global_vnext_ece_logit", coef: 0.7385535433615661, impute: -1.344681565639764, mean: -1.344681565639764, scale: 1.3700432869882329 },
  { name: "side_biopsy_gg", coef: 0.3789206772466316, impute: 2.2031063321385904, mean: 2.203106332138592, scale: 1.784021471333397 },
  { name: "exactvu_on_side", coef: 0.315089035317817, impute: 0.5355603448275862, mean: 0.5355603448275812, scale: 0.43640682247593315 },
];

/** Nerve-sparing context from side EPE: <10% G1, 10-<30% G2, >=30% G3. */
export const NS_CUTOFFS = [0.1, 0.3] as const;
export const NS_LABELS = ["Grade 1", "Grade 2", "Grade 3"] as const;

export type Side = "left" | "right";

/** Locked equation on already-resolved inputs. */
export function sideEpeFromInputs(inputs: {
  globalLogit: number;
  sideBiopsyGg: OptionalPredictor;
  exactvuOnSide: OptionalPredictor;
}) {
  const { logit, imputed } = lockedLinearPredictor(INTERCEPT, FEATURES, {
    global_vnext_ece_logit: inputs.globalLogit,
    side_biopsy_gg: inputs.sideBiopsyGg,
    exactvu_on_side: inputs.exactvuOnSide,
  });
  const probability = sigmoid(logit);
  return {
    probability,
    logit,
    nsGrade: assignTier(probability, NS_CUTOFFS, NS_LABELS),
    imputed,
  };
}

/**
 * Biopsy grade group on one side.
 *
 * Every biopsy is systematic plus targeted (confirmed by the PI), so a side
 * with no cancer reported was sampled and is documented clean:
 *   - an entered side grade > 0 is used as entered;
 *   - unilateral cancer: that side = overall grade group, other side = 0;
 *   - bilateral without side grades, or laterality unknown: missing (neutral),
 *     because which side carries the highest grade is not documented.
 */
export function sideBiopsyGgFromRecord(P: Prostate3DInputV1, side: Side): OptionalPredictor {
  const bx = P.biopsy;
  const entered = side === "left" ? bx.gg_left : bx.gg_right;
  if (typeof entered === "number" && entered > 0) return entered;
  const lat = bx.laterality;
  if (!lat || lat === "bilateral") return null;
  if (lat === side) {
    const gg = bx.max_grade_group;
    return typeof gg === "number" && gg >= 1 ? gg : null;
  }
  return 0;
}

const isExactvu = (l: { source?: string }) => l.source === "MUS" || l.source === "ExactVu";

function primusOf(l: LesionRow): number | null {
  if (typeof l.primus === "number") return l.primus;
  const n = parseFloat(l.score);
  return Number.isFinite(n) ? n : null;
}

/**
 * ExactVu lesion localized to this side: 1 / 0 / null.
 *   - ExactVu not known to be performed: null (neutral, never negative).
 *   - performed with a suspicious lesion (PRI-MUS >= 3, or an entered lesion
 *     without a score) on this side: 1.
 *   - performed, nothing on this side: 0, unless a lesion has no side recorded,
 *     in which case laterality is ambiguous and this side is null.
 */
export function exactvuOnSideFromRecord(
  P: Prostate3DInputV1,
  lesionRows: LesionRow[],
  status: ModalityStatus,
  side: Side,
): OptionalPredictor {
  const rows = [...lesionRows, ...(P.lesions ?? [])].filter(isExactvu);
  const performed = status === "performed" || rows.length > 0;
  if (!performed) return null;

  const target = side === "left" ? "L" : "R";
  const suspicious = (l: LesionRow) => {
    const p = primusOf(l);
    return p === null || p >= 3;
  };
  if (rows.some((l) => l.side === target && suspicious(l))) return 1;
  for (const [zone, z] of Object.entries(P.zones ?? {})) {
    const mus = z?.sources?.mus;
    if (typeof mus === "number" && mus >= 3 && zoneKeyToSide(zone) === target) return 1;
  }
  if (rows.some((l) => !l.side && suspicious(l))) return null;
  return 0;
}
