/**
 * vNext SVI, patient level.
 *
 * Source: COMPASS_vNext_CoreModel_Lock.json, version
 * vNext-core-candidate-2026-09-24, file SHA-256
 * be53aba453b2595cbb3e15a640d5017667beb41650425137e8b2334756127bd8.
 * Status: provisionally frozen pending external validation. Research use only.
 *
 * Standardized L2 logistic regression (C = 1). N = 3,454, 301 events.
 * Repeated OOF AUC 0.8322; 2024-25 temporal AUC 0.8107.
 * Seven predictors; Decipher, ExactVu and PSMA are not inputs.
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

export const SVI_VNEXT_VERSION = "vNext-core-candidate-2026-09-24";

const INTERCEPT = -3.034728755182638;

const FEATURES: readonly LockedFeature[] = [
  { name: "gg2", coef: 0.7880457305967608, impute: 0.4255935147654893, mean: 0.4255935147654893, scale: 0.49443267990197265 },
  { name: "gg3", coef: 0.8112326011294532, impute: 0.2319050376375217, mean: 0.2319050376375217, scale: 0.42204868339547724 },
  { name: "gg4_5", coef: 1.077786672538851, impute: 0.22235089751013318, mean: 0.22235089751013318, scale: 0.41582565563776264 },
  { name: "log_psad", coef: 0.282516526261716, impute: -1.7947758831190161, mean: -1.7947758831190161, scale: 0.80169603671256 },
  { name: "pirads", coef: 0.3407530860758033, impute: 4.185550082101806, mean: 4.185550082101826, scale: 0.6563934826435143 },
  { name: "mri_svi_clean", coef: 0.4782618373726315, impute: 0.04964990451941439, mean: 0.04964990451941426, scale: 0.20717766970745446 },
  { name: "max_core_pct", coef: 0.5413926635417802, impute: 56.30656455142232, mean: 56.30656455142354, scale: 28.33661025167477 },
];

export const SVI_TIER_CUTOFFS = [0.02, 0.05, 0.1, 0.2] as const;
export const SVI_TIER_LABELS = ["Very low", "Low", "Intermediate", "High", "Very high"] as const;

export type SviVNextResult =
  | {
      ok: true;
      probability: number;
      /** Linear predictor; the side-SVI model takes this as its first input. */
      logit: number;
      tier: { index: number; label: string };
      imputed: string[];
    }
  | { ok: false; problems: RequiredInputProblem[] };

export function predictSviVNext(S: ClinicalState): SviVNextResult {
  const valid = validateVNextRequiredInputs(S);
  if (!valid.ok) return valid;

  const { logit, imputed } = lockedLinearPredictor(INTERCEPT, FEATURES, {
    gg2: S.gg === 2 ? 1 : 0,
    gg3: S.gg === 3 ? 1 : 0,
    gg4_5: S.gg >= 4 ? 1 : 0,
    log_psad: vnextLogPsad(S.psa, S.vol),
    pirads: S.pirads,
    mri_svi_clean: S.mri_svi,
    max_core_pct: isObserved(S.maxcore) ? normalizeMaxCorePct(S.maxcore) : null,
  });
  const probability = sigmoid(logit);
  return {
    ok: true,
    probability,
    logit,
    tier: assignTier(probability, SVI_TIER_CUTOFFS, SVI_TIER_LABELS),
    imputed,
  };
}
