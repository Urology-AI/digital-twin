/**
 * Side-specific positive surgical margin (PSM), left and right.
 *
 * Source: COMPASS_vNext_PSM_ModelLock.json, version
 * vNext-psm-side-candidate-2026-09-26, SHA-256
 * bdcfd1832c53799e9dc2eb908cc79cc653330c091edbbdc88825185ab9e84666.
 * Status: frozen candidate for external validation. Research use only.
 *
 * Standardized L2 logistic regression, one prediction per side. N = 4,203
 * patients / 8,406 sides / 616 side events. Grouped-CV AUC 0.6934, 2024-25
 * temporal AUC 0.6841.
 *
 * Exactly three inputs: log PSA density, positive cores, and the side-localized
 * index-lesion PI-RADS. Nerve-sparing grade, ECE and grade group are not inputs.
 * There is no patient-level PSM, regional PSM or ECE-derived PSM.
 */
import type { ClinicalState, OptionalPredictor, Prostate3DInputV1 } from "@/types/patient";
import type { LesionRow } from "@/types/lesion";
import {
  validateVNextRequiredInputs,
  type RequiredInputProblem,
} from "@/lib/models/inputContract";
import {
  assignTier,
  lockedLinearPredictor,
  sigmoid,
  vnextLogPsad,
  type LockedFeature,
} from "./common";

export const PSM_SIDE_VERSION = "vNext-psm-side-candidate-2026-09-26";

const INTERCEPT = -2.7254046775739997;

const FEATURES: readonly LockedFeature[] = [
  { name: "log_psad", coef: 0.28707315882516415, impute: -1.7843017168203532, mean: -1.7843017168203532, scale: 0.7865778368193919 },
  { name: "pos_cores", coef: 0.27403058576772316, impute: 5.946708463949843, mean: 5.946708463949839, scale: 3.64591566875227 },
  { name: "pirads_index_side", coef: 0.44639858983510483, impute: 2.0291872474180512, mean: 2.0291872474180175, scale: 1.9264154359650032 },
];

export const PSM_TIER_CUTOFFS = [0.03, 0.08, 0.15] as const;
export const PSM_TIER_LABELS = ["Very low", "Low", "Intermediate", "High"] as const;

/** Locked equation on already-resolved inputs. null means unavailable (neutral mean). */
export function psmSideFromInputs(inputs: {
  logPsad: number;
  posCores: OptionalPredictor;
  piradsIndexSide: OptionalPredictor;
}) {
  const { logit, imputed } = lockedLinearPredictor(INTERCEPT, FEATURES, {
    log_psad: inputs.logPsad,
    pos_cores: inputs.posCores,
    pirads_index_side: inputs.piradsIndexSide,
  });
  const probability = sigmoid(logit);
  return {
    probability,
    logit,
    tier: assignTier(probability, PSM_TIER_CUTOFFS, PSM_TIER_LABELS),
    imputed,
  };
}

const piradsOf = (l: LesionRow): number | null => {
  const n = typeof l.pirads === "number" ? l.pirads : parseFloat(l.score);
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
};

/**
 * Side-localized index-lesion PI-RADS for the left and right sides.
 *   - index lesion = the MRI lesion(s) with the highest PI-RADS;
 *   - index on this side: that score; index on the other side: 0;
 *   - index lesions on both sides: the score on both sides;
 *   - no MRI lesion with a score, or an index lesion with no side recorded:
 *     laterality is unavailable, so null (neutral mean). Side is never inferred.
 */
export function psmIndexPiradsBySide(
  P: Prostate3DInputV1,
  lesionRows: LesionRow[],
): { left: OptionalPredictor; right: OptionalPredictor } {
  const mri = [...lesionRows, ...(P.lesions ?? [])].filter((l) => l.source === "MRI");
  const scored = mri.map((l) => ({ l, s: piradsOf(l) })).filter((x) => x.s !== null) as { l: LesionRow; s: number }[];
  if (scored.length === 0) return { left: null, right: null };
  const top = Math.max(...scored.map((x) => x.s));
  const index = scored.filter((x) => x.s === top).map((x) => x.l);
  const hasL = index.some((l) => l.side === "L");
  const hasR = index.some((l) => l.side === "R");
  if (hasL && hasR) return { left: top, right: top };
  if (index.some((l) => l.side !== "L" && l.side !== "R")) return { left: null, right: null };
  return hasL ? { left: top, right: 0 } : { left: 0, right: top };
}

export type PsmSideResult =
  | {
      ok: true;
      probability: number;
      tier: { index: number; label: string };
      imputed: string[];
    }
  | { ok: false; problems: RequiredInputProblem[] };

export function predictPsmSideVNext(
  S: ClinicalState,
  piradsIndexSide: OptionalPredictor,
): PsmSideResult {
  const valid = validateVNextRequiredInputs(S);
  if (!valid.ok) return valid;
  const r = psmSideFromInputs({
    logPsad: vnextLogPsad(S.psa, S.vol),
    posCores: S.cores,
    piradsIndexSide,
  });
  return { ok: true, probability: r.probability, tier: r.tier, imputed: r.imputed };
}
