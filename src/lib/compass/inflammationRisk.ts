/**
 * Periprostatic-inflammation / "obliterated planes" risk.
 *
 * A transparent additive-points model (NOT fitted on pathology) that estimates
 * how likely the periprostatic planes are fibrosed/adherent — which makes an
 * intrafascial nerve-sparing plane hard to develop and raises positive-margin
 * risk. Feeds the surgical plan (grade escalation, cautions) and the
 * functional-outcome / BCR penalties.
 *
 * Weights live in `planningEvidence.ts` (`INFLAMMATION_WEIGHTS`).
 */
import { INFLAMMATION_CUTS, INFLAMMATION_WEIGHTS } from "@/lib/compass/planningEvidence";
import { clamp, sigmoid } from "@/lib/utils/math";
import type { ClinicalState } from "@/types/patient";

export type InflammationTier = "low" | "moderate" | "high";

export interface InflammationRisk {
  score: number; // 0..1
  tier: InflammationTier;
  contributors: { label: string; points: number }[];
  /** true when the tier is moderate or high — prompts an MRI re-read for
   *  peri-prostatic inflammation / fatty change before finalising the plan */
  reviewMri: boolean;
  /** true when an intra-operative inflammation grade has been recorded */
  intraopObserved: boolean;
  /** true when the recorded intra-op grade is what set the score (i.e. it is
   *  at least as high as the pre-op risk-factor estimate) */
  intraopDriven: boolean;
}

export function predictInflammationRisk(S: ClinicalState): InflammationRisk {
  const W = INFLAMMATION_WEIGHTS.value;
  const contributors: { label: string; points: number }[] = [];
  const add = (cond: boolean, label: string, points: number) => {
    if (cond && points !== 0) contributors.push({ label, points });
  };

  // ── Pre-operative risk factors ──────────────────────────────────────────
  add(S.age > 70, "Age > 70", W.age_gt_70);
  add(S.vol > 80, "Prostate volume > 80 cc", W.volume_gt_80);
  add(S.vol > 100, "Prostate volume > 100 cc", W.volume_gt_100);

  // BPH / outlet procedures: scored individually by dissection burden, capped.
  let bph = 0;
  const bphNames: string[] = [];
  const bphAdd = (cond: boolean, name: string, w: number) => {
    if (cond) {
      bph += w;
      bphNames.push(name);
    }
  };
  bphAdd(S.prior_turp, "TURP", W.prior_turp);
  bphAdd(S.prior_holep, "HoLEP", W.prior_holep);
  bphAdd(S.prior_greenlight, "GreenLight", W.prior_greenlight);
  bphAdd(S.prior_urolift, "Urolift", W.prior_urolift);
  bphAdd(S.prior_rezum, "Rezūm", W.prior_rezum);
  bph = Math.min(bph, W.prior_bph_cap);
  if (bph > 0) {
    contributors.push({ label: `Prior BPH procedure (${bphNames.join(", ")})`, points: bph });
  }

  add(S.prior_pelvic_radiation, "Prior pelvic radiation", W.prior_pelvic_radiation);
  add(S.radiation_proctitis, "Radiation proctitis", W.radiation_proctitis);
  add(S.urinary_retention, "Urinary retention", W.urinary_retention);
  add(S.recurrent_uti, "Recurrent UTI / cystoscopy", W.recurrent_uti);
  add(S.ipss > 19, "IPSS > 19", W.ipss_gt_19);
  add(S.pelvic_abscess, "Pelvic abscess", W.pelvic_abscess);
  add(S.hernia_mesh, "Local hernia mesh", W.hernia_mesh);
  add(S.rectal_fistula, "Rectal fistula", W.rectal_fistula);
  add(S.crohns || S.ulcerative_colitis, "Inflammatory bowel disease", W.ibd);
  add(S.diverticulitis, "Diverticulitis", W.diverticulitis);
  add(S.biopsy_shows_inflammation, "Biopsy shows inflammation", W.biopsy_inflammation);
  add(S.biopsy_sessions >= 2, "Multiple prostate biopsies", W.multiple_biopsies);
  add(S.treated_prostatitis, "Treated for prostatitis", W.treated_prostatitis);
  add(S.bmi > 30, "BMI > 30", W.bmi_gt_30);
  add(
    S.mri_periprostatic_inflammation === "equivocal",
    "MRI: equivocal periprostatic inflammation",
    W.mri_inflammation_equivocal,
  );
  add(
    S.mri_periprostatic_inflammation === "present",
    "MRI: periprostatic inflammation present",
    W.mri_inflammation_present,
  );
  add(S.mri_periprostatic_fat_stranding, "MRI: periprostatic fat stranding", W.mri_fat_stranding);

  const riskPoints = contributors.reduce((s, c) => s + c.points, 0);
  const riskLogit = W.intercept + riskPoints;

  // ── Intra-operative observation ────────────────────────────────────────
  const intraopGrade = Math.max(S.intraop_inflammation_l, S.intraop_inflammation_r);
  const intraopObserved = intraopGrade > 0;
  const intraopPoints = W.intraop_per_grade * intraopGrade;
  const intraopLogit = W.intercept + intraopPoints;

  // Observed inflammation is confirmatory — it can raise the estimate but must
  // never de-escalate below what the pre-operative risk factors already imply.
  const intraopDriven = intraopObserved && intraopLogit >= riskLogit;
  const logit = intraopObserved ? Math.max(riskLogit, intraopLogit) : riskLogit;

  if (intraopObserved) {
    contributors.unshift({
      label: `Intra-operative inflammation grade ${intraopGrade}${
        intraopDriven ? "" : " (below pre-op estimate)"
      }`,
      points: intraopPoints,
    });
  }

  const score = clamp(sigmoid(logit), 0.02, 0.98);
  const cuts = INFLAMMATION_CUTS.value;
  const tier: InflammationTier =
    score >= cuts.high ? "high" : score >= cuts.moderate ? "moderate" : "low";

  return {
    score,
    tier,
    contributors: contributors.sort((a, b) => b.points - a.points),
    reviewMri: tier !== "low" && !intraopObserved,
    intraopObserved,
    intraopDriven,
  };
}
