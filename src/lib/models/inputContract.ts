/**
 * vNext input contract — Phase 1A.
 *
 * This module owns one question: what does it mean for a clinical predictor to
 * be absent? It contains no model mathematics. The shared mathematical helpers
 * (PSAD, z-scoring, imputation resolution, tiering, Cox horizon risk) arrive in
 * Phase 1B.
 *
 * Two rules:
 *
 *   1. PSA, prostate volume and biopsy grade group are REQUIRED. PSA and volume
 *      must both be > 0 so that `ln(PSA / volume)` is defined. If any is absent
 *      or invalid, vNext endpoint execution is blocked and the caller gets an
 *      explicit validation state. We do not invent a PSAD and we do not
 *      substitute an average PSAD, because that would hand a clinician a
 *      confident-looking probability for a patient whose PSA density cannot be
 *      computed at all.
 *
 *   2. Every other predictor is optional and tri-state. `null` means not
 *      performed or not recorded. `0` means performed and negative. The vNext
 *      locks substitute a frozen per-endpoint training imputation mean for
 *      `null`, and that mean is never 0, so collapsing the two states changes
 *      the answer. Worked example from the Phase 0 audit: a GG2 patient with no
 *      MRI reads 3.37% ECE if absence is treated as 0 and 17.37% if absence is
 *      mean-imputed.
 *
 * On keeping the frozen imputation constants without defeating rule 1:
 * the constants stay recorded per endpoint in the Phase 1B parameter tables,
 * next to each feature's mean and scale, exactly as the lock JSON stores them,
 * so a retrospective run can reproduce the fitted artifact bit for bit. What
 * makes rule 1 hold is that `log_psad` is not reachable through the optional
 * path at all: it is derived from two required inputs, and
 * `validateVNextRequiredInputs` gates execution before any feature vector is
 * built. The lock's `log_psad` imputation value is therefore preserved as
 * provenance for audit and is never consulted by the runtime.
 */
import type { ClinicalState, OptionalPredictor } from "@/types/patient";

/** True when the predictor was actually observed (including an observed 0). */
export function isObserved(v: OptionalPredictor): v is number {
  return v !== null && !Number.isNaN(v);
}

/**
 * COMPAT SHIM — DELETE DURING PHASES 2–7.
 *
 * The v22 runtime cannot represent an absent predictor: it reads every optional
 * field as a plain `number` and treats absence as a fixed in-band value.
 * Phase 1A widens the types but must not change any endpoint output, so every
 * v22 model call site funnels its optional inputs through this function with
 * the literal value that field used to hold when absent. Behavior is therefore
 * bit-identical to the pre-Phase-1A runtime.
 *
 * Each vNext endpoint migration deletes its own call sites. When this function
 * has no callers left, delete it and this comment.
 *
 * Do NOT call this from new vNext code. vNext substitutes the frozen
 * per-endpoint imputation mean, which is not the same number.
 */
export function v22Absent(v: OptionalPredictor, whenAbsent: number): number {
  return isObserved(v) ? v : whenAbsent;
}

/** Which required input failed, and why. */
export type RequiredInputProblem =
  | "psa_missing"
  | "psa_not_positive"
  | "volume_missing"
  | "volume_not_positive"
  | "grade_group_missing"
  | "grade_group_out_of_range"
  | "imaging_status_conflict";

export type VNextInputValidation =
  | { ok: true }
  | { ok: false; problems: RequiredInputProblem[] };

function finitePositive(v: unknown): boolean {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

/**
 * Gate for the vNext oncologic endpoints (ECE, SVI, Upgrade, LNI, PSM, BCR).
 *
 * Phase 1A builds and tests this gate but deliberately does not wire it into
 * `runCompass`, because doing so would change what the existing v22 UI renders,
 * which Phase 1A is not permitted to do. The vNext runtime consumes it from
 * Phase 1B onward.
 */
export function validateVNextRequiredInputs(
  S: Pick<ClinicalState, "psa" | "vol" | "gg"> &
    Partial<Pick<ClinicalState, "required_present" | "imaging_conflicts">>,
): VNextInputValidation {
  const problems: RequiredInputProblem[] = [];
  // Absent when the source record omitted it, even though a historical default
  // still sits in the numeric field for the v22 runtime.
  const present = S.required_present ?? { psa: true, vol: true, gg: true };

  if (!present.psa || S.psa === null || Number.isNaN(S.psa))
    problems.push("psa_missing");
  else if (!finitePositive(S.psa)) problems.push("psa_not_positive");

  if (!present.vol || S.vol === null || Number.isNaN(S.vol))
    problems.push("volume_missing");
  else if (!finitePositive(S.vol)) problems.push("volume_not_positive");

  if (!present.gg || S.gg === null || Number.isNaN(S.gg))
    problems.push("grade_group_missing");
  else if (!Number.isInteger(S.gg) || S.gg < 1 || S.gg > 5)
    problems.push("grade_group_out_of_range");

  if (S.imaging_conflicts && S.imaging_conflicts.length > 0)
    problems.push("imaging_status_conflict");

  return problems.length === 0 ? { ok: true } : { ok: false, problems };
}

/** Human-readable reason per problem, for the validation surface in the UI. */
export const REQUIRED_INPUT_MESSAGES: Record<RequiredInputProblem, string> = {
  psa_missing: "PSA is required and was not recorded.",
  psa_not_positive: "PSA must be greater than 0.",
  volume_missing: "Prostate volume is required and was not recorded.",
  volume_not_positive: "Prostate volume must be greater than 0.",
  grade_group_missing: "Biopsy grade group is required and was not recorded.",
  grade_group_out_of_range: "Biopsy grade group must be an integer from 1 to 5.",
  imaging_status_conflict:
    "An imaging study is marked not performed but has findings recorded. Correct one or the other.",
};
