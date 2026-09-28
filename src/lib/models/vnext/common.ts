/**
 * Shared arithmetic for the vNext model locks.
 *
 * Every vNext logistic endpoint is:
 *   z_k   = (x_k - mean_k) / scale_k        x_k = observed value, or the frozen
 *                                           training imputation mean if missing
 *   logit = intercept + sum(coef_k * z_k)
 *   p     = 1 / (1 + exp(-logit))
 * No clamping, no extra logit terms.
 */
import type { OptionalPredictor } from "@/types/patient";
import { isObserved } from "@/lib/models/inputContract";

export interface LockedFeature {
  readonly name: string;
  readonly coef: number;
  /** Frozen training-set value substituted when the input is missing. */
  readonly impute: number;
  readonly mean: number;
  readonly scale: number;
}

/** vNext PSA density transform: ln(PSA / volume). No +0.01 offset. */
export function vnextLogPsad(psa: number, vol: number): number {
  return Math.log(psa / vol);
}

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Linear predictor over a locked feature list. `values` maps feature name to
 * the observed value, or null when not performed / not recorded. Returns the
 * logit plus the names of the features that were imputed, so the UI can say
 * which parts of a prediction rest on cohort averages.
 */
export function lockedLinearPredictor(
  intercept: number,
  features: readonly LockedFeature[],
  values: Record<string, OptionalPredictor>,
): { logit: number; imputed: string[] } {
  let logit = intercept;
  const imputed: string[] = [];
  for (const f of features) {
    const v = values[f.name];
    let x: number;
    if (v === undefined) {
      throw new Error(`vNext: no value supplied for feature "${f.name}"`);
    } else if (isObserved(v)) {
      x = v;
    } else {
      x = f.impute;
      imputed.push(f.name);
    }
    logit += f.coef * ((x - f.mean) / f.scale);
  }
  return { logit, imputed };
}

/** Tier index is 1-based. cutoffs ascending; a value equal to a cutoff goes up. */
export function assignTier(
  p: number,
  cutoffs: readonly number[],
  labels: readonly string[],
): { index: number; label: string } {
  let i = 0;
  while (i < cutoffs.length && p >= cutoffs[i]!) i++;
  return { index: i + 1, label: labels[i]! };
}
