import type { ClinicalState } from "@/types/patient";
import { sigmoid } from "@/lib/utils/math";
import { UPGRADE as UPGRADE_W, weightsToArrays } from "./weights";

const UPGRADE = weightsToArrays(UPGRADE_W);

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
