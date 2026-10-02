/**
 * PIPS-R: baseline recovery reserve.
 *
 * The PIPS framework separates three questions per patient: can the bundle be
 * preserved oncologically (PIPS-EPE), how hard is the plane (PIPS-H), and how
 * much can the patient's neurovascular system recover if it IS preserved
 * (PIPS-R). PIPS-R "modifies counseling and rehabilitation, never the plane".
 *
 * No new coefficients are introduced. The reserve is the existing
 * functional-outcome nomogram evaluated for bilateral intrafascial
 * preservation, with PDE5 use, pelvic-floor training and the other lifestyle
 * levers held neutral, so it reflects the patient's baseline capacity (age,
 * baseline SHIM, diabetes, hypertension, coronary disease, smoking, BMI), not
 * what rehabilitation might add. Only the tier cutpoints are PIPS-specific.
 *
 * Factors the framework lists that the nomogram does not model (prior pelvic
 * radiation or ADT, pelvic fracture or urethral injury, PDE5 response, erection
 * hardness, testosterone, neuropathy, penile Doppler) are surfaced as flags
 * rather than being given invented numeric penalties.
 */
import { computeFunctionalOutcomes, type FunctionalInputs } from "@/lib/compass/functionalOutcomes";
import { PIPS_R_CUTS } from "@/lib/compass/planningEvidence";
import type { ClinicalState } from "@/types/patient";

export type ReserveTier = "good" | "reduced" | "poor";

export interface ReserveDriver {
  label: string;
  detail: string;
  /** percentage points of reserve this factor costs relative to its reference value */
  cost: number;
}

export interface RecoveryReserve {
  /** false when baseline SHIM < 12 (the nomogram does not estimate unassisted recovery) */
  available: boolean;
  /** expected unassisted erectile function at 18 months with bilateral preservation, 0-1 */
  probability: number | null;
  tier: ReserveTier | null;
  drivers: ReserveDriver[];
  /** risk factors present in this record that the nomogram does not model */
  notModelled: string[];
}

type Base = Omit<FunctionalInputs, "nsL" | "nsR" | "plan">;

/** Lifestyle and rehabilitation levers held neutral so the reserve is baseline capacity. */
function neutral(base: Base): Base {
  return { ...base, pde5: "none", pfmt: "none", exercise: "light", alcohol: "moderate", diet: undefined };
}

/** Expected unassisted potency at 18 months (0-100), or null when SHIM < 12. */
function reserveAt(base: Base): number | null {
  const r = computeFunctionalOutcomes({ ...neutral(base), nsL: 1, nsR: 1 });
  return r.potencyTimeline[4] ?? null;
}

export function reserveTier(p: number): ReserveTier {
  const cuts = PIPS_R_CUTS.value;
  return p >= cuts.good ? "good" : p >= cuts.reduced ? "reduced" : "poor";
}

export function computeRecoveryReserve(S: ClinicalState, base: Base): RecoveryReserve {
  const notModelled: string[] = [];
  if (S.prior_pelvic_radiation) notModelled.push("Prior pelvic radiation");
  if (S.neoadjuvant_adt) notModelled.push("Androgen-deprivation exposure");
  if (S.prior_pelvic_surgery === "bladder_fracture_urethroplasty") notModelled.push("Pelvic fracture, urethral injury or bladder surgery");

  const actual = reserveAt(base);
  if (actual === null) {
    return { available: false, probability: null, tier: null, drivers: [], notModelled };
  }

  const refs: { label: string; detail: string; ref: Partial<Base> }[] = [
    { label: "Age", detail: `${Math.round(base.age)} yrs, vs 55`, ref: { age: 55 } },
    { label: "Baseline erectile function", detail: `SHIM ${base.shim}, vs 25`, ref: { shim: 25 } },
    { label: "Diabetes", detail: "present", ref: { dm: false } },
    { label: "Hypertension", detail: "present", ref: { htn: false } },
    { label: "Coronary artery disease", detail: "present", ref: { cad: false } },
    { label: "Smoking", detail: base.smoking, ref: { smoking: "never" } },
    { label: "BMI", detail: `${Math.round(base.bmi)} kg/m², vs 22`, ref: { bmi: 22 } },
  ];
  const drivers = refs
    .map((r) => {
      const better = reserveAt({ ...base, ...r.ref });
      return { label: r.label, detail: r.detail, cost: Math.max(0, (better ?? actual) - actual) };
    })
    .filter((d) => d.cost > 0)
    .sort((a, b) => b.cost - a.cost);

  const probability = actual / 100;
  return { available: true, probability, tier: reserveTier(probability), drivers, notModelled };
}
