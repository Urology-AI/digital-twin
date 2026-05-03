import type { ClinicalState } from "@/types/patient";
import { logPsad, sigmoid } from "@/lib/utils/math";

/**
 * Preoperative BCR — second `predBCR_preop` in original file (overrides first).
 */
export function predictBcrPreop(S: ClinicalState): number {
  const log_psad = logPsad(S.psa, S.vol);
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
    S.cores,
    Math.max(S.pirads, 2),
    S.mri_svi,
    ece_conc,
    dec_imp,
    dec_avail,
  ];
  // Locked 2026-05-03 — CV AUC 0.743 (N=2,399). See BCR tab for salvage-censoring caveat.
  const c = [
    0.2346, 0.2256, 0.3019, 0.4495, 0.0341, 0.1757, 0.1222, 0.0843, 0.2157,
    0.4597,
  ];
  const m = [
    -1.7865, 0.4328, 0.2451, 0.2171, 6.3653, 4.1834, 0.0447, 0.1463, 0.5528,
    0.4185,
  ];
  const s = [
    0.774, 0.4955, 0.4302, 0.4123, 3.7894, 0.6965, 0.2065, 0.3868, 0.1681,
    0.4933,
  ];
  let L = -2.182256;
  for (let k = 0; k < vals.length; k++) {
    const v = vals[k];
    const sk = s[k] ?? 0;
    if (v != null && !Number.isNaN(v) && sk > 0) {
      L += (c[k] ?? 0) * ((v - (m[k] ?? 0)) / sk);
    }
  }
  return sigmoid(L);
}
