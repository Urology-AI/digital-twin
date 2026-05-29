import type { ClinicalState } from "@/types/patient";
import { logPsad, normalizeMaxCorePct, sigmoid } from "@/lib/utils/math";
import { PSM as PSM_W, weightsToArrays } from "./weights";

const PSM = weightsToArrays(PSM_W);

export function predictPsm(S: ClinicalState): number {
  const log_psad = logPsad(S.psa, S.vol);
  const gg2 = S.gg === 2 ? 1 : 0;
  const gg3 = S.gg === 3 ? 1 : 0;
  const gg45 = S.gg >= 4 ? 1 : 0;
  const vals = [
    log_psad,
    gg2,
    gg3,
    gg45,
    normalizeMaxCorePct(S.maxcore),
    S.cores,
    Math.max(S.pirads, 2),
    S.mri_epe,
    S.mri_svi,
    S.bilateral,
  ];
  let L = PSM.i;
  for (let k = 0; k < vals.length; k++) {
    const v = vals[k];
    const sk = PSM.s[k] ?? 0;
    if (v != null && !Number.isNaN(v) && sk > 0) {
      L += (PSM.c[k] ?? 0) * ((v - (PSM.m[k] ?? 0)) / sk);
    }
  }
  return sigmoid(L);
}
