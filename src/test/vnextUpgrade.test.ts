/**
 * vNext Grade Upgrade against the pinned cases in
 * COMPASS_vNext_Regression_Cases.json (core lock be53aba4...27bd8).
 */
import { describe, it, expect } from "vitest";
import { defaultClinicalState, type ClinicalState } from "@/types/patient";
import { predictUpgradeVNext } from "@/lib/models/vnext/upgrade";
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

describe("vNext Upgrade reproduces every pinned lock case", () => {
  for (const c of cases) {
    it(c.caseId, () => {
      const r = predictUpgradeVNext(stateFrom(c.input));
      expect(r.ok && r.applicable).toBe(true);
      if (!r.ok || !r.applicable) return;
      expect(Math.abs(r.probability - c.expected.Upgrade.probability)).toBeLessThan(1e-12);
      expect(r.tier.index).toBe(c.expected.Upgrade.tierIndex);
      expect(r.tier.label).toBe(c.expected.Upgrade.tierLabel);
    });
  }
});

describe("vNext Upgrade behavior", () => {
  const base = () => stateFrom(cases.find((c) => c.caseId === "MODERATE_GG2")!.input);

  it("GG5 is not applicable and produces no probability", () => {
    const r = predictUpgradeVNext({ ...base(), gg: 5 });
    expect(r).toEqual({ ok: true, applicable: false, reason: "gg5" });
  });

  it("refuses to predict without PSA, volume or grade group", () => {
    const S = { ...base(), required_present: { psa: true, vol: true, gg: false } };
    expect(predictUpgradeVNext(S).ok).toBe(false);
  });

  it("missing optionals take the training mean and are reported", () => {
    const r = predictUpgradeVNext({ ...base(), mri_svi: null, cores: null, mri_adc: null });
    expect(r.ok && r.applicable && r.imputed.sort()).toEqual(["adc_mean", "mri_svi_clean", "pos_cores"]);
  });

  it("uses only the six frozen inputs", () => {
    const a = predictUpgradeVNext(base());
    const loaded: ClinicalState = {
      ...base(),
      maxcore: 99, dec: 0.95, mus_ece: 1, psma_epe: 1, psma_avail: 1, suv: 40, mri_epe: 1, mri_abutment: 4,
    };
    const b = predictUpgradeVNext(loaded);
    expect(a.ok && b.ok && a.applicable && b.applicable && a.probability === b.probability).toBe(true);
  });

  it("has exactly three tiers at 5% and 20%", () => {
    const tiers = new Set(cases.map((c) => c.expected.Upgrade.tierLabel));
    expect([...tiers].sort()).toEqual(["High", "Intermediate", "Low"]);
  });
});
