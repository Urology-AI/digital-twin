/**
 * Curated, read-only demo cases for showing COMPASS live.
 *
 * These are NOT clinical data — they are teaching scenarios with plausible
 * numbers, tuned so each one lands a clear talking point (see `blurb`). They
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
    name: "Low-risk / AS candidate",
    blurb: "GG1 · PSA 4.5 · PI-RADS 2 — green across the board",
    record: mkRecord({
      patient: { age: 60, psa: 4.5, bmi: 26, shim: 21, ipss: 6 },
      prostate: { volume_cc: 55 },
      biopsy: {
        max_grade_group: 1, total_positive_cores: 2, max_core_involvement_pct: 15,
        max_linear_extent_mm: 3, laterality: "left", gg_left: 1, gg_right: 0,
      },
      staging: { max_pirads: 2 },
    }),
    lesionRows: [
      mri({ side: "L", level: "Mid", zone: "Posterior", pirads: 2 }),
      bx({ side: "L", level: "Mid", zone: "Posterior", gg: 1, corePct: 15 }),
    ],
  },
  {
    id: "int-unilat",
    name: "Intermediate GG2, unilateral",
    blurb: "GG2 left lobe · focal PI-RADS 4 — the nerve-sparing trade-off",
    record: mkRecord({
      patient: { age: 62, psa: 6.2, bmi: 27, shim: 18, ipss: 8 },
      prostate: { volume_cc: 42 },
      biopsy: {
        max_grade_group: 2, total_positive_cores: 4, max_core_involvement_pct: 40,
        max_linear_extent_mm: 8, max_pct_pattern45: 10, laterality: "left",
        gg_left: 2, gg_right: 0, cores_left: 4, cores_right: 0,
      },
      staging: { max_pirads: 4, lesion_size_cm: 1.3, adc_mean: 850 },
    }),
    lesionRows: [
      mri({ side: "L", level: "Mid", zone: "Posterolateral", pirads: 4, mriSize: 13 }),
      bx({ side: "L", level: "Mid", zone: "Posterolateral", gg: 2, corePct: 40, linear: 8 }),
    ],
  },
  {
    id: "high-ece",
    name: "High-risk GG4 + MRI EPE",
    blurb: "GG4 · PSA 15 · PI-RADS 5 · EPE+ — drives ECE/SVI, wide excision",
    record: mkRecord({
      patient: { age: 66, psa: 15, bmi: 28, shim: 16, ipss: 12, htn: true },
      prostate: { volume_cc: 38 },
      biopsy: {
        max_grade_group: 4, total_positive_cores: 7, max_core_involvement_pct: 70,
        max_linear_extent_mm: 14, max_pct_pattern45: 60, has_cribriform: 1,
        has_pni: 1, laterality: "bilateral", gg_left: 4, gg_right: 3,
        cores_left: 5, cores_right: 2,
      },
      staging: { epe: true, max_pirads: 5, lesion_size_cm: 2.1, adc_mean: 680 },
    }),
    lesionRows: [
      mri({ side: "L", level: "Base", zone: "Posterolateral", pirads: 5, mriSize: 21, epe: true }),
      bx({ side: "L", level: "Base", zone: "Posterolateral", gg: 4, corePct: 70, linear: 14, cribriform: true }),
      bx({ side: "R", level: "Base", zone: "Posterior", gg: 3, corePct: 30 }),
    ],
  },
  {
    id: "super-healer",
    name: "Young super-healer NS candidate",
    blurb: "Age 48 · SHIM 24 · organ-confined GG2 — lands the Super-healer tier",
    record: mkRecord({
      patient: {
        age: 48, psa: 5.5, bmi: 24, shim: 24, ipss: 3,
        smoking: "never", exercise: "active", pfmt: "intensive",
        alcohol: "none", pde5_plan: "daily",
      },
      prostate: { volume_cc: 40 },
      biopsy: {
        max_grade_group: 2, total_positive_cores: 2, max_core_involvement_pct: 12,
        max_linear_extent_mm: 3, laterality: "bilateral", gg_left: 2, gg_right: 2,
        cores_left: 1, cores_right: 1,
      },
      staging: { max_pirads: 2, lesion_size_cm: 0.6 },
    }),
    lesionRows: [
      bx({ side: "L", level: "Mid", zone: "Posterior", gg: 2, corePct: 12 }),
      bx({ side: "R", level: "Mid", zone: "Posterior", gg: 2, corePct: 12 }),
    ],
  },
  {
    id: "ns-right-upgrade",
    name: "Right nerve-sparing, upgraded",
    blurb: "Bx GG2 (3+4) · PI-RADS 4 right mid-PZ → path GG3 (4+3), pT2 — unilateral NS",
    record: mkRecord({
      patient: { age: 59, psa: 6, bmi: 27, shim: 20, ipss: 7 },
      prostate: { volume_cc: 45 },
      biopsy: {
        max_grade_group: 2, total_positive_cores: 3, max_core_involvement_pct: 35,
        max_linear_extent_mm: 6, max_pct_pattern45: 15, has_pni: 1,
        laterality: "right", gg_left: 0, gg_right: 2, cores_left: 0, cores_right: 3,
      },
      staging: { max_pirads: 4, max_primus: 4, lesion_size_cm: 1.2, adc_mean: 820 },
    }),
    lesionRows: [
      mri({ side: "R", level: "Mid", zone: "Posterior", pirads: 4, primus: 4, mriSize: 12 }),
      bx({ side: "R", level: "Mid", zone: "Posterior", gg: 2, corePct: 35, linear: 6, pni: true }),
    ],
  },
  {
    id: "anterior-occult",
    name: "Anterior lesion, occult high-grade",
    blurb: "Bx GG1 · PI-RADS 3 / PRIMUS 4 anterior → path GG4 (3+5), pT3 — imaging-led upgrade",
    record: mkRecord({
      patient: { age: 64, psa: 7.5, psa_density: 0.19, bmi: 28, shim: 17, ipss: 10 },
      prostate: { volume_cc: 40 },
      biopsy: {
        max_grade_group: 1, total_positive_cores: 2, max_core_involvement_pct: 20,
        max_linear_extent_mm: 4, laterality: "left", gg_left: 1, gg_right: 0,
        cores_left: 2, cores_right: 0,
      },
      staging: { max_pirads: 3, max_primus: 4, lesion_size_cm: 1, adc_mean: 800 },
    }),
    lesionRows: [
      mri({ side: "L", level: "Mid", zone: "Anterior", pirads: 3, primus: 4, mriSize: 10 }),
      bx({ side: "L", level: "Mid", zone: "Anterior", gg: 1, corePct: 20, linear: 4 }),
    ],
  },
  {
    id: "apex-concordant",
    name: "Apical GG2, concordant",
    blurb: "Bx GG2 (3+4) · PI-RADS 4 right PL apex → path GG2 (3+4), pT2 — apical margin focus",
    record: mkRecord({
      patient: { age: 61, psa: 5.8, bmi: 26, shim: 21, ipss: 6 },
      prostate: { volume_cc: 44 },
      biopsy: {
        max_grade_group: 2, total_positive_cores: 3, max_core_involvement_pct: 30,
        max_linear_extent_mm: 5, max_pct_pattern45: 10, laterality: "right",
        gg_left: 0, gg_right: 2, cores_left: 0, cores_right: 3,
      },
      staging: { max_pirads: 4, max_primus: 4, lesion_size_cm: 1.1, adc_mean: 830 },
    }),
    lesionRows: [
      mri({ side: "R", level: "Apex", zone: "Posterolateral", pirads: 4, primus: 4, mriSize: 11 }),
      bx({ side: "R", level: "Apex", zone: "Posterolateral", gg: 2, corePct: 30, linear: 5 }),
    ],
  },
  {
    id: "low-imaging-upgrade",
    name: "Negative imaging, still upstaged",
    blurb: "Bx GG1 · PI-RADS 2 / PRIMUS 3 → path GG2 (3+4), pT3 — occult upgrade",
    record: mkRecord({
      patient: { age: 66, psa: 6.5, bmi: 29, shim: 15, ipss: 12, htn: true },
      prostate: { volume_cc: 50 },
      biopsy: {
        max_grade_group: 1, total_positive_cores: 3, max_core_involvement_pct: 15,
        max_linear_extent_mm: 3, laterality: "bilateral", gg_left: 1, gg_right: 1,
        cores_left: 2, cores_right: 1,
      },
      staging: { max_pirads: 2, max_primus: 3 },
    }),
    lesionRows: [
      mri({ side: "L", level: "Mid", zone: "Posterior", pirads: 2, primus: 3 }),
      bx({ side: "L", level: "Mid", zone: "Posterior", gg: 1, corePct: 15 }),
      bx({ side: "R", level: "Mid", zone: "Posterior", gg: 1, corePct: 10 }),
    ],
  },
  {
    id: "pirads5-ece",
    name: "PI-RADS 5, EPE+ GG4",
    blurb: "Bx GG4 (4+4) · PI-RADS 5 / PRIMUS 5 · EPE+ → path GG4, pT3a (ECE+) — no NS right",
    record: mkRecord({
      patient: { age: 67, psa: 14, bmi: 28, shim: 16, ipss: 13, htn: true, statin: true },
      prostate: { volume_cc: 40 },
      biopsy: {
        max_grade_group: 4, total_positive_cores: 6, max_core_involvement_pct: 65,
        max_linear_extent_mm: 13, max_pct_pattern45: 85, has_cribriform: 1,
        has_pni: 1, laterality: "bilateral", gg_left: 2, gg_right: 4,
        cores_left: 2, cores_right: 4,
      },
      staging: { epe: true, max_pirads: 5, max_primus: 5, lesion_size_cm: 2, adc_mean: 650 },
    }),
    lesionRows: [
      mri({ side: "R", level: "Base", zone: "Posterior", pirads: 5, primus: 5, mriSize: 20, epe: true }),
      bx({ side: "R", level: "Base", zone: "Posterior", gg: 4, corePct: 65, linear: 13, cribriform: true, pni: true }),
      bx({ side: "L", level: "Mid", zone: "Posterior", gg: 2, corePct: 25 }),
    ],
  },
  {
    id: "high-grade-focal-ns",
    name: "GG5 with focal nerve-sparing",
    blurb: "Bx GG5 (4+5) · PI-RADS 5 left mid-apex · focal EPE → path GG5, pT3a — contralateral focal NS",
    record: mkRecord({
      patient: {
        age: 60, psa: 11, bmi: 25, shim: 22, ipss: 5,
        smoking: "never", exercise: "active", pfmt: "intensive", pde5_plan: "daily",
      },
      prostate: { volume_cc: 42 },
      biopsy: {
        max_grade_group: 5, total_positive_cores: 5, max_core_involvement_pct: 60,
        max_linear_extent_mm: 12, max_pct_pattern45: 70, has_pni: 1,
        laterality: "left", gg_left: 5, gg_right: 1, cores_left: 4, cores_right: 1,
      },
      staging: { epe: true, max_pirads: 5, max_primus: 5, lesion_size_cm: 1.8, adc_mean: 690 },
    }),
    lesionRows: [
      mri({ side: "L", level: "Mid", zone: "Posterolateral", pirads: 5, primus: 5, mriSize: 18, epe: true }),
      mri({ side: "L", level: "Apex", zone: "Posterolateral", pirads: 5, primus: 5, mriSize: 9 }),
      bx({ side: "L", level: "Mid", zone: "Posterolateral", gg: 5, corePct: 60, linear: 12, pni: true }),
    ],
  },
];

export const DEMO_CASE_IDS = new Set(DEMO_CASES.map((d) => d.id));
