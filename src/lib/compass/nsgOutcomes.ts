/**
 * NS-grade → positive-margin → BCR outcomes, and PSMA nodal-station
 * false-positive rates. Extracted from PredictionPanel so the surgical-plan and
 * impact modules can reuse the same figures.
 *
 * Source: Mount Sinai 5,003-side radical-prostatectomy database (institutional
 * data) — see `NSG_OUTCOME_DATA` in planningEvidence.ts.
 */
export const NSG_DATA_CITATION =
  "Mount Sinai 5,003-side radical-prostatectomy database — positive-margin and " +
  "biochemical-recurrence rates by nerve-sparing grade and zone.";

/** NS Grade → PSM → BCR data from the 5,003-side database (rates in %). */
export const NSG_DATA = {
  1: { psm: 11.6, bcr_no: 3.4, bcr_psm: 3.3, apex_psm: 3.0, apex_bcr: 5, pl_psm: 0.8, pl_bcr: 0, base_psm: 1.6, base_bcr: 0, ant_psm: 1.7, ant_bcr: 0, post_psm: 3.0, post_bcr: 0 },
  2: { psm: 12.0, bcr_no: 9.2, bcr_psm: 16.0, apex_psm: 2.5, apex_bcr: 20, pl_psm: 1.2, pl_bcr: 8, base_psm: 1.8, base_bcr: 23, ant_psm: 1.5, ant_bcr: 6, post_psm: 3.0, post_bcr: 20 },
  3: { psm: 16.7, bcr_no: 21.6, bcr_psm: 27.6, apex_psm: 1.8, apex_bcr: 15, pl_psm: 0.7, pl_bcr: 25, base_psm: 4.4, base_bcr: 37, ant_psm: 1.4, ant_bcr: 25, post_psm: 3.3, post_bcr: 28 },
} as const;

export type NsgGrade = keyof typeof NSG_DATA;

/** Clamp any numeric NS grade (may be escalated past 3) into the NSG_DATA keys. */
export function nsgGrade(grade: number): NsgGrade {
  return (Math.min(3, Math.max(1, Math.round(grade))) as NsgGrade);
}

export const STATION_FP: Record<string, { fp: number; note: string }> = {
  "external iliac": { fp: 90, note: "Highest FP rate — 90% benign. Predominantly low-grade patients." },
  "internal iliac": { fp: 20, note: "Low FP rate — high clinical significance." },
  "obturator": { fp: 25, note: "Low FP rate — clinically significant when positive." },
  "common iliac": { fp: 50, note: "Moderate FP rate. Concerning if high SUV." },
  "perirectal": { fp: 15, note: "Rare but concerning. Low FP rate." },
  "presacral": { fp: 30, note: "Moderate concern." },
  "paraaortic": { fp: 40, note: "Extended field. May indicate higher stage." },
  "inguinal": { fp: 70, note: "Often reactive." },
  "retroperitoneal": { fp: 50, note: "Moderate concern. Check SUVmax." },
};
