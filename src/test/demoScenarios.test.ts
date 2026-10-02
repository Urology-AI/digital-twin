import { describe, expect, it } from "vitest";
import { DEMO_CASES } from "@/data/demoCases";
import { usePatientStore } from "@/store/patientStore";

const load = (id: string) => {
  const d = DEMO_CASES.find((x) => x.id === id)!;
  usePatientStore.getState().loadDemoCase(d);
  return usePatientStore.getState().predictions!;
};

describe("demo planning scenarios", () => {
  it("cohort-derived demo cases carry no surgical history (it is never assigned to a cohort row)", () => {
    for (const d of DEMO_CASES.filter((x) => !x.id.startsWith("plan-"))) {
      expect(d.record.history, d.id).toBeUndefined();
    }
  });

  it("each scenario layers exactly one exposure on an unchanged base case", () => {
    const base = DEMO_CASES.find((d) => d.id === "gg2-unilateral")!;
    for (const id of ["plan-prior-radiation", "plan-prior-turp", "plan-prior-hifu-left"]) {
      const sc = DEMO_CASES.find((d) => d.id === id)!;
      expect(sc.blurb).toMatch(/^Illustrative scenario/);
      expect(Object.keys(sc.record.history ?? {})).toHaveLength(1);
      expect({ ...sc.record, history: undefined }).toEqual({ ...base.record, history: undefined });
      expect(sc.lesionRows).toEqual(base.lesionRows);
    }
    const hem = DEMO_CASES.find((d) => d.id === "plan-biopsy-hemorrhage")!;
    const hemBase = DEMO_CASES.find((d) => d.id === "gg2-right-small-gland")!;
    expect(Object.keys(hem.record.history ?? {})).toEqual(["mri_post_biopsy_hemorrhage"]);
    expect({ ...hem.record, history: undefined }).toEqual({ ...hemBase.record, history: undefined });
  });

  it("each exposure raises plane risk over its base case, on both sides unless it is side-specific", () => {
    const base = load("gg2-unilateral");
    for (const id of ["plan-prior-radiation", "plan-prior-turp"]) {
      const p = load(id);
      expect(p.plan.left.hostilityScore, id).toBeGreaterThan(base.plan.left.hostilityScore);
      expect(p.plan.right.hostilityScore, id).toBeGreaterThan(base.plan.right.hostilityScore);
      expect(p.plan.left.hostilityScore).toBeCloseTo(p.plan.right.hostilityScore, 10);
    }
    const hemBase = load("gg2-right-small-gland");
    const hem = load("plan-biopsy-hemorrhage");
    expect(hem.plan.left.hostilityScore).toBeGreaterThan(hemBase.plan.left.hostilityScore);
    expect(hem.plan.right.hostilityScore).toBeGreaterThan(hemBase.plan.right.hostilityScore);
  });

  it("the HIFU scenario raises the left side more than the right", () => {
    const base = load("gg2-unilateral");
    const p = load("plan-prior-hifu-left");
    expect(p.plan.left.hostilityScore).toBeGreaterThan(base.plan.left.hostilityScore);
    expect(p.plan.left.hostilityScore).toBeGreaterThan(p.plan.right.hostilityScore);
    // contralateral ablation has no isolated evidence: the right side must not move
    expect(p.plan.right.hostilityScore).toBeCloseTo(base.plan.right.hostilityScore, 10);
  });

  it("scenario ids are unique and appear after the cohort cases", () => {
    const ids = DEMO_CASES.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.slice(-4).every((i) => i.startsWith("plan-"))).toBe(true);
  });
});
