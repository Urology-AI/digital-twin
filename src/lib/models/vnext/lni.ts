/**
 * vNext Lymph Node Invasion (LNI), patient level.
 *
 * Source: COMPASS_vNext_LNI_ModelLock_2026-10-02.json, version
 * vNext-lni-3feature-candidate-2026-10-02, canonical SHA-256
 * c51a475fd22120f73127fce494c2a4cc1504d9f394ba7d0d168fcdf0d6f9f6fb.
 * Status: finalized development candidate. Research use only.
 *
 * Standardized L2 logistic regression. N = 663, 35 events. Repeated OOF AUC 0.8422.
 * Inputs: PSA and prostate volume (log PSA density), biopsy Grade Group, PSMA
 * pelvic lymph-node status. Missing or not-performed PSMA is NOT negative: it
 * takes the frozen training mean. No side-specific or regional LNI, and no
 * automatic PLND recommendation.
 */
import type { ClinicalState } from "@/types/patient";
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

export const LNI_VNEXT_VERSION = "vNext-lni-3feature-candidate-2026-10-02";

const INTERCEPT = -3.3476274574159866;

const FEATURES: readonly LockedFeature[] = [
  { name: "log_psad", coef: 0.5834339056078796, impute: -1.6244208509642653, mean: -1.6244208509642653, scale: 0.8287719345550639 },
  { name: "gg4_5", coef: 0.42566857641499295, impute: 0.3167420814479638, mean: 0.3167420814479638, scale: 0.4652059063339318 },
  { name: "psma_ln_pos", coef: 0.5515538630360188, impute: 0.1253822629969419, mean: 0.1253822629969419, scale: 0.3288965381114206 },
];

export const LNI_TIER_CUTOFFS = [0.02, 0.05] as const;
export const LNI_TIER_LABELS = ["Low", "Intermediate", "High"] as const;

export type LniVNextResult =
  | {
      ok: true;
      probability: number;
      tier: { index: number; label: string };
      imputed: string[];
    }
  | { ok: false; problems: RequiredInputProblem[] };

export function predictLniVNext(S: ClinicalState): LniVNextResult {
  const valid = validateVNextRequiredInputs(S);
  if (!valid.ok) return valid;

  const { logit, imputed } = lockedLinearPredictor(INTERCEPT, FEATURES, {
    log_psad: vnextLogPsad(S.psa, S.vol),
    gg4_5: S.gg >= 4 ? 1 : 0,
    psma_ln_pos: S.psma_ln,
  });
  const probability = sigmoid(logit);
  return {
    ok: true,
    probability,
    tier: assignTier(probability, LNI_TIER_CUTOFFS, LNI_TIER_LABELS),
    imputed,
  };
}
