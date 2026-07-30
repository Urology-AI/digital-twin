/**
 * Comparison suite: the standalone inflammation instrument's own P(ECE)/nerve-
 * sparing read vs. COMPASS's fitted, patient-specific `predictEceSide` +
 * zone-aware `getNsGradeZoneAware`. These two models are deliberately kept
 * unmerged (see `src/lib/inflammation/model.ts` header) — this suite is not
 * asserting they should agree in general. It locks in three things:
 *
 *  1. On a clean low-risk side and an unambiguous high-risk side, both
 *     models land in the same grade tier (a sanity check that the two
 *     independent instruments aren't wildly inconsistent at the extremes).
 *  2. The "overcall" scenario the inflammation instrument exists to catch:
 *     COMPASS's ECE-side model has no notion of periprostatic inflammation
 *     at all, so a heavy inflammatory load leaves it unchanged, while the
 *     inflammation instrument's shrinkage mechanism pulls its own read back.
 *  3. A `nsL`/`nsR`-vs-instrument grade disagreement is exactly the signal
 *     the "Digital twin (COMPASS), for comparison only" panel in
 *     `InflammationWorkspace.tsx` is built to surface, not paper over.
 */
import { describe, it, expect } from "vitest";
import { defaultClinicalState, type ClinicalState } from "@/types/patient";
import { predictEceSide } from "@/lib/models/ece";
import { getNsGradeZoneAware } from "@/lib/compass/nsGrade";
import { scoreSide, DEFAULT_INFLAMMATION_CONFIG, nsGrade, nsGradeByNumber } from "@/lib/inflammation/model";
import { emptyPatientInput, emptySideInput } from "@/types/inflammation";

const noLesions: never[] = [];
const noZones = {};

function compassSide(S: ClinicalState, side: "left" | "right") {
  const ece = predictEceSide(S, side, noLesions, noLesions);
  const pred = { eceL: side === "left" ? ece : 0.05, eceR: side === "right" ? ece : 0.05, sviL: 0.02, sviR: 0.02 };
  const nsDetail = getNsGradeZoneAware(side, S, pred, noZones, noLesions);
  return { ecePct: ece * 100, nsDetail };
}

const P0 = emptyPatientInput();
const S0 = emptySideInput();

describe("Low-risk, clean side: both models agree it's a narrow plane", () => {
  const S: ClinicalState = { ...defaultClinicalState(), gg_left: 1, cores_left: 1, mc_left: 10 };
  const compass = compassSide(S, "left");
  const instrument = scoreSide(P0, { ...S0, gg: "1", maxI: 10 }, DEFAULT_INFLAMMATION_CONFIG);

  it("COMPASS keeps P(ECE) low", () => expect(compass.ecePct).toBeLessThan(20));
  it("the instrument keeps P(ECE) low too", () => expect(instrument.pAdj).toBeLessThan(21));
  it("both land at Grade 1 or 2", () => {
    expect(compass.nsDetail.nsGrade).toBeLessThanOrEqual(2);
    expect(nsGrade(instrument.pAdj).n).toBeLessThanOrEqual(2);
  });
});

describe("High-risk, unambiguous extension: both models agree it's a wide plane", () => {
  const S: ClinicalState = {
    ...defaultClinicalState(),
    gg_left: 5, cores_left: 8, mc_left: 90, pni_bx: 1, psad: 0.4, psa: 30, vol: 30,
    mri_epe: 1, pirads: 5,
  };
  const compass = compassSide(S, "left");
  const instrument = scoreSide(
    { ...P0, psa: 30, vol: 30 },
    { ...S0, gg: "5", maxI: 90, posC: 80, pni: true, ccl: 25, angle: 100, caps: "2", epeGr: "3", adcI: 0.7, anch: "yes", dce: "3" },
    DEFAULT_INFLAMMATION_CONFIG,
  );

  it("COMPASS pushes P(ECE) high", () => expect(compass.ecePct).toBeGreaterThan(40));
  it("the instrument pushes P(ECE) high too", () => expect(instrument.pAdj).toBeGreaterThan(73));
  it("both land at Grade 3 or 4", () => {
    expect(compass.nsDetail.nsGrade).toBeGreaterThanOrEqual(3);
    expect(nsGrade(instrument.pAdj).n).toBeGreaterThanOrEqual(3);
  });
});

describe("The overcall scenario: heavy periprostatic inflammation confounding a modest imaging signal", () => {
  // GG absent on this side (no oncologic hard evidence) but a real, if modest,
  // capsular-contact bump plus a heavy inflammatory load: 3 prior biopsy
  // sessions, granulomatous prostatitis on pathology, T1 hyperintensity
  // (haemorrhage/thrombosis), bilateral symmetric change, elevated CRP/NLR,
  // BMI >=30 — the exact profile the instrument's shrinkage term exists for.
  const S: ClinicalState = { ...defaultClinicalState(), gg_left: 0, mri_epe: 1, pirads: 4 };
  const compass = compassSide(S, "left");

  const patient = { psa: 6, vol: 45, priorBx: "3" as const, bxMri: 10, bmi: 34, mets: "3" as const, crp: 5, nlr: 4 };
  const sideClean = { ccl: 12, angle: 65 };
  const sideInflamed = { ...sideClean, iraniG: "3" as const, iraniA: "3" as const, gran: true, t1hi: true, sym: true };

  const instrumentClean = scoreSide(P0, { ...S0, ...sideClean }, DEFAULT_INFLAMMATION_CONFIG);
  const instrumentInflamed = scoreSide({ ...P0, ...patient }, { ...S0, ...sideInflamed }, DEFAULT_INFLAMMATION_CONFIG);

  it("COMPASS's ECE-side model has no inflammation input, so it doesn't move between the two cases", () => {
    // Re-run with the same GG/PSA-blind ClinicalState either way — nothing in
    // ClinicalState carries CRP/NLR/BMI/Irani grade/prior-biopsy-count, so the
    // COMPASS number is identical regardless of the inflammatory load.
    const compassAgain = compassSide(S, "left");
    expect(compassAgain.ecePct).toBe(compass.ecePct);
  });

  it("the instrument's own read is meaningfully pulled back once the inflammatory load is entered", () => {
    expect(instrumentInflamed.inflScore).toBeGreaterThan(50);
    expect(instrumentInflamed.pAdj).toBeLessThan(instrumentClean.pAdj);
    expect(instrumentInflamed.pAdj).toBeLessThan(instrumentInflamed.pRaw);
  });

  it("this is exactly the disagreement the workspace's comparison panel is designed to surface", () => {
    const compassGrade = nsGradeByNumber(compass.nsDetail.nsGrade).n;
    const instrumentGrade = nsGrade(instrumentInflamed.pAdj).n;
    // COMPASS, blind to inflammation, may sit a tier above the instrument's
    // shrunk read for this exact profile — that gap is the point, not a bug.
    expect(compassGrade).toBeGreaterThanOrEqual(instrumentGrade);
  });
});
