/**
 * PIPS counseling output + per-side confidence.
 *
 * The PIPS framework asks for separate statements rather than a single risk
 * label, so that a difficult plane is never read as poor surgical performance
 * and a promise of nerve sparing never overrides oncologic judgment. Every
 * number here is an existing model output (PIPS-EPE, PIPS-H, the functional
 * nomogram); nothing new is fitted. The one statement with no validated
 * model, "probability intended nerve sparing is reduced intra-operatively",
 * is deliberately qualitative.
 */
import { computeFunctionalOutcomes, type FunctionalInputs } from "@/lib/compass/functionalOutcomes";
import { predictPlaneHostility, type HostilityTier } from "@/lib/compass/planeHostility";
import type { RiskContributor } from "@/lib/compass/inflammationRisk";
import type { ClinicalState } from "@/types/patient";
import type { SidePlan, SurgicalPlan } from "@/types/prediction";

export type ConfidenceLevel = "high" | "reduced" | "low";

export interface SideConfidence {
  level: ConfidenceLevel;
  reasons: string[];
}

/** Share of a side's positive hostility points that rest on unvalidated inputs before confidence is reduced. */
const UNVALIDATED_SHARE_LIMIT = 0.5;

/**
 * Per-side confidence from data-quality gates and the evidence basis of the
 * side's hostility score. "Low" means review is required before the numbers
 * are used; "reduced" means treat them with extra caution. It does not claim
 * the underlying weights are validated; they are always provisional.
 */
export function sideConfidence(S: ClinicalState, side: "left" | "right"): SideConfidence {
  const reasons: string[] = [];
  let level: ConfidenceLevel = "high";
  const bump = (to: ConfidenceLevel) => {
    const rank = { high: 0, reduced: 1, low: 2 } as const;
    if (rank[to] > rank[level]) level = to;
  };

  if (S.flag_active_infection) {
    bump("low");
    reasons.push("Active infection: this side is not scored; surgery is deferred.");
  }
  if (S.flag_imaging_discordant) {
    bump("low");
    reasons.push("Imaging modalities disagree on side or extent; multidisciplinary review required.");
  }
  if (S.flag_mri_artifact) {
    bump("reduced");
    reasons.push("MRI degraded by hip hardware or motion.");
  }
  if (S.flag_key_data_missing) {
    bump("reduced");
    reasons.push("Key data missing (MRI plane read, baseline IIEF, or prior operative reports).");
  }

  const contributors = predictPlaneHostility(S, side).contributors.filter((c) => c.points > 0);
  const total = contributors.reduce((s, c) => s + c.points, 0);
  const unvalidated = contributors.filter((c) => c.evidence === "unvalidated" || c.evidence === "none").reduce((s, c) => s + c.points, 0);
  if (total > 0 && unvalidated / total > UNVALIDATED_SHARE_LIMIT) {
    bump("reduced");
    reasons.push("Most of this side's plane-hostility score rests on inputs not yet validated against the plane (MRI grades, expert priors).");
  }
  return { level, reasons };
}

export type ChangeLikelihood = "unlikely" | "possible" | "likely" | "not-assessed";

export interface SideCounseling {
  side: "left" | "right";
  /** 1 - PIPS-EPE: chance this bundle can be preserved from an oncologic perspective */
  preservableOncologically: number;
  /** PIPS-H probability that the planned plane is technically difficult */
  technicallyDifficult: number;
  hostilityTier: HostilityTier;
  /** what this side's plane-hostility score is made of, with evidence tags */
  contributors: RiskContributor[];
  /** qualitative only: no validated probability exists */
  planReduction: { likelihood: ChangeLikelihood; text: string };
  /** may intra-operative findings or frozen sections change the plan? */
  intraopChange: { possible: boolean; text: string };
  confidence: SideConfidence;
}

export interface RecoveryScenario {
  label: string;
  /** potency at 12 months, %; null when baseline SHIM < 12 */
  potency12: number | null;
  continence12: number;
}

export interface PipsCounseling {
  left: SideCounseling;
  right: SideCounseling;
  recovery: RecoveryScenario[];
  uncertainty: string[];
}

function planReduction(plan: SidePlan): SideCounseling["planReduction"] {
  switch (plan.decisionCode) {
    case "defer":
      return { likelihood: "not-assessed", text: "Not assessed: surgery is deferred for active infection." };
    case "wider-plane":
      return { likelihood: "likely", text: "A wider plane is already planned because oncologic risk on this side is high; counsel that functional preservation is unlikely." };
    case "graded-frozen-section":
      return { likelihood: "possible", text: "Possible: start interfascial and widen only if a frozen section is positive." };
    case "preserve-hostile-protocol":
      return { likelihood: "possible", text: "Possible: the plane is hostile, so the intended grade may be reduced intra-operatively even though oncologic risk is low." };
    default:
      return { likelihood: "unlikely", text: "Unlikely on current inputs. This is qualitative; no validated probability exists." };
  }
}

function intraopChange(plan: SidePlan): SideCounseling["intraopChange"] {
  if (plan.decisionCode === "defer") return { possible: false, text: "Not applicable: surgery deferred." };
  if (plan.decisionCode === "graded-frozen-section")
    return { possible: true, text: "Yes: frozen-section findings are expected to guide the final plane on this side." };
  if (plan.decisionCode === "preserve-hostile-protocol")
    return { possible: true, text: "Yes: consent for an intra-operative plane change if the plane cannot be developed safely." };
  if (plan.decisionCode === "wider-plane")
    return { possible: true, text: "The wider plane is the plan; intra-operative findings could widen it further but are unlikely to narrow it." };
  return { possible: false, text: "Not expected on current inputs, though unexpected findings can always change the plan." };
}

function uncertaintySources(S: ClinicalState): string[] {
  const out: string[] = [];
  if (S.flag_mri_artifact) out.push("MRI artifact from hip hardware or motion");
  if (S.flag_imaging_discordant) out.push("Disagreement between MRI, PSMA PET, biopsy or micro-ultrasound");
  if (S.flag_key_data_missing) out.push("Missing MRI plane read, baseline IIEF, or prior operative reports");
  const prior: string[] = [];
  if (S.prior_pelvic_radiation) prior.push("pelvic radiation");
  if (S.prior_turp || S.prior_holep || S.prior_greenlight) prior.push("prior TURP/HoLEP/laser");
  if (S.prior_focal_ablation_l > 0 || S.prior_focal_ablation_r > 0) prior.push("focal ablation");
  if (S.prior_pelvic_surgery !== "none") prior.push("prior pelvic surgery");
  if (prior.length) out.push(`Prior treatment (${prior.join(", ")}) changes anatomy in ways imaging may not fully show`);
  return out;
}

export function buildPipsCounseling(
  S: ClinicalState,
  plan: SurgicalPlan,
  eceL: number,
  eceR: number,
  functionalBase: Omit<FunctionalInputs, "nsL" | "nsR" | "plan">,
): PipsCounseling {
  const side = (sp: SidePlan, ece: number): SideCounseling => ({
    side: sp.side,
    preservableOncologically: 1 - ece,
    technicallyDifficult: sp.hostilityScore,
    hostilityTier: sp.hostilityTier,
    contributors: predictPlaneHostility(S, sp.side).contributors,
    planReduction: planReduction(sp),
    intraopChange: intraopChange(sp),
    confidence: sideConfidence(S, sp.side),
  });

  // Recovery conditional on how much nerve sparing is achieved. Grade 3 is
  // extrafascial (no bundle preserved on that side); the preserved side keeps
  // its planned grade, capped at interfascial.
  const kept = (sp: SidePlan) => Math.min(sp.nsGrade, 2);
  const run = (nsL: number, nsR: number, label: string): RecoveryScenario => {
    const r = computeFunctionalOutcomes({ ...functionalBase, nsL, nsR });
    return { label, potency12: r.potency12, continence12: r.continence12 };
  };
  const recovery = [
    run(kept(plan.left), kept(plan.right), "Nerve sparing both sides, as planned"),
    run(kept(plan.left), 3, "Left preserved, right wide"),
    run(3, kept(plan.right), "Right preserved, left wide"),
    run(3, 3, "Wide (extrafascial) both sides"),
  ];

  return { left: side(plan.left, eceL), right: side(plan.right, eceR), recovery, uncertainty: uncertaintySources(S) };
}
