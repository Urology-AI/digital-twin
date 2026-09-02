/**
 * COMPASS Functional Outcomes predictor.
 *
 * The NS-grade base rates (`POT`/`CONT`), modifiable-factor deltas (`MF`) and
 * age/SHIM/IPSS adjustment factors below are the COMPASS RARP functional-outcome
 * working nomogram (Mount Sinai; ported from COMPASS_final.html) — see
 * `FUNCTIONAL_OUTCOMES_MODEL` in planningEvidence.ts for provenance. Recovery-
 * trajectory shape follows Ficarra 2012 and Tewari 2012 systematic reviews.
 * Not yet a formally published fitted model; surfaced in the UI as provisional.
 *
 * Operative-choice and inflammation deltas come from `PLAN_DELTAS` (literature).
 */
import {
  FUNCTIONAL_OUTCOMES_MODEL,
  FULL_RECOVERY_THRESHOLD,
  HEALER_THRESHOLD,
  MODIFIABLE_BCR,
  PLAN_DELTAS,
} from "@/lib/compass/planningEvidence";

/** Re-exported so panels can cite the functional model without a second import. */
export const FUNCTIONAL_MODEL_CITATION = FUNCTIONAL_OUTCOMES_MODEL.citation;

export type PfmtLevel = 'none' | 'basic' | 'moderate' | 'intensive';
export type ExerciseLevel = 'sedentary' | 'light' | 'moderate' | 'active';
export type SmokingStatus = 'never' | 'former' | 'current';
export type Pde5Regimen = 'none' | 'prn' | 'daily';
export type AlcoholLevel = 'none' | 'moderate' | 'heavy';

export type HoodPlan = 'none' | 'unilateral' | 'bilateral';
export type InflammationTierInput = 'low' | 'moderate' | 'high';
export type HealerTier = 'super' | 'healer' | 'delayed' | 'non-recovery';

/** Optional operative-plan modifiers applied on top of the NS-grade base rates. */
export interface PlanModifiers {
  hood: HoodPlan;
  bnPreservation: boolean;
  svPreservationL: boolean;
  svPreservationR: boolean;
  hydrodissectionL: boolean;
  hydrodissectionR: boolean;
  inflammationTier: InflammationTierInput;
}

export interface FunctionalInputs {
  nsL: number; // 1-3
  nsR: number; // 1-3
  age: number;
  shim: number;
  ipss: number;
  bmi: number;
  pfmt: PfmtLevel;
  exercise: ExerciseLevel;
  smoking: SmokingStatus;
  pde5: Pde5Regimen;
  alcohol: AlcoholLevel;
  dm: boolean;
  htn: boolean;
  cad: boolean;
  /** operative-plan modifiers; omit to score the NS grade alone */
  plan?: PlanModifiers;
}

export interface FunctionalOutcomesResult {
  potency12: number | null;   // null if SHIM < 12
  continence12: number;
  potencyTimeline: (number | null)[];  // [6wk, 3mo, 6mo, 12mo, 18mo] — null when SHIM < 12
  continenceTimeline: number[];
  potencyAdj: number;
  continenceAdj: number;
  shimValid: boolean;
  /** erectile-recovery phenotype from time-to-potency (null when SHIM < 12) */
  healerTier: HealerTier | null;
  /** probability mass in each recovery window, 0–1 (null when SHIM < 12) */
  healerBands: { super: number; healer: number; delayed: number } | null;
  /** net pp effect of the operative-plan modifiers (0 when no plan passed) */
  planPotencyAdj: number;
  planContinenceAdj: number;
}

// POT and CONT arrays: [6wk, 3mo, 6mo, 12mo, 12mo(main), 18mo, beyond]
const POT = {
  BL_G1:       [44, 61, 87, 90, 90, 93, 96] as number[],
  UL_G1_CL_G2: [37, 56, 80, 85, 85, 90, 93] as number[],
  BL_G2:       [29, 51, 73, 81, 81, 88, 91] as number[],
  G3_PLUS:     [25, 43, 70, 84, 84, 82, 85] as number[],
  VERY_HIGH:   [15, 30, 55, 72, 72, 74, 78] as number[],
};

const CONT = {
  BL_G1:       [60, 77, 92, 96, 96, 95, 97] as number[],
  UL_G1_CL_G2: [56, 77, 92, 95, 95, 95, 97] as number[],
  BL_G2:       [51, 77, 92, 94, 94, 96, 97] as number[],
  G3_PLUS:     [49, 72, 87, 93, 93, 95, 96] as number[],
  VERY_HIGH:   [42, 65, 80, 89, 89, 92, 94] as number[],
};

const MF = {
  bmi: {
    pot: (b: number) => b < 25 ? 0 : b < 30 ? -3 : -8,
    cont: (b: number) => b < 25 ? 0 : b < 30 ? -2 : -5,
  },
  pfmt: {
    pot: { none: 0, basic: 2, moderate: 4, intensive: 6 } as Record<PfmtLevel, number>,
    cont: { none: 0, basic: 3, moderate: 6, intensive: 10 } as Record<PfmtLevel, number>,
  },
  exercise: {
    pot: { sedentary: -3, light: 0, moderate: 2, active: 4 } as Record<ExerciseLevel, number>,
    cont: { sedentary: -2, light: 0, moderate: 2, active: 3 } as Record<ExerciseLevel, number>,
  },
  pde5: {
    pot: { none: 0, prn: 4, daily: 8 } as Record<Pde5Regimen, number>,
  },
  smoking: {
    pot: { never: 0, former: -2, current: -8 } as Record<SmokingStatus, number>,
    cont: { never: 0, former: 0, current: -2 } as Record<SmokingStatus, number>,
  },
  alcohol: {
    pot: { none: 2, moderate: 0, heavy: -10 } as Record<AlcoholLevel, number>,
    cont: { none: 0, moderate: 0, heavy: -2 } as Record<AlcoholLevel, number>,
  },
  comorbid: {
    dm:  { pot: -8, cont: -3 },
    htn: { pot: -3, cont: -1 },
    cad: { pot: -5, cont: -1 },
  },
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** pp deltas from the operative-plan modifiers. `contEarly` applies to the
 *  6-week / 3-month continence points only (recovery-speed effect). */
function planDeltas(p: PlanModifiers | undefined): {
  pot: number;
  cont: number;
  contEarly: number;
} {
  if (!p) return { pot: 0, cont: 0, contEarly: 0 };
  const D = PLAN_DELTAS.value;
  let pot = 0;
  let cont = 0;
  let contEarly = 0;
  const apply = (d: { pot: number; cont: number; contEarly: number }) => {
    pot += d.pot;
    cont += d.cont;
    contEarly += d.contEarly;
  };
  if (p.hood === "bilateral") apply(D.hood_bilateral);
  else if (p.hood === "unilateral") apply(D.hood_unilateral);
  if (p.bnPreservation) apply(D.bladder_neck_preservation);
  if (p.hydrodissectionL) apply(D.hydrodissection);
  if (p.hydrodissectionR) apply(D.hydrodissection);
  if (!p.svPreservationL) apply(D.sv_non_preservation);
  if (!p.svPreservationR) apply(D.sv_non_preservation);
  if (p.inflammationTier === "moderate") apply(D.inflammation_moderate);
  else if (p.inflammationTier === "high") apply(D.inflammation_high);
  return { pot, cont, contEarly };
}

function healerTierFromTimeline(timeline: (number | null)[]): HealerTier | null {
  if (timeline.some((v) => v === null)) return null;
  const t = timeline as number[];
  const thr = HEALER_THRESHOLD.value;
  const full = FULL_RECOVERY_THRESHOLD.value;
  // [6wk, 3mo, 6mo, 12mo, 18mo]
  if (t[0]! >= full) return "super"; // full recovery by 6 weeks
  if (t[1]! >= thr || t[2]! >= thr || t[3]! >= thr) return "healer";
  if (t[4]! >= thr) return "delayed";
  return "non-recovery";
}

function healerBandsFromTimeline(
  timeline: (number | null)[],
): { super: number; healer: number; delayed: number } | null {
  if (timeline.some((v) => v === null)) return null;
  const t = timeline as number[];
  const sup = clamp(t[0]! / 100, 0, 1);
  const heal = clamp((t[3]! - t[0]!) / 100, 0, 1);
  const del = clamp((t[4]! - t[3]!) / 100, 0, 1);
  return { super: sup, healer: heal, delayed: del };
}

function blend(a: number[], b: number[], w: number): number[] {
  return a.map((v, i) => Math.round(v * (1 - w) + (b[i] ?? 0) * w));
}

function getPot(L: number, R: number): number[] {
  const w = Math.max(L, R);
  const b = Math.min(L, R);
  if (w === 1) return POT.BL_G1;
  if (w === 2 && b === 1) return POT.UL_G1_CL_G2;
  if (w === 2) return POT.BL_G2;
  if (w === 3 && b === 1) return blend(POT.BL_G2, POT.G3_PLUS, 0.5);
  if (w === 3 && b === 2) return POT.G3_PLUS;
  return POT.VERY_HIGH;
}

function getCont(L: number, R: number): number[] {
  const w = Math.max(L, R);
  const b = Math.min(L, R);
  if (w === 1) return CONT.BL_G1;
  if (w === 2 && b === 1) return CONT.UL_G1_CL_G2;
  if (w === 2) return CONT.BL_G2;
  if (w === 3 && b === 1) return blend(CONT.BL_G2, CONT.G3_PLUS, 0.5);
  if (w === 3 && b === 2) return CONT.G3_PLUS;
  return CONT.VERY_HIGH;
}

/**
 * Age adjustment factor applied to the potency curve. Exported so the
 * biological-age readout can show what the same patient's factor would be at
 * their biological age — the model itself is always called with chronological
 * age (see BIOLOGICAL_AGE in planningEvidence.ts).
 */
export function ageAdjustment(age: number): number {
  return (
    age <= 50 ? 1.10 :
    age <= 55 ? 1.10 - (age - 50) * 0.01 :
    age <= 60 ? 1.05 - (age - 55) * 0.01 :
    age <= 65 ? 1.00 - (age - 60) * 0.01 :
    age <= 70 ? 0.95 - (age - 65) * 0.02 :
    0.85
  );
}

export function computeFunctionalOutcomes(inputs: FunctionalInputs): FunctionalOutcomesResult {
  const { nsL, nsR, age, shim, ipss, bmi, pfmt, exercise, smoking, pde5, alcohol, dm, htn, cad } = inputs;

  const pd = getPot(nsL, nsR);
  const cd = getCont(nsL, nsR);

  const aA = ageAdjustment(age);

  // SHIM adjustment factor
  const sA =
    shim >= 21 ? 1.0 :
    shim >= 17 ? 0.92 + (shim - 17) * 0.02 :
    shim >= 12 ? 0.85 + (shim - 12) * 0.014 :
    0.70;

  // IPSS adjustment (continence)
  const iA =
    ipss <= 7 ? 0 :
    ipss <= 14 ? -3 :
    ipss <= 19 ? -6 :
    -10;

  // Potency and continence adjustments from lifestyle modifiable factors
  let pA = 0;
  let cA = 0;

  pA += MF.bmi.pot(bmi);
  cA += MF.bmi.cont(bmi);

  pA += MF.pfmt.pot[pfmt];
  cA += MF.pfmt.cont[pfmt];

  pA += MF.exercise.pot[exercise];
  cA += MF.exercise.cont[exercise];

  pA += MF.pde5.pot[pde5];

  pA += MF.smoking.pot[smoking];
  cA += MF.smoking.cont[smoking];

  pA += MF.alcohol.pot[alcohol];
  cA += MF.alcohol.cont[alcohol];

  if (dm)  { pA += MF.comorbid.dm.pot;  cA += MF.comorbid.dm.cont; }
  if (htn) { pA += MF.comorbid.htn.pot; cA += MF.comorbid.htn.cont; }
  if (cad) { pA += MF.comorbid.cad.pot; cA += MF.comorbid.cad.cont; }

  // Operative-plan modifiers (hood / bladder-neck / hydrodissection / SV / inflammation)
  const pdel = planDeltas(inputs.plan);
  pA += pdel.pot;
  cA += pdel.cont;
  const planPotencyAdj = pdel.pot;
  const planContinenceAdj = pdel.cont + pdel.contEarly;

  // Base predictions at 12mo
  const pB = Math.round((pd[4] ?? 0) * aA * sA);
  const cB = Math.round((cd[4] ?? 0) * (age >= 70 ? 0.95 : 1.0));

  const pF = clamp(pB + pA, 15, 98);
  const cF = clamp(cB + cA + iA, 40, 99);

  const shimValid = shim >= 12;

  // Potency timeline: [6wk, 3mo, 6mo, 12mo, 18mo]
  const potencyTimeline: (number | null)[] = shimValid
    ? [
        clamp(Math.round((pd[0] ?? 0) * aA * sA) + Math.round(pA * 0.5), 10, 90),
        clamp(Math.round((pd[1] ?? 0) * aA * sA) + Math.round(pA * 0.7), 15, 92),
        clamp(Math.round((pd[2] ?? 0) * aA * sA) + Math.round(pA * 0.9), 20, 95),
        pF,
        clamp(Math.round((pd[5] ?? 0) * aA * sA) + pA, 20, 99),
      ]
    : [null, null, null, null, null];

  // Continence timeline: [6wk, 3mo, 6mo, 12mo, 18mo]
  const continenceTimeline: number[] = [
    clamp(Math.round(cd[0] ?? 0) + Math.round(cA * 0.5) + pdel.contEarly, 30, 85),
    clamp(Math.round(cd[1] ?? 0) + Math.round(cA * 0.7) + pdel.contEarly, 50, 92),
    clamp(Math.round(cd[2] ?? 0) + Math.round(cA * 0.9), 70, 97),
    cF,
    clamp(Math.round(cd[5] ?? 0) + cA, 80, 99),
  ];

  return {
    potency12: shimValid ? pF : null,
    continence12: cF,
    potencyTimeline,
    continenceTimeline,
    potencyAdj: pA,
    continenceAdj: cA,
    shimValid,
    healerTier: healerTierFromTimeline(potencyTimeline),
    healerBands: healerBandsFromTimeline(potencyTimeline),
    planPotencyAdj,
    planContinenceAdj,
  };
}

/* ------------------------------------------------------------------ */
/* Per-factor breakdown — for the "modifiable factors" impact view    */
/* ------------------------------------------------------------------ */

export interface FactorContribution {
  label: string;
  detail: string;
  /** pp effect on 12-month potency (higher = better) */
  pot: number;
  /** pp effect on 12-month continence (higher = better) */
  cont: number;
  /** pp effect on BCR risk (higher = worse); only BMI has a pathway */
  bcrRisk: number;
  /** true if the patient can change it before surgery */
  modifiable: boolean;
}

type BreakdownInput = Pick<
  FunctionalInputs,
  "bmi" | "pfmt" | "exercise" | "pde5" | "smoking" | "alcohol" | "dm" | "htn" | "cad" | "ipss"
>;

export function modifiableFactorBreakdown(i: BreakdownInput): FactorContribution[] {
  const bmiBcr =
    i.bmi >= 35 ? MODIFIABLE_BCR.value.bmi_ge_35 : i.bmi >= 30 ? MODIFIABLE_BCR.value.bmi_ge_30 : 0;
  const ipssCont = i.ipss <= 7 ? 0 : i.ipss <= 14 ? -3 : i.ipss <= 19 ? -6 : -10;

  const rows: FactorContribution[] = [
    {
      label: "BMI",
      detail: `${Math.round(i.bmi)} kg/m²`,
      pot: MF.bmi.pot(i.bmi),
      cont: MF.bmi.cont(i.bmi),
      bcrRisk: Math.round(bmiBcr * 100),
      modifiable: true,
    },
    {
      label: "Pelvic floor training",
      detail: i.pfmt,
      pot: MF.pfmt.pot[i.pfmt],
      cont: MF.pfmt.cont[i.pfmt],
      bcrRisk: 0,
      modifiable: true,
    },
    {
      label: "Exercise",
      detail: i.exercise,
      pot: MF.exercise.pot[i.exercise],
      cont: MF.exercise.cont[i.exercise],
      bcrRisk: 0,
      modifiable: true,
    },
    {
      label: "PDE5 inhibitor",
      detail: i.pde5,
      pot: MF.pde5.pot[i.pde5],
      cont: 0,
      bcrRisk: 0,
      modifiable: true,
    },
    {
      label: "Smoking",
      detail: i.smoking,
      pot: MF.smoking.pot[i.smoking],
      cont: MF.smoking.cont[i.smoking],
      bcrRisk: 0,
      modifiable: true,
    },
    {
      label: "Alcohol",
      detail: i.alcohol,
      pot: MF.alcohol.pot[i.alcohol],
      cont: MF.alcohol.cont[i.alcohol],
      bcrRisk: 0,
      modifiable: true,
    },
    {
      label: "Voiding symptoms (IPSS)",
      detail: String(i.ipss),
      pot: 0,
      cont: ipssCont,
      bcrRisk: 0,
      modifiable: true,
    },
    ...(i.dm
      ? [{ label: "Diabetes", detail: "present", pot: MF.comorbid.dm.pot, cont: MF.comorbid.dm.cont, bcrRisk: 0, modifiable: false }]
      : []),
    ...(i.htn
      ? [{ label: "Hypertension", detail: "present", pot: MF.comorbid.htn.pot, cont: MF.comorbid.htn.cont, bcrRisk: 0, modifiable: false }]
      : []),
    ...(i.cad
      ? [{ label: "Coronary disease", detail: "present", pot: MF.comorbid.cad.pot, cont: MF.comorbid.cad.cont, bcrRisk: 0, modifiable: false }]
      : []),
  ];

  return rows.filter((r) => r.pot !== 0 || r.cont !== 0 || r.bcrRisk !== 0);
}
