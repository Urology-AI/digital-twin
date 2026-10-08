/**
 * Everything the Planning tab and the planning section of the PDF report derive
 * from a patient: the baseline-vs-plan outcome comparison, BCR by plan, the PIPS
 * counselling block and the recovery reserve. One implementation, so the page
 * and the report can never disagree.
 */
import {
  computeFunctionalOutcomes,
  type AlcoholLevel,
  type ExerciseLevel,
  type FunctionalInputs,
  type Pde5Regimen,
  type PfmtLevel,
  type PlanModifiers,
  type SmokingStatus,
} from "@/lib/compass/functionalOutcomes";
import { bcrByPlan } from "@/lib/compass/bcrByPlan";
import { buildPipsCounseling } from "@/lib/compass/pipsCounseling";
import { computeRecoveryReserve } from "@/lib/compass/recoveryReserve";
import type { ClinicalState } from "@/types/patient";
import type { CompassPredictions } from "@/types/prediction";

const pf = (v: string): PfmtLevel =>
  (["none", "basic", "moderate", "intensive"] as string[]).includes(v) ? (v as PfmtLevel) : "basic";
const ex = (v: string): ExerciseLevel =>
  (["sedentary", "light", "moderate", "active"] as string[]).includes(v) ? (v as ExerciseLevel) : "moderate";
const sm = (v: string): SmokingStatus =>
  (["never", "former", "current"] as string[]).includes(v) ? (v as SmokingStatus) : "never";
const p5 = (v: string): Pde5Regimen =>
  (["none", "prn", "daily"] as string[]).includes(v) ? (v as Pde5Regimen) : "prn";

function baseInputs(S: ClinicalState): Omit<FunctionalInputs, "nsL" | "nsR" | "plan"> {
  return {
    age: S.age,
    shim: S.shim,
    ipss: S.ipss,
    bmi: S.bmi,
    pfmt: pf(S.pfmt),
    exercise: ex(S.exercise),
    smoking: sm(S.smoking),
    pde5: p5(S.pde5),
    alcohol: (S.alcohol || "moderate") as AlcoholLevel,
    dm: S.dm,
    htn: S.htn,
    cad: S.cad,
  };
}

export function computePlanningView(S: ClinicalState, predictions: CompassPredictions) {
  const { plan, inflammation } = predictions;
  const base = baseInputs(S);

  // Baseline = the model's recommended NS grade + standard technique, but the
  // SAME patient (inflammation tier carries into both arms so the delta is
  // purely the surgical choices).
  const baselineMods: PlanModifiers = {
    svPreservationL: true,
    svPreservationR: true,
    hydrodissectionL: false,
    hydrodissectionR: false,
    inflammationTier: inflammation.tier,
  };
  const baseline = computeFunctionalOutcomes({
    ...base,
    nsL: plan.left.recommendedGrade,
    nsR: plan.right.recommendedGrade,
    plan: baselineMods,
  });

  const planMods: PlanModifiers = {
    svPreservationL: plan.left.svPreservation.value,
    svPreservationR: plan.right.svPreservation.value,
    hydrodissectionL: plan.left.hydrodissection.value,
    hydrodissectionR: plan.right.hydrodissection.value,
    inflammationTier: inflammation.tier,
  };
  const withPlan = computeFunctionalOutcomes({
    ...base,
    nsL: plan.left.nsGrade,
    nsR: plan.right.nsGrade,
    plan: planMods,
  });

  const bcr = bcrByPlan(
    S,
    predictions.bcr36,
    {
      nsGrade: Math.max(plan.left.recommendedGrade, plan.right.recommendedGrade),
      hydrodissection: false,
      inflammationTier: inflammation.tier,
    },
    {
      nsGrade: Math.max(plan.left.nsGrade, plan.right.nsGrade),
      hydrodissection: planMods.hydrodissectionL || planMods.hydrodissectionR,
      inflammationTier: inflammation.tier,
    },
  );

  const counseling = buildPipsCounseling(S, plan, predictions.eceL, predictions.eceR, base);
  const reserve = computeRecoveryReserve(S, base);

  return { baseline, withPlan, bcr, counseling, reserve };
}
