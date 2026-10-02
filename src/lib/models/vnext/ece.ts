/**
 * vNext ECE, patient level.
 *
 * Source: COMPASS_vNext_CoreModel_Lock.json, version
 * vNext-core-candidate-2026-09-24, file SHA-256
 * be53aba453b2595cbb3e15a640d5017667beb41650425137e8b2334756127bd8.
 * Status: frozen for external/prospective validation. Research use only.
 *
 * Standardized L2 logistic regression (C = 1). N = 3,454, 882 events.
 * Repeated OOF AUC 0.7825; 2024-25 temporal AUC 0.7415.
 * Decipher, ExactVu and PSMA are not inputs.
 */
import type { ClinicalState } from "@/types/patient";
import { normalizeMaxCorePct } from "@/lib/utils/math";
import {
  isObserved,
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

export const ECE_VNEXT_VERSION = "vNext-core-candidate-2026-09-24";

const INTERCEPT = -1.3398300130917316;

const FEATURES: readonly LockedFeature[] = [
  { name: "gg2", coef: 0.3871940210838731, impute: 0.4255935147654893, mean: 0.4255935147654893, scale: 0.49443267990197265 },
  { name: "gg3", coef: 0.5177794293068118, impute: 0.2319050376375217, mean: 0.2319050376375217, scale: 0.42204868339547724 },
  { name: "gg4_5", coef: 0.6649916550814684, impute: 0.22235089751013318, mean: 0.22235089751013318, scale: 0.41582565563776264 },
  { name: "log_psad", coef: 0.3168653599703186, impute: -1.7947758831190161, mean: -1.7947758831190161, scale: 0.80169603671256 },
  { name: "pirads", coef: 0.43023660495285243, impute: 4.185550082101806, mean: 4.185550082101826, scale: 0.6563934826435143 },
  { name: "mri_epe", coef: 0.1395609869562608, impute: 0.15230825154489278, mean: 0.15230825154488978, scale: 0.3206747927404026 },
  { name: "mri_svi_clean", coef: 0.2509602268515916, impute: 0.04964990451941439, mean: 0.04964990451941426, scale: 0.20717766970745446 },
  { name: "max_core_pct", coef: 0.462890141105549, impute: 56.30656455142232, mean: 56.30656455142354, scale: 28.33661025167477 },
  { name: "capsular_abutment", coef: 0.12565664814401906, impute: 1.8991643454038998, mean: 1.8991643454038496, scale: 1.0121938579423426 },
];

/** Ordinal planning tiers. Not absolute-risk labels: temporal calibration drifted. */
export const ECE_TIER_CUTOFFS = [0.1, 0.2, 0.3, 0.5] as const;
export const ECE_TIER_LABELS = ["Tier 1", "Tier 2", "Tier 3", "Tier 4", "Tier 5"] as const;

export type EceVNextResult =
  | {
      ok: true;
      probability: number;
      /** Linear predictor; the side-EPE model takes this as its first input. */
      logit: number;
      tier: { index: number; label: string };
      /** Inputs that were missing and replaced by the training-cohort average. */
      imputed: string[];
    }
  | { ok: false; problems: RequiredInputProblem[] };

export function predictEceVNext(S: ClinicalState): EceVNextResult {
  const valid = validateVNextRequiredInputs(S);
  if (!valid.ok) return valid;

  const { logit, imputed } = lockedLinearPredictor(INTERCEPT, FEATURES, {
    gg2: S.gg === 2 ? 1 : 0,
    gg3: S.gg === 3 ? 1 : 0,
    gg4_5: S.gg >= 4 ? 1 : 0,
    log_psad: vnextLogPsad(S.psa, S.vol),
    pirads: S.pirads,
    mri_epe: S.mri_epe,
    mri_svi_clean: S.mri_svi,
    max_core_pct: isObserved(S.maxcore) ? normalizeMaxCorePct(S.maxcore) : null,
    capsular_abutment: S.mri_abutment,
  });
  const probability = sigmoid(logit);
  return {
    ok: true,
    probability,
    logit,
    tier: assignTier(probability, ECE_TIER_CUTOFFS, ECE_TIER_LABELS),
    imputed,
  };
}
