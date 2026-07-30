/**
 * Literature-anchored behavior tests for the standalone inflammation instrument
 * (`src/lib/inflammation/model.ts`). Each block below tests one row of the
 * "favors ECE vs. favors inflammation" table assembled from the source
 * literature review (see `src/lib/inflammation/references.ts` for the full
 * citation list; reference numbers `[n]` below match that list). These are not
 * clinical-accuracy tests — no fitted ground truth exists yet (see the model's
 * own header) — they lock in that the *direction* of every coefficient matches
 * the published literature, and that the hard/soft/shrinkage architecture
 * behaves the way `model.ts`'s docstring says it does.
 */
import { describe, it, expect } from "vitest";
import {
  DEFAULT_INFLAMMATION_CONFIG,
  nsGrade,
  nsGradeByNumber,
  scoreSide,
} from "@/lib/inflammation/model";
import {
  emptyPatientInput,
  emptySideInput,
  type PatientInflammationInput,
  type SideInflammationInput,
} from "@/types/inflammation";

const P0 = emptyPatientInput();
const S0 = emptySideInput();
const baseline = scoreSide(P0, S0, DEFAULT_INFLAMMATION_CONFIG);

function score(patient: Partial<PatientInflammationInput> = {}, side: Partial<SideInflammationInput> = {}) {
  return scoreSide({ ...P0, ...patient }, { ...S0, ...side }, DEFAULT_INFLAMMATION_CONFIG);
}

describe("baseline (no fields entered)", () => {
  it("scores 0 on both axes with no evidence", () => {
    expect(baseline.inflScore).toBe(0);
    expect(baseline.touched).toBe(0);
  });
});

describe("MRI capsular interface geometry [7-11]", () => {
  it("capsular contact length >=15mm favors ECE, <10mm favors inflammation", () => {
    const wide = score({}, { ccl: 18 });
    const narrow = score({}, { ccl: 5 });
    expect(wide.pRaw).toBeGreaterThan(baseline.pRaw);
    expect(narrow.pRaw).toBeLessThan(baseline.pRaw);
  });

  it("contact angle >80deg favors ECE, <50deg favors inflammation [7]", () => {
    const wide = score({}, { angle: 90 });
    const narrow = score({}, { angle: 30 });
    expect(wide.pRaw).toBeGreaterThan(baseline.pRaw);
    expect(narrow.pRaw).toBeLessThan(baseline.pRaw);
  });

  it("capsular integrity: interrupted > thinned > intact [7]", () => {
    const intact = score({}, { caps: "0" });
    const thinned = score({}, { caps: "1" });
    const interrupted = score({}, { caps: "2" });
    expect(interrupted.pRaw).toBeGreaterThan(thinned.pRaw);
    expect(thinned.pRaw).toBeGreaterThan(intact.pRaw);
  });

  it("Mehralivand EPE grade is monotonic 0->3 [9]", () => {
    const grades = (["0", "1", "2", "3"] as const).map((g) => score({}, { epeGr: g }).pRaw);
    expect(grades).toEqual([...grades].sort((a, b) => a - b));
  });

  it("nodular morphology favors ECE; band/wedge favors inflammation and raises the inflammation index [13,16]", () => {
    const nodular = score({}, { morph: "nod" });
    const band = score({}, { morph: "band" });
    expect(nodular.pRaw).toBeGreaterThan(baseline.pRaw);
    expect(band.pRaw).toBeLessThan(baseline.pRaw);
    expect(band.inflScore).toBeGreaterThan(baseline.inflScore);
  });

  it("a lesion-anchored abnormality favors ECE; a free-standing one favors inflammation", () => {
    const anchored = score({}, { anch: "yes" });
    const freeStanding = score({}, { anch: "no" });
    expect(anchored.pRaw).toBeGreaterThan(baseline.pRaw);
    expect(freeStanding.pRaw).toBeLessThan(baseline.pRaw);
  });
});

describe("MRI quantitative features [7,12-16]", () => {
  it("low interface ADC (<0.85) favors ECE; high (>=0.90) favors inflammation [7,12]", () => {
    const low = score({}, { adcI: 0.75 });
    const high = score({}, { adcI: 1.0 });
    expect(low.pRaw).toBeGreaterThan(baseline.pRaw);
    expect(high.pRaw).toBeLessThan(baseline.pRaw);
  });

  it("interface ADC close to the lesion's own ADC favors ECE; very different favors inflammation", () => {
    const same = score({}, { adcI: 0.9, adcL: 0.85 });
    const different = score({}, { adcI: 0.9, adcL: 0.5 });
    expect(same.pRaw).toBeGreaterThan(different.pRaw);
  });

  it("elevated T2 ratio (>1.10) favors ECE; low (<1.00) favors inflammation [7,13-14]", () => {
    const high = score({}, { t2Ratio: 1.25 });
    const low = score({}, { t2Ratio: 0.9 });
    expect(high.pRaw).toBeGreaterThan(baseline.pRaw);
    expect(low.pRaw).toBeLessThan(baseline.pRaw);
  });

  it("DCE type 3 washout favors ECE; persistent/delayed favors inflammation and raises the index [15-16]", () => {
    const washout = score({}, { dce: "3" });
    const persistent = score({}, { dce: "12" });
    expect(washout.pRaw).toBeGreaterThan(baseline.pRaw);
    expect(persistent.pRaw).toBeLessThan(baseline.pRaw);
    expect(persistent.inflScore).toBeGreaterThan(baseline.inflScore);
  });

  it("T1 hyperintensity at the capsule (haemorrhage/thrombosis) raises only the inflammation index, not the ECE read [5,40-42]", () => {
    const t1 = score({}, { t1hi: true });
    expect(t1.pRaw).toBe(baseline.pRaw);
    expect(t1.inflScore).toBeGreaterThan(baseline.inflScore);
  });

  it("a prominent/asymmetric periprostatic venous plexus raises only the inflammation index [40-42]", () => {
    const vein = score({}, { vein: true });
    expect(vein.pRaw).toBe(baseline.pRaw);
    expect(vein.inflScore).toBeGreaterThan(baseline.inflScore);
  });
});

describe("Periprostatic adipose tissue (PPAT) [17-19,21]", () => {
  it("higher chemical-shift water:oil ratio favors ECE", () => {
    const high = score({}, { rwo: 80 });
    const low = score({}, { rwo: 10 });
    expect(high.pRaw).toBeGreaterThan(baseline.pRaw);
    expect(low.pRaw).toBeLessThan(baseline.pRaw);
  });

  it("high PPAT radiomic fiber complexity favors ECE [17]", () => {
    expect(score({}, { ppatFibrosis: true }).pRaw).toBeGreaterThan(baseline.pRaw);
  });

  it("altered PPAT geometric shape descriptors favor ECE [18]", () => {
    expect(score({}, { ppatGeom: true }).pRaw).toBeGreaterThan(baseline.pRaw);
  });
});

describe("PSMA-PET [22-25]", () => {
  it("periprostatic:lesion SUV ratio >=0.70 favors ECE; <0.40 favors inflammation", () => {
    const high = score({}, { suvL: 10, suvP: 8 });
    const low = score({}, { suvL: 10, suvP: 2 });
    expect(high.pRaw).toBeGreaterThan(baseline.pRaw);
    expect(low.pRaw).toBeLessThan(baseline.pRaw);
  });

  it("lesion SUVmax >=13 is an independent hard predictor [23]", () => {
    expect(score({}, { suvL: 15 }).pRaw).toBeGreaterThan(baseline.pRaw);
  });

  it("focal (lesion-anchored) periprostatic uptake is treated as hard evidence, distinct from diffuse background [25]", () => {
    expect(score({}, { psmaFocalUptake: true }).pRaw).toBeGreaterThan(baseline.pRaw);
  });
});

describe("Micro-ultrasound [26-27]", () => {
  it("more positive micro-US features monotonically raise P(ECE)", () => {
    const one = score({}, { mus1: true });
    const four = score({}, { mus1: true, mus2: true, mus3: true, mus4: true });
    expect(one.pRaw).toBeGreaterThan(baseline.pRaw);
    expect(four.pRaw).toBeGreaterThan(one.pRaw);
  });
});

describe("Biopsy oncological terms are hard evidence, immune to inflammation shrinkage [8,10,28-31]", () => {
  const heavyInflammation: Partial<PatientInflammationInput> = {
    priorBx: "3", bxMri: 10, bxSurg: 20, bmi: 34, mets: "4", crp: 6, nlr: 5, priorIntv: true,
  };
  const heavyInflammationSide: Partial<SideInflammationInput> = {
    iraniG: "3", iraniA: "3", gran: true, nCores: 12, t1hi: true, sym: true, vein: true,
  };

  it("higher grade group monotonically raises P(ECE)", () => {
    const ggs = (["1", "2", "3", "4", "5"] as const).map((g) => score({}, { gg: g }).pRaw);
    expect(ggs).toEqual([...ggs].sort((a, b) => a - b));
    // GG1 carries zero weight by design (H.gg["1"] === 0); GG2+ must exceed baseline.
    expect(ggs[0]).toBe(baseline.pRaw);
    expect(ggs[1]).toBeGreaterThan(baseline.pRaw);
  });

  it("perineural invasion raises P(ECE) and is not shrunk by a heavily inflamed profile [31]", () => {
    const clean = score({}, { pni: true });
    const inflamed = score(heavyInflammation, { ...heavyInflammationSide, pni: true });
    expect(clean.pRaw).toBeGreaterThan(baseline.pRaw);
    // pAdj == pRaw whenever there is no positive soft-term evidence to shrink.
    expect(inflamed.pAdj).toBe(inflamed.pRaw);
    expect(inflamed.inflScore).toBeGreaterThan(50);
  });

  it("ipsilateral positive-core burden and >=1/3 threshold raise P(ECE) [8,10,28-30]", () => {
    const low = score({}, { posC: 10 });
    const high = score({}, { posC: 60 });
    expect(high.pRaw).toBeGreaterThan(low.pRaw);
    expect(low.pRaw).toBeGreaterThan(baseline.pRaw);
  });

  it("PSA density above the reference raises P(ECE), clamped to a bounded contribution", () => {
    const modest = score({ psa: 10, vol: 40 });
    const veryHigh = score({ psa: 80, vol: 20 });
    expect(modest.pRaw).toBeGreaterThan(baseline.pRaw);
    expect(veryHigh.pRaw).toBeGreaterThan(modest.pRaw);
  });
});

describe("Inflammation-only clinical/biopsy terms never move the ECE read by themselves", () => {
  it("prior biopsy sessions, short biopsy-to-MRI/surgery intervals, and Irani scores raise only the inflammation index [4,32-35]", () => {
    const r = score(
      { priorBx: "3", bxMri: 10, bxSurg: 20 },
      { iraniG: "3", iraniA: "3", gran: true, nCores: 12 },
    );
    expect(r.pRaw).toBe(baseline.pRaw);
    expect(r.inflScore).toBeGreaterThan(0);
  });

  it("BMI>=30, MetS>=3, CRP>2.5, NLR>=3 each raise only the inflammation index [7,35-37]", () => {
    expect(score({ bmi: 34 }).inflScore).toBeGreaterThan(baseline.inflScore);
    expect(score({ mets: "3" }).inflScore).toBeGreaterThan(baseline.inflScore);
    expect(score({ crp: 5 }).inflScore).toBeGreaterThan(baseline.inflScore);
    expect(score({ nlr: 4 }).inflScore).toBeGreaterThan(baseline.inflScore);
  });
});

describe("PSA kinetics", () => {
  it("a rapid PSA rise is treated as hard oncologic evidence", () => {
    const rising = score({ psa: 12, psaPrior: 4, psaPriorMonths: 6 });
    expect(rising.pRaw).toBeGreaterThan(baseline.pRaw);
  });

  it("a declining PSA raises only the inflammation index", () => {
    const declining = score({ psa: 4, psaPrior: 12, psaPriorMonths: 6 });
    expect(declining.pRaw).toBe(baseline.pRaw);
    expect(declining.inflScore).toBeGreaterThan(baseline.inflScore);
  });
});

describe("Interval MRI change has a dual effect by design", () => {
  it("a growing lesion favors ECE; a shrinking one favors inflammation on both axes", () => {
    const growing = score({}, { mriIntervalChange: "growing" });
    const shrinking = score({}, { mriIntervalChange: "shrinking" });
    expect(growing.pRaw).toBeGreaterThan(baseline.pRaw);
    expect(shrinking.pRaw).toBeLessThan(baseline.pRaw);
    expect(shrinking.inflScore).toBeGreaterThan(baseline.inflScore);
  });
});

describe("Hard/soft split and shrinkage mechanics (model.ts docstring)", () => {
  it("with no inflammation evidence, pAdj equals pRaw regardless of soft evidence", () => {
    const r = score({}, { ccl: 18, angle: 90 });
    expect(r.lambda).toBe(0);
    expect(r.pAdj).toBe(r.pRaw);
  });

  it("heavy inflammation shrinks a positive soft-evidence read (the overcall correction)", () => {
    const inflamed = score(
      { priorBx: "3", bxMri: 10, bmi: 34, mets: "4", crp: 5, nlr: 4, priorIntv: true },
      { ccl: 18, angle: 90, iraniG: "3", iraniA: "3", gran: true, t1hi: true, sym: true },
    );
    expect(inflamed.lambda).toBeGreaterThan(0);
    expect(inflamed.pAdj).toBeLessThan(inflamed.pRaw);
    // The correction only pulls back the soft (imaging) contribution, never past pRaw's floor set by hard terms alone.
    expect(inflamed.pAdj).toBeGreaterThan(baseline.pRaw);
  });

  it("heavy inflammation never pushes a *negative* soft read (already favoring inflammation) further down — no double-counting", () => {
    const negativeSoft = score(
      { priorBx: "3", bmi: 34, mets: "4", crp: 5, nlr: 4 },
      { ccl: 5, angle: 30, morph: "band", iraniG: "3", iraniA: "3", gran: true },
    );
    expect(negativeSoft.lambda).toBeGreaterThan(0);
    expect(negativeSoft.pAdj).toBe(negativeSoft.pRaw);
  });
});

describe("Martini incremental nerve-sparing grade thresholds [29]", () => {
  it("maps P(ECE) to grades at the 10/21/73% boundaries", () => {
    expect(nsGrade(10).n).toBe(1);
    expect(nsGrade(10.01).n).toBe(2);
    expect(nsGrade(21).n).toBe(2);
    expect(nsGrade(21.01).n).toBe(3);
    expect(nsGrade(73).n).toBe(3);
    expect(nsGrade(73.01).n).toBe(4);
  });

  it("nsGradeByNumber shares labels with nsGrade and clamps out-of-range input", () => {
    expect(nsGradeByNumber(1).label).toBe(nsGrade(5).label);
    expect(nsGradeByNumber(4).label).toBe(nsGrade(90).label);
    expect(nsGradeByNumber(0).n).toBe(1);
    expect(nsGradeByNumber(9).n).toBe(4);
  });
});
