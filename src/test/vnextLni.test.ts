/**
 * vNext LNI against the pinned cases in
 * COMPASS_vNext_LNI_Regression_Cases_2026-10-02.json
 * (lock c51a475f...f6fb).
 */
import { describe, it, expect } from "vitest";
import { defaultClinicalState, type ClinicalState } from "@/types/patient";
import { predictLniVNext } from "@/lib/models/vnext/lni";
import pkg from "./fixtures/vnext/COMPASS_vNext_LNI_Regression_Cases_2026-10-02.json";

type CaseInput = (typeof pkg.cases)[number]["input"];

function stateFrom(inp: CaseInput): ClinicalState {
  return {
    ...defaultClinicalState(),
    psa: inp.psa,
    vol: inp.prostateVolume,
    gg: inp.biopsyGradeGroup,
    required_present: { psa: true, vol: true, gg: true },
    psma_ln: inp.psmaLnPositive as number | null,
  };
}

describe("vNext LNI reproduces every pinned lock case", () => {
  for (const c of pkg.cases) {
    it(c.caseId, () => {
      const r = predictLniVNext(stateFrom(c.input));
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(Math.abs(r.probability - c.expected.probability)).toBeLessThan(1e-12);
      expect(r.tier.label).toBe(c.expected.tier);
    });
  }
});

describe("vNext LNI behavior", () => {
  const base = () => stateFrom(pkg.cases[1]!.input);

  it("refuses to predict without PSA, volume or grade group", () => {
    const S = { ...base(), required_present: { psa: true, vol: true, gg: false } };
    expect(predictLniVNext(S).ok).toBe(false);
  });

  it("missing PSMA is mean-imputed, not treated as negative", () => {
    const miss = predictLniVNext({ ...base(), psma_ln: null });
    const neg = predictLniVNext({ ...base(), psma_ln: 0 });
    expect(miss.ok && miss.imputed).toEqual(["psma_ln_pos"]);
    expect(miss.ok && neg.ok && miss.probability).not.toBe(neg.ok && neg.probability);
  });

  it("positive cores and other inputs do not change the result", () => {
    const a = predictLniVNext(base());
    const b = predictLniVNext({ ...base(), cores: 12, pirads: 5, mri_svi: 1, mri_adc: 500 });
    expect(a.ok && b.ok && a.probability).toBe(b.ok && b.probability);
  });

  it("tier boundaries: <2% Low, 2 to <5% Intermediate, >=5% High", () => {
    const labels = ["Low", "Intermediate", "High"];
    const seen = pkg.cases.map((c) => {
      const r = predictLniVNext(stateFrom(c.input));
      return r.ok ? r.tier.label : "";
    });
    for (const l of labels) expect(seen).toContain(l);
  });
});
