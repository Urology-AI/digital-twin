/**
 * Turns the zone-aware NS grade + inflammation risk into an actionable operative
 * plan: per-side plane and zone grades, hydrodissection candidacy, SV
 * preservation.
 *
 * Every recommendation is advisory. Surgeon overrides are tri-state — `null` /
 * `"auto"` means "follow the model", an explicit value (including a deliberate
 * "no") wins over the recommendation.
 */
import {
  HYDRODISSECTION_THRESHOLD,
  NS_ZONE_THRESHOLDS,
  PLANE_TECHNIQUE,
  SV_PRESERVATION,
} from "@/lib/compass/planningEvidence";
import { predictPlaneHostility } from "@/lib/compass/planeHostility";
import { applyDeferGate, checkPipsGates, epeTier, planeDecisionMatrix } from "@/lib/compass/planeDecisionMatrix";
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
): PlanRec<boolean> {
  if (override === null || override === rec)
    return { value: rec, rationale: recRationale };
  return {
    value: override,
    rationale: `Set to ${override ? "yes" : "no"} — model recommends ${rec ? "yes" : "no"}.`,
  };
}

function buildSide(
  side: "left" | "right",
  S: ClinicalState,
  nsDetail: NsSideDetail,
  sideSvi: number,
  psmaSvi: boolean,
  sideEce: number,
): SidePlan {
  const override = side === "left" ? S.plan_ns_override_l : S.plan_ns_override_r;
  const modelGrade = nsDetail.nsGrade;

  // PIPS-style decision matrix: PIPS-EPE (sideEce, the fitted COMPASS side
  // model) and PIPS-H (plane hostility, side-specific) are combined ONLY
  // here — never blended into one score. Escalation toward a wider plane
  // happens only when EPE itself is elevated; a hostile-but-EPE-low side
  // gets a hostile-plane operative protocol instead of a wider excision.
  const hostility = predictPlaneHostility(S, side);
  const tier = epeTier(sideEce);
  const decision = applyDeferGate(planeDecisionMatrix(tier, hostility.tier), checkPipsGates(S));
  // The matrix is advisory only: the 5-zone grade already reflects side ECE,
  // so escalating again on high EPE would double-count it.
  const recommendedGrade = modelGrade;
  const pipsGrade = decision.escalate ? Math.min(3, modelGrade + 1) : modelGrade;
  let grade = recommendedGrade;

  const overridden = override != null && override !== recommendedGrade;
  if (override != null) grade = override;

  const { plane, note } = planeLabel(grade);

  // Grade provenance — kept terse; full citations live in the Sources tab.
  // Always describe what the MODEL concluded; when overridden, the reset link
  // above already shows the model grade, so this line explains why.
  const reason = nsDetail.reason || `model NS grade ${modelGrade}`;
  let gradeRationale = reason;
  if (decision.escalate) {
    gradeRationale = `${reason} · ${decision.rationale}`;
  } else if (decision.hostileProtocol) {
    gradeRationale = `${reason} · hostile-plane protocol (fibrosis, not EPE)`;
  } else if (hostility.tier === "intermediate") {
    gradeRationale = `${reason} · moderate plane hostility flagged`;
  }
  if (decision.code === "defer") {
    gradeRationale = decision.rationale;
  }

  // Zone grades from raw zone ECE. A surgeon's side-level plane override does
  // NOT move the zone chips — those stay the recommended per-zone picture.
  const T = NS_ZONE_THRESHOLDS.value;
  const zoneGrades: Record<string, number> = {};
  for (const z of ZONES) {
    const ece = nsDetail.zones[z] ?? 0;
    const th = T[z] ?? T.posterolateral;
    const raw = ece >= th.grade3 ? 3 : ece >= th.grade2 ? 2 : 1;
    zoneGrades[z] = raw;
  }

  // ── Hydrodissection ───────────────────────────────────────────────────
  const postEce = Math.max(nsDetail.zones.posterolateral ?? 0, nsDetail.zones.base ?? 0);
  const thr = HYDRODISSECTION_THRESHOLD.value;
  const frankEpe = !!S.mri_epe || !!S.psma_epe;
  const bundleRemoved = grade >= 3 || frankEpe;
  const hydroRec = !bundleRemoved && postEce >= thr.minEce;
  const hydroRationale = bundleRemoved
    ? frankEpe
      ? "Frank EPE — bundle is being taken."
      : "Wide excision planned — no bundle to preserve."
    : hydroRec
      ? `Posterolateral ECE ~${Math.round(postEce * 100)}% — buffer the NVB off the capsule.`
      : `Posterolateral ECE ~${Math.round(postEce * 100)}% — low, standard plane is adequate.`;
  const hydrodissection = resolveTri(
    side === "left" ? S.plan_hydrodissection_l : S.plan_hydrodissection_r,
    hydroRec,
    hydroRationale,
  );

  // ── SV preservation ───────────────────────────────────────────────────
  const svCut = SV_PRESERVATION.value.maxSideSvi;
  const svRec = sideSvi < svCut && !psmaSvi;
  const svRationale = psmaSvi
    ? "PSMA-avid SV — complete excision."
    : svRec
      ? `Side SVI ${Math.round(sideSvi * 100)}% — tip-sparing reasonable.`
      : `Side SVI ${Math.round(sideSvi * 100)}% — complete excision.`;
  const svPreservation = resolveTri(
    side === "left" ? S.plan_sv_preservation_l : S.plan_sv_preservation_r,
    svRec,
    svRationale,
  );

  // Per-side NS alerts only. The patient-level inflammation caution lives in
  // the inflammation-risk card, not repeated on both side cards.
  const cautions = nsDetail.alerts.map((a) => a.message);

  return {
    side,
    nsGrade: grade,
    modelGrade,
    recommendedGrade,
    pipsGrade,
    overridden,
    gradeRationale,
    plane,
    planeNote: note,
    zoneGrades,
    hydrodissection,
    svPreservation,
    cautions,
    epeTier: tier,
    hostilityScore: hostility.score,
    hostilityTier: hostility.tier,
    hostileProtocol: decision.hostileProtocol,
    decisionCode: decision.code,
  };
}

export function buildSurgicalPlan(
  S: ClinicalState,
  nsDetailL: NsSideDetail,
  nsDetailR: NsSideDetail,
  sviL: number,
  sviR: number,
  eceL: number,
  eceR: number,
): SurgicalPlan {
  const psmaSvi = !!S.psma_svi && !!S.psma_avail;
  const left = buildSide("left", S, nsDetailL, sviL, psmaSvi, eceL);
  const right = buildSide("right", S, nsDetailR, sviR, psmaSvi, eceR);

  return { left, right, gates: checkPipsGates(S) };
}
