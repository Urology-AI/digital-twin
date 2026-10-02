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

/**
 * How directly the literature ties a contributor to a hostile periprostatic
 * plane:
 *  - "direct": plane/fibrosis measured, or an independent RP difficulty predictor
 *  - "surrogate": only surgical surrogates (nerve-sparing rate, operative time,
 *    rectal injury, margins)
 *  - "unvalidated": scored research input / expert prior — validated for
 *    something else (e.g. EPE) but not against the plane; provisional
 *  - "null": studied and shown to have no effect on the plane (zero weight)
 *  - "none": never studied in radical prostatectomy (zero-weight context)
 */
export type EvidenceTier = "direct" | "surrogate" | "unvalidated" | "null" | "none";

export interface RiskContributor {
  label: string;
  points: number;
  evidence: EvidenceTier;
}

export interface InflammationRisk {
  score: number; // 0..1
  tier: InflammationTier;
  contributors: RiskContributor[];
  /** true when the tier is moderate or high — prompts an MRI re-read for
   *  peri-prostatic inflammation / fatty change before finalising the plan */
  reviewMri: boolean;
  /** true when an intra-operative inflammation grade has been recorded */
  intraopObserved: boolean;
  /** true when the recorded intra-op grade is what set the score (i.e. it is
   *  at least as high as the pre-op risk-factor estimate) */
  intraopDriven: boolean;
}

/**
 * Whole-patient history/systemic risk factors shared by both the patient-
 * level inflammation-risk score below and the side-specific PIPS-H plane-
 * hostility score (`planeHostility.ts`) — these are asymmetric in effect but
 * not asymmetric in the record (a prior pelvic radiation course, for
 * instance, is one fact about the patient, applied identically to both
 * sides' hostility estimates; only the MRI plane phenotype in
 * `planeHostility.ts` is genuinely side-specific).
 *
 * Items whose weight is 0 are still returned (0 points) so the UI can show
 * them as context without scoring them.
 *
 * `skipGlobalMri` lets PIPS-H drop the whole-gland MRI inflammation / fat-
 * stranding reads when it is about to score the side-specific versions of the
 * same finding, so one radiologist observation is never counted twice.
 */
export function preopHistoryPoints(
  S: ClinicalState,
  opts: { skipGlobalMri?: { inflammation?: boolean; fatStranding?: boolean } } = {},
): { points: number; contributors: RiskContributor[] } {
  const W = INFLAMMATION_WEIGHTS.value;
  const contributors: RiskContributor[] = [];
  const add = (cond: boolean, label: string, points: number, evidence: EvidenceTier) => {
    if (cond) contributors.push({ label, points, evidence });
  };

  add(S.age > 70, "Age > 70", W.age_gt_70, "null");
  add(S.vol > 80, "Prostate volume > 80 cc", W.volume_gt_80, "surrogate");
  add(S.vol > 100, "Prostate volume > 100 cc", W.volume_gt_100, "surrogate");

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
  if (bphNames.length > 0 && S.bph_procedure_complicated) bph += W.bph_procedure_complicated;
  bph = Math.min(bph, W.prior_bph_cap);
  if (bphNames.length > 0) {
    // TURP/HoLEP/laser have meta-analytic surgical-surrogate evidence; Urolift
    // and Rezūm alone have none for RP.
    const resective = S.prior_turp || S.prior_holep || S.prior_greenlight;
    contributors.push({
      label: `Prior BPH procedure (${bphNames.join(", ")}${S.bph_procedure_complicated ? "; complicated" : ""})`,
      points: bph,
      evidence: resective ? "surrogate" : "none",
    });
  }

  add(S.prior_pelvic_radiation, "Prior pelvic radiation", W.prior_pelvic_radiation, "direct");
  add(
    S.prior_pelvic_radiation && S.radiation_brachytherapy,
    "Radiation modality: brachytherapy / combined (expert prior)",
    W.radiation_brachytherapy_extra,
    "unvalidated",
  );
  add(S.five_ari_long_term, "5-ARI ≥ 12 months (direction uncertain, context only)", W.five_ari_long_term, "none");
  add(S.radiation_proctitis, "Radiation proctitis", W.radiation_proctitis, "surrogate");
  add(S.urinary_retention, "Urinary retention (context only)", W.urinary_retention, "none");
  add(S.recurrent_uti, "Recurrent UTI / cystoscopy (context only)", W.recurrent_uti, "none");
  add(S.ipss > 19, "IPSS > 19 (context; continence sub-model only)", W.ipss_gt_19, "none");
  add(S.pelvic_abscess, "Pelvic abscess (context only; active infection is a hard-stop gate)", W.pelvic_abscess, "none");
  add(S.prior_abdominal_surgery, "Prior abdominal/pelvic surgery in general (validated null)", W.prior_abdominal_surgery, "null");
  add(S.hernia_mesh, "Local hernia mesh (adds operative time, not plane quality)", W.hernia_mesh, "surrogate");
  add(S.rectal_fistula, "Rectal fistula", W.rectal_fistula, "surrogate");
  add(S.crohns || S.ulcerative_colitis, "Inflammatory bowel disease", W.ibd, "surrogate");
  add(S.diverticulitis, "Diverticulitis (context only)", W.diverticulitis, "none");
  add(S.biopsy_shows_inflammation, "Biopsy shows inflammation (context only)", W.biopsy_inflammation, "none");
  add(S.biopsy_sessions >= 2, "Multiple prostate biopsies (validated null)", W.multiple_biopsies, "null");
  add(S.treated_prostatitis, "Treated for prostatitis (context only)", W.treated_prostatitis, "none");
  // Measured pelvic visceral fat supersedes BMI (BMI loses independent value
  // once pelvic fat / geometry are measured), so the two are never both scored.
  const pvfMeasured = S.pelvic_visceral_fat_cm3 !== null;
  add(S.bmi > 30 && !pvfMeasured, "BMI > 30 (attenuated by pelvic geometry)", W.bmi_gt_30, "surrogate");
  add(S.bmi > 30 && pvfMeasured, "BMI > 30 (superseded by measured pelvic fat)", 0, "none");
  add(
    pvfMeasured && (S.pelvic_visceral_fat_cm3 ?? 0) >= 1400,
    "Pelvic visceral fat ≥ 1400 cm³ (measured)",
    W.pvf_ge_1400,
    "surrogate",
  );
  // Neoadjuvant ADT and radiation both act through fibrosis: not additive.
  add(
    S.neoadjuvant_adt && !S.prior_pelvic_radiation,
    "Neoadjuvant ADT (desmoplasia; weak, descriptive)",
    W.neoadjuvant_adt,
    "unvalidated",
  );
  add(
    S.neoadjuvant_adt && S.prior_pelvic_radiation,
    "Neoadjuvant ADT (not additive with prior radiation)",
    0,
    "unvalidated",
  );
  add(
    !opts.skipGlobalMri?.inflammation && S.mri_periprostatic_inflammation === "equivocal",
    "MRI: equivocal periprostatic inflammation",
    W.mri_inflammation_equivocal,
    "unvalidated",
  );
  add(
    !opts.skipGlobalMri?.inflammation && S.mri_periprostatic_inflammation === "present",
    "MRI: periprostatic inflammation present",
    W.mri_inflammation_present,
    "unvalidated",
  );
  add(
    !opts.skipGlobalMri?.fatStranding && S.mri_periprostatic_fat_stranding,
    "MRI: periprostatic fat stranding",
    W.mri_fat_stranding,
    "unvalidated",
  );
  add(S.mri_post_biopsy_hemorrhage, "MRI: post-biopsy hemorrhage (T1)", W.mri_post_biopsy_hemorrhage, "direct");
  add(
    S.prior_pelvic_surgery === "bladder_fracture_urethroplasty",
    "Prior bladder surgery, pelvic fracture, or urethroplasty (context only)",
    W.prior_pelvic_surgery_bladder,
    "none",
  );
  add(
    S.prior_pelvic_surgery === "rectal_denonvilliers",
    "Prior rectal/LAR/APR surgery at Denonvilliers",
    W.prior_pelvic_surgery_denonvilliers,
    "surrogate",
  );
  add(S.penile_prosthesis_reservoir === "present", "Penile prosthesis reservoir in Retzius (descriptive only, no effect size)", W.reservoir_present, "unvalidated");
  add(
    S.penile_prosthesis_reservoir === "prior_infection_or_revision",
    "Penile prosthesis reservoir — prior infection/revision (descriptive only)",
    W.reservoir_infected,
    "unvalidated",
  );
  add(S.catheter_prolonged_or_traumatic, "Prolonged/traumatic catheterization (context only)", W.catheter_prolonged, "none");
  add(
    S.biopsy_recent_or_complicated,
    "Recent or complicated biopsy (validated null)",
    W.biopsy_recent_or_complicated,
    "null",
  );
  add(
    (S.crp !== null && S.crp > 3) || (S.nlr !== null && S.nlr > 3),
    "Systemic inflammatory index (hs-CRP > 3 or NLR > 3) (context only)",
    W.systemic_inflammatory_index_high,
    "none",
  );

  const points = contributors.reduce((s, c) => s + c.points, 0);
  return { points, contributors };
}

export function predictInflammationRisk(S: ClinicalState): InflammationRisk {
  const W = INFLAMMATION_WEIGHTS.value;
  const { points: riskPoints, contributors } = preopHistoryPoints(S);
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
      evidence: "direct",
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
