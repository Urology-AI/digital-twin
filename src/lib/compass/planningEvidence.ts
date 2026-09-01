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
