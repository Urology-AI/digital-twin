import { describe, expect, it } from "vitest";
import { bmiAdjustedBcr } from "@/lib/compass/bcrBmiAdjusted";

describe("bmiAdjustedBcr", () => {
  it("leaves the risk unchanged at the reference BMI", () => {
    expect(bmiAdjustedBcr(0.2, 27)).toBeCloseTo(0.2, 10);
  });

  it("applies HR 1.21 per +5 kg/m²", () => {
    expect(bmiAdjustedBcr(0.2, 32)).toBeCloseTo(1 - 0.8 ** 1.21, 10);
  });

  it("lowers the risk below the reference BMI", () => {
    expect(bmiAdjustedBcr(0.2, 22)).toBeLessThan(0.2);
  });

  it("is NaN when risk or BMI is missing", () => {
    expect(bmiAdjustedBcr(NaN, 30)).toBeNaN();
    expect(bmiAdjustedBcr(0.2, 0)).toBeNaN();
  });
});
