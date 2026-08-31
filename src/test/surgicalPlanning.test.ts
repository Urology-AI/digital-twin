import { describe, expect, it } from "vitest";
import { defaultClinicalState } from "@/types/patient";
import { predictInflammationRisk } from "@/lib/compass/inflammationRisk";
import { buildSurgicalPlan } from "@/lib/compass/surgicalPlan";
import { bcrByPlan } from "@/lib/compass/bcrByPlan";
import { computeFunctionalOutcomes } from "@/lib/compass/functionalOutcomes";
import { EVIDENCE_REGISTRY } from "@/lib/compass/planningEvidence";
import type { NsSideDetail } from "@/types/prediction";

describe("planning evidence registry", () => {
  it("every constant group has a source and a real citation", () => {
    expect(EVIDENCE_REGISTRY.length).toBeGreaterThan(15);
    for (const e of EVIDENCE_REGISTRY) {
      expect(["institutional", "literature", "provisional"]).toContain(e.source);
      expect(e.label.length).toBeGreaterThan(3);
      expect(e.citation.length).toBeGreaterThan(20);
    }
  });

  it("literature-tagged groups name at least one author-year citation", () => {
    const lit = EVIDENCE_REGISTRY.filter((e) => e.source === "literature");
    for (const e of lit) {
      expect(e.citation).toMatch(/\b(19|20)\d\d\b/); // a year
    }
  });
});

describe("planning references", () => {
  it("every reference has authors, title, source and a usedFor list", async () => {
    const { PLANNING_REFERENCES } = await import("@/lib/compass/planningReferences");
    expect(PLANNING_REFERENCES.length).toBeGreaterThan(15);
    for (const r of PLANNING_REFERENCES) {
      expect(r.authors.length).toBeGreaterThan(3);
      expect(r.title.length).toBeGreaterThan(10);
      expect(r.source).toMatch(/\b(19|20)\d\d\b/);
      expect(r.usedFor.length).toBeGreaterThan(0);
    }
  });

  it("includes Tewari-group work", async () => {
    const { PLANNING_REFERENCES } = await import("@/lib/compass/planningReferences");
    const tewari = PLANNING_REFERENCES.filter((r) => r.group === "tewari");
    expect(tewari.length).toBeGreaterThanOrEqual(6);
    expect(tewari.every((r) => /Tewari|Srivastava|Martini|Sooriakumaran/.test(r.authors))).toBe(true);
  });
});

function nsDetail(grade: number, zones: Partial<NsSideDetail["zones"]> = {}): NsSideDetail {
  return {
    nsGrade: grade,
    reason: "test",
    alerts: [],
    zones: {
      posterolateral: 0,
      base: 0,
      apex: 0,
      anterior: 0,
      bladder_neck: 0,
      ...zones,
    },
    svi: 0,
    has_zone_data: true,
  };
}

describe("predictInflammationRisk", () => {
  it("is low for a clean history", () => {
    const r = predictInflammationRisk(defaultClinicalState());
    expect(r.tier).toBe("low");
    expect(r.reviewMri).toBe(false);
  });

  it("escalates and prompts MRI review when multiple factors present", () => {
    const S = defaultClinicalState();
    S.age = 74;
    S.vol = 105;
    S.prior_turp = true;
    S.bmi = 33;
    S.diverticulitis = true;
    const r = predictInflammationRisk(S);
    expect(r.tier).not.toBe("low");
    expect(r.reviewMri).toBe(true);
    expect(r.contributors.length).toBeGreaterThan(3);
  });

  it("is raised by a recorded intra-op grade", () => {
    const S = defaultClinicalState();
    S.intraop_inflammation_r = 3;
    const r = predictInflammationRisk(S);
    expect(r.tier).toBe("high");
    expect(r.intraopObserved).toBe(true);
    expect(r.intraopDriven).toBe(true);
    expect(r.reviewMri).toBe(false);
  });

  it("a low intra-op grade never de-escalates below the pre-op estimate", () => {
    const S = defaultClinicalState();
    S.prior_pelvic_radiation = true;
    S.diverticulitis = true;
    S.crohns = true;
    const preop = predictInflammationRisk(S);
    S.intraop_inflammation_l = 1; // mild — logit well below the risk-factor sum
    const withIntraop = predictInflammationRisk(S);
    expect(withIntraop.score).toBeGreaterThanOrEqual(preop.score - 1e-9);
    expect(withIntraop.intraopDriven).toBe(false);
  });

  it("splits BPH-procedure weights and caps the total", () => {
    const one = defaultClinicalState();
    one.prior_holep = true;
    const all = defaultClinicalState();
    all.prior_turp = true;
    all.prior_holep = true;
    all.prior_greenlight = true;
    all.prior_urolift = true;
    all.prior_rezum = true;
    const rOne = predictInflammationRisk(one);
    const rAll = predictInflammationRisk(all);
    const bphOne = rOne.contributors.find((c) => /BPH/.test(c.label))!;
    const bphAll = rAll.contributors.find((c) => /BPH/.test(c.label))!;
    expect(bphAll.points).toBeGreaterThan(bphOne.points);
    expect(bphAll.points).toBeLessThanOrEqual(1.4 + 1e-9); // prior_bph_cap
  });
});

describe("buildSurgicalPlan", () => {
  it("recommends a bilateral hood for low-risk bilateral disease", () => {
    const S = defaultClinicalState();
    const infl = predictInflammationRisk(S);
    const plan = buildSurgicalPlan(S, nsDetail(1), nsDetail(1), 0.02, 0.02, infl);
    expect(plan.hood.value).toBe("bilateral");
    expect(plan.bladderNeckPreservation.value).toBe(true);
  });

  it("escalates NS grade when inflammation risk is high", () => {
    const S = defaultClinicalState();
    S.intraop_inflammation_l = 3;
    const infl = predictInflammationRisk(S);
    const plan = buildSurgicalPlan(S, nsDetail(2), nsDetail(1), 0.02, 0.02, infl);
    expect(plan.left.nsGrade).toBe(3);
  });

  it("flags hydrodissection in the intermediate posterolateral-ECE band", () => {
    const S = defaultClinicalState();
    const infl = predictInflammationRisk(S);
    const plan = buildSurgicalPlan(
      S,
      nsDetail(2, { posterolateral: 0.2 }),
      nsDetail(1),
      0.02,
      0.02,
      infl,
    );
    expect(plan.left.hydrodissection.value).toBe(true);
  });

  it("drops bladder-neck preservation with a large median lobe", () => {
    const S = defaultClinicalState();
    S.median_lobe_grade = 3;
    const infl = predictInflammationRisk(S);
    const plan = buildSurgicalPlan(S, nsDetail(1), nsDetail(1), 0.02, 0.02, infl);
    expect(plan.bladderNeckPreservation.value).toBe(false);
    expect(plan.hood.value).toBe("none");
  });

  it("honours a surgeon NS-grade override", () => {
    const S = defaultClinicalState();
    S.plan_ns_override_r = 3;
    const infl = predictInflammationRisk(S);
    const plan = buildSurgicalPlan(S, nsDetail(1), nsDetail(1), 0.02, 0.02, infl);
    expect(plan.right.nsGrade).toBe(3);
    expect(plan.right.overridden).toBe(true);
  });
});

describe("bcrByPlan", () => {
  const arm = (o: Partial<{ nsGrade: number; hydrodissection: boolean; inflammationTier: "low" | "moderate" | "high" }> = {}) => ({
    nsGrade: 2,
    hydrodissection: false,
    inflammationTier: "low" as const,
    ...o,
  });

  it("projects y1 below y2-3 and both below the plateau", () => {
    const S = defaultClinicalState();
    const r = bcrByPlan(S, 0.2, arm(), arm());
    expect(r.baseline.y1).toBeLessThan(r.baseline.y23);
    expect(r.baseline.y23).toBeLessThan(r.baseline.plateau + 1e-9);
  });

  it("hydrodissection lowers the projected BCR", () => {
    const S = defaultClinicalState();
    const r = bcrByPlan(S, 0.2, arm(), arm({ hydrodissection: true }));
    expect(r.withPlan.y23).toBeLessThan(r.baseline.y23);
  });

  it("high inflammation raises the projected BCR more than moderate", () => {
    const S = defaultClinicalState();
    const mod = bcrByPlan(S, 0.2, arm(), arm({ inflammationTier: "moderate" }));
    const high = bcrByPlan(S, 0.2, arm(), arm({ inflammationTier: "high" }));
    expect(mod.withPlan.y23).toBeGreaterThan(mod.baseline.y23);
    expect(high.withPlan.y23).toBeGreaterThan(mod.withPlan.y23);
  });
});

describe("computeFunctionalOutcomes — healer tiers + plan deltas", () => {
  const base = {
    age: 58,
    shim: 22,
    ipss: 5,
    bmi: 26,
    pfmt: "moderate" as const,
    exercise: "active" as const,
    smoking: "never" as const,
    pde5: "daily" as const,
    alcohol: "none" as const,
    dm: false,
    htn: false,
    cad: false,
  };

  it("assigns a healer tier from the potency timeline", () => {
    const r = computeFunctionalOutcomes({ ...base, nsL: 1, nsR: 1 });
    expect(["super", "healer", "delayed", "non-recovery"]).toContain(r.healerTier);
    expect(r.healerBands).not.toBeNull();
  });

  it("returns null healer fields when SHIM < 12", () => {
    const r = computeFunctionalOutcomes({ ...base, shim: 8, nsL: 1, nsR: 1 });
    expect(r.healerTier).toBeNull();
    expect(r.healerBands).toBeNull();
  });

  it("a bilateral hood improves early continence", () => {
    const noPlan = computeFunctionalOutcomes({ ...base, nsL: 2, nsR: 2 });
    const withHood = computeFunctionalOutcomes({
      ...base,
      nsL: 2,
      nsR: 2,
      plan: {
        hood: "bilateral",
        bnPreservation: true,
        svPreservationL: true,
        svPreservationR: true,
        hydrodissectionL: false,
        hydrodissectionR: false,
        inflammationTier: "low",
      },
    });
    expect(withHood.continenceTimeline[0]).toBeGreaterThan(noPlan.continenceTimeline[0]!);
    expect(withHood.planContinenceAdj).toBeGreaterThan(0);
  });

  it("high inflammation drags potency down", () => {
    const clean = computeFunctionalOutcomes({ ...base, nsL: 2, nsR: 2 });
    const inflamed = computeFunctionalOutcomes({
      ...base,
      nsL: 2,
      nsR: 2,
      plan: {
        hood: "none",
        bnPreservation: false,
        svPreservationL: true,
        svPreservationR: true,
        hydrodissectionL: false,
        hydrodissectionR: false,
        inflammationTier: "high",
      },
    });
    expect(inflamed.potency12!).toBeLessThan(clean.potency12!);
  });
});
