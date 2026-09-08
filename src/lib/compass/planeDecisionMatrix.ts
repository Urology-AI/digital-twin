/**
 * PIPS-style decision matrix — combines PIPS-EPE (oncologic; the fitted
 * COMPASS side-specific `eceL`/`eceR`) with PIPS-H (plane hostility, see
 * `planeHostility.ts`) ONLY at this final lookup step, per
 * `PIPS_DECISION_MATRIX` in `planningEvidence.ts`.
 *
 * This replaces the old rule in `surgicalPlan.ts` ("high inflammation always
 * raises the NS grade by one step", `NS_GRADE_ESCALATION`), which let a
 * hostile-but-oncologically-low-risk side get the same wider plane as a
 * genuinely EPE-positive one. Here, escalation toward a wider plane happens
 * only when EPE itself is elevated; a hostile-but-EPE-low side instead gets
 * an operative *protocol* note (early exposure, athermal dissection,
 * alternate direction, hydrodissection, consent to convert intraoperatively)
 * while keeping the plane the EPE risk alone would justify.
 */
import { PIPS_EPE_CUTS } from "@/lib/compass/planningEvidence";
import type { HostilityTier } from "@/lib/compass/planeHostility";
import type { ClinicalState } from "@/types/patient";

export type EpeTier = "low" | "intermediate" | "high";

export function epeTier(p: number): EpeTier {
  const cuts = PIPS_EPE_CUTS.value;
  return p >= cuts.high ? "high" : p >= cuts.intermediate ? "intermediate" : "low";
}

export type DecisionCode = "maximal" | "preserve-hostile-protocol" | "wider-plane" | "graded-frozen-section" | "defer";

export interface DecisionMatrixResult {
  code: DecisionCode;
  /** true when this result should widen the plane beyond what EPE-zone thresholds alone would set */
  escalate: boolean;
  /** true when the hostile-plane operative protocol note applies, independent of escalation */
  hostileProtocol: boolean;
  rationale: string;
}

const HOSTILE = (t: HostilityTier) => t === "high" || t === "very-high";

export function planeDecisionMatrix(epe: EpeTier, hostility: HostilityTier): DecisionMatrixResult {
  if (epe === "high") {
    return {
      code: "wider-plane",
      escalate: true,
      hostileProtocol: false,
      rationale: HOSTILE(hostility)
        ? "High EPE probability and a hostile plane — oncologic margin takes priority; counsel that functional preservation on this side is unlikely."
        : "High EPE probability — oncologic margin takes priority regardless of plane quality.",
    };
  }
  if (epe === "intermediate") {
    return {
      code: "graded-frozen-section",
      escalate: false,
      hostileProtocol: HOSTILE(hostility),
      rationale: HOSTILE(hostility)
        ? "Intermediate EPE on a hostile plane — highest-value setting for frozen-section-guided grading; start interfascial, apply the hostile-plane protocol, widen only on a positive margin."
        : "Intermediate EPE — start interfascial with frozen-section guidance; widen only on a positive margin.",
    };
  }
  // epe === "low"
  if (HOSTILE(hostility)) {
    return {
      code: "preserve-hostile-protocol",
      escalate: false,
      hostileProtocol: true,
      rationale: "Low EPE probability on a hostile plane — fibrosis alone does not justify wide excision; apply the hostile-plane protocol (early exposure, athermal low-traction dissection, alternate direction, hydrodissection) and consent for an intraoperative plane change.",
    };
  }
  return {
    code: "maximal",
    escalate: false,
    hostileProtocol: false,
    rationale: "Low EPE probability, plane not hostile — maximal anatomically appropriate nerve sparing.",
  };
}

/**
 * Hard-stop / review gates (`PIPS_GATES` in planningEvidence.ts) — checked
 * before, and separately from, the EPE x hostility matrix above. These are
 * whole-patient facts, not points, so they are never folded into either
 * axis's score.
 */
export interface PipsGates {
  activeInfection: boolean;
  imagingDiscordant: boolean;
  mriArtifact: boolean;
  keyDataMissing: boolean;
}

export function checkPipsGates(S: ClinicalState): PipsGates {
  return {
    activeInfection: !!S.flag_active_infection,
    imagingDiscordant: !!S.flag_imaging_discordant,
    mriArtifact: !!S.flag_mri_artifact,
    keyDataMissing: !!S.flag_key_data_missing,
  };
}

/** Overrides a side's decision when the active-infection gate is tripped — surgery is deferred, not scored. */
export function applyDeferGate(decision: DecisionMatrixResult, gates: PipsGates): DecisionMatrixResult {
  if (!gates.activeInfection) return decision;
  return {
    code: "defer",
    escalate: false,
    hostileProtocol: false,
    rationale: "Active infection (bacterial prostatitis, abscess, fistula, sepsis, or a positive culture with symptoms) — treat/drain and re-image at 6-12 weeks before elective surgery; this side has not been scored.",
  };
}
