import type { ClinicalState } from "@/types/patient";
import { logPsad, sigmoid } from "@/lib/utils/math";

/**
 * LNI parsimonious 4-feature model — locked 2026-05-03
 * Features: log_psad, gg_high (GG4-5 binary), pos_cores, psma_ln_pos
 * Verified CV AUC 0.842 (N=663, 35 events). Outperforms 17-feature expansion.
 */
const LNI_PLND = {
  i: -3.2892,
  // log_psad, gg_high, pos_cores, psma_ln_pos
  c: [0.5623, 0.4162, 0.1260, 0.5437],
  // Approximate training means (PLND cohort N=663)
  m: [-1.6174, 0.28, 5.3, 0.15],
  // Approximate training standard deviations
  s: [0.7068, 0.45, 4.2, 0.36],
} as const;

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
