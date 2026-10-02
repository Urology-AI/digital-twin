import type { ClinicalState } from "@/types/patient";
// COMPAT SHIM (Phase 1A): see inputContract.ts. Each v22Absent() call passes
// the exact in-band value the field held when absent pre-Phase-1A, so model
// outputs are bit-identical. Phases 2–7 replace these with vNext imputation.
import { v22Absent } from "./inputContract";
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
    normalizeMaxCorePct(v22Absent(S.maxcore, 0)),
    v22Absent(S.cores, 0),
    Math.max(v22Absent(S.pirads, 2), 2),
    v22Absent(S.mri_epe, 0),
    v22Absent(S.mri_svi, 0),
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
