/**
 * Implementation artifact for the preoperative BCR Cox model.
 *
 * This file is versioned separately from the model lock. The lock itself
 * (COMPASS_vNext_BCR_Provisional_ModelLock.json) is unchanged and keeps its own
 * canonical SHA-256. The lock stores baseline cumulative hazards rounded to 8
 * decimals; the values below are the same quantities at full precision,
 * recovered from the lock's own pinned mean_reference risks:
 *
 *   H0(t) = -ln(1 - risk_t(mean_reference))      (mean_reference has LP = 0)
 *
 * No coefficient was changed and nothing was refit. Rounded to 8 decimals these
 * equal the lock's stored values exactly, and with them all 15 pinned horizon
 * predictions reproduce to about 2e-15 (rounded H0 only reaches about 5e-9).
 */
export const BCR_COX_IMPLEMENTATION_VERSION = "bcr-cox-impl-2026-10-05.1";

export const BCR_COX_SOURCE_LOCK = {
  version: "vNext-bcr-preop-candidate-2026-09-27",
  sha256_canonical_without_hash_field:
    "b364b7910c0b5356fbc3c8d5c99f142a9df1e11a0d3da915cc7868627a10a585",
} as const;

/** Full-precision baseline cumulative hazards. */
export const BCR_COX_BASELINE_H0 = {
  m12: 0.06913324926015361,
  m24: 0.12034824045129856,
  m36: 0.18804860720552194,
} as const;

/** The lock's own 8-decimal values, kept only so a test can prove consistency. */
export const BCR_COX_LOCK_H0_ROUNDED = {
  m12: 0.06913325,
  m24: 0.12034824,
  m36: 0.18804861,
} as const;
