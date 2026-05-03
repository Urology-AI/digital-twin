import type { ClinicalState } from "@/types/patient";
import { sigmoid } from "@/lib/utils/math";

/** Grade Upgrade model — Option A locked 2026-05-03 (N=3,137, CV AUC 0.807) */
const UPGRADE = {
  i: -3.2302,
  // psad, gg(continuous), cores, maxcore, linear_mm, pct45, cribriform_bx,
  // pni_bx, bilateral, pirads, mri_svi, mus_ece, suv, psma_epe
  // Note: gg has large negative beta — GG1 patients have most upgrade headroom
  c: [
    0.1976, -1.4920, -0.1070, -0.0032, 0.0151, 0.0272, 0.0418, -0.0814,
    0.0223, 0.2587, 0.1484, -0.2267, 0.0272, 0.0504,
  ],
  m: [
    0.3149, 2.7446, 6.1862, 15.5193, 8.5496, 0.2437, 0.0132, 0.0362, 0.4679,
    4.0791, 0.0428, 0.1087, 16.6291, 0.0264,
  ],
  s: [
    1.7167, 1.1419, 4.2345, 27.8063, 11.625, 0.331, 0.114, 0.1869, 0.499,
    0.8516, 0.2025, 0.3113, 36.1101, 0.1602,
  ],
} as const;

export function predictUpgrade(S: ClinicalState): number {
  if (S.gg < 1) return 0.05;
  const vals = [
    S.psad,
    S.gg,
    S.cores,
    S.maxcore,
    S.linear_mm,
    S.pct45,
    S.cribriform_bx,
    S.pni_bx,
    S.bilateral,
    Math.max(S.pirads, 2),
    S.mri_svi,
    S.mus_ece,
    S.suv,
    S.psma_epe,
  ];
  let L = UPGRADE.i;
  for (let k = 0; k < vals.length; k++) {
    const v = vals[k];
    const sk = UPGRADE.s[k] ?? 0;
    if (v != null && !Number.isNaN(v) && sk > 0) {
      L += (UPGRADE.c[k] ?? 0) * ((v - (UPGRADE.m[k] ?? 0)) / sk);
    }
  }
  return sigmoid(L);
}
