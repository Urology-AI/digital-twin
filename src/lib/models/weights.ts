/**
 * COMPASS model weights — single source of truth.
 *
 * Every model is expressed as a list of { name, coeff, mean, scale } entries
 * so the feature identity is co-located with its numbers.
 *
 * Formula per feature:  contribution = coeff * (value - mean) / scale
 * Final logit:          intercept + sum(contributions)
 * Probability:          sigmoid(logit)
 *
 * Locked: 2026-05-03  (model build v22, production 2.5.1)
 * Training cohort: Mount Sinai RARP, N=5,352  |  IRB STUDY-14-00050
 *
 * To update a model: change the numbers here only. The model *.ts files
 * derive their c/m/s arrays by calling weightsToArrays() below.
 */

export interface FeatureWeight {
  name: string;
  coeff: number;
  mean: number;
  scale: number;
}

export interface ModelWeights {
  intercept: number;
  features: readonly FeatureWeight[];
}

/** Unpack a ModelWeights into the parallel arrays used by linearPredict(). */
export function weightsToArrays(w: ModelWeights): {
  i: number;
  c: number[];
  m: number[];
  s: number[];
} {
  return {
    i: w.intercept,
    c: w.features.map((f) => f.coeff),
    m: w.features.map((f) => f.mean),
    s: w.features.map((f) => f.scale),
  };
}

// ---------------------------------------------------------------------------
// ECE — extracapsular extension
// CV AUC 0.800 | independent AUC 0.761 | N=5,352
// ---------------------------------------------------------------------------

export const ECE_PATIENT: ModelWeights = {
  intercept: -0.7423,
  features: [
    { name: "log_psad",           coeff: 0.3285, mean: -1.6174, scale: 0.7068 },
    { name: "grade_group_2",      coeff: 0.4091, mean:  0.3970, scale: 0.4893 },
    { name: "grade_group_3",      coeff: 0.4912, mean:  0.2603, scale: 0.4388 },
    { name: "grade_group_4_5",    coeff: 0.5948, mean:  0.2389, scale: 0.4264 },
    { name: "max_core_pct",       coeff: 0.2019, mean: 51.1131, scale: 32.2602 },
    { name: "pirads",             coeff: 0.3922, mean:  4.0824, scale:  0.8493 },
    { name: "mri_epe",            coeff: 0.1399, mean:  0.1499, scale:  0.3570 },
    { name: "mri_svi",            coeff: 0.2352, mean:  0.0428, scale:  0.2025 },
    { name: "mus_ece",            coeff: 0.0435, mean:  0.1071, scale:  0.3092 },
    { name: "psma_epe",           coeff: 0.0062, mean:  0.0264, scale:  0.1602 },
    { name: "ece_concordance",    coeff: 0.0400, mean:  0.2834, scale:  0.5672 },
    { name: "decipher_imputed",   coeff: 0.2133, mean:  0.6446, scale:  0.1175 },
    { name: "decipher_available", coeff: 0.4180, mean:  0.2372, scale:  0.4254 },
  ],
};

// CV AUC 0.80 | independent AUC L 0.71 / R 0.77
// Imaging features applied ipsilaterally only; contralateral side uses baseline.
export const ECE_SIDE: ModelWeights = {
  intercept: -1.6557,
  features: [
    { name: "log_psad",           coeff: 0.3800, mean: -1.6339, scale: 0.6811 },
    { name: "grade_group_2",      coeff: 0.2600, mean:  0.2645, scale: 0.4411 },
    { name: "grade_group_3",      coeff: 0.3600, mean:  0.1434, scale: 0.3505 },
    { name: "grade_group_4_5",    coeff: 0.3800, mean:  0.1285, scale: 0.3347 },
    { name: "max_core_pct_ipsi",  coeff: 0.1400, mean: 37.0968, scale: 36.2759 },
    { name: "positive_cores_ipsi",coeff: 0.1700, mean:  1.4227, scale:  1.8524 },
    { name: "pirads_ipsi",        coeff: 0.1900, mean:  2.9354, scale:  1.0145 },
    // psma_epe used as proxy for mri_epe_side in side model
    { name: "psma_epe_ipsi",      coeff: -0.020, mean:  0.0438, scale:  0.2047 },
    { name: "mus_ece_ipsi",       coeff: 0.1100, mean:  0.0483, scale:  0.2144 },
    { name: "ece_concordance_ipsi",coeff: 0.1500, mean:  0.0981, scale:  0.3191 },
    { name: "mri_svi",            coeff: 0.2000, mean:  0.0401, scale:  0.1962 },
    { name: "imaging_ipsi_any",   coeff: 0.1000, mean:  0.6018, scale:  0.4895 },
  ],
};

// Applied only when ECE is predicted positive. AUC 0.70 | N=227
// Negative coefficients on mri_epe and linear_extent reflect detection bias.
export const EXTENSIVE_ECE: ModelWeights = {
  intercept: -0.1975,
  features: [
    { name: "log_psad",     coeff:  0.3742, mean: -1.3727, scale:  0.7027 },
    { name: "grade_group",  coeff:  0.0940, mean:  3.0220, scale:  1.1124 },
    { name: "max_core_pct", coeff:  0.1132, mean: 66.4566, scale: 27.6234 },
    { name: "pos_cores",    coeff:  0.0391, mean:  7.2467, scale:  4.9687 },
    { name: "linear_extent",coeff: -0.3013, mean: 14.1211, scale: 14.6296 },
    { name: "bilateral",    coeff:  0.2486, mean:  0.2775, scale:  0.4478 },
    { name: "pirads",       coeff:  0.0412, mean:  4.3128, scale:  1.0213 },
    { name: "mri_epe",      coeff: -0.0677, mean:  0.2379, scale:  0.4258 },
    { name: "mri_svi",      coeff:  0.2421, mean:  0.1013, scale:  0.3018 },
    { name: "mus_ece",      coeff:  0.3411, mean:  0.1806, scale:  0.3847 },
  ],
};

// ---------------------------------------------------------------------------
// SVI — seminal vesicle invasion
// ---------------------------------------------------------------------------

// CV AUC 0.863 | independent AUC 0.874 | N=5,352
export const SVI_PATIENT: ModelWeights = {
  intercept: -3.189665,
  features: [
    { name: "log_psad",           coeff: 0.3139, mean: -1.6174, scale: 0.7068 },
    { name: "grade_group_2",      coeff: 0.7981, mean:  0.3970, scale: 0.4893 },
    { name: "grade_group_3",      coeff: 0.7700, mean:  0.2603, scale: 0.4388 },
    { name: "grade_group_4_5",    coeff: 0.9954, mean:  0.2389, scale: 0.4264 },
    { name: "max_core_pct",       coeff: 0.3156, mean: 51.1131, scale: 32.2602 },
    { name: "pirads",             coeff: 0.2892, mean:  4.0824, scale:  0.8493 },
    { name: "mri_epe",            coeff: 0.0614, mean:  0.1499, scale:  0.3570 },
    { name: "mri_svi",            coeff: 0.4573, mean:  0.0428, scale:  0.2025 },
    { name: "mus_ece",            coeff: 0.0924, mean:  0.1071, scale:  0.3092 },
    { name: "psma_epe",           coeff: 0.0492, mean:  0.0264, scale:  0.1602 },
    { name: "decipher_imputed",   coeff: 0.2707, mean:  0.6446, scale:  0.1175 },
    { name: "decipher_available", coeff: 0.3033, mean:  0.2372, scale:  0.4254 },
    { name: "positive_cores",     coeff: 0.0324, mean:  6.1908, scale:  4.2325 },
  ],
};

// Side-specific SVI
export const SVI_SIDE: ModelWeights = {
  intercept: -3.0240,
  features: [
    { name: "log_psad",    coeff: 0.3139, mean: -1.6340, scale: 0.6788 },
    { name: "grade_group", coeff: 0.3500, mean:  2.2902, scale: 1.8300 },
    { name: "max_core_pct_ipsi",  coeff: 0.3156, mean: 48.1988, scale: 33.8968 },
    { name: "positive_cores_ipsi",coeff: 0.0324, mean:  1.4226, scale:  1.8528 },
    { name: "linear_mm_ipsi",     coeff: 0.0400, mean:  8.0020, scale: 12.0413 },
    { name: "bilateral",          coeff: 0.1443, mean:  0.2619, scale:  0.4397 },
    { name: "pirads_ipsi",        coeff: 0.2892, mean:  2.9368, scale:  1.0154 },
    { name: "mri_epe_ipsi",       coeff: 0.0614, mean:  0.0439, scale:  0.2049 },
    { name: "mri_svi_ipsi",       coeff: 0.4573, mean:  0.0119, scale:  0.1085 },
    { name: "mus_ece_ipsi",       coeff: 0.0924, mean:  0.0476, scale:  0.2130 },
  ],
};

// ---------------------------------------------------------------------------
// Grade Upgrade (biopsy → surgical specimen)
// N=3,137 | CV AUC 0.807
// Note: gg has large negative coeff — GG1 patients have most upgrade headroom.
// ---------------------------------------------------------------------------

export const UPGRADE: ModelWeights = {
  intercept: -3.2302,
  features: [
    { name: "psad",          coeff:  0.1976, mean:  0.3149, scale:  1.7167 },
    { name: "grade_group",   coeff: -1.4920, mean:  2.7446, scale:  1.1419 },
    { name: "positive_cores",coeff: -0.1070, mean:  6.1862, scale:  4.2345 },
    { name: "max_core_pct",  coeff: -0.0032, mean: 15.5193, scale: 27.8063 },
    { name: "linear_mm",     coeff:  0.0151, mean:  8.5496, scale: 11.6250 },
    { name: "pct45",         coeff:  0.0272, mean:  0.2437, scale:  0.3310 },
    { name: "cribriform_bx", coeff:  0.0418, mean:  0.0132, scale:  0.1140 },
    { name: "pni_bx",        coeff: -0.0814, mean:  0.0362, scale:  0.1869 },
    { name: "bilateral",     coeff:  0.0223, mean:  0.4679, scale:  0.4990 },
    { name: "pirads",        coeff:  0.2587, mean:  4.0791, scale:  0.8516 },
    { name: "mri_svi",       coeff:  0.1484, mean:  0.0428, scale:  0.2025 },
    { name: "mus_ece",       coeff: -0.2267, mean:  0.1087, scale:  0.3113 },
    { name: "suv",           coeff:  0.0272, mean: 16.6291, scale: 36.1101 },
    { name: "psma_epe",      coeff:  0.0504, mean:  0.0264, scale:  0.1602 },
  ],
};

// ---------------------------------------------------------------------------
// PSM — positive surgical margin
// N=3,454 | CV AUC 0.651 (literature ceiling for this endpoint)
// ---------------------------------------------------------------------------

export const PSM: ModelWeights = {
  intercept: -1.2510,
  features: [
    { name: "log_psad",        coeff: 0.2844, mean: -1.6137, scale: 0.7090 },
    { name: "grade_group_2",   coeff: 0.1812, mean:  0.3980, scale: 0.4895 },
    { name: "grade_group_3",   coeff: 0.1188, mean:  0.2566, scale: 0.4367 },
    { name: "grade_group_4_5", coeff: 0.0400, mean:  0.2418, scale: 0.4282 },
    { name: "max_core_pct",    coeff: 0.0109, mean: 50.7988, scale: 32.3931 },
    { name: "positive_cores",  coeff: 0.0521, mean:  6.1908, scale:  4.2325 },
    { name: "pirads",          coeff: 0.0099, mean:  4.0773, scale:  0.8520 },
    { name: "mri_epe",         coeff: -0.0287, mean:  0.1497, scale:  0.3567 },
    { name: "mri_svi",         coeff: 0.0542, mean:  0.0428, scale:  0.2023 },
    { name: "bilateral",       coeff: 0.1002, mean:  0.4671, scale:  0.4989 },
  ],
};

// ---------------------------------------------------------------------------
// BCR — biochemical recurrence (preoperative)
// N=2,399 | CV AUC 0.743
// Note: salvage-censoring applies — see MODEL_CARD.md BCR section.
// ---------------------------------------------------------------------------

export const BCR_PREOP: ModelWeights = {
  intercept: -2.182256,
  features: [
    { name: "log_psad",           coeff: 0.2346, mean: -1.7865, scale: 0.7740 },
    { name: "grade_group_2",      coeff: 0.2256, mean:  0.4328, scale: 0.4955 },
    { name: "grade_group_3",      coeff: 0.3019, mean:  0.2451, scale: 0.4302 },
    { name: "grade_group_4_5",    coeff: 0.4495, mean:  0.2171, scale: 0.4123 },
    { name: "positive_cores",     coeff: 0.0341, mean:  6.3653, scale: 3.7894 },
    { name: "pirads",             coeff: 0.1757, mean:  4.1834, scale: 0.6965 },
    { name: "mri_svi",            coeff: 0.1222, mean:  0.0447, scale: 0.2065 },
    { name: "ece_concordance",    coeff: 0.0843, mean:  0.1463, scale: 0.3868 },
    { name: "decipher_imputed",   coeff: 0.2157, mean:  0.5528, scale: 0.1681 },
    { name: "decipher_available", coeff: 0.4597, mean:  0.4185, scale: 0.4933 },
  ],
};

// ---------------------------------------------------------------------------
// LNI — lymph node invasion
// N=663 (PLND cohort) | CV AUC 0.842 | 35 events
// Parsimonious 4-feature model; outperforms 17-feature expansion.
// ---------------------------------------------------------------------------

export const LNI_PLND: ModelWeights = {
  intercept: -3.2892,
  features: [
    { name: "log_psad",    coeff: 0.5623, mean: -1.6174, scale: 0.7068 },
    { name: "gg_high",     coeff: 0.4162, mean:  0.2800, scale: 0.4500 },
    { name: "pos_cores",   coeff: 0.1260, mean:  5.3000, scale: 4.2000 },
    { name: "psma_ln_pos", coeff: 0.5437, mean:  0.1500, scale: 0.3600 },
  ],
};
