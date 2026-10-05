/**
 * Preoperative biochemical recurrence (BCR): L2-regularized Cox model.
 *
 * Source: COMPASS_vNext_BCR_Provisional_ModelLock.json, version
 * vNext-bcr-preop-candidate-2026-09-27, canonical SHA-256
 * b364b7910c0b5356fbc3c8d5c99f142a9df1e11a0d3da915cc7868627a10a585.
 * Status: provisional. Research use only.
 *
 * Cox proportional hazards, Breslow ties, L2 alpha 0.001. Development cohort
 * N = 2,219 (321 events, surgery through 2023); temporal 2024-25 N = 556
 * (33 events).
 *
 *   LP      = sum(beta_k * z_k)            (no intercept)
 *   risk(t) = 1 - exp(-H0(t) * exp(LP))    t = 12, 24, 36 months
 *
 * Inputs: grade group (dummy coded), PSA density, PI-RADS, MRI SVI, ADC mean,
 * MRI EPE. Decipher, positive cores, ExactVu, PSMA and PSM are not inputs.
 * Missing optional imaging takes the frozen training mean, never zero.
 *
 * Known limitation (documented, not repaired): the proportional-hazards
 * diagnostic is violated for GG2, MRI SVI and ADC. Absolute estimates are
 * provisional because retrospective salvage-treatment timing was not fully
 * structured.
 */
import type { ClinicalState, OptionalPredictor } from "@/types/patient";
import {
  validateVNextRequiredInputs,
  type RequiredInputProblem,
} from "@/lib/models/inputContract";
import {
  assignTier,
  lockedLinearPredictor,
  vnextLogPsad,
  type LockedFeature,
} from "./common";
import { BCR_COX_BASELINE_H0 } from "./bcrCoxBaseline";

export const BCR_COX_VERSION = "vNext-bcr-preop-candidate-2026-09-27";

const FEATURES: readonly LockedFeature[] = [
  { name: "gg2", coef: 0.15674284114713927, impute: 0.40307275192046993, mean: 0.40307275192047, scale: 0.4898515402136896 },
  { name: "gg3", coef: 0.39305334290785354, impute: 0.23361952101220063, mean: 0.23361952101220063, scale: 0.4225604413099129 },
  { name: "gg4_5", coef: 0.5537535687846893, impute: 0.23813827383642114, mean: 0.23813827383642108, scale: 0.425367921062095 },
  { name: "log_psad", coef: 0.23738471677077375, impute: -1.7767001600083165, mean: -1.776700160008313, scale: 0.7901267056714066 },
  { name: "pirads", coef: 0.18862118287721685, impute: 4.203431372549019, mean: 4.2034313725490025, scale: 0.6006083682722367 },
  { name: "mri_svi_clean", coef: 0.11095161648170719, impute: 0.05732801595214357, mean: 0.057328015952143326, scale: 0.22102966687586342 },
  { name: "adc_mean", coef: -0.12250634502157372, impute: 779.0122767857143, mean: 779.0122767857035, scale: 132.15143999864623 },
  { name: "mri_epe", coef: 0.07301986166398523, impute: 0.17115054378935318, mean: 0.1711505437893532, scale: 0.33419101664283546 },
];

export const BCR_HORIZONS = [12, 24, 36] as const;
export type BcrHorizon = (typeof BCR_HORIZONS)[number];

export const BCR_TIER_LABELS = ["Low", "Intermediate", "High"] as const;
export const BCR_TIER_CUTOFFS: Record<BcrHorizon, readonly [number, number]> = {
  12: [0.05, 0.15],
  24: [0.1, 0.25],
  36: [0.15, 0.35],
};

/** Internal C-index (repeated 5-fold, development) and 2024-25 temporal C-index. */
export const BCR_COX_PERFORMANCE = {
  internalCIndex: 0.722,
  temporalCIndex: 0.698,
} as const;

export function bcrTier(horizon: BcrHorizon, risk: number) {
  return assignTier(risk, BCR_TIER_CUTOFFS[horizon], BCR_TIER_LABELS);
}

export type BcrCoxResult =
  | {
      ok: true;
      linearPredictor: number;
      risk12: number;
      risk24: number;
      risk36: number;
      tier12: { index: number; label: string };
      tier24: { index: number; label: string };
      tier36: { index: number; label: string };
      imputed: string[];
    }
  | { ok: false; problems: RequiredInputProblem[] };

/** Feature-level entry point; also used to replay the lock's raw regression cases. */
export function coxFromFeatures(
  values: Record<string, OptionalPredictor>,
): Extract<BcrCoxResult, { ok: true }> {
  const { logit: lp, imputed } = lockedLinearPredictor(0, FEATURES, values);
  const hr = Math.exp(lp);
  const risk = (h0: number) => 1 - Math.exp(-h0 * hr);
  const risk12 = risk(BCR_COX_BASELINE_H0.m12);
  const risk24 = risk(BCR_COX_BASELINE_H0.m24);
  const risk36 = risk(BCR_COX_BASELINE_H0.m36);
  return {
    ok: true as const,
    linearPredictor: lp,
    risk12,
    risk24,
    risk36,
    tier12: bcrTier(12, risk12),
    tier24: bcrTier(24, risk24),
    tier36: bcrTier(36, risk36),
    imputed,
  };
}

export function predictBcrCox(S: ClinicalState): BcrCoxResult {
  const valid = validateVNextRequiredInputs(S);
  if (!valid.ok) return valid;
  return coxFromFeatures({
    gg2: S.gg === 2 ? 1 : 0,
    gg3: S.gg === 3 ? 1 : 0,
    gg4_5: S.gg >= 4 ? 1 : 0,
    log_psad: vnextLogPsad(S.psa, S.vol),
    pirads: S.pirads,
    mri_svi_clean: S.mri_svi,
    adc_mean: S.mri_adc,
    mri_epe: S.mri_epe,
  });
}
