/**
 * Every numeric value and decision rule used by the surgical-plan,
 * inflammation-risk, healer-tier and BCR-by-plan modules — each tagged with a
 * source and a citation. Nothing in those modules should hard-code a number that
 * is not declared here.
 *
 * Citations foreground the Mount Sinai / Tewari group's own published work
 * wherever a directly relevant paper exists (this is the group behind COMPASS);
 * landmark external references are used only where that group has no directly
 * applicable paper. Author/year handles are from working knowledge and should be
 * verified against the primary literature before any clinical framing.
 *
 * A machine-readable mirror lives at `models/surgicalPlanning.json`
 * (referenced by MODEL_CARD.md §9.6).
 *
 * - `institutional` — derived from the Mount Sinai RARP cohort / an existing
 *                     fitted COMPASS model.
 * - `literature`    — a published estimate (paper cited).
 * - `provisional`   — an expert-prior default not yet calibrated on COMPASS
 *                     data; flagged in the UI as such.
 */

export type EvidenceSource = "institutional" | "literature" | "provisional";

export interface Evidenced<T> {
  value: T;
  source: EvidenceSource;
  /** short human-readable name for the "Evidence & sources" panel */
  label: string;
  citation: string;
}

/** Registry populated as each group is declared, for the UI bibliography. */
export const EVIDENCE_REGISTRY: Omit<Evidenced<unknown>, "value">[] = [];

const ev = <T>(
  value: T,
  source: EvidenceSource,
  label: string,
  citation: string,
): Evidenced<T> => {
  EVIDENCE_REGISTRY.push({ source, label, citation });
  return { value, source, label, citation };
};

export const SOURCE_LABEL: Record<EvidenceSource, string> = {
  institutional: "COMPASS data",
  literature: "Literature",
  provisional: "Provisional — not yet calibrated",
};

/* ================================================================== */
/* Core COMPASS prediction models — provenance                         */
/* (ECE, SVI, Upgrade, PSM, BCR, LNI — Predictions tab). These are the */
/* six fitted models MODEL_CARD.md §9.6 says the planning/inflammation */
/* modules never modify; the entries below only document where their  */
/* numbers come from, not a change to any of their coefficients.      */
/* ================================================================== */

export const CORE_MODELS_PROVENANCE = ev(
  { cohortN: 5352, span: "Jan 2015 – Jan 2026" },
  "institutional",
  "Core COMPASS models (ECE, SVI, Upgrade, PSM)",
  "Fitted on the Mount Sinai RARP cohort — 5,352 consecutive patients, " +
    "January 2015 to January 2026 (MODEL_CARD.md §2-3). Model-level Ns and " +
    "cross-validated AUCs are reported per outcome in MODEL_CARD.md §2. The " +
    "peer-reviewed manuscript describing COMPASS is in preparation; until " +
    "publication this is institutional evidence, not an external citation.",
);

export const BCR_MODEL_DEFINITION = ev(
  { definition: "PSA ≥0.2 ng/mL on two consecutive measures" },
  "literature",
  "BCR outcome definition & natural history",
  "Biochemical recurrence defined per the AUA/ASTRO guideline on clinically " +
    "localized prostate cancer (amended 2026); event-timing consistent with " +
    "post-prostatectomy recurrence series (Han M et al., J Urol 2003; " +
    "Freedland SJ et al., JAMA 2005). The BCR risk model itself is fitted on " +
    "the Mount Sinai cohort (see Core COMPASS models entry above).",
);

export const LNI_MODEL_DEFINITION = ev(
  { template: "extended PLND: obturator + external + internal iliac + common iliac" },
  "literature",
  "LNI outcome definition & PSMA nodal positivity",
  "Lymph-node invasion scored against an extended pelvic lymph-node-" +
    "dissection template. PSMA nodal positivity as the strongest single " +
    "predictor is consistent with proPSMA (Hofman MS et al., Lancet 2020). " +
    "The LNI risk model itself is fitted on the Mount Sinai cohort (N=663 " +
    "PSMA-imaged patients with extended PLND; see Core COMPASS models entry).",
);

/* ================================================================== */
/* Nerve-sparing grade model                                           */
/* ================================================================== */

export const NS_BASE_MODEL = ev(
  { note: "zone-aware 5-zone NS grade" },
  "institutional",
  "COMPASS zone-aware nerve-sparing model",
  "COMPASS zone-aware NS grade (MODEL_CARD.md §9); side ECE/SVI from the fitted " +
    "COMPASS side-specific models (Mount Sinai RARP cohort, N≈5,352). Grading " +
    "framework: Tewari AK et al., anatomic (neural-hammock) grades of nerve " +
    "sparing, BJU Int 2011.",
);

/** Grade-1 (full nerve-sparing) eligibility for a side with cancer. */
export const NS_MINIMAL_DISEASE = ev(
  { maxGg: 2, maxCores: 2, maxEce: 0.1 },
  "literature",
  "Minimal-disease full nerve-sparing eligibility",
  "Full (intrafascial) nerve-sparing reserved for low-volume, low-grade, " +
    "low-ECE disease — Tewari AK et al., risk-stratified neural-hammock grades " +
    "of nerve sparing, BJU Int 2011; Srivastava A, … Tewari AK, Eur Urol 2013.",
);

/** Fraction-ECE thresholds per zone: grade2 = partial, grade3 = wide. */
export const NS_ZONE_THRESHOLDS = ev(
  {
    posterolateral: { grade2: 0.1, grade3: 0.3 },
    base: { grade2: 0.1, grade3: 0.35 },
    apex: { grade2: 0.1, grade3: 0.3 },
    anterior: { grade2: 0.12, grade3: 0.35 },
    bladder_neck: { grade2: 0.1, grade3: 0.3 },
  },
  "literature",
  "Per-zone NS-grade ECE thresholds",
  "Posterolateral/base retained from the existing COMPASS NS_THRESHOLDS; " +
    "zone-specific ECE / positive-margin gradients from Martini A, … Tewari AK, " +
    "side-specific ECE nomogram work (BJU Int 2018) and apical-margin series " +
    "(Preisser F et al. 2019).",
);

/** Fallback zonal split of side-level ECE when no zone-level data is available. */
export const NS_ZONE_ECE_FALLBACK = ev(
  { posterolateral: 0.35, base: 0.3, apex: 0.2, anterior: 0.1, bladder_neck: 0.05 },
  "literature",
  "Zonal distribution of extracapsular extension",
  "Posterolateral / base predominance of ECE site on whole-mount radical " +
    "prostatectomy (Martini A, … Tewari AK, 2017–2018; Ball MW et al. 2015).",
);

/** Biopsy grade-group → prior probability that the zone harbours csPCa. */
export const GG_BOOST_ZONE = ev(
  {
    byGrade: { 1: 0.3, 2: 0.55, 3: 0.7, 4: 0.8, 5: 0.9 } as Record<number, number>,
    coreInvolvementWeight: 0.3,
  },
  "provisional",
  "Biopsy GG → zone cancer prior",
  "Monotone prior mapping biopsy grade group (and core-involvement fraction) in " +
    "a sextant to the probability that zone contains significant cancer; " +
    "directionally consistent with the sextant GG → ECE-site relationship in the " +
    "Tewari-group side-specific models. Expert prior pending COMPASS fitting.",
);

/**
 * ECE / SVI fractions that raise a dissection alert or force a grade, used by
 * both the NS model and the surgical plan.
 */
export const NS_ALERT_THRESHOLDS = ev(
  {
    apex: 0.1,
    apexHigh: 0.2,
    anterior: 0.1,
    anteriorHigh: 0.2,
    bladderNeck: 0.1,
    bladderNeckHigh: 0.2,
    nvb: 0.15,
    nvbHigh: 0.3,
    sviGrade2: 0.15,
    sviGrade3: 0.25,
    sviHigh: 0.3,
    mriEpePosterior: 0.15,
    psmaBase: 0.08,
    psmaBaseHigh: 0.25,
    zoneDataPresent: 0.03,
    zoneWeightAlert: 0.05,
  },
  "literature",
  "Zone dissection-alert & grade thresholds",
  "Periprostatic neuroanatomy / NVB course — Tewari A et al., Eur Urol 2003 and " +
    "BJU Int 2011; apical-margin gradients (Preisser F et al. 2019); PSMA-avid " +
    "at base ECE rate (Hofman MS et al., proPSMA, Lancet 2020).",
);

/** Grade → fascial plane label + technique note. */
export const PLANE_TECHNIQUE = ev(
  {
    1: { plane: "Intrafascial", note: "Athermal, retrograde release inside the prostatic fascia." },
    2: { plane: "Interfascial", note: "Athermal where possible; plane between prostatic and levator fascia." },
    3: { plane: "Extrafascial (wide)", note: "Wide excision outside the levator fascia; NVB taken on this side." },
  } as Record<number, { plane: string; note: string }>,
  "literature",
  "Fascial-plane nomenclature & athermal technique",
  "Tewari AK et al., anatomic (neural-hammock) grades of nerve sparing, BJU Int " +
    "2011; Tewari AK et al., athermal, traction-free risk-stratified nerve " +
    "sparing, World J Urol 2013.",
);

/** How the inflammation tier changes the recommended NS grade. */
export const NS_GRADE_ESCALATION = ev(
  { high_steps: 1, moderate_steps: 0 },
  "literature",
  "Inflammation → NS-grade escalation",
  "Obliterated periprostatic planes preclude an intrafascial dissection and " +
    "raise positive-margin risk — a wider plane is taken (competing goals of " +
    "cancer control vs. neurovascular preservation: Tewari A et al., BJU Int " +
    "2008; Srivastava & Tewari, Eur Urol 2013). Moderate inflammation is flagged " +
    "but left to surgeon judgement.",
);

/* ================================================================== */
/* Periprostatic-inflammation / "obliterated planes" risk              */
/* ================================================================== */

/** Additive logit points. `score = sigmoid(intercept + Σ points)`. */
export const INFLAMMATION_WEIGHTS = ev(
  {
    intercept: -1.9,
    age_gt_70: 0.35,
    volume_gt_80: 0.4,
    volume_gt_100: 0.35,
    prior_turp: 0.55,
    prior_holep: 0.7,
    prior_greenlight: 0.6,
    prior_urolift: 0.3,
    prior_rezum: 0.25,
    prior_bph_cap: 1.4,
    prior_pelvic_radiation: 1.1,
    radiation_proctitis: 0.6,
    urinary_retention: 0.4,
    recurrent_uti: 0.35,
    ipss_gt_19: 0.3,
    pelvic_abscess: 0.9,
    hernia_mesh: 0.7,
    rectal_fistula: 0.9,
    ibd: 0.7,
    diverticulitis: 0.45,
    biopsy_inflammation: 0.4,
    multiple_biopsies: 0.35,
    treated_prostatitis: 0.5,
    bmi_gt_30: 0.3,
    mri_inflammation_equivocal: 0.5,
    mri_inflammation_present: 1.0,
    mri_fat_stranding: 0.4,
    intraop_per_grade: 1.0,
  },
  "provisional",
  "Periprostatic-inflammation risk weights",
  "Surgical-difficulty framing after Tewari A et al., competing goals during " +
    "robotic RP (BJU Int 2008). Individual risk factors: prior BPH surgery and " +
    "pelvic RT (Mandel P et al., salvage RP series), IBD / diverticular pelvic " +
    "inflammation, obesity / periprostatic-fat inflammation, post-biopsy change. " +
    "BPH-procedure sub-weights ranked by dissection burden. Expert priors " +
    "pending fitting against whole-mount inflammation grade.",
);

export const INFLAMMATION_CUTS = ev(
  { moderate: 0.3, high: 0.55 },
  "provisional",
  "Inflammation-risk tier cutpoints",
  "Provisional tertile-style cutpoints; to be calibrated against whole-mount " +
    "periprostatic inflammation grade and an intra-op difficulty score.",
);

/* ================================================================== */
/* PIPS-H — side-specific plane hostility                              */
/* ================================================================== */

/**
 * Side-specific MRI "plane phenotype" weights (additive logit points, added
 * on top of the shared `INFLAMMATION_WEIGHTS` history/systemic terms) — the
 * piece the whole-patient `inflammationRisk.ts` score cannot see, per the
 * PIPS framework's core argument that plane hostility must be assessed per
 * side, not per patient.
 */
export const PLANE_HOSTILITY_MRI_WEIGHTS = ev(
  {
    capsuleInterfacePerLevel: 0.35, // 0 sharp .. 3 effaced
    nvbPlanePerLevel: 0.5, // 0 visible .. 2 obliterated/tethered
    postTreatmentDistortionPerLevel: 0.4, // 0 none .. 2 reaches posterolateral/NVB
    nonmassInflammatorySignalPerLevel: 0.35, // 0 none .. 2 diffuse
  },
  "provisional",
  "PIPS-H MRI plane-phenotype weights",
  "Candidate MRI fibrosis/plane features — capsule-fat interface loss, NVB " +
    "corridor fibrosis/tethering, post-treatment distortion reaching the " +
    "posterolateral capsule, non-mass-like inflammatory signal — from the PIPS " +
    "development framework's MRI-phenotype domain (periprostatic-inflammation " +
    "and plane-score research protocol, 2026), itself built on periprostatic " +
    "adipose inflammation associated with high-grade disease (Gucalp A et al., " +
    "Prostate Cancer Prostatic Dis 2017) and periprostatic-fat fibrosis as a " +
    "cancer-aggressiveness marker (Jin Y et al., Cancers 2026). Expert priors " +
    "pending a video-validated Plane Difficulty Index and whole-mount fitting.",
);

/** PIPS-style 4-tier hostility cutpoints (probability of a difficult plane). */
export const PLANE_HOSTILITY_CUTS = ev(
  { intermediate: 0.25, high: 0.5, veryHigh: 0.75 },
  "provisional",
  "PIPS-H tier cutpoints",
  "Low < 25%, intermediate 25–50%, high 50–75%, very high ≥ 75% — the tier " +
    "bands used in the PIPS v0.1 research-instrument prototype; provisional " +
    "pending fitting against a video-validated Plane Difficulty Index.",
);

/**
 * PIPS-style decision matrix: combines PIPS-EPE (oncologic — already the
 * fitted COMPASS side-specific ECE model, `eceL`/`eceR`) with PIPS-H (plane
 * hostility, above) ONLY at this final lookup step. This replaces
 * `NS_GRADE_ESCALATION`'s "high inflammation always raises the grade by one
 * step" rule: escalation now happens only when EPE itself is elevated, and a
 * hostile-but-oncologically-low-risk side gets an operative *protocol* note
 * instead of a wider excision.
 */
export const PIPS_EPE_CUTS = ev(
  { intermediate: 0.15, high: 0.35 },
  "literature",
  "PIPS-EPE tier cutpoints",
  "Low < 15%, intermediate 15–35%, high > 35% ipsilateral EPE probability — " +
    "matches the tiering used by the side-specific MRI/microultrasound EPE " +
    "nomograms this module is meant to sit alongside (Soeterik TFW et al., " +
    "simple PSA/biopsy/MRI decision rule, Int Urol Nephrol 2019; Pedraza AM, " +
    "Parekh S, Joshi H et al., side-specific microultrasound-based nomogram, " +
    "Eur Urol Open Sci 2023; Fasulo V et al., World J Urol 2022).",
);

export const PIPS_DECISION_MATRIX = ev(
  {
    // code: recommended plane action; escalates only when EPE itself is high.
    "low-low": "maximal",
    "low-high": "preserve-hostile-protocol",
    "high-low": "wider-plane",
    "high-high": "wider-plane",
    "intermediate-any": "graded-frozen-section",
  },
  "literature",
  "PIPS EPE x hostility decision matrix",
  "Never dissect through suspected EPE to preserve erectile function, and " +
    "never let fibrosis alone trigger wide excision when EPE probability is " +
    "low — the two questions (oncologic safety vs. technical difficulty) are " +
    "combined only at this final step, not blended into one score. Frozen-" +
    "section-guided grading at intermediate EPE is the highest-value setting " +
    "for NeuroSAFE (NeuroSAFE PROOF Collaborative Group, randomised phase 3 " +
    "trial of NeuroSAFE-guided vs. standard RARP, Lancet Oncol 2025) and for " +
    "side-specific frozen sections generally. Periprostatic-plane risk factors " +
    "— prior BPH surgery (Creta M et al., systematic review, Prostate Cancer " +
    "Prostatic Dis 2024), post-biopsy prostatitis (Türk H et al., Int Braz J " +
    "Urol 2018), and prior focal/ablative therapy (systematic review, salvage " +
    "RP after focal ablative therapy, Cancers 2023) — feed PIPS-H, never PIPS-EPE.",
);

/* ================================================================== */
/* Hood / bladder-neck / SV / hydrodissection decision rules           */
/* ================================================================== */

export const HOOD_DECISION = ev(
  { anteriorApexEceMax: 0.15 },
  "literature",
  "Anterior hood (Retzius-sparing) candidacy",
  "Anterior compartment / puboprostatic preservation supports early continence " +
    "(Tewari AK et al., anatomic restoration of the continence mechanism and " +
    "puboprostatic collar, Urology 2007); Retzius-sparing early-continence data " +
    "(Rosenberg JE et al., Cochrane 2020; Galfano A et al. 2013). Offered when " +
    "anterior / apical ECE risk is low and planes are not obliterated.",
);

export const BNP_DECISION = ev(
  { maxMedianLobe: 2, maxBnEce: 0.1, maxVolumeCc: 120 },
  "literature",
  "Bladder-neck preservation candidacy",
  "Bladder-neck preservation / anatomic vesico-urethral reconstruction improves " +
    "time to continence (Tewari AK et al., anatomic restoration, Urology 2007; " +
    "Ma X et al., meta-analysis 2016; Nyarangi-Dix JN et al., RCT 2013). Not " +
    "feasible with a large median lobe, high bladder-neck ECE, or a very large " +
    "gland.",
);

export const SV_PRESERVATION = ev(
  { maxSideSvi: 0.1 },
  "literature",
  "Seminal-vesicle tip-sparing candidacy",
  "SV tip-sparing is reasonable only when side SVI risk is low; a PSMA-avid SV " +
    "or SVI probability above ~10% argues for complete excision (John H & Hauri " +
    "D, Urology 2000; Zlotta AR et al.).",
);

export const HYDRODISSECTION_THRESHOLD = ev(
  { minEce: 0.15 },
  "literature",
  "Hydrodissection of the NVB",
  "A blunt / fluid peri-NVB plane lets the bundle be swept off an at-risk " +
    "capsule while it is still being spared (competing goals of preservation vs. " +
    "cancer control: Tewari A et al., BJU Int 2008; Kowalczyk KJ et al., " +
    "stepwise nerve sparing without countertraction, Eur Urol 2011). Not " +
    "applicable once frank EPE or a planned wide excision removes the bundle.",
);

/* ================================================================== */
/* Functional-outcome model provenance                                 */
/* ================================================================== */

export const FUNCTIONAL_OUTCOMES_MODEL = ev(
  { note: "NS-grade base rates + modifiable-factor deltas + recovery trajectory" },
  "provisional",
  "Functional-outcome nomogram",
  "COMPASS RARP functional-outcome working nomogram (Mount Sinai; ported from " +
    "COMPASS_final.html) — potency / continence base rates by NS-grade " +
    "combination. Recovery-trajectory shape after Srivastava & Tewari " +
    "(risk-stratified nerve sparing → return of continence, Eur Urol 2013) and " +
    "Tewari et al. athermal-technique outcome series (World J Urol 2013). Not " +
    "yet a formally published fitted model.",
);

/** pp deltas added to the potency / continence timelines. */
export const PLAN_DELTAS = ev(
  {
    hood_bilateral: { contEarly: 12, cont: 4, pot: 2 },
    hood_unilateral: { contEarly: 6, cont: 2, pot: 1 },
    bladder_neck_preservation: { contEarly: 6, cont: 3, pot: 0 },
    hydrodissection: { pot: 4, cont: 0, contEarly: 0 },
    sv_non_preservation: { pot: -3, cont: 0, contEarly: 0 },
    inflammation_moderate: { pot: -4, cont: -2, contEarly: -3 },
    inflammation_high: { pot: -10, cont: -5, contEarly: -8 },
  },
  "literature",
  "Operative-choice effect on functional recovery",
  "Anterior / bladder-neck preservation → early continence (Tewari AK et al., " +
    "anatomic restoration, Urology 2007; Ma X et al. 2016; Rosenberg JE et al., " +
    "Cochrane 2020). Nerve-sparing grade → potency (Srivastava & Tewari, Eur " +
    "Urol 2013). Inflammation penalties are expert priors.",
);

export const HEALER_THRESHOLD = ev(
  50,
  "provisional",
  "Healer-tier potency threshold",
  "Modeled potency probability (PDE5-assisted) ≥ 50% is treated as functional " +
    "recovery; timeline buckets full-recovery-by-6-wk super / ≤12 mo healer / " +
    "18 mo delayed, consistent with the Tewari-group nerve-sparing recovery-" +
    "trajectory analyses. Threshold to be calibrated against serial SHIM / EHS " +
    "follow-up.",
);

export const FULL_RECOVERY_THRESHOLD = ev(
  55,
  "provisional",
  "Super-healer full-recovery threshold",
  "\"Super healer\" is reserved for full erectile-function recovery by 6 weeks " +
    "post-op: modeled potency probability (PDE5-assisted) ≥ 55% at the 6-week " +
    "point — above the 50% functional-recovery bar, so the patient is already " +
    "past functional recovery this early rather than just crossing it. Reachable " +
    "only by the best nerve-sparing / youngest / highest-baseline cases given " +
    "the model's early-recovery ceiling. To be calibrated against serial SHIM / EHS.",
);

/* ================================================================== */
/* BCR projection                                                      */
/* ================================================================== */

export const NSG_OUTCOME_DATA = ev(
  { note: "NS grade → PSM → BCR rates" },
  "institutional",
  "NS-grade positive-margin & BCR rates",
  "Mount Sinai 5,003-side radical-prostatectomy database (Tewari group, Icahn " +
    "School of Medicine at Mount Sinai) — positive-margin rate and biochemical-" +
    "recurrence rate (margin-negative vs margin-positive) by nerve-sparing grade " +
    "and by zone.",
);

export const BCR_HAZARD = ev(
  { y1Fraction: 0.35, y23Fraction: 0.7 },
  "literature",
  "BCR event-timing fractions",
  "Fraction of eventual BCR events realised by 1 yr and by 2–3 yr, from " +
    "post-prostatectomy recurrence-timing series (Han M et al., J Urol 2003; " +
    "Freedland SJ et al., JAMA 2005).",
);

export const PSM_PLAN_MODULATION = ev(
  {
    hydrodissection: -0.03,
    inflammation_moderate: 0.02,
    inflammation_high: 0.05,
    positive_margin_bcr_floor: 0.02,
  },
  "provisional",
  "Plan effect on positive-margin rate",
  "Directional expert-prior adjustments to the NS-grade PSM rate for a " +
    "protective hydrodissection plane vs. an obliterated inflammatory plane; " +
    "consistent with Sooriakumaran P, … Tewari AK, multi-institutional PSM " +
    "analysis (Eur Urol 2014).",
);

export const MODIFIABLE_BCR = ev(
  { bmi_ge_30: 0.03, bmi_ge_35: 0.06 },
  "literature",
  "Obesity → BCR risk",
  "Obesity is weakly associated with higher BCR after RP (Cao Y & Ma J, " +
    "systematic review / meta-analysis, Cancer Prev Res 2011). Low-confidence; " +
    "shown as a caveated estimate only.",
);

/* ================================================================== */
/* Biological age — modifiable-factor burden expressed in years        */
/* ================================================================== */

/*
 * A counselling device, not a measurement: chronological age stays the
 * parameter every prediction model reads, and these year-equivalents only
 * restate the modifiable-factor burden in units a patient can act on. Each
 * weight carries its own source so a reviewer can argue with one number
 * without having to reject the whole table.
 *
 * If this ever needs to be a measurement rather than a talking point, replace
 * the table with a published index computed from preoperative bloods (Levine
 * phenotypic age, or the Klemera-Doubal method) — expert priors will not carry
 * that weight.
 */

export const BIOLOGICAL_AGE_FRAMING = ev(
  { clamp: { min: -10, max: 20 } },
  "literature",
  "Biological age — framing and clamp",
  "Framing follows the urologic-oncology frailty-age literature: frailty-based " +
    "biological age vs. expected life age in urological cancers (Cancers 2022, " +
    "PMC9776733), the 5-item frailty index for morbidity after radical " +
    "prostatectomy (Shahait et al., J Endourol 2021), and G8 frailty scoring in " +
    "robotic RP cohorts. Comorbidity-based life expectancy in prostate cancer " +
    "specifically: Daskivich et al. The offset is clamped to −10/+20 years as an " +
    "expert-prior guard against a pile-up of factors implying an implausible age.",
);

export const BIOLOGICAL_AGE_BMI = ev(
  { underweight: 1, normal: 0, overweight: 1.5, obese: 4 },
  "literature",
  "Biological age — BMI years",
  "Prospective Studies Collaboration (Lancet 2009) and the Global BMI Mortality " +
    "Collaboration (Lancet 2016): BMI 30–35 is associated with roughly 2–4 years " +
    "of life expectancy lost vs. 22.5–25, with a smaller penalty in the " +
    "overweight band and a modest underweight penalty.",
);

export const BIOLOGICAL_AGE_SMOKING = ev(
  { never: 0, former: 2, current: 6 },
  "literature",
  "Biological age — smoking years",
  "Doll et al. (British Doctors Study, BMJ 2004) and Jha et al. (NEJM 2013): " +
    "continuing smokers lose about 10 years of life expectancy, and cessation " +
    "recovers most of it. Held at +6 rather than +10 because the potency and " +
    "continence models already charge smoking directly — this figure is the " +
    "counselling equivalent, not the epidemiological total. Disease-specific " +
    "reinforcement: in a metastatic prostate cancer cohort, current smoking was " +
    "independently associated with worse overall survival (HR 1.27, 95% CI " +
    "1.01-1.59) with a dose-response by pack-years (HR 1.006/pack-yr, 95% CI " +
    "1.002-1.011) — Choi C, Labriola M, et al., Prostate Cancer Prostatic Dis " +
    "2026 (PROMISE registry, N=2353). That cohort is metastatic, not this app's " +
    "localized pre-prostatectomy population, so it reinforces direction rather " +
    "than resetting the magnitude above.",
);

/** postdiagnosis dietary fat pattern — general-mortality counseling only; the source study found no association with prostate-cancer-specific mortality. */
export const BIOLOGICAL_AGE_DIET = ev(
  { favorable: -1, average: 0, high_saturated_fat: 1.5 },
  "literature",
  "Biological age — diet years",
  "Zhang Y, Shanahan MR, Guard HE, et al.; Mucci LA (senior/corresponding). " +
    "Dietary Fat Intake and Mortality Among Patients With Nonmetastatic " +
    "Prostate Cancer. JAMA Netw Open. 2026;9(9):e2630693 (Health Professionals " +
    "Follow-Up Study, N=4884, median 12.8-yr follow-up). Highest vs. lowest " +
    "quintile of postdiagnosis saturated-fat intake: all-cause mortality HR " +
    "1.24 (95% CI 1.05-1.47), cardiovascular HR 1.42 (1.02-1.98). Replacing 10% " +
    "of calories from animal fat with plant-based fat (HR 0.84, 0.76-0.93) or " +
    "5% of calories from saturated fat with monounsaturated fat (HR 0.80, " +
    "0.70-0.91) was associated with lower all-cause mortality. No association " +
    "with prostate-cancer-specific mortality, so this term stays out of the BCR " +
    "model. Function-specific reinforcement, mirroring how smoking is handled " +
    "above: in the same HPFS cohort, higher diet quality was associated with " +
    "lower incident erectile dysfunction (Bauer SR et al., JAMA Netw Open " +
    "2020;3(11):e2021701) — that is the evidence behind the separate " +
    "DIET_FUNCTIONAL_DELTA potency term, and as with smoking the year-" +
    "equivalent here is the counselling figure, not the same quantity again.",
);

/**
 * pp added to the potency timeline by dietary pattern. Continence is left at 0
 * — no diet-quality → post-prostatectomy continence evidence exists.
 */
export const DIET_FUNCTIONAL_DELTA = ev(
  { favorable: 3, average: 0, high_saturated_fat: -3 },
  "provisional",
  "Diet → erectile-function recovery",
  "Bauer SR, Breyer BN, Stampfer MJ, et al. Association of Diet With Erectile " +
    "Dysfunction Among Men in the Health Professionals Follow-Up Study. JAMA " +
    "Netw Open. 2020;3(11):e2021701 (N=21,469, 1998-2014). Highest vs. lowest " +
    "diet quality and incident erectile dysfunction: Mediterranean score HR " +
    "0.78 (95% CI 0.66-0.92) under age 60, 0.82 (0.76-0.89) at 60-69; " +
    "AHEI-2010 quintile 5 vs. 1 HR 0.78 (0.63-0.97) and 0.78 (0.69-0.87) " +
    "across the same bands. The protective components are the ones worth " +
    "counselling: vegetables, fruit and nuts, legumes, fish, and a higher " +
    "polyunsaturated-to-saturated fat ratio, against red and processed meat at " +
    "the top intake quintile (HR 1.17, 1.09-1.25). Consistent in direction " +
    "with the fat-substitution findings in the prostate-cancer cohort above " +
    "(Zhang et al. 2026). Provisional because that cohort measured INCIDENT " +
    "erectile dysfunction in the general male population, not recovery after " +
    "radical prostatectomy: the +/-3 pp spread is a conservative translation " +
    "of a ~20% relative-risk reduction onto this model's 12-month potency " +
    "rates, deliberately smaller than the smoking (-8 pp) and diabetes (-8 pp) " +
    "terms it sits beside. No post-prostatectomy dietary trial with usable " +
    "effect sizes exists to calibrate against.",
);

export const BIOLOGICAL_AGE_EXERCISE = ev(
  { sedentary: 3, light: 1, moderate: 0, active: -3 },
  "literature",
  "Biological age — physical activity years",
  "Moore et al. (PLoS Med 2012): leisure-time physical activity at or above " +
    "guideline levels is associated with roughly 3.4–4.5 years of additional " +
    "life expectancy vs. none, scaled here across the four activity bands.",
);

export const BIOLOGICAL_AGE_ALCOHOL = ev(
  { none: -0.5, moderate: 0, heavy: 3 },
  "literature",
  "Biological age — alcohol years",
  "Wood et al. (Lancet 2018, 83-cohort pooled analysis): drinking above roughly " +
    "100 g/week shortens life expectancy in a dose-dependent way, with several " +
    "years lost at the heaviest levels and little difference across the " +
    "low-to-moderate range.",
);

export const BIOLOGICAL_AGE_COMORBID = ev(
  { dm: 4, htn: 2, cad: 5 },
  "literature",
  "Biological age — comorbidity years",
  "Emerging Risk Factors Collaboration (NEJM 2011): diabetes at age 50 is " +
    "associated with about 6 years of life expectancy lost, and prior myocardial " +
    "infarction more. Held below those totals here because comorbidities " +
    "co-occur and the table sums them; hypertension is the mildest of the three.",
);

/* ================================================================== */
/* Modifiable-factor deltas — per-factor grounding                     */
/*                                                                     */
/* The pp values themselves live in `MF` in functionalOutcomes.ts and  */
/* came with the ported nomogram. The entries below say what published */
/* evidence stands behind each one — and, where the literature does    */
/* NOT support the coded magnitude, say that instead of implying it    */
/* does. Nothing here changes a coefficient.                           */
/* ================================================================== */

export const MF_AGE_SHIM = ev(
  { note: "age and SHIM multipliers on the potency timeline" },
  "literature",
  "Modifiable factor — age & baseline erectile function",
  "Briganti A, Gallina A, Suardi N, et al. Predicting erectile function " +
    "recovery after bilateral nerve-sparing radical prostatectomy: a proposal " +
    "of a novel preoperative risk stratification. J Sex Med. 2010;7(7):2521-31 " +
    "(N=435). Age, preoperative IIEF and the Charlson comorbidity index " +
    "stratify erectile-function recovery, which is the structure this model's " +
    "age and SHIM multipliers reproduce. Recovery rates fall steeply across " +
    "age bands and with lower baseline function, matching the direction of the " +
    "×1.10 (age ≤50) to ×0.85 (age 65-70) and SHIM 12-16 ×0.85-0.92 factors.",
);

export const MF_BMI_FUNCTION = ev(
  { pot: -8, cont: -5, threshold: 30 },
  "literature",
  "Modifiable factor — obesity",
  "Wei Y, Wu YP, Lin MY, et al. Impact of obesity on long-term urinary " +
    "incontinence after radical prostatectomy: a meta-analysis. Biomed Res " +
    "Int. 2018;2018:8279523 — obesity raised incontinence risk at 12 months " +
    "after robot-assisted RP (OR 2.43, 95% CI 1.21-4.88) and at 24 months (OR " +
    "2.00, 1.57-2.56). High-volume RARP series report 12-month continence 88% " +
    "in normal-weight vs. 85% in obese men, and 36-month erectile function 56% " +
    "vs. 49% — roughly 3 pp and 7 pp, close to the -5 pp continence and -8 pp " +
    "potency charged here.",
);

export const MF_PFMT = ev(
  { pot: 6, cont: 10, level: "intensive" },
  "provisional",
  "Modifiable factor — pelvic floor muscle training",
  "Geng E, Yin S, Yang Y, et al. The effect of perioperative pelvic floor " +
    "muscle exercise on urinary incontinence after radical prostatectomy: a " +
    "meta-analysis. Int Braz J Urol. 2023;49(4):441-451 (15 RCTs, N=2,178): " +
    "incontinence odds ratios 0.26 (95% CI 0.15-0.46) at 1 month, 0.30 " +
    "(0.11-0.80) at 3 months, 0.20 (0.07-0.56) at 6 months, and 0.85 " +
    "(0.48-1.51, P=0.58) at 12 months. Yu K, Bu F, Jian T, et al. (Front " +
    "Oncol. 2024;13:1307434, network meta-analysis, 42 RCTs, N=4,256) found " +
    "modalities separating at 6 months but not at 12. Trial-level absolute " +
    "differences: Filocamo MT, Li Marzi V, Del Popolo G, et al. (Eur Urol. " +
    "2005;48(5):734-8) 96% vs 65% continent at 6 months and 89% vs 67% " +
    "pad-free at 12 months; Manassero F, Traversi C, Ales V, et al. (Neurourol " +
    "Urodyn. 2007;26(7):985-9) 60% vs 40% continent at 6 months. Certainty is " +
    "low throughout: Johnson EE, Mamoulakis C, Stoniute A, Omar MI, Sinha S. " +
    "Conservative interventions for managing urinary incontinence after " +
    "prostate surgery. Cochrane Database Syst Rev. 2023;(4):CD014799.",
);

export const MF_EXERCISE_FUNCTION = ev(
  { pot: 4, cont: 3, level: "active" },
  "literature",
  "Modifiable factor — physical activity",
  "Gerbild H, Larsen CM, Graugaard C, Areskoug Josefsson K. Physical activity " +
    "to improve erectile function: a systematic review of intervention " +
    "studies. Sex Med. 2018;6(2):75-89. Roughly 160 minutes per week of " +
    "moderate aerobic activity over 6 months improved patient-reported " +
    "erectile function (IIEF / IIEF-5) in men whose ED was driven by physical " +
    "inactivity, obesity, hypertension, metabolic syndrome or cardiovascular " +
    "disease. Trials were in general-ED populations, not post-prostatectomy " +
    "recovery, so this supports the direction and rough size of the +4 pp " +
    "rather than calibrating it.",
);

export const MF_PDE5_REHAB = ev(
  { pot: 8, regimen: "daily" },
  "literature",
  "Modifiable factor — PDE5 inhibitor regimen",
  "Montorsi F, Brock G, Stolzenburg JU, et al. Effects of tadalafil treatment " +
    "on erectile function recovery following bilateral nerve-sparing radical " +
    "prostatectomy: a randomised placebo-controlled study (REACTT). Eur Urol. " +
    "2014;65(3):587-96. Tadalafil 5 mg once daily beat placebo on drug-" +
    "assisted erectile function (IIEF-EF P=0.016; SEP-3 P=0.019) and reduced " +
    "penile length loss (LS mean difference 4.1 mm, 95% CI 0.4-7.8, P=0.032), " +
    "while on-demand dosing did not — which is why daily is scored above PRN " +
    "here. Unassisted erectile function was not improved after withdrawal, " +
    "which matches how this model defines its endpoint: potency here is " +
    "PDE5-ASSISTED function (models/surgicalPlanning.json, healer_threshold), " +
    "so a drug-assisted effect is the right quantity to add.",
);

export const MF_SMOKING_FUNCTION = ev(
  { pot: -8, cont: -2, level: "current" },
  "literature",
  "Modifiable factor — smoking (functional recovery)",
  "Three independent post-prostatectomy sources agree on the potency penalty " +
    "and disagree with the continence one. (1) Visscher J, Bonevski B, " +
    "O'Callaghan M. BJU Int. 2025;136(4):647-656 (N=2,676): ever-smokers " +
    "scored 11 points lower on the EPIC-26 sexual domain across 24 months " +
    "(95% CI -15.0 to -7.0) — on a 0-100 scale that brackets the -8 pp used " +
    "here — while urinary incontinence scores were similar. (2) Visscher et " +
    "al., Prostate Cancer Prostatic Dis. 2024 (systematic review, 9 studies): " +
    "erectile function OR 0.73 (95% CI 0.56-0.95); urinary incontinence OR " +
    "1.20 (0.75-1.91), not significant; cessation improved the EPIC-26 sexual " +
    "domain by 6.6 points on average (P=0.03), up to 12.5 points at 18-24 " +
    "months — which is what the never/former/current ladder encodes. " +
    "(3) Zhang C et al., Urology 2025;207:155-161 (PIE, N=286): worse sexual " +
    "recovery at 5 weeks (P=0.022), 6 months (P=0.004) and 12 months " +
    "(P=0.002), with no urinary difference. The -8 pp potency term is well " +
    "supported; the -2 pp continence term is contradicted by all three.",
);

export const MF_ALCOHOL_FUNCTION = ev(
  { pot: -10, cont: -2, level: "heavy", meaning: "dependence-level intake" },
  "literature",
  "Modifiable factor — alcohol",
  "The -10 pp applies to dependence-level drinking, not to the 'more than " +
    "21 drinks per week' band used in population epidemiology — the two are " +
    "different exposures and only the first is charged here. In men with " +
    "alcohol dependence, Arackal BS, Benegal V (Indian J Psychiatry " +
    "2007;49(2):109-112, N=100) found 72% with at least one sexual " +
    "dysfunction and 33.3% with erectile dysfunction, with a significant " +
    "dose-response (F=10.54, P=0.002) in which the amount consumed was the " +
    "strongest predictor. The mechanisms bear directly on nerve-sparing " +
    "recovery: alcoholic peripheral neuropathy damages the same nerves the " +
    "NS grade is protecting, gonadotropin suppression drives hypogonadism, " +
    "and chronic intake reduces nitric-oxide-mediated vasodilation and " +
    "damages vessels. For comparison, at lower intake there is no measurable " +
    "penalty — Wang X et al. (Int J Impot Res 2018, 24 studies, N=154,295) " +
    "report OR 0.99 (95% CI 0.80-1.22) above 21 drinks/week and OR 0.71 " +
    "(0.59-0.86) for light-to-moderate intake, and Zhang C et al. (Urology " +
    "2025;207:155-161, PIE) found no association between drinking FREQUENCY " +
    "and 12-month function after prostatectomy. Those cohorts measured " +
    "frequency and volume bands, never dependence, which is why they do not " +
    "constrain this term. The -2 pp continence penalty rests on a different " +
    "mechanism again: alcohol suppresses vasopressin, so it acts as a " +
    "diuretic, and the concentrated urine that follows irritates the bladder " +
    "— higher voided volumes and urgency mean more leak episodes and more " +
    "pads for the same sphincteric competence. Bradley CS, Erickson BA, " +
    "Messersmith EE, et al. (J Urol 2017;198:1010-20, LURN systematic " +
    "review, 110 articles of which 26 on alcohol) found associations between " +
    "alcohol and lower urinary tract symptoms but graded the evidence low " +
    "(59% level 4), and the signal is weaker than for caffeine. Note this is " +
    "a symptom-burden effect, not a recovery effect: the post-prostatectomy " +
    "cohorts above scored pad-free status at 12 months, which is sphincteric " +
    "recovery, and would not detect fluid-load-driven leakage in a man whose " +
    "sphincter has recovered. That is why their null does not refute this " +
    "term — the two are measuring different things.",
);

export const MF_COMORBID_FUNCTION = ev(
  { dm: { pot: -8, cont: -3 }, htn: { pot: -3, cont: -1 }, cad: { pot: -5, cont: -1 } },
  "literature",
  "Modifiable factor — comorbidities (functional recovery)",
  "Rabbani F, Schiff J, Piecuch M, et al. Factors predicting preservation of " +
    "erectile function in men undergoing open radical retropubic " +
    "prostatectomy. J Urol. 2009;181(4):1817-22 (N=1,110, single surgeon): on " +
    "multivariable analysis age, absence of diabetes, and neurovascular-bundle " +
    "preservation were the independent predictors of preserved erectile " +
    "function — which is why diabetes carries the largest comorbidity penalty " +
    "here. Comorbidity burden also enters the Briganti risk stratification " +
    "(J Sex Med 2010) through the Charlson index. The split across diabetes, " +
    "hypertension and coronary disease is an expert ordering, not a fitted " +
    "decomposition.",
);

export const MF_IPSS_CONTINENCE = ev(
  { thresholds: [7, 14, 19], cont: [0, -3, -6, -10] },
  "literature",
  "Modifiable factor — baseline voiding symptoms (IPSS)",
  "Kimura N, Yamada Y, Hakozaki Y, et al. Long-term transition of urinary " +
    "status after robot-assisted radical prostatectomy. J Robot Surg. " +
    "2026;20:198 (N=243, median follow-up 65.5 months). A preoperative IPSS " +
    "storage subscore above 7 was independently associated with lower odds of " +
    "reaching pad-free status (HR 0.50, 95% CI 0.32-0.78) and of reaching " +
    "1 pad/day (HR 0.60, 0.41-0.87) — the only factor significant for both. " +
    "This supports charging baseline voiding symptoms against continence and " +
    "supports the first cut at IPSS 7; the -3/-6/-10 pp ladder above that is " +
    "the nomogram's own banding.",
);

/** What the alcohol and activity bands on the Factors tab actually mean. */
export const INTAKE_ACTIVITY_BANDS = ev(
  {
    alcohol: { moderate: "≤2 drinks/day", heavy: ">4/day or >14/week" },
    exercise: { light: "<150 min/wk", moderate: "150–300 min/wk", active: ">300 min/wk" },
  },
  "literature",
  "Alcohol & activity band definitions",
  "Alcohol: 'moderate' follows the Dietary Guidelines for Americans " +
    "(2020-2025) — up to 2 drinks per day for men; 'heavy' follows the NIAAA " +
    "definition of heavy alcohol use — more than 4 drinks on any day or more " +
    "than 14 per week, the threshold above which risk of alcohol use disorder " +
    "rises sharply. Physical activity: bands follow the WHO 2020 guidelines on " +
    "physical activity and sedentary behaviour (Bull FC, Al-Ansari SS, Biddle " +
    "S, et al. Br J Sports Med. 2020;54(24):1451-1462), which recommend " +
    "150-300 minutes of moderate-intensity or 75-150 minutes of " +
    "vigorous-intensity aerobic activity per week plus muscle strengthening on " +
    "2 or more days. 'Moderate' here means meeting that recommendation and " +
    "'active' means exceeding it — note the 160 min/week that Gerbild et al. " +
    "found sufficient to improve erectile function sits just inside the " +
    "'moderate' band, so the erectile benefit starts at the guideline, not " +
    "above it.",
);
