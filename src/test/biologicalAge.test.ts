import { describe, expect, it } from "vitest";
import { computeBiologicalAge, type BiologicalAgeInputs } from "@/lib/compass/biologicalAge";

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
