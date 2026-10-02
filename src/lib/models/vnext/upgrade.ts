/**
 * vNext Grade Upgrade, patient level.
 *
 * Source: COMPASS_vNext_CoreModel_Lock.json, version
 * vNext-core-candidate-2026-09-24, file SHA-256
 * be53aba453b2595cbb3e15a640d5017667beb41650425137e8b2334756127bd8.
 * Status: provisionally frozen pending external validation. Research use only.
 *
 * Standardized L2 logistic regression (C = 1). N = 3,137, 422 events.
 * Repeated OOF AUC 0.8121; 2024-25 temporal AUC 0.8226.
 *
 * Applies only to biopsy Grade Group 1-4. GG5 has no higher grade to upgrade
 * to, so the endpoint is "not applicable" and no probability is produced.
 * Inputs: grade group, PSA density, PI-RADS, MRI SVI, positive cores, ADC mean.
 * Eight features because grade group is dummy coded (gg4_5 means GG4 only here).
 * Decipher, ExactVu, PSMA, max core %, cancer length, pattern 4/5, cribriform,
 * PNI and bilateral disease are not inputs.
 */
import type { ClinicalState } from "@/types/patient";
import {
  validateVNextRequiredInputs,
  type RequiredInputProblem,
} from "@/lib/models/inputContract";
import {
  assignTier,
  lockedLinearPredictor,
  sigmoid,
  vnextLogPsad,
  type LockedFeature,
} from "./common";

export const UPGRADE_VNEXT_VERSION = "vNext-core-candidate-2026-09-24";

const INTERCEPT = -2.3283115453187424;

const FEATURES: readonly LockedFeature[] = [
  { name: "gg2", coef: -1.4239577460630854, impute: 0.46860057379662096, mean: 0.46860057379662096, scale: 0.4990131020665742 },
  { name: "gg3", coef: -1.514035382540398, impute: 0.25533949633407715, mean: 0.25533949633407715, scale: 0.436051875292302 },
  { name: "gg4_5", coef: -1.0142314840348838, impute: 0.14376793114440548, mean: 0.14376793114440548, scale: 0.3508542619363007 },
  { name: "log_psad", coef: 0.2442440897283199, impute: -1.8038339982542708, mean: -1.8038339982542708, scale: 0.7765152122721909 },
  { name: "pirads", coef: 0.31710950088764145, impute: 4.160694896851249, mean: 4.160694896851229, scale: 0.6522689038420854 },
  { name: "mri_svi_clean", coef: 0.19081823520422225, impute: 0.042134831460674156, mean: 0.04213483146067408, scale: 0.1914192252723432 },
  { name: "pos_cores", coef: -0.2493104439085748, impute: 5.912695234281137, mean: 5.912695234281165, scale: 3.310177289599353 },
  { name: "adc_mean", coef: -0.14118003867748435, impute: 785.186848436247, mean: 785.1868484362296, scale: 125.60662805971859 },
];

export const UPGRADE_TIER_CUTOFFS = [0.05, 0.2] as const;
export const UPGRADE_TIER_LABELS = ["Low", "Intermediate", "High"] as const;

export type UpgradeVNextResult =
  | {
      ok: true;
      applicable: true;
      probability: number;
      tier: { index: number; label: string };
      imputed: string[];
    }
  | { ok: true; applicable: false; reason: "gg5" }
  | { ok: false; problems: RequiredInputProblem[] };

export function predictUpgradeVNext(S: ClinicalState): UpgradeVNextResult {
  const valid = validateVNextRequiredInputs(S);
  if (!valid.ok) return valid;
  if (S.gg >= 5) return { ok: true, applicable: false, reason: "gg5" };

  const { logit, imputed } = lockedLinearPredictor(INTERCEPT, FEATURES, {
    gg2: S.gg === 2 ? 1 : 0,
    gg3: S.gg === 3 ? 1 : 0,
    gg4_5: S.gg === 4 ? 1 : 0,
    log_psad: vnextLogPsad(S.psa, S.vol),
    pirads: S.pirads,
    mri_svi_clean: S.mri_svi,
    pos_cores: S.cores,
    adc_mean: S.mri_adc,
  });
  const probability = sigmoid(logit);
  return {
    ok: true,
    applicable: true,
    probability,
    tier: assignTier(probability, UPGRADE_TIER_CUTOFFS, UPGRADE_TIER_LABELS),
    imputed,
  };
}
