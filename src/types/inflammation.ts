/**
 * Standalone side-specific ECE / periprostatic-inflammation research instrument.
 *
 * Deliberately decoupled from `ClinicalState` / `Prostate3DInputV1` — this is a
 * separate research prototype (ported from the standalone HTML calculator),
 * not yet merged into the main COMPASS prediction pipeline. Every coefficient
 * is an expert prior, not a fitted regression coefficient. See
 * `src/lib/inflammation/model.ts` for the scoring logic.
 *
 * Schemas below are the single source of truth for these shapes — types are
 * inferred from them (`z.infer`), and the same schemas validate every trust
 * boundary that can hand this tool untyped data: persisted localStorage,
 * an imported case JSON file, and a pasted coefficient-config JSON blob.
 * Validating late (deep inside `model.ts`, mid-calculation) is how the
 * "undefined slips past a `!== null` check" class of bug happens; validating
 * at the boundary turns that into one readable error instead.
 */
import { z } from "zod";

const nnum = z.number().nullable();
const nenum = <T extends [string, ...string[]]>(values: T) => z.enum(values).nullable();

export const patientInflammationInputSchema = z.object({
  psa: nnum,
  vol: nnum,
  priorBx: nenum(["1", "2", "3"]),
  route: nenum(["tp", "tr"]),
  bxMri: nnum,
  bxSurg: nnum,
  bmi: nnum,
  mets: nenum(["0", "1", "2", "3", "4", "5"]),
  crp: nnum,
  nlr: nnum,
  priorIntv: z.boolean(),
  // Longitudinal kinetics
  psaPrior: nnum,
  psaPriorMonths: nnum,
});
export type PatientInflammationInput = z.infer<typeof patientInflammationInputSchema>;

export const sideInflammationInputSchema = z.object({
  // MRI — capsular interface geometry
  ccl: nnum,
  angle: nnum,
  caps: nenum(["0", "1", "2"]),
  epeGr: nenum(["0", "1", "2", "3"]),
  morph: nenum(["nod", "band", "none"]),
  anch: nenum(["yes", "no"]),
  // MRI — quantitative
  adcI: nnum,
  adcL: nnum,
  t2Ratio: nnum,
  dce: nenum(["3", "12"]),
  t1hi: z.boolean(),
  // Periprostatic soft tissue
  fatPl: nenum(["0", "1", "2"]),
  pdff: z.boolean(),
  sym: z.boolean(),
  vein: z.boolean(),
  // Periprostatic adipose tissue (PPAT)
  rwo: nnum,
  ppatFibrosis: z.boolean(),
  ppatGeom: z.boolean(),
  // PSMA PET
  suvL: nnum,
  suvP: nnum,
  psmaFocalUptake: z.boolean(),
  // Micro-ultrasound
  mus1: z.boolean(),
  mus2: z.boolean(),
  mus3: z.boolean(),
  mus4: z.boolean(),
  // Biopsy — oncological
  gg: nenum(["1", "2", "3", "4", "5"]),
  posC: nnum,
  maxI: nnum,
  pni: z.boolean(),
  // Biopsy — inflammatory
  iraniG: nenum(["0", "1", "2", "3"]),
  iraniA: nenum(["0", "1", "2", "3"]),
  gran: z.boolean(),
  nCores: nnum,
  // Longitudinal kinetics
  mriIntervalChange: nenum(["growing", "stable", "shrinking", "new"]),
  // Outcome (post-op ground truth — optional, filled in after pathology)
  outEce: nenum(["yes", "no"]),
  outInflGrade: nenum(["0", "1", "2", "3"]),
  outPlaneCall: nenum(["1", "2", "3", "4"]),
});
export type SideInflammationInput = z.infer<typeof sideInflammationInputSchema>;

export function emptyPatientInput(): PatientInflammationInput {
  return {
    psa: null, vol: null, priorBx: null, route: null, bxMri: null, bxSurg: null,
    bmi: null, mets: null, crp: null, nlr: null, priorIntv: false,
    psaPrior: null, psaPriorMonths: null,
  };
}

export function emptySideInput(): SideInflammationInput {
  return {
    ccl: null, angle: null, caps: null, epeGr: null, morph: null, anch: null,
    adcI: null, adcL: null, t2Ratio: null, dce: null, t1hi: false,
    fatPl: null, pdff: false, sym: false, vein: false,
    rwo: null, ppatFibrosis: false, ppatGeom: false,
    suvL: null, suvP: null, psmaFocalUptake: false,
    mus1: false, mus2: false, mus3: false, mus4: false,
    gg: null, posC: null, maxI: null, pni: false,
    iraniG: null, iraniA: null, gran: false, nCores: null,
    mriIntervalChange: null,
    outEce: null, outInflGrade: null, outPlaneCall: null,
  };
}

const num = z.number();
const rec = <T extends [string, ...string[]]>(keys: T) =>
  z.object(Object.fromEntries(keys.map((k) => [k, num])) as Record<T[number], typeof num>);

export const inflammationConfigSchema = z.object({
  intercept: num,
  hardScale: num,
  softScale: num,
  shrinkMax: num,
  shrinkExp: num,
  eceHard: z.object({
    gg: rec(["1", "2", "3", "4", "5"]),
    posCoresPer100: num,
    posCoresThirdPct: num,
    posCoresThird: num,
    maxInvolPer100: num,
    pni: num,
    psadPerUnit: num,
    psadRef: num,
    psadClamp: num,
    psmaRatioHigh: num,
    psmaRatioMid: num,
    psmaRatioLow: num,
    psmaIndexHot: num,
    psmaFocalUptake: num,
  }),
  eceSoft: z.object({
    cclPerMm: num,
    cclRef: num,
    cclClampLo: num,
    cclClampHi: num,
    anglePer60: num,
    angleRef: num,
    capsIntegrity: rec(["0", "1", "2"]),
    epeGrade: rec(["0", "1", "2", "3"]),
    morphNodular: num,
    morphBand: num,
    morphNone: num,
    adcPer010: num,
    adcRef: num,
    adcRatioSame: num,
    adcRatioDiff: num,
    dceWashout: num,
    dcePersist: num,
    musPerFeature: z.object({ 0: num, 1: num, 2: num, 3: num, 4: num }),
    anchoredYes: num,
    anchoredNo: num,
    t2RatioPer01: num,
    t2RatioRef: num,
    t2RatioClampLo: num,
    t2RatioClampHi: num,
    rwoPer10: num,
    rwoRef: num,
    rwoClampLo: num,
    rwoClampHi: num,
    ppatFibrosisHigh: num,
    ppatGeomAltered: num,
  }),
  infl: z.object({
    iraniG: num,
    iraniA: num,
    granulomatous: num,
    priorBx: rec(["1", "2", "3"]),
    manyCores: num,
    bxMriLt28: num,
    bxMri28to56: num,
    bxSurgLt56: num,
    t1Hyper: num,
    morphBandLike: num,
    bilatSymmetric: num,
    fatPlane: rec(["0", "1", "2"]),
    pdffReduced: num,
    dcePersistPeri: num,
    venousProminent: num,
    priorIntervention: num,
    bmi30: num,
    mets3: num,
    crpHigh: num,
    nlrHigh: num,
  }),
  kinetics: z.object({
    psaVelocityThreshold: num,
    psaVelocityEceHard: num,
    psaVelocityDecliningInfl: num,
    mriGrowingEceSoft: num,
    mriShrinkingEceSoft: num,
    mriShrinkingInfl: num,
    mriStableInfl: num,
  }),
  inflMax: num,
});
export type InflammationConfig = z.infer<typeof inflammationConfigSchema>;

export const cohortCaseSchema = z.object({
  patient: patientInflammationInputSchema,
  sides: z.object({ L: sideInflammationInputSchema, R: sideInflammationInputSchema }),
});
export type CohortCase = z.infer<typeof cohortCaseSchema>;

export const cohortSchema = z.array(cohortCaseSchema);

export interface WeightedTerm {
  label: string;
  value: number;
}

export interface SideInflammationResult {
  pRaw: number;
  pAdj: number;
  inflScore: number;
  lambda: number;
  hardTerms: WeightedTerm[];
  softTerms: WeightedTerm[];
  inflTerms: WeightedTerm[];
  touched: number;
  hasSoftEvidence: boolean;
}

export interface NsGradeInfo {
  n: 1 | 2 | 3 | 4;
  label: string;
  desc: string;
}
