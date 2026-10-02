import { describe, expect, it } from "vitest";
import { defaultClinicalState } from "@/types/patient";
import { predictInflammationRisk } from "@/lib/compass/inflammationRisk";
import { predictPlaneHostility } from "@/lib/compass/planeHostility";
import { buildPipsCounseling, sideConfidence } from "@/lib/compass/pipsCounseling";
import { PDI_ITEM_COUNT, normalizePdi, pdiTotal } from "@/lib/compass/planeDifficultyIndex";
import { buildSurgicalPlan } from "@/lib/compass/surgicalPlan";
import { bcrByPlan } from "@/lib/compass/bcrByPlan";
import { computeFunctionalOutcomes } from "@/lib/compass/functionalOutcomes";
import { EVIDENCE_REGISTRY } from "@/lib/compass/planningEvidence";
import type { NsSideDetail } from "@/types/prediction";
import type { FunctionalInputs } from "@/lib/compass/functionalOutcomes";

type BreakdownProbe = Pick<
  FunctionalInputs,
  "bmi" | "pfmt" | "exercise" | "pde5" | "smoking" | "alcohol" | "dm" | "htn" | "cad" | "ipss"
> & { diet: NonNullable<FunctionalInputs["diet"]> };

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

describe("evidence entries must not drift from the coefficients they document", () => {
  // The MF table in functionalOutcomes.ts is the source of truth at runtime;
  // the MF_* evidence entries repeat those numbers so the citation shown in the
  // UI names the value actually being applied. Read the effective pp back out
  // through the public breakdown so a change to either side fails here.
  const base: BreakdownProbe = {
    bmi: 24, pfmt: "none", exercise: "light", pde5: "none", smoking: "never",
    alcohol: "moderate", diet: "average", dm: false, htn: false, cad: false, ipss: 5,
  };

  const effect = async (over: Partial<BreakdownProbe>, label: string) => {
    const { modifiableFactorBreakdown } = await import("@/lib/compass/functionalOutcomes");
    const row = modifiableFactorBreakdown({ ...base, ...over }).find((r) => r.label === label);
    expect(row, `no breakdown row for ${label}`).toBeDefined();
    return { pot: row!.pot, cont: row!.cont };
  };

  it("obesity entry matches the applied deltas", async () => {
    const { MF_BMI_FUNCTION } = await import("@/lib/compass/planningEvidence");
    const v = MF_BMI_FUNCTION.value;
    expect(await effect({ bmi: v.threshold + 2 }, "BMI")).toEqual({ pot: v.pot, cont: v.cont });
  });

  it("PFMT entry matches the applied deltas", async () => {
    const { MF_PFMT } = await import("@/lib/compass/planningEvidence");
    const v = MF_PFMT.value;
    expect(await effect({ pfmt: "intensive" }, "Pelvic floor training")).toEqual({
      pot: v.pot,
      cont: v.cont,
    });
  });

  it("physical-activity entry matches the applied deltas", async () => {
    const { MF_EXERCISE_FUNCTION } = await import("@/lib/compass/planningEvidence");
    const v = MF_EXERCISE_FUNCTION.value;
    expect(await effect({ exercise: "active" }, "Exercise")).toEqual({ pot: v.pot, cont: v.cont });
  });

  it("PDE5 entry matches the applied delta", async () => {
    const { MF_PDE5_REHAB } = await import("@/lib/compass/planningEvidence");
    expect((await effect({ pde5: "daily" }, "PDE5 inhibitor")).pot).toBe(MF_PDE5_REHAB.value.pot);
  });

  it("smoking entry matches the applied deltas", async () => {
    const { MF_SMOKING_FUNCTION } = await import("@/lib/compass/planningEvidence");
    const v = MF_SMOKING_FUNCTION.value;
    expect(await effect({ smoking: "current" }, "Smoking")).toEqual({ pot: v.pot, cont: v.cont });
  });

  it("alcohol entry matches the applied deltas", async () => {
    const { MF_ALCOHOL_FUNCTION } = await import("@/lib/compass/planningEvidence");
    const v = MF_ALCOHOL_FUNCTION.value;
    expect(await effect({ alcohol: "heavy" }, "Alcohol")).toEqual({ pot: v.pot, cont: v.cont });
  });

  it("comorbidity entry matches the applied deltas", async () => {
    const { MF_COMORBID_FUNCTION } = await import("@/lib/compass/planningEvidence");
    const v = MF_COMORBID_FUNCTION.value;
    expect(await effect({ dm: true }, "Diabetes")).toEqual(v.dm);
    expect(await effect({ htn: true }, "Hypertension")).toEqual(v.htn);
    expect(await effect({ cad: true }, "Coronary disease")).toEqual(v.cad);
  });

  it("IPSS entry matches the applied ladder in every scored band", async () => {
    const { MF_IPSS_CONTINENCE } = await import("@/lib/compass/planningEvidence");
    const { thresholds, cont } = MF_IPSS_CONTINENCE.value;
    // cont[0] is the 0-pp band at or below the first threshold; that row is
    // correctly absent from the breakdown, so probe just above each threshold.
    const probes = [thresholds[0]! + 1, thresholds[1]! + 1, thresholds[2]! + 1];
    for (let i = 0; i < probes.length; i++) {
      const row = await effect({ ipss: probes[i]! }, "Voiding symptoms (IPSS)");
      expect(row.cont, `IPSS ${probes[i]}`).toBe(cont[i + 1]!);
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

  it("every modifiable factor in the outcome model is grounded in a named paper", async () => {
    const { EVIDENCE_REGISTRY } = await import("@/lib/compass/planningEvidence");
    const { PLANNING_REFERENCES } = await import("@/lib/compass/planningReferences");
    // one entry per lever the Factors tab exposes — add a factor, add its evidence
    const factors = [
      "age & baseline erectile function",
      "obesity",
      "pelvic floor muscle training",
      "physical activity",
      "PDE5 inhibitor regimen",
      "smoking (functional recovery)",
      "alcohol",
      "comorbidities (functional recovery)",
      "baseline voiding symptoms (IPSS)",
    ];
    for (const f of factors) {
      const label = `Modifiable factor — ${f}`;
      const entry = EVIDENCE_REGISTRY.find((e) => e.label === label);
      expect(entry, `no evidence entry for ${label}`).toBeDefined();
      expect(entry!.citation).toMatch(/\b(19|20)\d\d\b/); // names a year
      expect(
        PLANNING_REFERENCES.some((r) => r.usedFor.includes(label)),
        `no bibliography entry cites ${label}`,
      ).toBe(true);
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

describe("predictPlaneHostility (PIPS-H)", () => {
  it("is low for a clean history and normal MRI plane phenotype on both sides", () => {
    const S = defaultClinicalState();
    expect(predictPlaneHostility(S, "left").tier).toBe("low");
    expect(predictPlaneHostility(S, "right").tier).toBe("low");
  });

  it("is genuinely side-specific — a left-only MRI finding does not move the right side", () => {
    const S = defaultClinicalState();
    S.mri_capsule_interface_l = 3;
    S.mri_nvb_plane_l = 2;
    S.mri_post_treatment_distortion_l = 2;
    const left = predictPlaneHostility(S, "left");
    const right = predictPlaneHostility(S, "right");
    expect(left.tier).toMatch(/high|very-high/);
    expect(right.tier).toBe("low");
    expect(left.score).toBeGreaterThan(right.score);
  });

  it("shares whole-patient history terms with predictInflammationRisk — both sides move together on a symmetric risk factor", () => {
    const S = defaultClinicalState();
    S.prior_pelvic_radiation = true;
    S.diverticulitis = true;
    const left = predictPlaneHostility(S, "left");
    const right = predictPlaneHostility(S, "right");
    const baseline = predictPlaneHostility(defaultClinicalState(), "left");
    expect(left.score).toBe(right.score); // symmetric history factor, no side-specific MRI difference
    expect(left.score).toBeGreaterThan(baseline.score);
  });

  it("side-specific fat stranding raises only the affected side", () => {
    const S = defaultClinicalState();
    S.mri_fat_stranding_l = 2;
    expect(predictPlaneHostility(S, "left").score).toBeGreaterThan(predictPlaneHostility(S, "right").score);
  });

  it("prior ipsilateral focal ablation raises this side more than a whole-gland ablation raises the contralateral side", () => {
    const S = defaultClinicalState();
    S.prior_focal_ablation_l = 1; // ipsilateral focal (IRE/laser/PDT)
    const ipsi = predictPlaneHostility(S, "left");
    const contra = predictPlaneHostility(S, "right");
    expect(ipsi.score).toBeGreaterThan(contra.score);
    // contralateral ablation has no isolated estimate in the literature: zero weight, shown as context
    const baseline = predictPlaneHostility(defaultClinicalState(), "right");
    expect(contra.score).toBe(baseline.score);
    expect(contra.contributors.some((c) => c.label.includes("contralateral") && c.points === 0 && c.evidence === "none")).toBe(true);
  });

  it("whole-gland ablation (HIFU/cryo) scores higher than focal ablation on the same side", () => {
    const focal = defaultClinicalState();
    focal.prior_focal_ablation_l = 1;
    const wholeGland = defaultClinicalState();
    wholeGland.prior_focal_ablation_l = 2;
    expect(predictPlaneHostility(wholeGland, "left").score).toBeGreaterThan(predictPlaneHostility(focal, "left").score);
  });

  it("prior rectal surgery, penile-prosthesis reservoir, post-biopsy hemorrhage, brachytherapy modality and a complicated BPH procedure each raise hostility on both sides", () => {
    const baseline = predictPlaneHostility(defaultClinicalState(), "left").score;
    const cases: Partial<ReturnType<typeof defaultClinicalState>>[] = [
      { prior_pelvic_surgery: "rectal_denonvilliers" },
      { penile_prosthesis_reservoir: "prior_infection_or_revision" },
      { mri_post_biopsy_hemorrhage: true },
      { prior_pelvic_radiation: true, radiation_brachytherapy: true },
      { prior_turp: true, bph_procedure_complicated: true },
      { mri_denonvilliers: 2 },
    ];
    for (const patch of cases) {
      const S = { ...defaultClinicalState(), ...patch };
      expect(predictPlaneHostility(S, "left").score).toBeGreaterThan(baseline);
      expect(predictPlaneHostility(S, "right").score).toBeGreaterThan(baseline);
    }
  });

  it("evidence-free factors (age, hs-CRP/NLR, biopsy count, recent/complicated biopsy) are shown as context but do not move the score", () => {
    const baseline = defaultClinicalState();
    const base = predictPlaneHostility(baseline, "left");
    const cases: Partial<ReturnType<typeof defaultClinicalState>>[] = [
      { age: 80 },
      { crp: 8 },
      { nlr: 6 },
      { biopsy_sessions: 4 },
      { biopsy_recent_or_complicated: true },
      { five_ari_long_term: true },
    ];
    for (const patch of cases) {
      const S = { ...baseline, ...patch };
      const out = predictPlaneHostility(S, "left");
      expect(out.score).toBe(base.score);
      expect(out.contributors.some((c) => c.points === 0 && (c.evidence === "none" || c.evidence === "null"))).toBe(true);
    }
  });

  it("UroLift, Rezum, recurrent UTI and pelvic abscess (no RP plane evidence) show as context but do not move the score", () => {
    const base = predictPlaneHostility(defaultClinicalState(), "left").score;
    for (const patch of [{ prior_urolift: true }, { prior_rezum: true }, { recurrent_uti: true }, { pelvic_abscess: true }]) {
      const out = predictPlaneHostility({ ...defaultClinicalState(), ...patch }, "left");
      expect(out.score).toBe(base);
      expect(out.contributors.some((c) => c.points === 0 && (c.evidence === "none" || c.evidence === "null"))).toBe(true);
    }
  });

  it("never-studied history items (retention, IPSS, catheter, diverticulitis, bladder surgery/fracture, prostatitis, biopsy inflammation) and the validated-null general abdominal surgery do not move the score", () => {
    const base = predictPlaneHostility(defaultClinicalState(), "left").score;
    const cases: Partial<ReturnType<typeof defaultClinicalState>>[] = [
      { urinary_retention: true },
      { ipss: 25 },
      { catheter_prolonged_or_traumatic: true },
      { diverticulitis: true },
      { prior_pelvic_surgery: "bladder_fracture_urethroplasty" },
      { treated_prostatitis: true },
      { biopsy_shows_inflammation: true },
      { prior_abdominal_surgery: true },
    ];
    for (const patch of cases) {
      expect(predictPlaneHostility({ ...defaultClinicalState(), ...patch }, "left").score).toBe(base);
    }
    const out = predictPlaneHostility({ ...defaultClinicalState(), prior_abdominal_surgery: true }, "left");
    expect(out.contributors.find((c) => c.label.includes("abdominal"))?.evidence).toBe("null");
  });

  it("measured pelvic visceral fat >= 1400 cm3 raises hostility and supersedes the BMI term (never both scored)", () => {
    const base = predictPlaneHostility(defaultClinicalState(), "left").score;
    const obese = { ...defaultClinicalState(), bmi: 34 };
    const obeseLowFat = { ...obese, pelvic_visceral_fat_cm3: 900 };
    const obeseHighFat = { ...obese, pelvic_visceral_fat_cm3: 1600 };
    expect(predictPlaneHostility(obese, "left").score).toBeGreaterThan(base); // BMI term while fat is unmeasured
    expect(predictPlaneHostility(obeseLowFat, "left").score).toBe(base); // measured low fat: BMI superseded
    expect(predictPlaneHostility(obeseHighFat, "left").score).toBeGreaterThan(base);
    const out = predictPlaneHostility(obeseHighFat, "left");
    expect(out.contributors.filter((c) => c.label.startsWith("BMI") && c.points > 0)).toHaveLength(0);
  });

  it("neoadjuvant ADT adds a small term but is not additive with prior radiation", () => {
    const base = predictPlaneHostility(defaultClinicalState(), "left").score;
    const adt = predictPlaneHostility({ ...defaultClinicalState(), neoadjuvant_adt: true }, "left").score;
    const rt = predictPlaneHostility({ ...defaultClinicalState(), prior_pelvic_radiation: true }, "left").score;
    const both = predictPlaneHostility({ ...defaultClinicalState(), prior_pelvic_radiation: true, neoadjuvant_adt: true }, "left").score;
    expect(adt).toBeGreaterThan(base);
    expect(adt).toBeLessThan(rt);
    expect(both).toBe(rt);
  });

  it("HoLEP is weighted below TURP (the margin elevation is confined to prior TURP)", () => {
    const turp = predictPlaneHostility({ ...defaultClinicalState(), prior_turp: true }, "left").score;
    const holep = predictPlaneHostility({ ...defaultClinicalState(), prior_holep: true }, "left").score;
    expect(holep).toBeLessThan(turp);
    expect(holep).toBeGreaterThan(predictPlaneHostility(defaultClinicalState(), "left").score);
  });

  it("a side-specific MRI read supersedes the whole-gland read of the same finding (no double counting)", () => {
    const wholeGlandOnly = { ...defaultClinicalState(), mri_periprostatic_inflammation: "present" as const, mri_periprostatic_fat_stranding: true };
    const both = { ...wholeGlandOnly, mri_nonmass_inflammatory_signal_l: 2, mri_fat_stranding_l: 2 };
    const sideOnly = { ...defaultClinicalState(), mri_nonmass_inflammatory_signal_l: 2, mri_fat_stranding_l: 2 };
    expect(predictPlaneHostility(both, "left").score).toBe(predictPlaneHostility(sideOnly, "left").score);
    // the whole-gland read still counts on a side with no side-specific read
    expect(predictPlaneHostility(both, "right").score).toBeGreaterThan(predictPlaneHostility(defaultClinicalState(), "right").score);
    expect(predictPlaneHostility(wholeGlandOnly, "left").score).toBeGreaterThan(predictPlaneHostility(defaultClinicalState(), "left").score);
  });

  it("tags every contributor with an evidence tier; prior radiation is direct, hernia mesh is surrogate", () => {
    const S = { ...defaultClinicalState(), prior_pelvic_radiation: true, hernia_mesh: true, mri_capsule_interface_l: 2 };
    const out = predictPlaneHostility(S, "left");
    const tierOf = (needle: string) => out.contributors.find((c) => c.label.includes(needle))?.evidence;
    expect(tierOf("Prior pelvic radiation")).toBe("direct");
    expect(tierOf("hernia mesh")).toBe("surrogate");
    expect(tierOf("Capsule")).toBe("unvalidated");
  });
});

describe("Plane Difficulty Index", () => {
  it("normalizes to 12 clamped 0–3 scores and totals them", () => {
    expect(normalizePdi(undefined)).toEqual(Array(PDI_ITEM_COUNT).fill(0));
    const n = normalizePdi([5, -2, 1.4, "x"]);
    expect(n.slice(0, 4)).toEqual([3, 0, 1, 0]);
    expect(n).toHaveLength(PDI_ITEM_COUNT);
    expect(pdiTotal(n)).toBe(4);
  });

  it("is recorded only: scoring it does not change any prediction", () => {
    const S = { ...defaultClinicalState(), plane_difficulty_l: Array(PDI_ITEM_COUNT).fill(3) };
    expect(predictPlaneHostility(S, "left").score).toBe(predictPlaneHostility(defaultClinicalState(), "left").score);
    expect(predictInflammationRisk(S).score).toBe(predictInflammationRisk(defaultClinicalState()).score);
  });
});

describe("PIPS gates", () => {
  it("active infection defers both sides regardless of EPE/hostility", () => {
    const S = defaultClinicalState();
    S.flag_active_infection = true;
    const plan = buildSurgicalPlan(S, nsDetail(1), nsDetail(1), 0.02, 0.02, 0.4, 0.4);
    expect(plan.left.decisionCode).toBe("defer");
    expect(plan.right.decisionCode).toBe("defer");
    expect(plan.gates.activeInfection).toBe(true);
    // the per-side rationale must say so too, not just the plan-level banner
    expect(plan.left.gradeRationale).toMatch(/active infection/i);
    expect(plan.right.gradeRationale).toMatch(/active infection/i);
  });

  it("without the active-infection flag, the plan is scored normally", () => {
    const S = defaultClinicalState();
    const plan = buildSurgicalPlan(S, nsDetail(1), nsDetail(1), 0.02, 0.02, 0.02, 0.02);
    expect(plan.left.decisionCode).not.toBe("defer");
    expect(plan.gates.activeInfection).toBe(false);
  });

  it("surfaces imaging-discordant, MRI-artifact, and missing-data flags on the plan without changing the decision code", () => {
    const S = defaultClinicalState();
    S.flag_imaging_discordant = true;
    S.flag_mri_artifact = true;
    S.flag_key_data_missing = true;
    const plan = buildSurgicalPlan(S, nsDetail(1), nsDetail(1), 0.02, 0.02, 0.02, 0.02);
    expect(plan.gates.imagingDiscordant).toBe(true);
    expect(plan.gates.mriArtifact).toBe(true);
    expect(plan.gates.keyDataMissing).toBe(true);
    expect(plan.left.decisionCode).toBe("maximal");
  });
});

describe("buildSurgicalPlan", () => {
  it("does NOT escalate a hostile-but-EPE-low side — uses the hostile-plane protocol instead", () => {
    // PIPS-style behaviour: a hostile plane on a side with low oncologic risk
    // gets a protocol note, not a wider excision (replaces the old
    // NS_GRADE_ESCALATION rule, which escalated on inflammation tier alone).
    const S = defaultClinicalState();
    S.mri_capsule_interface_l = 3;
    S.mri_nvb_plane_l = 2;
    S.mri_post_treatment_distortion_l = 2;
    const plan = buildSurgicalPlan(S, nsDetail(2), nsDetail(1), 0.02, 0.02, 0.02, 0.02);
    expect(plan.left.hostilityTier).toMatch(/high|very-high/);
    expect(plan.left.epeTier).toBe("low");
    expect(plan.left.nsGrade).toBe(2); // unchanged — no escalation
    expect(plan.left.hostileProtocol).toBe(true);
    expect(plan.left.decisionCode).toBe("preserve-hostile-protocol");
  });

  it("keeps the 5-zone model grade when EPE is high — the matrix is advisory only", () => {
    const S = defaultClinicalState();
    const plan = buildSurgicalPlan(S, nsDetail(2), nsDetail(1), 0.02, 0.02, 0.4, 0.02);
    expect(plan.left.epeTier).toBe("high");
    expect(plan.left.nsGrade).toBe(2);
    expect(plan.left.pipsGrade).toBe(3);
    expect(plan.left.decisionCode).toBe("wider-plane");
  });

  it("flags hydrodissection in the intermediate posterolateral-ECE band", () => {
    const S = defaultClinicalState();
    const plan = buildSurgicalPlan(
      S,
      nsDetail(2, { posterolateral: 0.2 }),
      nsDetail(1),
      0.02,
      0.02,
      0.02,
      0.02,
    );
    expect(plan.left.hydrodissection.value).toBe(true);
  });

  it("honours a surgeon NS-grade override", () => {
    const S = defaultClinicalState();
    S.plan_ns_override_r = 3;
    const plan = buildSurgicalPlan(S, nsDetail(1), nsDetail(1), 0.02, 0.02, 0.02, 0.02);
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

  it("high inflammation drags potency down", () => {
    const clean = computeFunctionalOutcomes({ ...base, nsL: 2, nsR: 2 });
    const inflamed = computeFunctionalOutcomes({
      ...base,
      nsL: 2,
      nsR: 2,
      plan: {
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

describe("PIPS counseling output and per-side confidence", () => {
  const fbase = (S: ReturnType<typeof defaultClinicalState>) => ({
    age: S.age, shim: S.shim, ipss: S.ipss, bmi: S.bmi,
    pfmt: "none" as const, exercise: "light" as const, smoking: "never" as const,
    pde5: "prn" as const, alcohol: "moderate" as const, dm: false, htn: false, cad: false,
  });

  it("confidence is high with no flags and a history-driven score", () => {
    const S = defaultClinicalState();
    expect(sideConfidence(S, "left")).toEqual({ level: "high", reasons: [] });
  });

  it("MRI artifact or missing data reduces confidence; discordance or active infection makes it low", () => {
    const S = defaultClinicalState();
    expect(sideConfidence({ ...S, flag_mri_artifact: true }, "left").level).toBe("reduced");
    expect(sideConfidence({ ...S, flag_key_data_missing: true }, "right").level).toBe("reduced");
    expect(sideConfidence({ ...S, flag_imaging_discordant: true }, "left").level).toBe("low");
    expect(sideConfidence({ ...S, flag_active_infection: true }, "left").level).toBe("low");
  });

  it("a side whose score rests mainly on unvalidated MRI grades has reduced confidence; the other side does not", () => {
    const S = { ...defaultClinicalState(), mri_capsule_interface_l: 3, mri_nvb_plane_l: 2 };
    const left = sideConfidence(S, "left");
    expect(left.level).toBe("reduced");
    expect(left.reasons.join(" ")).toMatch(/not yet validated/i);
    expect(sideConfidence(S, "right").level).toBe("high");
  });

  it("builds separate per-side statements and four recovery scenarios that fall as nerve sparing is lost", () => {
    const S = defaultClinicalState();
    S.shim = 22;
    const plan = buildSurgicalPlan(S, nsDetail(1), nsDetail(1), 0.02, 0.02, 0.1, 0.4);
    const c = buildPipsCounseling(S, plan, 0.1, 0.4, fbase(S));
    expect(c.left.preservableOncologically).toBeCloseTo(0.9);
    expect(c.right.preservableOncologically).toBeCloseTo(0.6);
    expect(c.left.technicallyDifficult).toBe(plan.left.hostilityScore);
    expect(c.recovery.map((r) => r.label)).toEqual(["Nerve sparing both sides, as planned", "Left preserved, right wide", "Right preserved, left wide", "Wide (extrafascial) both sides"]);
    const [p0, p1, , p3] = c.recovery.map((r) => r.potency12 as number);
    expect(p0).toBeGreaterThanOrEqual(p1!);
    expect(p1).toBeGreaterThanOrEqual(p3!);
    expect(p0).toBeGreaterThan(p3!);
  });

  it("the intra-operative plan-reduction statement is qualitative, and deferred surgery is not assessed", () => {
    const S = defaultClinicalState();
    S.flag_active_infection = true;
    const plan = buildSurgicalPlan(S, nsDetail(1), nsDetail(1), 0.02, 0.02, 0.1, 0.1);
    const c = buildPipsCounseling(S, plan, 0.1, 0.1, fbase(S));
    expect(c.left.planReduction.likelihood).toBe("not-assessed");
    const ok = buildSurgicalPlan(defaultClinicalState(), nsDetail(1), nsDetail(1), 0.02, 0.02, 0.02, 0.02);
    expect(buildPipsCounseling(defaultClinicalState(), ok, 0.02, 0.02, fbase(S)).left.planReduction.text).toMatch(/qualitative/i);
  });

  it("flags prior treatment and provisional weights among the sources of uncertainty", () => {
    const S = { ...defaultClinicalState(), prior_pelvic_radiation: true };
    const plan = buildSurgicalPlan(S, nsDetail(1), nsDetail(1), 0.02, 0.02, 0.1, 0.1);
    const u = buildPipsCounseling(S, plan, 0.1, 0.1, fbase(S)).uncertainty.join(" ");
    expect(u).toMatch(/pelvic radiation/);
    // the standing "weights are provisional" caveat lives in the page header, not the uncertainty list
    expect(u).not.toMatch(/provisional/);
  });
});
