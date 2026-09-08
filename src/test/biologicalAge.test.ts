import { describe, expect, it } from "vitest";
import { computeBiologicalAge, type BiologicalAgeInputs } from "@/lib/compass/biologicalAge";
import { computeFunctionalOutcomes, modifiableFactorBreakdown } from "@/lib/compass/functionalOutcomes";

const BASE: BiologicalAgeInputs = {
  age: 65,
  bmi: 24,
  smoking: "never",
  exercise: "active",
  alcohol: "none",
  diet: "average",
  dm: false,
  htn: false,
  cad: false,
};

describe("computeBiologicalAge — diet term (Zhang et al., JAMA Netw Open 2026)", () => {
  it("a favorable diet lowers biological age vs. average", () => {
    const favorable = computeBiologicalAge({ ...BASE, diet: "favorable" });
    const average = computeBiologicalAge({ ...BASE, diet: "average" });
    expect(favorable.biological).toBeLessThan(average.biological);
  });

  it("a high-saturated-fat diet raises biological age vs. average", () => {
    const highSatFat = computeBiologicalAge({ ...BASE, diet: "high_saturated_fat" });
    const average = computeBiologicalAge({ ...BASE, diet: "average" });
    expect(highSatFat.biological).toBeGreaterThan(average.biological);
  });

  it("shows up in the per-factor breakdown when non-neutral", () => {
    const r = computeBiologicalAge({ ...BASE, diet: "high_saturated_fat" });
    expect(r.contributions.some((c) => c.label === "Diet")).toBe(true);
  });

  it("an average diet contributes nothing to the breakdown", () => {
    const r = computeBiologicalAge(BASE);
    expect(r.contributions.some((c) => c.label === "Diet")).toBe(false);
  });

  it("diet's effect is small relative to smoking — a general-mortality, not disease-specific, signal", () => {
    const dietWorst = computeBiologicalAge({ ...BASE, diet: "high_saturated_fat" });
    const smokingCurrent = computeBiologicalAge({ ...BASE, smoking: "current" });
    expect(dietWorst.offset).toBeLessThan(smokingCurrent.offset);
  });
});

describe("diet → erectile-function recovery (Bauer et al., JAMA Netw Open 2020)", () => {
  const fn = {
    nsL: 2 as const, nsR: 2 as const,
    age: 58, shim: 22, ipss: 5, bmi: 26,
    pfmt: "moderate" as const,
    exercise: "moderate" as const,
    smoking: "never" as const,
    pde5: "prn" as const,
    alcohol: "moderate" as const,
    dm: false, htn: false, cad: false,
  };

  it("a lean-protein / healthy-fat pattern raises 12-month potency vs. a high-saturated-fat one", () => {
    const good = computeFunctionalOutcomes({ ...fn, diet: "favorable" });
    const bad = computeFunctionalOutcomes({ ...fn, diet: "high_saturated_fat" });
    expect(good.potencyAdj - bad.potencyAdj).toBe(6);
  });

  it("omitting diet scores the neutral average pattern", () => {
    expect(computeFunctionalOutcomes(fn).potencyAdj).toBe(
      computeFunctionalOutcomes({ ...fn, diet: "average" }).potencyAdj,
    );
  });

  it("leaves continence untouched — no diet → continence evidence", () => {
    const good = computeFunctionalOutcomes({ ...fn, diet: "favorable" });
    const bad = computeFunctionalOutcomes({ ...fn, diet: "high_saturated_fat" });
    expect(good.continenceAdj).toBe(bad.continenceAdj);
  });

  it("stays smaller than the smoking term it is extrapolated alongside", () => {
    const dietSpread =
      computeFunctionalOutcomes({ ...fn, diet: "favorable" }).potencyAdj -
      computeFunctionalOutcomes({ ...fn, diet: "high_saturated_fat" }).potencyAdj;
    const smokingSpread =
      computeFunctionalOutcomes({ ...fn, smoking: "never" }).potencyAdj -
      computeFunctionalOutcomes({ ...fn, smoking: "current" }).potencyAdj;
    expect(dietSpread).toBeLessThan(smokingSpread);
  });

  it("appears in the modifiable-factor breakdown as a potency-only, modifiable row", () => {
    const row = modifiableFactorBreakdown({ ...fn, diet: "favorable" }).find((r) => r.label === "Diet");
    expect(row).toBeDefined();
    expect(row!.pot).toBeGreaterThan(0);
    expect(row!.cont).toBe(0);
    expect(row!.modifiable).toBe(true);
  });
});

describe("modifiable-factor headroom — what a patient can still change", () => {
  const base = {
    bmi: 24, pfmt: "intensive" as const, exercise: "active" as const,
    pde5: "daily" as const, smoking: "never" as const, alcohol: "none" as const,
    diet: "favorable" as const, dm: false, htn: false, cad: false, ipss: 5,
  };

  it("shows an unused lever even when its current effect is zero", () => {
    // pelvic floor training at "none" scores 0/0 — it used to vanish from the table
    const rows = modifiableFactorBreakdown({ ...base, pfmt: "none" });
    const pfmt = rows.find((r) => r.label === "Pelvic floor training");
    expect(pfmt).toBeDefined();
    expect(pfmt!.pot).toBe(0);
    expect(pfmt!.contGain).toBe(10);
    expect(pfmt!.target).toBe("intensive");
  });

  it("reports no headroom for a factor already at its best", () => {
    const rows = modifiableFactorBreakdown(base);
    for (const r of rows) {
      expect(r.potGain).toBe(0);
      expect(r.contGain).toBe(0);
    }
  });

  it("a current smoker can reach former, not never", () => {
    const rows = modifiableFactorBreakdown({ ...base, smoking: "current" });
    const smoking = rows.find((r) => r.label === "Smoking")!;
    expect(smoking.potGain).toBe(6); // -8 -> -2, not -8 -> 0
    expect(smoking.target).toBe("quit");
  });

  it("never offers headroom on a fixed factor", () => {
    const rows = modifiableFactorBreakdown({ ...base, dm: true });
    const dm = rows.find((r) => r.label === "Diabetes")!;
    expect(dm.modifiable).toBe(false);
    expect(dm.potGain).toBe(0);
    expect(dm.contGain).toBe(0);
  });

  it("headroom equals the gap to the best setting", () => {
    const rows = modifiableFactorBreakdown({ ...base, bmi: 32, alcohol: "heavy" });
    expect(rows.find((r) => r.label === "BMI")!.potGain).toBe(8);
    expect(rows.find((r) => r.label === "Alcohol")!.potGain).toBe(12);
  });
});
