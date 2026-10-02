import { describe, expect, it } from "vitest";
import { defaultClinicalState } from "@/types/patient";
import { computeRecoveryReserve, reserveTier } from "@/lib/compass/recoveryReserve";

const base = (S: ReturnType<typeof defaultClinicalState>, over: Record<string, unknown> = {}) => ({
  age: S.age, shim: S.shim, ipss: S.ipss, bmi: S.bmi,
  pfmt: "none" as const, exercise: "light" as const, smoking: "never" as const,
  pde5: "prn" as const, alcohol: "moderate" as const, dm: false, htn: false, cad: false,
  ...over,
});

const reserveOf = (over: Record<string, unknown>, ageShim = { age: 60, shim: 24 }) => {
  const S = { ...defaultClinicalState(), ...ageShim };
  return computeRecoveryReserve(S, base(S, over));
};

describe("PIPS-R recovery reserve", () => {
  it("is available with a probability and tier when baseline SHIM >= 12", () => {
    const r = reserveOf({});
    expect(r.available).toBe(true);
    expect(r.probability).toBeGreaterThan(0);
    expect(r.probability).toBeLessThanOrEqual(1);
    expect(r.tier).not.toBeNull();
  });

  it("is not estimated when baseline SHIM < 12", () => {
    const r = reserveOf({}, { age: 60, shim: 8 });
    expect(r.available).toBe(false);
    expect(r.probability).toBeNull();
    expect(r.tier).toBeNull();
    expect(r.drivers).toEqual([]);
  });

  it("falls with age, lower baseline SHIM, diabetes, and current smoking", () => {
    const ref = reserveOf({}).probability!;
    expect(reserveOf({}, { age: 72, shim: 24 }).probability!).toBeLessThan(ref);
    expect(reserveOf({}, { age: 60, shim: 14 }).probability!).toBeLessThan(ref);
    expect(reserveOf({ dm: true }).probability!).toBeLessThan(ref);
    expect(reserveOf({ smoking: "current" }).probability!).toBeLessThan(ref);
  });

  it("is baseline capacity: PDE5 regimen, pelvic-floor training and exercise do not change it", () => {
    const a = reserveOf({ pde5: "none", pfmt: "none", exercise: "light" }).probability;
    const b = reserveOf({ pde5: "daily", pfmt: "intensive", exercise: "active" }).probability;
    expect(b).toBe(a);
  });

  it("lists drivers sorted by cost, all positive, and only for factors that actually lower it", () => {
    const r = reserveOf({ dm: true, smoking: "current", htn: true }, { age: 70, shim: 16 });
    expect(r.drivers.length).toBeGreaterThan(0);
    expect(r.drivers.every((d) => d.cost > 0)).toBe(true);
    const costs = r.drivers.map((d) => d.cost);
    expect([...costs].sort((x, y) => y - x)).toEqual(costs);
    expect(r.drivers.map((d) => d.label)).toEqual(expect.arrayContaining(["Diabetes", "Smoking", "Hypertension"]));
    expect(reserveOf({}).drivers.map((d) => d.label)).not.toContain("Diabetes");
  });

  it("flags risk factors the nomogram does not model instead of inventing a penalty", () => {
    const S = { ...defaultClinicalState(), age: 60, shim: 24, prior_pelvic_radiation: true, neoadjuvant_adt: true, prior_pelvic_surgery: "bladder_fracture_urethroplasty" as const };
    const withFlags = computeRecoveryReserve(S, base(S));
    const without = reserveOf({});
    expect(withFlags.notModelled).toEqual([
      "Prior pelvic radiation",
      "Androgen-deprivation exposure",
      "Pelvic fracture, urethral injury or bladder surgery",
    ]);
    expect(withFlags.probability).toBe(without.probability);
  });

  it("tier cutpoints are good >= 60%, reduced 35-60%, poor < 35%", () => {
    expect(reserveTier(0.6)).toBe("good");
    expect(reserveTier(0.599)).toBe("reduced");
    expect(reserveTier(0.35)).toBe("reduced");
    expect(reserveTier(0.349)).toBe("poor");
  });
});
