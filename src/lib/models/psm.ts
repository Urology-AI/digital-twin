import type { ClinicalState } from "@/types/patient";
import { logPsad, normalizeMaxCorePct, sigmoid } from "@/lib/utils/math";

/** PSM model — locked 2026-05-03 (N=3,454, CV AUC 0.651 — literature ceiling) */
const PSM = {
  i: -1.251,
  // log_psad, gg2, gg3, gg45, max_core_pct, cores, pirads, mri_epe, mri_svi, bilateral
  c: [0.2844, 0.1812, 0.1188, 0.0400, 0.0109, 0.0521, 0.0099, -0.0287, 0.0542, 0.1002],
  m: [
    -1.6137, 0.398, 0.2566, 0.2418, 50.7988, 6.1908, 4.0773, 0.1497, 0.0428,
    0.4671,
  ],
  s: [
    0.709, 0.4895, 0.4367, 0.4282, 32.3931, 4.2325, 0.852, 0.3567, 0.2023,
    0.4989,
  ],
} as const;

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
