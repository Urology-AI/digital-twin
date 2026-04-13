import type { ClinicalState } from "@/types/patient";
import { logPsad, normalizeMaxCorePct, sigmoid } from "@/lib/utils/math";

const PSM = {
  i: -1.251,
  c: [0.2791, 0.0866, 0.0445, -0.058, 0.1216, -0.0168, 0.12, -0.0341, -0.0429, 0.3391],
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
