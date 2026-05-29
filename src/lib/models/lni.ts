import type { ClinicalState } from "@/types/patient";
import { logPsad, sigmoid } from "@/lib/utils/math";
import { LNI_PLND as LNI_PLND_W, weightsToArrays } from "./weights";

const LNI_PLND = weightsToArrays(LNI_PLND_W);

/** LNI model — locked 2026-05-03 */
export function predictLni(S: ClinicalState): number {
  const log_psad = logPsad(S.psa, S.vol);
  const gg_high = S.gg >= 4 ? 1 : 0;
  const pos_cores = S.cores || 0;
  const psma_ln_pos = S.psma_ln || 0;
  const vals = [log_psad, gg_high, pos_cores, psma_ln_pos];
  let L = LNI_PLND.i;
  for (let k = 0; k < vals.length; k++) {
    const v = vals[k];
    const sk = LNI_PLND.s[k] ?? 0;
    if (v != null && !Number.isNaN(v) && sk > 0) {
      L += (LNI_PLND.c[k] ?? 0) * ((v - (LNI_PLND.m[k] ?? 0)) / sk);
    }
  }
  return sigmoid(L);
}
