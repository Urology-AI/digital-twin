/**
 * Biochemical-recurrence projection: a "grade alone" baseline arm vs. a
 * "with the operative plan" arm.
 *
 * `predictBcrPreop` gives a single "will recur" probability. Here we blend the
 * NS-grade positive-margin rate (NSG_DATA) with BCR-if-margin figures, nudged by
 * plan choices (hydrodissection lowers PSM, obliterated planes raise it), anchor
 * to the preop BCR, and project onto 1-year and 2–3-year cumulative incidence.
 *
 * Patient properties (BMI, inflammation tier) are applied to BOTH arms so the
 * baseline↔plan delta reflects only the surgical decisions, not fixed patient
 * risk.
 */
import {
  BCR_HAZARD,
  MODIFIABLE_BCR,
  PSM_PLAN_MODULATION,
} from "@/lib/compass/planningEvidence";
import { NSG_DATA, nsgGrade } from "@/lib/compass/nsgOutcomes";
import type { InflammationTier } from "@/lib/compass/inflammationRisk";
import { clamp } from "@/lib/utils/math";
import type { ClinicalState } from "@/types/patient";

export interface BcrArm {
  nsGrade: number;
  hydrodissection: boolean;
  inflammationTier: InflammationTier;
}

export interface BcrArmResult {
  psmRate: number;
  plateau: number;
  y1: number;
  y23: number;
}

export interface BcrByPlan {
  baseline: BcrArmResult;
  withPlan: BcrArmResult;
  /** low-confidence modifiable-factor (BMI) contribution, applied to both arms */
  bmiPenaltyPp: number;
}

export function bcrByPlan(
  S: ClinicalState,
  preopBcr: number,
  baseline: BcrArm,
  withPlan: BcrArm,
): BcrByPlan {
  const h = BCR_HAZARD.value;
  const mod = PSM_PLAN_MODULATION.value;

  const baseRow = NSG_DATA[1];
  const basePsm = baseRow.psm / 100;
  const baseBlended =
    basePsm * (baseRow.bcr_psm / 100) + (1 - basePsm) * (baseRow.bcr_no / 100);
  const anchor = baseBlended > 0 ? preopBcr / baseBlended : 1;

  const bmiPenalty =
    S.bmi >= 35 ? MODIFIABLE_BCR.value.bmi_ge_35 : S.bmi >= 30 ? MODIFIABLE_BCR.value.bmi_ge_30 : 0;

  const arm = (a: BcrArm): BcrArmResult => {
    const row = NSG_DATA[nsgGrade(a.nsGrade)];
    let psmRate = row.psm / 100;
    if (a.hydrodissection) psmRate += mod.hydrodissection;
    if (a.inflammationTier === "moderate") psmRate += mod.inflammation_moderate;
    if (a.inflammationTier === "high") psmRate += mod.inflammation_high;
    psmRate = clamp(psmRate, 0.03, 0.6);

    const blended = psmRate * (row.bcr_psm / 100) + (1 - psmRate) * (row.bcr_no / 100);
    const plateau = clamp(blended * anchor + bmiPenalty, 0.02, 0.9);
    return {
      psmRate,
      plateau,
      y1: clamp(plateau * h.y1Fraction, 0, 1),
      y23: clamp(plateau * h.y23Fraction, 0, 1),
    };
  };

  return {
    baseline: arm(baseline),
    withPlan: arm(withPlan),
    bmiPenaltyPp: Math.round(bmiPenalty * 100),
  };
}
