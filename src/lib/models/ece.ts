import type { ClinicalState } from "@/types/patient";
import { clamp, logPsad, normalizeMaxCorePct, sigmoid } from "@/lib/utils/math";
import {
  imagingFlagsForSide,
  type CollectedLesion,
} from "@/lib/utils/normalization";
import {
  ECE_PATIENT as ECE_PATIENT_W,
  ECE_SIDE as ECE_SIDE_W,
  EXTENSIVE_ECE as EXTENSIVE_ECE_W,
  weightsToArrays,
} from "./weights";

const ECE_PATIENT    = weightsToArrays(ECE_PATIENT_W);
const ECE_SIDE       = weightsToArrays(ECE_SIDE_W);
const EXTENSIVE_ECE  = weightsToArrays(EXTENSIVE_ECE_W);

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

function mriDetailLogitDelta(S: ClinicalState): number {
  let d = 0;
  if (S.mri_size > 0) d += 0.636 * (S.mri_size - 1.37);
  if (S.mri_abutment >= 0) d += 0.171 * (S.mri_abutment - 1.75);
  if (S.mri_adc > 0) d += -0.00023 * (S.mri_adc - 767);
  if (S.mri_abutment >= 3 && !S.mri_epe) d += 0.35;
  return d;
}

/**
 * ExactVu (micro-US) abutment logit delta.
 * ev_abutment is binary (0 = No, 1 = Yes) per ExactVu data scale.
 * Coefficient is ESTIMATED (analogous to MRI grade-3 abutment bonus);
 * NOT formally calibrated — no pathological ECE outcome data available.
 */
function musDetailLogitDelta(S: ClinicalState): number {
  if (S.ev_abutment === 1) return 0.30;
  return 0;
}

/**
 * PSMA SUV logit delta for ECE.
 * Only applied when PSMA is available, SUV > 0, and psma_epe flag is NOT
 * already set (to avoid double-counting the strong binary EPE term).
 * Calibrated: each SUV unit above 4.5 adds ~0.038 logit (OR ≈1.04/unit).
 * Capped at 0.60 (~SUV 20+).
 */
function psmaDetailLogitDelta(S: ClinicalState): number {
  if (!S.psma_avail || !S.suv || S.suv <= 0 || S.psma_epe) return 0;
  return Math.min(0.60, Math.max(0, 0.038 * (S.suv - 4.5)));
}

export function predictEcePatient(S: ClinicalState): number {
  const log_psad = logPsad(S.psa, S.vol);
  const mc = normalizeMaxCorePct(S.maxcore);
  const gg2 = S.gg === 2 ? 1 : 0;
  const gg3 = S.gg === 3 ? 1 : 0;
  const gg45 = S.gg >= 4 ? 1 : 0;
  const ece_conc =
    (S.mri_epe || 0) + (S.mus_ece || 0) + (S.psma_epe || 0);
  const dec_imp = S.dec !== null && S.dec >= 0 ? S.dec : 0.521;
  const dec_avail = S.dec !== null && S.dec >= 0 ? 1 : 0;
  const vals = [
    log_psad,
    gg2,
    gg3,
    gg45,
    mc,
    Math.max(S.pirads, 2),
    S.mri_epe,
    S.mri_svi,
    S.mus_ece,
    S.psma_epe,
    ece_conc,
    dec_imp,
    dec_avail,
  ];
  let L = linearPredict(
    ECE_PATIENT.i,
    ECE_PATIENT.c,
    ECE_PATIENT.m,
    ECE_PATIENT.s,
    vals,
  );
  L += mriDetailLogitDelta(S);
  L += musDetailLogitDelta(S);
  L += psmaDetailLogitDelta(S);
  return sigmoid(L);
}

export function predictEceSide(
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
  const gg2 = gg_side === 2 ? 1 : 0;
  const gg3 = gg_side === 3 ? 1 : 0;
  const gg45 = gg_side >= 4 ? 1 : 0;

  const targetSide = side === "left" ? "L" : "R";
  let { mriOnSide, musOnSide, psmaOnSide } = imagingFlagsForSide(
    recordLesions,
    side,
  );
  const merged = [...lesions, ...recordLesions];
  for (const l of merged) {
    if (l.side !== targetSide) continue;
    if (l.source === "MRI") mriOnSide = true;
    if (l.source === "MUS") musOnSide = true;
    if (l.source === "PSMA") psmaOnSide = true;
  }

  const pirads_side = mriOnSide ? Math.max(S.pirads, 2) : 2;
  const mri_epe_side = mriOnSide ? (S.mri_epe || 0) : 0;
  const mus_ece_side = musOnSide ? (S.mus_ece || 0) : 0;
  const psma_epe_side = psmaOnSide ? (S.psma_epe || 0) : 0;
  const ece_conc_side = mri_epe_side + mus_ece_side + psma_epe_side;
  const imaging_ipsi = mriOnSide || musOnSide || psmaOnSide ? 1 : 0;

  const vals = [
    log_psad,
    gg2,
    gg3,
    gg45,
    mc_side,
    cores_side,
    pirads_side,
    mri_epe_side,
    mus_ece_side,
    ece_conc_side,
    S.mri_svi,
    imaging_ipsi,
  ];
  let L = linearPredict(
    ECE_SIDE.i,
    ECE_SIDE.c,
    ECE_SIDE.m,
    ECE_SIDE.s,
    vals,
  );
  L += mriDetailLogitDelta(S);
  L += musDetailLogitDelta(S);
  L += psmaDetailLogitDelta(S);
  return sigmoid(L);
}

export function predictExtensiveEce(S: ClinicalState): number {
  const log_psad = logPsad(S.psa, S.vol);
  const mc = normalizeMaxCorePct(S.maxcore);
  const vals = [
    log_psad,
    S.gg,
    mc,
    S.cores,
    S.linear_mm,
    S.bilateral,
    Math.max(S.pirads, 2),
    S.mri_epe,
    S.mri_svi,
    S.mus_ece,
  ];
  const L = linearPredict(
    EXTENSIVE_ECE.i,
    EXTENSIVE_ECE.c,
    EXTENSIVE_ECE.m,
    EXTENSIVE_ECE.s,
    vals,
  );
  return sigmoid(L);
}

export function clampEcePatient(p: number): number {
  return clamp(p, 0.02, 0.92);
}

export function clampEceSide(p: number): number {
  return clamp(p, 0.02, 0.9);
}
