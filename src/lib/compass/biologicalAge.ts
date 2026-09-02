/**
 * Biological age — the modifiable-factor burden re-expressed in years.
 *
 * This is a counselling display, not a model input: `runCompass` and the
 * functional-outcomes nomogram keep using chronological age. Year-equivalents
 * and the clamp come from `BIOLOGICAL_AGE` in planningEvidence.ts and are
 * provisional (see that citation).
 */
import { BIOLOGICAL_AGE } from "@/lib/compass/planningEvidence";
import type {
  AlcoholLevel,
  ExerciseLevel,
  SmokingStatus,
} from "@/lib/compass/functionalOutcomes";

const W = BIOLOGICAL_AGE.value;

export interface BiologicalAgeInputs {
  age: number;
  bmi: number;
  smoking: SmokingStatus;
  exercise: ExerciseLevel;
  alcohol: AlcoholLevel;
  dm: boolean;
  htn: boolean;
  cad: boolean;
}

export interface BiologicalAgeContribution {
  label: string;
  /** years added (+) or removed (−) vs. a same-age reference man */
  years: number;
  /** years recoverable if this factor were optimised */
  recoverable: number;
}

export interface BiologicalAgeResult {
  chronological: number;
  biological: number;
  /** biological − chronological, after clamping */
  offset: number;
  /** biological age if every modifiable factor were optimised */
  bestAchievable: number;
  /** years between `biological` and `bestAchievable` */
  potentialGain: number;
  /** per-factor breakdown, largest burden first */
  contributions: BiologicalAgeContribution[];
}

function bmiYears(bmi: number): number {
  if (!(bmi > 0)) return 0;
  if (bmi < 18.5) return W.bmi.underweight;
  if (bmi < 25) return W.bmi.normal;
  if (bmi < 30) return W.bmi.overweight;
  return W.bmi.obese;
}

const clamp = (n: number) => Math.max(W.clamp.min, Math.min(W.clamp.max, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

export function computeBiologicalAge(i: BiologicalAgeInputs): BiologicalAgeResult {
  // Optimised counterfactual: lifestyle levers can be moved, a smoking history
  // and established comorbidity cannot be undone — a current smoker can reach
  // "former" at best, and dm/htn/cad stay as they are.
  const rows: BiologicalAgeContribution[] = [
    {
      label: "BMI",
      years: bmiYears(i.bmi),
      recoverable: bmiYears(i.bmi) - W.bmi.normal,
    },
    {
      label: "Smoking",
      years: W.smoking[i.smoking],
      recoverable: W.smoking[i.smoking] - W.smoking[i.smoking === "never" ? "never" : "former"],
    },
    {
      label: "Exercise",
      years: W.exercise[i.exercise],
      recoverable: W.exercise[i.exercise] - W.exercise.active,
    },
    {
      label: "Alcohol",
      years: W.alcohol[i.alcohol],
      recoverable: W.alcohol[i.alcohol] - W.alcohol.none,
    },
    { label: "Diabetes", years: i.dm ? W.dm : 0, recoverable: 0 },
    { label: "Hypertension", years: i.htn ? W.htn : 0, recoverable: 0 },
    { label: "Coronary disease", years: i.cad ? W.cad : 0, recoverable: 0 },
  ];

  const raw = rows.reduce((s, r) => s + r.years, 0);
  const offset = clamp(raw);
  const bestOffset = clamp(raw - rows.reduce((s, r) => s + r.recoverable, 0));

  return {
    chronological: i.age,
    biological: round1(i.age + offset),
    offset: round1(offset),
    bestAchievable: round1(i.age + bestOffset),
    potentialGain: round1(offset - bestOffset),
    contributions: rows
      .filter((r) => r.years !== 0)
      .sort((a, b) => b.years - a.years),
  };
}
