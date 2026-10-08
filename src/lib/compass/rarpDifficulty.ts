/**
 * RARP step difficulty — two separate outputs, never blended:
 *  - bladder neck: how likely a hard posterior bladder-neck dissection /
 *    reconstruction is (median lobe, prior BPH intervention)
 *  - apex: how hard the apical dissection and vesicourethral anastomosis are
 *    likely to be (BMI/pelvic fat, volume, prior TURP/radiation/pelvic surgery,
 *    neoadjuvant ADT)
 *
 * Transparent additive points (not a probability, not fitted). Independent of
 * the nerve-sparing grade, PIPS-H plane hostility and EPE; nothing here feeds
 * back into them. Weights live in `planningEvidence.ts`.
 */
import {
  APICAL_DIFFICULTY_WEIGHTS,
  BLADDER_NECK_DIFFICULTY_WEIGHTS,
  RARP_DIFFICULTY_CUTS,
} from "@/lib/compass/planningEvidence";
import type { EvidenceTier, RiskContributor } from "@/lib/compass/inflammationRisk";
import type { ClinicalState } from "@/types/patient";

export type DifficultyTier = "low" | "moderate" | "high";

export interface StepDifficulty {
  points: number;
  tier: DifficultyTier;
  contributors: RiskContributor[];
}

export interface BladderNeckDifficulty extends StepDifficulty {
  /** high tier: bladder-neck reconstruction is likely, plan for it */
  reconstructionLikely: boolean;
}

function tierOf(points: number): DifficultyTier {
  const cuts = RARP_DIFFICULTY_CUTS.value;
  return points >= cuts.high ? "high" : points >= cuts.moderate ? "moderate" : "low";
}

function finish(contributors: RiskContributor[]): StepDifficulty {
  const points = contributors.reduce((s, c) => s + c.points, 0);
  return { points, tier: tierOf(points), contributors: contributors.sort((a, b) => b.points - a.points) };
}

export function predictBladderNeckDifficulty(S: ClinicalState): BladderNeckDifficulty {
  const W = BLADDER_NECK_DIFFICULTY_WEIGHTS.value;
  const c: RiskContributor[] = [];
  const add = (cond: boolean, label: string, points: number, evidence: EvidenceTier) => {
    if (cond) c.push({ label, points, evidence });
  };

  add(S.median_lobe_grade > 0, `Median lobe, grade ${S.median_lobe_grade}/3`, S.median_lobe_grade * W.median_lobe_per_grade, "surrogate");
  add(S.prior_turp, "Prior TURP", W.prior_turp, "surrogate");
  add(S.prior_holep, "Prior HoLEP (more bladder-neck reconstruction)", W.prior_holep, "surrogate");
  add(S.prior_greenlight, "Prior GreenLight laser", W.prior_greenlight, "unvalidated");
  const anyBph = S.prior_turp || S.prior_holep || S.prior_greenlight;
  add(anyBph && S.bph_procedure_complicated, "Complicated prior BPH procedure", W.bph_procedure_complicated, "unvalidated");

  const d = finish(c);
  return { ...d, reconstructionLikely: d.tier === "high" };
}

export function predictApicalDifficulty(S: ClinicalState): StepDifficulty {
  const W = APICAL_DIFFICULTY_WEIGHTS.value;
  const c: RiskContributor[] = [];
  const add = (cond: boolean, label: string, points: number, evidence: EvidenceTier) => {
    if (cond) c.push({ label, points, evidence });
  };

  // Measured pelvic visceral fat supersedes BMI so the two are never both scored.
  const pvfMeasured = S.pelvic_visceral_fat_cm3 !== null;
  add(S.bmi > 30 && !pvfMeasured, "BMI > 30", W.bmi_gt_30, "surrogate");
  add(pvfMeasured && (S.pelvic_visceral_fat_cm3 ?? 0) >= 1400, "Pelvic visceral fat ≥ 1400 cm³ (measured)", W.pvf_ge_1400, "surrogate");
  add(S.vol > 70, "Prostate volume > 70 cc", W.volume_gt_70, "surrogate");
  add(S.prior_turp, "Prior TURP", W.prior_turp, "surrogate");
  add(S.prior_pelvic_radiation, "Prior pelvic radiation (salvage setting)", W.prior_pelvic_radiation, "unvalidated");
  add(S.neoadjuvant_adt, "Neoadjuvant hormonal therapy", W.neoadjuvant_adt, "unvalidated");
  add(S.prior_pelvic_surgery !== "none", "Prior pelvic surgery", W.prior_pelvic_surgery, "unvalidated");

  return finish(c);
}
