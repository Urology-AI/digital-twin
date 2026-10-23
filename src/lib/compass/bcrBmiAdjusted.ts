/**
 * Literature BMI overlay on the preop Cox BCR risk. The Cox model has no BMI
 * term, so this is shown separately from — never in place of — its output.
 *
 * Proportional hazards: risk' = 1 − (1 − risk)^HR, with
 * HR = RR^((BMI − reference) / 5) from BMI_BCR_HAZARD.
 */
import { BMI_BCR_HAZARD } from "@/lib/compass/planningEvidence";

/** NaN when the risk or BMI is missing. */
export function bmiAdjustedBcr(risk: number, bmi: number): number {
  if (!Number.isFinite(risk) || !(bmi > 0)) return NaN;
  const { rrPer5, referenceBmi } = BMI_BCR_HAZARD.value;
  const hr = Math.pow(rrPer5, (bmi - referenceBmi) / 5);
  return 1 - Math.pow(1 - risk, hr);
}
