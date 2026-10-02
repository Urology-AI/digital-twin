/**
 * vNext side-specific SVI (left / right seminal vesicle).
 *
 * Source: COMPASS_vNext_SVI_Side_Shadow_ModelLock_2026-10-01.json, version
 * vNext-svi-side-shadow-candidate-2026-10-01, canonical SHA-256
 * 8c6462af6d2dcec2368e3f622b541b820c623cd09e0ce3e54b47cb426c65d137.
 * Status: SHADOW RESEARCH CANDIDATE. A localization / ranking signal, not a
 * validated absolute left/right probability. 664 patients, 1,328 sides, 92
 * side-SVI events; grouped-CV AUC 0.8415 (global logit alone 0.8350).
 *
 * Two inputs: the frozen global vNext SVI logit and the biopsy grade group on
 * that side (same rule as side EPE). A missing side grade takes the training
 * mean and is never coded 0 from a blank field. No clamps.
 */
import type { OptionalPredictor } from "@/types/patient";
import { lockedLinearPredictor, sigmoid, type LockedFeature } from "./common";

export const SVI_SIDE_VERSION = "vNext-svi-side-shadow-candidate-2026-10-01";

const INTERCEPT = -3.193339392651105;

const FEATURES: readonly LockedFeature[] = [
  { name: "global_svi_logit", coef: 1.2463490061038853, impute: -2.901396321908463, mean: -2.901396321908463, scale: 1.4337563120783088 },
  { name: "side_biopsy_gg", coef: 0.17613883933319469, impute: 1.8406193078324227, mean: 1.8406193078324224, scale: 1.8854844178919803 },
];

/** Locked equation on already-resolved inputs. */
export function sviSideFromInputs(inputs: {
  globalLogit: number;
  sideBiopsyGg: OptionalPredictor;
}) {
  const { logit, imputed } = lockedLinearPredictor(INTERCEPT, FEATURES, {
    global_svi_logit: inputs.globalLogit,
    side_biopsy_gg: inputs.sideBiopsyGg,
  });
  return { probability: sigmoid(logit), logit, imputed };
}
