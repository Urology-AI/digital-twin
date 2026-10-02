/**
 * vNext SVI (patient level) against the pinned cases in
 * COMPASS_vNext_Regression_Cases.json, and the side-SVI shadow model against
 * the pinned cases in its own lock (SHA-256 8c6462af...d137).
 */
import { describe, it, expect } from "vitest";
import { defaultClinicalState, type ClinicalState, type Prostate3DInputV1 } from "@/types/patient";
import { predictSviVNext } from "@/lib/models/vnext/svi";
import { sviSideFromInputs } from "@/lib/models/vnext/sviSide";
import { sideBiopsyGgFromRecord } from "@/lib/models/vnext/sideEpe";
import cases from "./fixtures/vnext/COMPASS_vNext_Regression_Cases.json";
import sideLock from "./fixtures/vnext/COMPASS_vNext_SVI_Side_Shadow_ModelLock_2026-10-01.json";

type CaseInput = (typeof cases)[number]["input"];

function stateFrom(inp: CaseInput): ClinicalState {
  return {
    ...defaultClinicalState(),
    psa: inp.psa,
    vol: inp.prostateVolume,
    gg: inp.biopsyGradeGroup,
    required_present: { psa: true, vol: true, gg: true },
    pirads: inp.pirads,
    mri_epe: inp.mriEpe,
    mri_svi: inp.mriSvi,
    maxcore: inp.maxCorePct,
    mri_abutment: inp.capsularAbutment,
    cores: inp.positiveCores,
    mri_adc: inp.adcMean,
  };
}

describe("vNext SVI reproduces every pinned lock case", () => {
  for (const c of cases) {
    it(c.caseId, () => {
      const r = predictSviVNext(stateFrom(c.input));
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(Math.abs(r.probability - c.expected.SVI.probability)).toBeLessThan(1e-12);
      expect(r.tier.index).toBe(c.expected.SVI.tierIndex);
      expect(r.tier.label).toBe(c.expected.SVI.tierLabel);
    });
  }
});

describe("vNext SVI behavior", () => {
  it("refuses to predict without PSA, volume or grade group", () => {
    const S = { ...defaultClinicalState(), required_present: { psa: true, vol: false, gg: true } };
    expect(predictSviVNext(S).ok).toBe(false);
  });

  it("imputes missing optional inputs and never clamps", () => {
    const adverse = cases.find((c) => c.caseId === "ADVERSE_GG4")!;
    const r = predictSviVNext(stateFrom(adverse.input));
    expect(r.ok && r.probability).toBeGreaterThan(0.5); // old ceiling was 0.9, floor 0.01
  });

  it("ignores Decipher, ExactVu and PSMA entirely", () => {
    const base = stateFrom(cases[1]!.input);
    const loaded: ClinicalState = { ...base, dec: 0.9, mus_ece: 1, psma_epe: 1, psma_avail: 1, suv: 30 };
    const a = predictSviVNext(base);
    const b = predictSviVNext(loaded);
    expect(a.ok && b.ok && a.probability === b.probability).toBe(true);
  });
});

describe("vNext side SVI reproduces every pinned shadow-lock case", () => {
  const logit = (p: number) => Math.log(p / (1 - p));
  for (const c of sideLock.pinned_regression_cases) {
    it(c.case_id, () => {
      const r = sviSideFromInputs({
        globalLogit: logit(c.global_svi_probability),
        sideBiopsyGg: c.side_biopsy_gg,
      });
      expect(Math.abs(r.probability - c.expected_side_shadow_probability)).toBeLessThan(1e-12);
    });
  }

  it("missing side grade is imputed, not zero", () => {
    const withMissing = sviSideFromInputs({ globalLogit: -2.5, sideBiopsyGg: null });
    const withZero = sviSideFromInputs({ globalLogit: -2.5, sideBiopsyGg: 0 });
    expect(withMissing.imputed).toEqual(["side_biopsy_gg"]);
    expect(withMissing.probability).toBeGreaterThan(withZero.probability);
  });

  it("uses the same side-grade rule as side EPE (unilateral: other side is 0)", () => {
    const P = { biopsy: { laterality: "left", max_grade_group: 3, gg_left: null, gg_right: null } } as unknown as Prostate3DInputV1;
    expect(sideBiopsyGgFromRecord(P, "left")).toBe(3);
    expect(sideBiopsyGgFromRecord(P, "right")).toBe(0);
  });
});
