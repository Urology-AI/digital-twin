/**
 * Curated, read-only demo cases for showing COMPASS live.
 *
 * These are NOT clinical data — they are teaching scenarios with plausible
 * numbers, tuned so each one lands a clear talking point (see `blurb`).
 *
 * The first ten are hand-built teaching scenarios. The `cohort-*` cases that
 * follow take their tumour profile (PSA, volume, grade, core involvement,
 * PI-RADS, PSMA/SUV, laterality) from de-identified rows of the COMPASS RARP
 * working cohort, so the numbers a presenter shows are the shape of real
 * disease rather than invented. Age, BMI, SHIM, IPSS and lifestyle are not in
 * that export and are filled in as plausible defaults. No identifiers, dates or
 * free text are carried over, and nothing here is a patient record. They
 * live in code, never in `patients.json` or the saved library, so a presenter
 * can edit a loaded copy freely and reload to get the pristine version back
 * (`usePatientStore.loadDemoCase` replaces any existing copy).
 */
import type { Prostate3DInputV1 } from "@/types/patient";
import type { LesionRow } from "@/types/lesion";
import { emptyLesion } from "@/types/lesion";

export interface DemoCase {
  /** stable slug — also the number-key order in the picker */
  id: string;
  name: string;
  /** one line shown under the name in the picker */
  blurb: string;
  record: Prostate3DInputV1;
  lesionRows: LesionRow[];
}

/** Blank v1 record with sensible defaults; pass overrides for each section. */
function mkRecord(over: {
  patient?: Partial<Prostate3DInputV1["patient"]>;
  prostate?: Partial<Prostate3DInputV1["prostate"]>;
  biopsy?: Partial<Prostate3DInputV1["biopsy"]>;
  staging?: Partial<Prostate3DInputV1["staging"]>;
}): Prostate3DInputV1 {
  return {
    _schema: "prostate-3d-input-v1",
    patient: {
      age: null, psa: null, psa_density: null, bmi: null, shim: null, ipss: null,
      dm: false, htn: false, cad: false, statin: false,
      smoking: "never", exercise: "moderate", pfmt: "none", alcohol: "none",
      pde5: false,
      ...over.patient,
    },
    prostate: { volume_cc: null, dimensions_cm: null, median_lobe_grade: 0, ...over.prostate },
    biopsy: {
      max_grade_group: 0, total_positive_cores: 0, total_cores: 12,
      max_core_involvement_pct: 0, max_linear_extent_mm: 0, max_pct_pattern45: 0,
      has_cribriform: 0, has_idc: 0, has_pni: 0, laterality: "bilateral",
      gg_left: null, gg_right: null, cores_left: null, cores_right: null,
      mc_left: null, mc_right: null, linear_left: null, linear_right: null,
      decipher_score: null,
      ...over.biopsy,
    },
    staging: {
      epe: false, svi: false, max_pirads: 1, max_suv: null, lesion_size_cm: null,
      abutment: null, adc_mean: null, epe_mus: false, svi_mus: false,
      psma_epe: false, psma_svi: false, max_primus: null, lymph_nodes_psma: null,
      ...over.staging,
    },
    zones: {},
    lesions: [],
  };
}

/** MRI lesion row for a zone. */
function mri(o: Partial<LesionRow> & { side: "L" | "R"; level: LesionRow["level"]; zone: string; pirads: number; primus?: number }): LesionRow {
  return {
    ...emptyLesion(`${o.side}-${o.level}-mri`),
    source: "MRI", side: o.side, level: o.level, zone: o.zone,
    score: String(o.pirads), pirads: o.pirads, primus: o.primus,
    mriSize: o.mriSize ?? 0, epe: o.epe ?? false, svi: o.svi ?? false,
  };
}

/** Biopsy lesion row for a zone. */
function bx(o: Partial<LesionRow> & { side: "L" | "R"; level: LesionRow["level"]; zone: string; gg: number }): LesionRow {
  return {
    ...emptyLesion(`${o.side}-${o.level}-bx`),
    source: "Bx", side: o.side, level: o.level, zone: o.zone,
    score: String(o.gg),
    corePct: o.corePct ?? 0, linear: o.linear ?? 0,
    cribriform: o.cribriform ?? false, idc: o.idc ?? false, pni: o.pni ?? false,
  };
}

export const DEMO_CASES: DemoCase[] = [
  {
    id: "low-risk",
    name: "Low-volume GG1, bilateral",
    blurb: "GG1 both lobes · PSAD 0.15 · PI-RADS 2 — low risk across the board, NS unconstrained",
    record: mkRecord({
      patient: { age: 60, psa: 4.48, psa_density: 0.149, bmi: 26, shim: 21, ipss: 6 },
      prostate: { volume_cc: 30 },
      biopsy: {
        max_grade_group: 1, total_positive_cores: 4, max_core_involvement_pct: 40,
        max_linear_extent_mm: 6, laterality: "bilateral",
        gg_left: 1, gg_right: 1, cores_left: 2, cores_right: 2,
      },
      staging: { max_pirads: 2 },
    }),
    lesionRows: [
      mri({ side: "L", level: "Mid", zone: "Posterior", pirads: 2 }),
      bx({ side: "L", level: "Mid", zone: "Posterior", gg: 1, corePct: 40, linear: 6 }),
      bx({ side: "R", level: "Mid", zone: "Posterior", gg: 1, corePct: 20 }),
    ],
  },
  {
    id: "int-unilat",
    name: "Intermediate GG2, unilateral",
    blurb: "GG2 left · PI-RADS 4 · SUV 8 — the nerve-sparing trade-off, one side only",
    record: mkRecord({
      patient: { age: 62, psa: 5.32, psa_density: 0.102, bmi: 27, shim: 18, ipss: 8 },
      prostate: { volume_cc: 52 },
      biopsy: {
        max_grade_group: 2, total_positive_cores: 2, max_core_involvement_pct: 50,
        max_pct_pattern45: 10, laterality: "left",
        gg_left: 2, gg_right: 0, cores_left: 2, cores_right: 0,
      },
      staging: { max_pirads: 4, max_suv: 8 },
    }),
    lesionRows: [
      mri({ side: "L", level: "Mid", zone: "Posterolateral", pirads: 4 }),
      bx({ side: "L", level: "Mid", zone: "Posterolateral", gg: 2, corePct: 50 }),
    ],
  },
  {
    id: "high-ece",
    name: "High-risk GG4, PSMA-heavy",
    blurb: "GG4 both lobes · SUV 11 · 8 PSMA foci — high bilateral ECE, wide excision",
    record: mkRecord({
      patient: { age: 66, psa: 7.7, psa_density: 0.167, bmi: 28, shim: 16, ipss: 12, htn: true },
      prostate: { volume_cc: 46 },
      biopsy: {
        max_grade_group: 4, total_positive_cores: 6, max_core_involvement_pct: 59,
        max_pct_pattern45: 60, has_cribriform: 1, has_pni: 1, laterality: "bilateral",
        gg_left: 4, gg_right: 4, cores_left: 3, cores_right: 3,
      },
      staging: { max_pirads: 4, lesion_size_cm: 0.8, max_suv: 11.1 },
    }),
    lesionRows: [
      mri({ side: "L", level: "Base", zone: "Posterolateral", pirads: 4, mriSize: 8 }),
      bx({ side: "L", level: "Base", zone: "Posterolateral", gg: 4, corePct: 59, cribriform: true }),
      bx({ side: "R", level: "Mid", zone: "Posterolateral", gg: 4, corePct: 45, pni: true }),
    ],
  },
  {
    id: "super-healer",
    name: "Young super-healer NS candidate",
    blurb: "Age 48 · SHIM 24 · GG2, minimal core involvement — lands the Super-healer tier",
    record: mkRecord({
      patient: {
        age: 48, psa: 2.8, psa_density: 0.112, bmi: 24, shim: 24, ipss: 3,
        smoking: "never", exercise: "active", pfmt: "intensive",
        alcohol: "none", pde5_plan: "daily",
      },
      prostate: { volume_cc: 25 },
      biopsy: {
        max_grade_group: 2, total_positive_cores: 5, max_core_involvement_pct: 10,
        laterality: "bilateral", gg_left: 2, gg_right: 2, cores_left: 3, cores_right: 2,
      },
      staging: { max_pirads: 4, max_suv: 7.9 },
    }),
    lesionRows: [
      mri({ side: "L", level: "Mid", zone: "Posterior", pirads: 4 }),
      bx({ side: "L", level: "Mid", zone: "Posterior", gg: 2, corePct: 10 }),
      bx({ side: "R", level: "Mid", zone: "Posterior", gg: 2, corePct: 10 }),
    ],
  },
  {
    id: "ns-right-upgrade",
    name: "Right-sided GG2, small gland",
    blurb: "GG2 right · 23 cc · PI-RADS 4 at 0.7 cm — NS 1 left / 2 right, the asymmetry case",
    record: mkRecord({
      patient: { age: 59, psa: 3.4, psa_density: 0.148, bmi: 27, shim: 20, ipss: 7 },
      prostate: { volume_cc: 23 },
      biopsy: {
        max_grade_group: 2, total_positive_cores: 3, max_core_involvement_pct: 45,
        max_pct_pattern45: 15, has_pni: 1, laterality: "right",
        gg_left: 0, gg_right: 2, cores_left: 0, cores_right: 3,
      },
      staging: { max_pirads: 4, lesion_size_cm: 0.7, max_suv: 5.5 },
    }),
    lesionRows: [
      mri({ side: "R", level: "Mid", zone: "Posterior", pirads: 4, mriSize: 7 }),
      bx({ side: "R", level: "Mid", zone: "Posterior", gg: 2, corePct: 45, pni: true }),
    ],
  },
  {
    id: "anterior-occult",
    name: "Anterior GG1 under a PI-RADS 5",
    blurb: "Bx GG1 · PI-RADS 5 · 56 cc — low ECE but the highest upgrade risk on the board",
    record: mkRecord({
      patient: { age: 64, psa: 3.71, psa_density: 0.066, bmi: 28, shim: 17, ipss: 10 },
      prostate: { volume_cc: 56 },
      biopsy: {
        max_grade_group: 1, total_positive_cores: 2, max_core_involvement_pct: 60,
        laterality: "left", gg_left: 1, gg_right: 0, cores_left: 2, cores_right: 0,
      },
      staging: { max_pirads: 5 },
    }),
    lesionRows: [
      mri({ side: "L", level: "Mid", zone: "Anterior", pirads: 5 }),
      bx({ side: "L", level: "Mid", zone: "Anterior", gg: 1, corePct: 60 }),
    ],
  },
  {
    id: "apex-concordant",
    name: "Apical GG2, concordant",
    blurb: "GG2 right apex · PI-RADS 4 at 0.6 cm · PSAD 0.21 — apical margin focus",
    record: mkRecord({
      patient: { age: 61, psa: 7.19, psa_density: 0.205, bmi: 26, shim: 21, ipss: 6 },
      prostate: { volume_cc: 35 },
      biopsy: {
        max_grade_group: 2, total_positive_cores: 4, max_core_involvement_pct: 30,
        max_pct_pattern45: 10, laterality: "bilateral",
        gg_left: 1, gg_right: 2, cores_left: 1, cores_right: 3,
      },
      staging: { max_pirads: 4, lesion_size_cm: 0.6, max_suv: 6 },
    }),
    lesionRows: [
      mri({ side: "R", level: "Apex", zone: "Posterolateral", pirads: 4, mriSize: 6 }),
      bx({ side: "R", level: "Apex", zone: "Posterolateral", gg: 2, corePct: 30 }),
      bx({ side: "L", level: "Mid", zone: "Posterior", gg: 1, corePct: 15 }),
    ],
  },
  {
    id: "low-imaging-upgrade",
    name: "PI-RADS 2 hiding a GG5",
    blurb: "PI-RADS 2 · SUV 4.5 · biopsy GG5 right — imaging says quiet, grade says otherwise",
    record: mkRecord({
      patient: { age: 66, psa: 5.6, psa_density: 0.187, bmi: 29, shim: 15, ipss: 12, htn: true },
      prostate: { volume_cc: 30 },
      biopsy: {
        max_grade_group: 5, total_positive_cores: 6, max_core_involvement_pct: 40,
        max_pct_pattern45: 70, has_cribriform: 1, laterality: "bilateral",
        gg_left: 2, gg_right: 5, cores_left: 2, cores_right: 4,
      },
      staging: { max_pirads: 2, max_suv: 4.5 },
    }),
    lesionRows: [
      bx({ side: "R", level: "Mid", zone: "Posterolateral", gg: 5, corePct: 40, cribriform: true }),
      bx({ side: "L", level: "Mid", zone: "Posterior", gg: 2, corePct: 20 }),
    ],
  },
  {
    id: "pirads5-ece",
    name: "PI-RADS 5, GG3 both lobes",
    blurb: "GG3 bilateral · cores to 70% · PI-RADS 5 — high ECE, NS narrows on both sides",
    record: mkRecord({
      patient: { age: 67, psa: 4.3, psa_density: 0.107, bmi: 28, shim: 16, ipss: 13, htn: true, statin: true },
      prostate: { volume_cc: 40 },
      biopsy: {
        max_grade_group: 3, total_positive_cores: 6, max_core_involvement_pct: 70,
        max_pct_pattern45: 40, has_cribriform: 1, has_pni: 1, laterality: "bilateral",
        gg_left: 3, gg_right: 3, cores_left: 3, cores_right: 3,
      },
      staging: { max_pirads: 5 },
    }),
    lesionRows: [
      mri({ side: "L", level: "Base", zone: "Posterior", pirads: 5 }),
      bx({ side: "L", level: "Base", zone: "Posterior", gg: 3, corePct: 70, cribriform: true, pni: true }),
      bx({ side: "R", level: "Mid", zone: "Posterior", gg: 3, corePct: 50 }),
    ],
  },
  {
    id: "high-grade-focal-ns",
    name: "GG5 with focal nerve-sparing",
    blurb: "PSA 1.5 · GG5 right · 19 cc · PI-RADS 4 at 1.3 cm — contralateral focal NS",
    record: mkRecord({
      patient: {
        age: 60, psa: 1.5, psa_density: 0.079, bmi: 25, shim: 22, ipss: 5,
        smoking: "never", exercise: "active", pfmt: "intensive", pde5_plan: "daily",
      },
      prostate: { volume_cc: 19 },
      biopsy: {
        max_grade_group: 5, total_positive_cores: 6, max_core_involvement_pct: 80,
        max_pct_pattern45: 75, has_pni: 1, laterality: "bilateral",
        gg_left: 1, gg_right: 5, cores_left: 1, cores_right: 5,
      },
      staging: { max_pirads: 4, lesion_size_cm: 1.3 },
    }),
    lesionRows: [
      mri({ side: "R", level: "Mid", zone: "Posterolateral", pirads: 4, mriSize: 13 }),
      bx({ side: "R", level: "Mid", zone: "Posterolateral", gg: 5, corePct: 80, pni: true }),
      bx({ side: "L", level: "Mid", zone: "Posterior", gg: 1, corePct: 15 }),
    ],
  },
  /* ---------------------------------------------------------------- *
   * Cohort-grounded cases — tumour profile from the COMPASS RARP        *
   * working cohort (see file header); demographics are defaults.        *
   * ---------------------------------------------------------------- */
  {
    id: "cohort-large-gland-micro",
    name: "Large gland, single micro-focus",
    blurb: "GG1 · 1 core at 5% · 81 cc gland · PI-RADS 4 — low ECE, upgrade is the real risk",
    record: mkRecord({
      patient: { age: 63, psa: 4.14, psa_density: 0.051, bmi: 29, shim: 19, ipss: 14 },
      prostate: { volume_cc: 81, median_lobe_grade: 1 },
      biopsy: {
        max_grade_group: 1, total_positive_cores: 1, max_core_involvement_pct: 5,
        max_linear_extent_mm: 4.9, laterality: "left",
        gg_left: 1, gg_right: 0, cores_left: 1, cores_right: 0,
      },
      staging: { max_pirads: 4 },
    }),
    lesionRows: [
      mri({ side: "L", level: "Mid", zone: "Posterior", pirads: 4 }),
      bx({ side: "L", level: "Mid", zone: "Posterior", gg: 1, corePct: 5, linear: 4.9 }),
    ],
  },
  {
    id: "cohort-psma-avid-pirads2",
    name: "Negative MRI, PSMA-avid",
    blurb: "PSA 13.5 · PSAD 0.31 · PI-RADS 2 · SUV 27 — negative MRI, high ECE",
    record: mkRecord({
      patient: { age: 64, psa: 13.5, psa_density: 0.307, bmi: 27, shim: 20, ipss: 8 },
      prostate: { volume_cc: 44 },
      biopsy: {
        max_grade_group: 2, total_positive_cores: 5, max_core_involvement_pct: 95,
        max_pct_pattern45: 15, laterality: "bilateral",
        gg_left: 1, gg_right: 2, cores_left: 2, cores_right: 3,
      },
      staging: { max_pirads: 2, max_suv: 27.2 },
    }),
    lesionRows: [
      mri({ side: "R", level: "Mid", zone: "Posterolateral", pirads: 2 }),
      bx({ side: "R", level: "Mid", zone: "Posterolateral", gg: 2, corePct: 95 }),
      bx({ side: "L", level: "Mid", zone: "Posterior", gg: 1, corePct: 20 }),
    ],
  },
  {
    id: "cohort-epe-gg2",
    name: "MRI EPE+ on a GG2",
    blurb: "GG2 · PSAD 0.31 · PI-RADS 5 · EPE+ — high ECE on a grade you'd normally spare",
    record: mkRecord({
      patient: { age: 66, psa: 6.9, psa_density: 0.314, bmi: 28, shim: 18, ipss: 9, htn: true },
      prostate: { volume_cc: 22 },
      biopsy: {
        max_grade_group: 2, total_positive_cores: 6, max_core_involvement_pct: 100,
        max_pct_pattern45: 25, has_pni: 1, laterality: "bilateral",
        gg_left: 2, gg_right: 2, cores_left: 3, cores_right: 3,
      },
      staging: { epe: true, max_pirads: 5, max_suv: 6.7 },
    }),
    lesionRows: [
      mri({ side: "L", level: "Mid", zone: "Posterolateral", pirads: 5, epe: true }),
      bx({ side: "L", level: "Mid", zone: "Posterolateral", gg: 2, corePct: 100, pni: true }),
      bx({ side: "R", level: "Mid", zone: "Posterior", gg: 2, corePct: 60 }),
    ],
  },
  {
    id: "cohort-low-psa-gg4",
    name: "Low PSA, GG4 with EPE",
    blurb: "PSA 1.9 · GG4 · 21 mm linear · EPE+ · SUV 19 — very high ECE, PSA hides it entirely",
    record: mkRecord({
      patient: { age: 61, psa: 1.9, psa_density: 0.039, bmi: 26, shim: 21, ipss: 6 },
      prostate: { volume_cc: 49 },
      biopsy: {
        max_grade_group: 4, total_positive_cores: 7, max_core_involvement_pct: 65,
        max_linear_extent_mm: 21, max_pct_pattern45: 55, has_cribriform: 1, has_pni: 1,
        laterality: "bilateral", gg_left: 3, gg_right: 4, cores_left: 3, cores_right: 4,
      },
      staging: { epe: true, max_pirads: 4, lesion_size_cm: 1.4, abutment: 4, max_suv: 19.4 },
    }),
    lesionRows: [
      mri({ side: "R", level: "Base", zone: "Posterolateral", pirads: 4, mriSize: 14, epe: true }),
      bx({ side: "R", level: "Base", zone: "Posterolateral", gg: 4, corePct: 65, linear: 21, cribriform: true, pni: true }),
      bx({ side: "L", level: "Mid", zone: "Posterior", gg: 3, corePct: 40 }),
    ],
  },
  {
    id: "cohort-psma-node",
    name: "PSMA node-positive, dense gland",
    blurb: "PSAD 0.81 · 13.6 cc · SUV 52 · PSMA node+ — high LNI drives PLND, ECE at the ceiling",
    record: mkRecord({
      patient: { age: 68, psa: 11, psa_density: 0.809, bmi: 28, shim: 16, ipss: 11, htn: true, statin: true },
      prostate: { volume_cc: 13.6 },
      biopsy: {
        max_grade_group: 3, total_positive_cores: 5, max_core_involvement_pct: 70,
        max_pct_pattern45: 45, has_cribriform: 1, laterality: "bilateral",
        gg_left: 3, gg_right: 2, cores_left: 3, cores_right: 2,
      },
      staging: { max_pirads: 5, abutment: 4, max_suv: 52.3, lymph_nodes_psma: 1 },
    }),
    lesionRows: [
      mri({ side: "L", level: "Base", zone: "Posterolateral", pirads: 5 }),
      bx({ side: "L", level: "Base", zone: "Posterolateral", gg: 3, corePct: 70, cribriform: true }),
      bx({ side: "R", level: "Mid", zone: "Posterior", gg: 2, corePct: 30 }),
    ],
  },
  {
    id: "cohort-high-psa-svi",
    name: "PSA 17.7, seminal-vesicle risk",
    blurb: "GG2 right · core 97% · PI-RADS 5 at 1.9 cm — SVI, not ECE, is what changes the plan",
    record: mkRecord({
      patient: { age: 65, psa: 17.7, psa_density: 0.26, bmi: 30, shim: 15, ipss: 12, dm: true, htn: true },
      prostate: { volume_cc: 68 },
      biopsy: {
        max_grade_group: 2, total_positive_cores: 4, max_core_involvement_pct: 97,
        max_linear_extent_mm: 7.1, max_pct_pattern45: 20, has_pni: 1, laterality: "right",
        gg_left: 0, gg_right: 2, cores_left: 0, cores_right: 4,
      },
      staging: { max_pirads: 5, lesion_size_cm: 1.9, max_suv: 3.5 },
    }),
    lesionRows: [
      mri({ side: "R", level: "Base", zone: "Posterior", pirads: 5, mriSize: 19 }),
      bx({ side: "R", level: "Base", zone: "Posterior", gg: 2, corePct: 97, linear: 7.1, pni: true }),
    ],
  },
];

export const DEMO_CASE_IDS = new Set(DEMO_CASES.map((d) => d.id));
