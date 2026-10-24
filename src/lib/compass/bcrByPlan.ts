/**
 * Biochemical-recurrence projection: a "grade alone" baseline arm vs. a
 * "with the operative plan" arm.
 *
 * Both arms start from the preoperative Cox model's own 12- and 36-month risks,
 * so the baseline arm matches the Predictions tab. The plan changes them only
 * through the positive-margin rate: the model-recommended NS grade's row of
 * NSG_DATA gives the margin rate and BCR with / without a margin, plan choices
 * nudge the margin rate (hydrodissection lowers it, obliterated planes raise
 * it), and each arm's risk is the Cox risk scaled by its blended BCR relative
 * to the unmodified row.
 *
 * An NS-grade override does not move BCR: the NSG_DATA rows differ by case mix
 * (wider planes were chosen for worse cancers), so comparing rows would read a
 * confounded difference as the effect of the plane.
 *
 * The inflammation tier is a patient property and is applied to BOTH arms, so
 * the baseline↔plan delta reflects only the surgical decisions.
 */
import { PSM_PLAN_MODULATION } from "@/lib/compass/planningEvidence";
import { NSG_DATA, nsgGrade } from "@/lib/compass/nsgOutcomes";
import type { InflammationTier } from "@/lib/compass/inflammationRisk";
import { clamp } from "@/lib/utils/math";

export interface BcrArm {
  nsGrade: number;
  hydrodissection: boolean;
  inflammationTier: InflammationTier;
}

export interface BcrArmResult {
  psmRate: number;
  y1: number;
  y3: number;
}

export interface BcrByPlan {
  baseline: BcrArmResult;
  withPlan: BcrArmResult;
}

export function bcrByPlan(
  cox: { bcr12: number; bcr36: number },
  baseline: BcrArm,
  withPlan: BcrArm,
): BcrByPlan {
  const mod = PSM_PLAN_MODULATION.value;
  const row = NSG_DATA[nsgGrade(baseline.nsGrade)];
  const blended = (psm: number) => psm * (row.bcr_psm / 100) + (1 - psm) * (row.bcr_no / 100);
  const reference = blended(row.psm / 100);

  const arm = (a: BcrArm): BcrArmResult => {
    let psmRate = row.psm / 100;
    if (a.hydrodissection) psmRate += mod.hydrodissection;
    if (a.inflammationTier === "moderate") psmRate += mod.inflammation_moderate;
    if (a.inflammationTier === "high") psmRate += mod.inflammation_high;
    psmRate = clamp(psmRate, 0.03, 0.6);

    const factor = reference > 0 ? blended(psmRate) / reference : 1;
    return {
      psmRate,
      y1: clamp(cox.bcr12 * factor, 0, 1),
      y3: clamp(cox.bcr36 * factor, 0, 1),
    };
  };

  return {
    baseline: arm(baseline),
    withPlan: arm(withPlan),
  };
}
