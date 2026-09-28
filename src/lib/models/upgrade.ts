import type { ClinicalState } from "@/types/patient";
// COMPAT SHIM (Phase 1A): see inputContract.ts. Each v22Absent() call passes
// the exact in-band value the field held when absent pre-Phase-1A, so model
// outputs are bit-identical. Phases 2–7 replace these with vNext imputation.
import { v22Absent } from "./inputContract";
import { sigmoid } from "@/lib/utils/math";
import { UPGRADE as UPGRADE_W, weightsToArrays } from "./weights";

const UPGRADE = weightsToArrays(UPGRADE_W);

export function predictUpgrade(S: ClinicalState): number {
  if (S.gg < 1) return 0.05;
  const vals = [
    S.psad,
    S.gg,
    v22Absent(S.cores, 0),
    v22Absent(S.maxcore, 0),
    S.linear_mm,
    S.pct45,
    S.cribriform_bx,
    S.pni_bx,
    S.bilateral,
    Math.max(v22Absent(S.pirads, 2), 2),
    v22Absent(S.mri_svi, 0),
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
