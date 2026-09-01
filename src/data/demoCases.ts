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
function mri(o: Partial<LesionRow> & { side: "L" | "R"; level: LesionRow["level"]; zone: string; pirads: number }): LesionRow {
  return {
    ...emptyLesion(`${o.side}-${o.level}-mri`),
    source: "MRI", side: o.side, level: o.level, zone: o.zone,
    score: String(o.pirads), pirads: o.pirads,
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
];

export const DEMO_CASE_IDS = new Set(DEMO_CASES.map((d) => d.id));
