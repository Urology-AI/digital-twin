import type { ClinicalState } from "@/types/patient";
import { logPsad, normalizeMaxCorePct, sigmoid } from "@/lib/utils/math";
import {
  imagingFlagsForSide,
  type CollectedLesion,
} from "@/lib/utils/normalization";
import {
  SVI_PATIENT as SVI_PATIENT_W,
  SVI_SIDE as SVI_SIDE_W,
  weightsToArrays,
} from "./weights";

const SVI_SIDE          = weightsToArrays(SVI_SIDE_W);
const SVI_PATIENT_W_ARRAYS = weightsToArrays(SVI_PATIENT_W);

function linearPredict(
  intercept: number,
  coeffs: readonly number[],
  means: readonly number[],
  scales: readonly number[],
  values: number[],
): number {
  let L = intercept;
  for (let k = 0; k < values.length; k++) {
    const v = values[k];
    const sk = scales[k] ?? 0;
    if (v != null && !Number.isNaN(v) && sk > 0) {
      L += (coeffs[k] ?? 0) * ((v - (means[k] ?? 0)) / sk);
    }
  }
  return L;
}

/**
 * MUS ECE logit delta for patient-level SVI.
 * mus_ece is absent from the trained SVI patient model feature set.
 * Coefficient ESTIMATED from the side-specific SVI model analogy;
 * NOT formally calibrated from training data.
 */
function musEceSviDelta(S: ClinicalState): number {
  if (S.mus_ece === 1) return 0.25;
  return 0;
}

/**
 * Patient-level SVI — locked 2026-05-03, 22-feature binary-GG model.
 * Features: log_psad, gg2, gg3, gg4_5, mc, pirads, mri_epe, mri_svi,
 *           mus_ece, psma_epe, dec_imp, dec_avail, pos_cores
 */
export function predictSviPatient(S: ClinicalState): number {
  const log_psad = logPsad(S.psa, S.vol);
  const gg2 = S.gg === 2 ? 1 : 0;
  const gg3 = S.gg === 3 ? 1 : 0;
  const gg45 = S.gg >= 4 ? 1 : 0;
  const dec_imp = S.dec !== null && S.dec >= 0 ? S.dec : 0.521;
  const dec_avail = S.dec !== null && S.dec >= 0 ? 1 : 0;
  const vals = [
    log_psad,
    gg2,
    gg3,
    gg45,
    normalizeMaxCorePct(S.maxcore),
    Math.max(S.pirads, 2),
    S.mri_epe,
    S.mri_svi,
    S.mus_ece,
    S.psma_epe,
    dec_imp,
    dec_avail,
    S.cores,
  ];
  const { i, c, m, s } = SVI_PATIENT_W_ARRAYS;
  return sigmoid(linearPredict(i, c, m, s, vals));
}

export function predictSviSide(
  S: ClinicalState,
  side: "left" | "right",
  lesions: CollectedLesion[],
  recordLesions: CollectedLesion[],
): number {
  const log_psad = logPsad(S.psa, S.vol);
  const gg_side =
    side === "left"
      ? S.gg_left !== undefined && S.gg_left !== null
        ? S.gg_left
        : S.gg
      : S.gg_right !== undefined && S.gg_right !== null
        ? S.gg_right
        : S.gg;
  const cores_side =
    side === "left"
      ? S.cores_left !== undefined && S.cores_left !== null
        ? S.cores_left
        : Math.round(S.cores / 2)
      : S.cores_right !== undefined && S.cores_right !== null
        ? S.cores_right
        : Math.round(S.cores / 2);
  let mc_side =
    side === "left"
      ? S.mc_left !== undefined && S.mc_left !== null
        ? S.mc_left
        : S.maxcore
      : S.mc_right !== undefined && S.mc_right !== null
        ? S.mc_right
        : S.maxcore;
  mc_side = normalizeMaxCorePct(mc_side);
  const linear_side =
    side === "left"
      ? S.linear_left !== undefined && S.linear_left !== null
        ? S.linear_left
        : S.linear_mm
      : S.linear_right !== undefined && S.linear_right !== null
        ? S.linear_right
        : S.linear_mm;

  const targetSide = side === "left" ? "L" : "R";
  let { mriOnSide, musOnSide } = imagingFlagsForSide(recordLesions, side);
  const merged = [...lesions, ...recordLesions];
  for (const l of merged) {
    if (l.side !== targetSide) continue;
    if (l.source === "MRI") mriOnSide = true;
    if (l.source === "MUS") musOnSide = true;
  }

  const pirads_side = mriOnSide
    ? Math.max(S.pirads, 2)
    : Math.max(S.pirads - 2, 2);
  const mri_epe_side = mriOnSide ? (S.mri_epe || 0) : 0;
  const mri_svi_side = mriOnSide ? (S.mri_svi || 0) : 0;
  const mus_ece_side = musOnSide ? (S.mus_ece || 0) : 0;

  const vals = [
    log_psad,
    gg_side,
    mc_side,
    cores_side,
    linear_side,
    S.bilateral,
    pirads_side,
    mri_epe_side,
    mri_svi_side,
    mus_ece_side,
  ];
  const L = linearPredict(
    SVI_SIDE.i,
    SVI_SIDE.c,
    SVI_SIDE.m,
    SVI_SIDE.s,
    vals,
  );
  return sigmoid(L);
}
