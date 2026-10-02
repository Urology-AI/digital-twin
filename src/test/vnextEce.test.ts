/**
 * vNext ECE against the pinned cases in COMPASS_vNext_Regression_Cases.json
 * (SHA-256 d8170fb69dc850d5041f17bd6b8c80a50530b698eb26f88d346f3c6d51f9d9ec).
 */
import { describe, it, expect } from "vitest";
import { defaultClinicalState, type ClinicalState } from "@/types/patient";
import { predictEceVNext } from "@/lib/models/vnext/ece";
import cases from "./fixtures/vnext/COMPASS_vNext_Regression_Cases.json";

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

describe("vNext ECE reproduces every pinned lock case", () => {
  for (const c of cases) {
    it(c.caseId, () => {
      const r = predictEceVNext(stateFrom(c.input));
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(Math.abs(r.probability - c.expected.ECE.probability)).toBeLessThan(1e-12);
      expect(r.tier.index).toBe(c.expected.ECE.tierIndex);
      expect(r.tier.label).toBe(c.expected.ECE.tierLabel);
    });
  }
});

describe("vNext ECE behavior", () => {
  it("reports which inputs were imputed", () => {
    const missing = cases.find((c) => c.caseId === "MISSING_OPTIONALS_GG3")!;
    const r = predictEceVNext(stateFrom(missing.input));
    expect(r.ok && r.imputed.sort()).toEqual(
      ["capsular_abutment", "max_core_pct", "mri_epe", "mri_svi_clean"].sort(),
    );
  });

  it("refuses to predict without PSA, volume or grade group", () => {
    const S = { ...defaultClinicalState(), required_present: { psa: false, vol: true, gg: true } };
    expect(predictEceVNext(S).ok).toBe(false);
  });

  it("does not clamp: ADVERSE_GG4 exceeds the old 0.92 ceiling", () => {
    const adverse = cases.find((c) => c.caseId === "ADVERSE_GG4")!;
    const r = predictEceVNext(stateFrom(adverse.input));
    expect(r.ok && r.probability).toBeGreaterThan(0.92);
  });

  it("ignores Decipher, ExactVu and PSMA entirely", () => {
    const base = stateFrom(cases[1]!.input);
    const loaded: ClinicalState = {
      ...base,
      dec: 0.9,
      ev_abutment: 1,
      mus_ece: 1,
      psma_epe: 1,
      psma_avail: 1,
      suv: 30,
    };
    const a = predictEceVNext(base);
    const b = predictEceVNext(loaded);
    expect(a.ok && b.ok && a.probability === b.probability).toBe(true);
  });
});
