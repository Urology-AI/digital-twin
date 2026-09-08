/**
 * Comparison: the OLD `NS_GRADE_ESCALATION` rule ("if whole-patient
 * inflammation risk is high, raise the NS grade by one step") vs. the NEW
 * PIPS-style decision matrix (`planeDecisionMatrix.ts`, keyed by this side's
 * own EPE tier and its own plane-hostility tier).
 *
 * The old rule is no longer wired into `surgicalPlan.ts` (see that file's
 * history), but is reimplemented here, verbatim, purely so the two rules can
 * be run side by side on the same inputs. This is not a regression test for
 * behaviour that still exists in the app — it is a record of *why* the
 * rule changed, with the disagreement cases spelled out.
 *
 * Three real differences fall out of running both rules across the same
 * scenarios:
 *
 *  1. BLIND SPOT — the old rule reads only the whole-patient
 *     `InflammationRisk` score, which has no side-specific MRI input at all.
 *     A side with a genuinely hostile plane (effaced capsule-fat interface,
 *     obliterated NVB corridor) produces NO signal under the old rule if the
 *     patient's overall history is otherwise clean. The new rule scores that
 *     side directly and attaches a hostile-plane protocol note.
 *
 *  2. FRAGILE ESCALATION — the old rule never re-checks this side's own EPE
 *     probability at the final step; it trusts the zone-aware NS grade to
 *     have already captured EPE and only ever adds an inflammation bump on
 *     top. If the zone grade under-calls a high-EPE side for any reason, the
 *     old rule has no independent oncologic check to catch it. The new rule
 *     always re-derives an EPE tier from this side's own probability and
 *     escalates on that basis regardless of what the zone grade said.
 *
 *  3. MISATTRIBUTED RATIONALE — when both EPE and whole-patient inflammation
 *     are high, the old rule's rationale string always says "raised for
 *     severe inflammation", even when the true driver is EPE. That
 *     conflates the two questions the PIPS framework insists stay separate:
 *     "can this be preserved oncologically" vs. "how hard will preservation
 *     be". The new rule's rationale is EPE-first whenever EPE actually set
 *     the plane.
 */
import { describe, expect, it } from "vitest";
import { defaultClinicalState, type ClinicalState } from "@/types/patient";
import { predictInflammationRisk } from "@/lib/compass/inflammationRisk";
import { predictPlaneHostility } from "@/lib/compass/planeHostility";
import { epeTier, planeDecisionMatrix } from "@/lib/compass/planeDecisionMatrix";
import { NS_GRADE_ESCALATION } from "@/lib/compass/planningEvidence";

/** The old rule, reimplemented verbatim for comparison — see file header. */
function oldEscalation(S: ClinicalState, modelGrade: number) {
  const infl = predictInflammationRisk(S);
  const esc = NS_GRADE_ESCALATION.value;
  const escalate = infl.tier === "high" && esc.high_steps > 0 && modelGrade < 3;
  const grade = escalate ? Math.min(3, modelGrade + esc.high_steps) : modelGrade;
  const rationale = escalate ? "raised for severe inflammation" : infl.tier === "moderate" ? "moderate inflammation flagged" : "no change";
  return { escalate, grade, rationale, inflammationTier: infl.tier };
}

function newDecision(S: ClinicalState, side: "left" | "right", modelGrade: number, sideEce: number) {
  const hostility = predictPlaneHostility(S, side);
  const tier = epeTier(sideEce);
  const decision = planeDecisionMatrix(tier, hostility.tier);
  const escalate = decision.escalate && modelGrade < 3;
  const grade = escalate ? Math.min(3, modelGrade + 1) : modelGrade;
  return { escalate, grade, rationale: decision.rationale, epeTier: tier, hostilityTier: hostility.tier, hostileProtocol: decision.hostileProtocol };
}

describe("old escalation rule vs. new PIPS decision matrix", () => {
  it("agree when both EPE and hostility/inflammation are low: no escalation", () => {
    const S = defaultClinicalState();
    const old = oldEscalation(S, 2);
    const next = newDecision(S, "left", 2, 0.02);
    expect(old.escalate).toBe(false);
    expect(next.escalate).toBe(false);
    expect(old.grade).toBe(next.grade);
  });

  it("BLIND SPOT — old rule sees nothing for a hostile side when whole-patient history is clean; new rule flags the hostile-plane protocol", () => {
    const S = defaultClinicalState();
    S.mri_capsule_interface_l = 3; // effaced capsule-fat interface, left side only
    S.mri_nvb_plane_l = 2; // obliterated NVB corridor, left side only

    const old = oldEscalation(S, 2);
    const next = newDecision(S, "left", 2, 0.02); // EPE stays low

    expect(old.inflammationTier).toBe("low"); // old model never saw the side-specific MRI fields
    expect(old.escalate).toBe(false);
    expect(old.rationale).toBe("no change"); // — and gives the surgeon no signal at all

    expect(next.hostilityTier).toMatch(/high|very-high/);
    expect(next.escalate).toBe(false); // correctly does NOT widen a low-EPE side
    expect(next.hostileProtocol).toBe(true); // — but does flag the operative protocol
    expect(next.grade).toBe(old.grade); // same final grade, very different information
  });

  it("FRAGILE ESCALATION — old rule has no independent EPE check; new rule escalates a high-EPE side even if the zone grade under-called it", () => {
    const S = defaultClinicalState(); // clean history — old inflammation tier stays low
    const underCalledZoneGrade = 2; // simulates a zone-model grade that didn't reach 3
    const highSideEce = 0.4; // this side's own EPE probability is high (>35%)

    const old = oldEscalation(S, underCalledZoneGrade);
    const next = newDecision(S, "left", underCalledZoneGrade, highSideEce);

    expect(old.escalate).toBe(false); // old rule cannot react to EPE at all here
    expect(old.grade).toBe(2);

    expect(next.epeTier).toBe("high");
    expect(next.escalate).toBe(true); // new rule re-derives EPE tier and escalates on it
    expect(next.grade).toBe(3);
  });

  it("MISATTRIBUTED RATIONALE — when both axes are high, old rule blames inflammation even though EPE is what should drive the plane", () => {
    const S = defaultClinicalState();
    S.intraop_inflammation_l = 3; // forces whole-patient inflammation tier to "high"
    const highSideEce = 0.5;

    const old = oldEscalation(S, 2);
    const next = newDecision(S, "left", 2, highSideEce);

    expect(old.escalate).toBe(true);
    expect(old.rationale).toBe("raised for severe inflammation"); // wrong attribution — EPE, not fibrosis, is driving this

    expect(next.escalate).toBe(true);
    expect(next.epeTier).toBe("high");
    expect(next.rationale).toMatch(/EPE/i); // correctly EPE-first

    // Same final grade, correct attribution only under the new rule.
    expect(old.grade).toBe(next.grade);
  });

  it("agree on plan when EPE is intermediate: both land on a graded/frozen-section approach in spirit", () => {
    // The old rule has no notion of "graded"; it only ever escalates by one
    // step or leaves the grade alone. The new rule's intermediate-EPE branch
    // never escalates either (frozen section decides intraoperatively), so
    // the grades still agree here — the new rule's advantage is entirely in
    // making that "await frozen section" plan explicit instead of implicit.
    const S = defaultClinicalState();
    const old = oldEscalation(S, 2);
    const next = newDecision(S, "left", 2, 0.25); // 25% — intermediate EPE tier

    expect(next.epeTier).toBe("intermediate");
    expect(next.escalate).toBe(false);
    expect(old.escalate).toBe(false);
    expect(old.grade).toBe(next.grade);
  });
});
