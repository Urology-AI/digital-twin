import type { ClinicalState } from "@/types/patient";
import { logPsad, sigmoid } from "@/lib/utils/math";
import { BCR_PREOP as BCR_PREOP_W, weightsToArrays } from "./weights";

const BCR_PREOP = weightsToArrays(BCR_PREOP_W);

/** Preoperative BCR — second `predBCR_preop` in original file (overrides first). */
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
  let L = BCR_PREOP.i;
  for (let k = 0; k < vals.length; k++) {
    const v = vals[k];
    const sk = BCR_PREOP.s[k] ?? 0;
    if (v != null && !Number.isNaN(v) && sk > 0) {
      L += (BCR_PREOP.c[k] ?? 0) * ((v - (BCR_PREOP.m[k] ?? 0)) / sk);
    }
  }
  return sigmoid(L);
}
