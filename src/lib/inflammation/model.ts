/**
 * Side-specific ECE / periprostatic-inflammation scoring — ported from the
 * standalone HTML research instrument. Kept intentionally separate from
 * `src/lib/models/ece.ts`: this is a prototype with expert-prior coefficients,
 * not validated against pathology, and must not affect the main COMPASS
 * predictions until it has been fitted on real data and deliberately merged.
 *
 * The ECE logit is split into `eceHard` terms (inflammation cannot mimic:
 * biopsy grade, core burden, PNI, PSA density, PSMA ratio) and `eceSoft`
 * terms (imaging morphology inflammation *can* mimic). Only the soft
 * subtotal is shrunk, and only when it is pushing the estimate upward —
 * this prevents a high inflammation score from de-escalating a side whose
 * hard oncological evidence already argues for extension.
 */
import { clamp, sigmoid } from "@/lib/utils/math";
import type {
  InflammationConfig,
  NsGradeInfo,
  PatientInflammationInput,
  SideInflammationInput,
  SideInflammationResult,
  WeightedTerm,
} from "@/types/inflammation";

export const DEFAULT_INFLAMMATION_CONFIG: InflammationConfig = {
  intercept: -2.30,
  hardScale: 0.55,
  softScale: 0.45,
  shrinkMax: 0.60,
  shrinkExp: 1.20,
  eceHard: {
    gg: { "1": 0.00, "2": 0.55, "3": 1.05, "4": 1.50, "5": 1.90 },
    posCoresPer100: 1.20,
    posCoresThirdPct: 33.34,
    posCoresThird: 1.41,
    maxInvolPer100: 0.80,
    pni: 0.45,
    psadPerUnit: 3.00,
    psadRef: 0.15,
    psadClamp: 0.90,
    psmaRatioHigh: 0.90,
    psmaRatioMid: 0.40,
    psmaRatioLow: -0.30,
    psmaIndexHot: 0.50,
    psmaFocalUptake: 0.65,
  },
  eceSoft: {
    cclPerMm: 0.09,
    cclRef: 10,
    cclClampLo: -0.90,
    cclClampHi: 1.60,
    anglePer60: 0.50,
    angleRef: 60,
    capsIntegrity: { "0": 0.00, "1": 0.50, "2": 1.10 },
    epeGrade: { "0": 0.00, "1": 0.40, "2": 0.90, "3": 1.40 },
    morphNodular: 0.60,
    morphBand: -0.70,
    morphNone: -0.30,
    adcPer010: 0.50,
    adcRef: 0.90,
    adcRatioSame: 0.60,
    adcRatioDiff: -0.60,
    dceWashout: 0.50,
    dcePersist: -0.50,
    musPerFeature: { 0: -0.30, 1: 0.10, 2: 0.50, 3: 0.90, 4: 1.30 },
    anchoredYes: 0.70,
    anchoredNo: -1.00,
    t2RatioPer01: 0.35,
    t2RatioRef: 1.05,
    t2RatioClampLo: -0.70,
    t2RatioClampHi: 0.70,
    rwoPer10: 0.20,
    rwoRef: 40,
    rwoClampLo: -0.60,
    rwoClampHi: 0.60,
    ppatFibrosisHigh: 0.45,
    ppatGeomAltered: 0.40,
  },
  infl: {
    iraniG: 7,
    iraniA: 5,
    granulomatous: 12,
    priorBx: { "1": 0, "2": 5, "3": 10 },
    manyCores: 4,
    bxMriLt28: 10,
    bxMri28to56: 4,
    bxSurgLt56: 5,
    t1Hyper: 9,
    morphBandLike: 10,
    bilatSymmetric: 9,
    fatPlane: { "0": 0, "1": 6, "2": 10 },
    pdffReduced: 8,
    dcePersistPeri: 6,
    venousProminent: 4,
    priorIntervention: 10,
    bmi30: 3,
    mets3: 3,
    crpHigh: 3,
    nlrHigh: 3,
  },
  kinetics: {
    psaVelocityThreshold: 0.75,
    psaVelocityEceHard: 0.50,
    psaVelocityDecliningInfl: 8,
    mriGrowingEceSoft: 0.60,
    mriShrinkingEceSoft: -0.60,
    mriShrinkingInfl: 10,
    mriStableInfl: 5,
  },
  inflMax: 155,
};

function add(arr: WeightedTerm[], label: string, value: number | null | undefined) {
  if (value) arr.push({ label, value });
}

export const OUTCOME_KEYS = new Set(["outEce", "outInflGrade", "outPlaneCall"]);

/** Count non-blank fields entered for a side, for the "sparse input" flag. Excludes outcome/ground-truth fields. */
export function countTouchedSideFields(side: SideInflammationInput): number {
  let n = 0;
  for (const [k, v] of Object.entries(side)) {
    if (OUTCOME_KEYS.has(k)) continue;
    if (typeof v === "boolean") { if (v) n++; }
    else if (v !== null && v !== "") n++;
  }
  return n;
}

export function scoreSide(
  patient: PatientInflammationInput,
  side: SideInflammationInput,
  cfg: InflammationConfig = DEFAULT_INFLAMMATION_CONFIG,
): SideInflammationResult {
  const H = cfg.eceHard, S = cfg.eceSoft, I = cfg.infl;
  const hardTerms: WeightedTerm[] = [];
  const softTerms: WeightedTerm[] = [];
  const inflTerms: WeightedTerm[] = [];

  // ---- ECE: hard terms ----
  if (side.gg) add(hardTerms, `Grade group ${side.gg}`, H.gg[side.gg]);

  if (side.posC !== null) {
    add(hardTerms, `Positive cores ${side.posC}%`, (side.posC / 100) * H.posCoresPer100);
    if (side.posC >= H.posCoresThirdPct) add(hardTerms, "Ipsilateral cores ≥1/3 positive", H.posCoresThird);
  }
  if (side.maxI !== null) {
    add(hardTerms, `Core involvement ${side.maxI}%`, (side.maxI / 100) * H.maxInvolPer100);
  }
  if (side.pni) add(hardTerms, "Perineural invasion", H.pni);

  let psad: number | null = null;
  if (patient.psa !== null && patient.vol && patient.vol > 0) {
    psad = patient.psa / patient.vol;
    add(
      hardTerms,
      `PSA density ${psad.toFixed(2)}`,
      clamp((psad - H.psadRef) * H.psadPerUnit, -H.psadClamp, H.psadClamp),
    );
  }

  let suvRatio: number | null = null;
  if (side.suvL && side.suvL > 0 && side.suvP !== null) {
    suvRatio = side.suvP / side.suvL;
    const w = suvRatio >= 0.70 ? H.psmaRatioHigh : suvRatio >= 0.40 ? H.psmaRatioMid : H.psmaRatioLow;
    add(hardTerms, `PSMA periprostatic:lesion ${suvRatio.toFixed(2)}`, w);
  }
  if (side.suvL !== null && side.suvL >= 13) add(hardTerms, "Lesion SUVmax ≥13", H.psmaIndexHot);
  if (side.psmaFocalUptake) add(hardTerms, "Focal periprostatic PSMA uptake", H.psmaFocalUptake);

  // ---- Kinetics: PSA velocity (progressive rise argues against inflammation) ----
  let psaVelocity: number | null = null;
  if (patient.psa !== null && patient.psaPrior !== null && patient.psaPriorMonths && patient.psaPriorMonths > 0) {
    psaVelocity = ((patient.psa - patient.psaPrior) / patient.psaPriorMonths) * 12;
    if (psaVelocity >= cfg.kinetics.psaVelocityThreshold) {
      add(hardTerms, `PSA velocity ${psaVelocity.toFixed(2)} ng/mL/yr`, cfg.kinetics.psaVelocityEceHard);
    }
  }

  // ---- ECE: soft terms ----
  if (side.ccl !== null) {
    add(
      softTerms,
      `Contact length ${side.ccl} mm`,
      clamp((side.ccl - S.cclRef) * S.cclPerMm, S.cclClampLo, S.cclClampHi),
    );
  }
  if (side.angle !== null) {
    add(
      softTerms,
      `Contact angle ${side.angle}°`,
      clamp(((side.angle - S.angleRef) / 60) * S.anglePer60, -0.60, 0.90),
    );
  }
  if (side.caps) add(softTerms, `Capsular integrity ${side.caps}`, S.capsIntegrity[side.caps]);
  if (side.epeGr) add(softTerms, `EPE grade ${side.epeGr}`, S.epeGrade[side.epeGr]);

  if (side.morph) {
    const label = side.morph === "nod" ? "Nodular morphology" : side.morph === "band" ? "Band / wedge morphology" : "No periprostatic change";
    const val = side.morph === "nod" ? S.morphNodular : side.morph === "band" ? S.morphBand : S.morphNone;
    add(softTerms, label, val);
  }
  if (side.anch) {
    add(softTerms, side.anch === "yes" ? "Anchored to index lesion" : "Free-standing abnormality", side.anch === "yes" ? S.anchoredYes : S.anchoredNo);
  }

  if (side.adcI !== null) {
    add(
      softTerms,
      `Interface ADC ${side.adcI.toFixed(2)}`,
      clamp(((S.adcRef - side.adcI) / 0.10) * S.adcPer010, -0.80, 1.00),
    );
  }
  let adcRatio: number | null = null;
  if (side.adcI !== null && side.adcL && side.adcL > 0) {
    adcRatio = side.adcI / side.adcL;
    if (adcRatio <= 1.15) add(softTerms, `ADC matches lesion (${adcRatio.toFixed(2)})`, S.adcRatioSame);
    else if (adcRatio >= 1.35) add(softTerms, `ADC unlike lesion (${adcRatio.toFixed(2)})`, S.adcRatioDiff);
  }

  if (side.dce) {
    add(softTerms, side.dce === "3" ? "DCE type 3 washout" : "DCE persistent / delayed", side.dce === "3" ? S.dceWashout : S.dcePersist);
  }

  const musN = ([side.mus1, side.mus2, side.mus3, side.mus4].filter(Boolean).length) as 0 | 1 | 2 | 3 | 4;
  if (musN > 0) add(softTerms, `Micro-US features ${musN}/4`, S.musPerFeature[musN]);

  if (side.t2Ratio !== null) {
    add(
      softTerms,
      `T2 signal ratio ${side.t2Ratio.toFixed(2)}`,
      clamp((side.t2Ratio - S.t2RatioRef) / 0.1 * S.t2RatioPer01, S.t2RatioClampLo, S.t2RatioClampHi),
    );
  }
  if (side.rwo !== null) {
    add(
      softTerms,
      `PPAT water:oil ratio ${side.rwo}`,
      clamp((side.rwo - S.rwoRef) / 10 * S.rwoPer10, S.rwoClampLo, S.rwoClampHi),
    );
  }
  if (side.ppatFibrosis) add(softTerms, "High PPAT radiomic fiber complexity", S.ppatFibrosisHigh);
  if (side.ppatGeom) add(softTerms, "Altered PPAT geometric shape", S.ppatGeomAltered);

  if (side.mriIntervalChange === "growing") {
    add(softTerms, "Interval MRI: growing", cfg.kinetics.mriGrowingEceSoft);
  } else if (side.mriIntervalChange === "shrinking") {
    add(softTerms, "Interval MRI: shrinking", cfg.kinetics.mriShrinkingEceSoft);
  }

  // ---- Inflammation axis ----
  if (side.iraniG) add(inflTerms, `Irani G ${side.iraniG}`, Number(side.iraniG) * I.iraniG);
  if (side.iraniA) add(inflTerms, `Irani A ${side.iraniA}`, Number(side.iraniA) * I.iraniA);
  if (side.gran) add(inflTerms, "Granulomatous inflammation", I.granulomatous);

  if (patient.priorBx) add(inflTerms, `Prior biopsy sessions ${patient.priorBx === "3" ? "≥3" : patient.priorBx}`, I.priorBx[patient.priorBx]);

  if (side.nCores !== null && side.nCores >= 8) add(inflTerms, `Ipsilateral cores ${side.nCores}`, I.manyCores);

  if (patient.bxMri !== null) {
    if (patient.bxMri < 28) add(inflTerms, `Biopsy→MRI ${patient.bxMri} d`, I.bxMriLt28);
    else if (patient.bxMri <= 56) add(inflTerms, `Biopsy→MRI ${patient.bxMri} d`, I.bxMri28to56);
  }
  if (patient.bxSurg !== null && patient.bxSurg < 56) add(inflTerms, `Biopsy→surgery ${patient.bxSurg} d`, I.bxSurgLt56);

  if (side.t1hi) add(inflTerms, "T1 hyperintensity at capsule", I.t1Hyper);
  if (side.morph === "band") add(inflTerms, "Band / wedge morphology", I.morphBandLike);
  if (side.sym) add(inflTerms, "Bilateral symmetric change", I.bilatSymmetric);

  if (side.fatPl) add(inflTerms, `Fat plane ${side.fatPl}`, I.fatPlane[side.fatPl]);
  if (side.pdff) add(inflTerms, "Reduced periprostatic PDFF", I.pdffReduced);
  if (side.dce === "12") add(inflTerms, "DCE persistent / delayed", I.dcePersistPeri);
  if (side.vein) add(inflTerms, "Venous plexus prominent", I.venousProminent);
  if (patient.priorIntv) add(inflTerms, "Prior TURP / focal Rx / BCG / prostatitis", I.priorIntervention);

  if (patient.bmi !== null && patient.bmi >= 30) add(inflTerms, "BMI ≥30", I.bmi30);
  if (patient.mets && Number(patient.mets) >= 3) add(inflTerms, "MetS ≥3 components", I.mets3);
  if (patient.crp !== null && patient.crp > 2.5) add(inflTerms, "CRP >2.5 mg/L", I.crpHigh);
  if (patient.nlr !== null && patient.nlr >= 3) add(inflTerms, "NLR ≥3", I.nlrHigh);

  if (psaVelocity !== null && psaVelocity < 0) {
    add(inflTerms, `PSA declining ${psaVelocity.toFixed(2)} ng/mL/yr`, cfg.kinetics.psaVelocityDecliningInfl);
  }
  if (side.mriIntervalChange === "shrinking") {
    add(inflTerms, "Interval MRI: shrinking", cfg.kinetics.mriShrinkingInfl);
  } else if (side.mriIntervalChange === "stable") {
    add(inflTerms, "Interval MRI: stable", cfg.kinetics.mriStableInfl);
  }

  // ---- Assemble ----
  const sum = (a: WeightedTerm[]) => a.reduce((t, w) => t + w.value, 0);
  const hardRaw = sum(hardTerms) * cfg.hardScale;
  const softRaw = sum(softTerms) * cfg.softScale;
  const inflRaw = sum(inflTerms);
  const inflScore = clamp((inflRaw / cfg.inflMax) * 100, 0, 100);

  const lambda = cfg.shrinkMax * Math.pow(inflScore / 100, cfg.shrinkExp);
  const softAdj = softRaw > 0 ? softRaw * (1 - lambda) : softRaw;

  const logitRaw = cfg.intercept + hardRaw + softRaw;
  const logitAdj = cfg.intercept + hardRaw + softAdj;

  return {
    pRaw: sigmoid(logitRaw) * 100,
    pAdj: sigmoid(logitAdj) * 100,
    inflScore,
    lambda,
    hardTerms,
    softTerms,
    inflTerms,
    touched: countTouchedSideFields(side),
    hasSoftEvidence: softTerms.length > 0,
  };
}

/** Martini incremental nerve-sparing grade labels, keyed by grade number — shared by
 *  the P(ECE)-threshold lookup below and by direct display of the digital twin's own
 *  zone-aware `nsL`/`nsR` grade, so both readouts use identical wording. */
export const NS_GRADE_BY_NUMBER: Record<1 | 2 | 3 | 4, Omit<NsGradeInfo, "n">> = {
  1: { label: "Grade 1 — intrafascial", desc: "Plane between periprostatic veins and pseudocapsule." },
  2: { label: "Grade 2 — interfascial", desc: "Perivenous plane." },
  3: { label: "Grade 3 — interfascial, wide", desc: "Outside the outer lateral prostatic fascia." },
  4: { label: "Grade 4 — extrafascial", desc: "Bundle taken with the specimen." },
};

export function nsGradeByNumber(n: number): NsGradeInfo {
  const clamped = Math.min(4, Math.max(1, Math.round(n))) as 1 | 2 | 3 | 4;
  return { n: clamped, ...NS_GRADE_BY_NUMBER[clamped] };
}

export function nsGrade(p: number): NsGradeInfo {
  if (p <= 10) return { n: 1, ...NS_GRADE_BY_NUMBER[1] };
  if (p <= 21) return { n: 2, ...NS_GRADE_BY_NUMBER[2] };
  if (p <= 73) return { n: 3, ...NS_GRADE_BY_NUMBER[3] };
  return { n: 4, ...NS_GRADE_BY_NUMBER[4] };
}
