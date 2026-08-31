/**
 * Turns the zone-aware NS grade + inflammation risk into an actionable operative
 * plan: per-side plane and zone grades, hydrodissection candidacy, SV
 * preservation, and the overall anterior "hood" (Retzius-sparing) and
 * bladder-neck-preservation calls.
 *
 * Every recommendation is advisory. Surgeon overrides are tri-state — `null` /
 * `"auto"` means "follow the model", an explicit value (including a deliberate
 * "no") wins over the recommendation.
 */
import {
  BNP_DECISION,
  HOOD_DECISION,
  HYDRODISSECTION_THRESHOLD,
  NS_GRADE_ESCALATION,
  NS_MODEL_CITATION,
  NS_ZONE_THRESHOLDS,
  PLANE_TECHNIQUE,
  SV_PRESERVATION,
} from "@/lib/compass/planningEvidence";
import type { InflammationRisk } from "@/lib/compass/inflammationRisk";
import { clamp } from "@/lib/utils/math";
import type { ClinicalState } from "@/types/patient";
import type { NsSideDetail, PlanRec, SidePlan, SurgicalPlan } from "@/types/prediction";

const ZONES = ["posterolateral", "base", "apex", "anterior", "bladder_neck"] as const;

function planeLabel(grade: number): { plane: string; note: string } {
  const g = Math.min(3, Math.max(1, Math.round(grade)));
  return PLANE_TECHNIQUE.value[g] ?? PLANE_TECHNIQUE.value[2]!;
}

/** Resolve a tri-state surgeon override against a model recommendation. */
function resolveTri(
  override: boolean | null,
  rec: boolean,
  recRationale: string,
  citation: string,
): PlanRec<boolean> {
  if (override === null) return { value: rec, rationale: recRationale, citation };
  if (override === rec)
    return { value: rec, rationale: `Surgeon confirmed. ${recRationale}`, citation };
  return {
    value: override,
    rationale: `Surgeon override: ${override ? "yes" : "no"} (model recommended ${
      rec ? "yes" : "no"
    } — ${recRationale})`,
    citation,
  };
}

function buildSide(
  side: "left" | "right",
  S: ClinicalState,
  nsDetail: NsSideDetail,
  sideSvi: number,
  psmaSvi: boolean,
  infl: InflammationRisk,
): SidePlan {
  const override = side === "left" ? S.plan_ns_override_l : S.plan_ns_override_r;
  const modelGrade = nsDetail.nsGrade;

  // Inflammation escalation: severe inflammation → one step less nerve-sparing.
  const esc = NS_GRADE_ESCALATION.value;
  const inflEscalated = infl.tier === "high" && esc.high_steps > 0 && modelGrade < 3;
  const recommendedGrade = inflEscalated ? Math.min(3, modelGrade + esc.high_steps) : modelGrade;
  let grade = recommendedGrade;

  const overridden = override != null && override !== recommendedGrade;
  if (override != null) grade = override;

  const { plane, note } = planeLabel(grade);

  // Grade provenance
  let gradeRationale = nsDetail.reason || `Model NS grade ${modelGrade}`;
  let gradeCitation = NS_MODEL_CITATION + " · " + PLANE_TECHNIQUE.citation;
  if (inflEscalated) {
    gradeRationale += ` · escalated to grade ${Math.min(3, modelGrade + esc.high_steps)} for severe periprostatic inflammation`;
    gradeCitation = NS_GRADE_ESCALATION.citation;
  } else if (infl.tier === "moderate") {
    gradeRationale += " · moderate inflammation — a wider plane may be safer (surgeon judgement)";
  }
  if (override != null && overridden) {
    gradeRationale = `Surgeon override to grade ${override} (model: grade ${modelGrade}${
      inflEscalated ? " + inflammation escalation" : ""
    }). ${gradeRationale}`;
  }

  // Zone grades from raw zone ECE, then shifted by the net grade delta so an
  // overridden or escalated side stays internally consistent.
  const T = NS_ZONE_THRESHOLDS.value;
  const gradeDelta = grade - modelGrade;
  const zoneGrades: Record<string, number> = {};
  for (const z of ZONES) {
    const ece = nsDetail.zones[z] ?? 0;
    const th = T[z] ?? T.posterolateral;
    const raw = ece >= th.grade3 ? 3 : ece >= th.grade2 ? 2 : 1;
    zoneGrades[z] = clamp(raw + gradeDelta, 1, 3);
  }

  // ── Hydrodissection ───────────────────────────────────────────────────
  const postEce = Math.max(nsDetail.zones.posterolateral ?? 0, nsDetail.zones.base ?? 0);
  const thr = HYDRODISSECTION_THRESHOLD.value;
  const frankEpe = !!S.mri_epe || !!S.psma_epe;
  const bundleRemoved = grade >= 3 || frankEpe;
  const hydroRec = !bundleRemoved && postEce >= thr.minEce;
  const hydroRationale = bundleRemoved
    ? frankEpe
      ? "Frank EPE on imaging — the bundle is being taken, no plane to hydrodissect."
      : "A wide (grade-3) excision is planned — no bundle to preserve."
    : hydroRec
      ? `Posterolateral/base ECE ~${Math.round(postEce * 100)}% (≥ ${Math.round(
          thr.minEce * 100,
        )}%) — develop a saline plane to sweep the NVB off the at-risk capsule.`
      : `Posterolateral/base ECE ~${Math.round(postEce * 100)}% is low — a standard plane is adequate.`;
  const hydrodissection = resolveTri(
    side === "left" ? S.plan_hydrodissection_l : S.plan_hydrodissection_r,
    hydroRec,
    hydroRationale,
    HYDRODISSECTION_THRESHOLD.citation,
  );

  // ── SV preservation ───────────────────────────────────────────────────
  const svCut = SV_PRESERVATION.value.maxSideSvi;
  const svRec = sideSvi < svCut && !psmaSvi;
  const svRationale = psmaSvi
    ? "PSMA-avid seminal vesicle — complete excision."
    : svRec
      ? `Side SVI risk ${Math.round(sideSvi * 100)}% (< ${Math.round(svCut * 100)}%) — SV tip-sparing is reasonable.`
      : `Side SVI risk ${Math.round(sideSvi * 100)}% (≥ ${Math.round(svCut * 100)}%) — complete SV excision.`;
  const svPreservation = resolveTri(
    side === "left" ? S.plan_sv_preservation_l : S.plan_sv_preservation_r,
    svRec,
    svRationale,
    SV_PRESERVATION.citation,
  );

  const cautions = [
    ...nsDetail.alerts.map((a) => a.message),
    ...(infl.tier !== "low"
      ? [
          `Periprostatic inflammation risk ${infl.tier}${
            infl.intraopObserved ? " (intra-op observed)" : ""
          } — planes may be obliterated.`,
        ]
      : []),
  ];

  return {
    side,
    nsGrade: grade,
    modelGrade,
    recommendedGrade,
    overridden,
    gradeRationale,
    gradeCitation,
    plane,
    planeNote: note,
    zoneGrades,
    hydrodissection,
    svPreservation,
    cautions,
  };
}

export function buildSurgicalPlan(
  S: ClinicalState,
  nsDetailL: NsSideDetail,
  nsDetailR: NsSideDetail,
  sviL: number,
  sviR: number,
  infl: InflammationRisk,
): SurgicalPlan {
  const psmaSvi = !!S.psma_svi && !!S.psma_avail;
  const left = buildSide("left", S, nsDetailL, sviL, psmaSvi, infl);
  const right = buildSide("right", S, nsDetailR, sviR, psmaSvi, infl);

  const wideSides = [left, right].filter((s) => s.nsGrade >= 3).length;
  const anteriorApexEce = Math.max(
    nsDetailL.zones.anterior ?? 0,
    nsDetailR.zones.anterior ?? 0,
    nsDetailL.zones.apex ?? 0,
    nsDetailR.zones.apex ?? 0,
  );
  const hoodMaxEce = HOOD_DECISION.value.anteriorApexEceMax;
  const bnpCut = BNP_DECISION.value;
  const bigMedianLobe = S.median_lobe_grade >= bnpCut.maxMedianLobe;

  let hoodRec: "none" | "unilateral" | "bilateral";
  let hoodRecWhy: string;
  if (wideSides === 0 && anteriorApexEce < hoodMaxEce && infl.tier !== "high" && !bigMedianLobe) {
    hoodRec = "bilateral";
    hoodRecWhy =
      "Both sides interfascial or better, low anterior/apical ECE — a bilateral anterior (Retzius-sparing) hood favours early continence.";
  } else if (wideSides === 1 && anteriorApexEce < hoodMaxEce && !bigMedianLobe) {
    hoodRec = "unilateral";
    hoodRecWhy =
      "One side needs wide excision — preserve the anterior hood on the contralateral side only.";
  } else {
    hoodRec = "none";
    hoodRecWhy = bigMedianLobe
      ? "Large median lobe — anterior/bladder-neck reconstruction needed, hood not feasible."
      : infl.tier === "high"
        ? "Obliterated periprostatic planes — a standard anterior approach is safer."
        : "Bilateral high-risk disease — a standard anterior approach is safer.";
  }

  const hoodValue = S.plan_hood === "auto" ? hoodRec : S.plan_hood;
  const hood: SurgicalPlan["hood"] = {
    value: hoodValue,
    rationale:
      S.plan_hood === "auto"
        ? hoodRecWhy
        : `Surgeon-selected: ${hoodValue} (model recommended ${hoodRec} — ${hoodRecWhy})`,
    citation: HOOD_DECISION.citation,
  };

  const bnEce = Math.max(
    nsDetailL.zones.bladder_neck ?? 0,
    nsDetailR.zones.bladder_neck ?? 0,
  );
  const bnpRec =
    S.median_lobe_grade < bnpCut.maxMedianLobe &&
    bnEce < bnpCut.maxBnEce &&
    S.vol < bnpCut.maxVolumeCc;
  const bnpRationale = bnpRec
    ? "No large median lobe, bladder-neck-zone ECE low, gland not very large — preservation supports early continence."
    : bnEce >= bnpCut.maxBnEce
      ? `Bladder-neck-zone ECE ~${Math.round(bnEce * 100)}% — take a wider bladder-neck margin.`
      : S.median_lobe_grade >= bnpCut.maxMedianLobe
        ? "Large median lobe — bladder-neck reconstruction rather than preservation."
        : "Very large gland — bladder-neck preservation may not be achievable.";
  const bnp = resolveTri(S.plan_bnp, bnpRec, bnpRationale, BNP_DECISION.citation);

  return { left, right, hood, bladderNeckPreservation: bnp };
}
