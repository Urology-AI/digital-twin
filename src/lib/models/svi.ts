import type { ClinicalState } from "@/types/patient";
import { logPsad, normalizeMaxCorePct, sigmoid } from "@/lib/utils/math";
import {
  imagingFlagsForSide,
  type CollectedLesion,
} from "@/lib/utils/normalization";

/** Side-specific SVI */
const SVI_SIDE = {
  i: -3.024,
  c: [
    0.4152, 0.1374, 0.4236, 0.3567, 0.0038, 0.0659, 0.1108, 0.0585, 0.0572,
    0.2541,
  ],
  m: [
    -1.634, 2.2902, 48.1988, 1.4226, 8.002, 0.2619, 2.9368, 0.0439, 0.0119,
    0.0476,
  ],
  s: [
    0.6788, 1.83, 33.8968, 1.8528, 12.0413, 0.4397, 1.0154, 0.2049, 0.1085,
    0.213,
  ],
} as const;

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
 * Patient-level SVI — retrained 9-feature model (hardcoded in original HTML).
 */
export function predictSviPatient(S: ClinicalState): number {
  const log_psad = logPsad(S.psa, S.vol);
  const dec_imp = S.dec !== null && S.dec >= 0 ? S.dec : 0.521;
  const dec_avail = S.dec !== null && S.dec >= 0 ? 1 : 0;
  const vals = [
    log_psad,
    S.gg,
    normalizeMaxCorePct(S.maxcore),
    S.cores,
    Math.max(S.pirads, 2),
    S.mri_epe,
    S.mri_svi,
    dec_imp,
    dec_avail,
  ];
  const c = [
    0.3162, 0.4338, 0.4802, 0.1082, 0.4769, -0.0755, 0.5875, 0.0879, 0.3971,
  ];
  const m = [
    -1.7887, 2.6698, 58.0121, 6.4766, 4.1544, 0.1654, 0.0474, 0.5418, 0.3302,
  ];
  const s = [
    0.7566, 1.1132, 28.3631, 3.8708, 0.7011, 0.4198, 0.2125, 0.1498, 0.4703,
  ];
  let L = linearPredict(-3.189665, c, m, s, vals);
  L += musEceSviDelta(S);
  return sigmoid(L);
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
