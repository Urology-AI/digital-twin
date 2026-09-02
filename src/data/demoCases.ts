/**
 * Curated, read-only demo cases for showing COMPASS live.
 *
 * They are de-identified teaching scenarios, each picked so it lands a clear
 * talking point (see `blurb`) — not patient records and not for clinical use.
 *
 * Every case is grounded in a de-identified row of the COMPASS RARP working
 * cohort — none are invented. The first eleven are carried over verbatim:
 * demographics, biopsy, staging and the full zone-level lesion map are the
 * de-identified record as exported. The `cohort-*` cases that follow take only
 * the tumour profile (PSA, volume, grade, core involvement, PI-RADS, PSMA/SUV,
 * laterality) from cohort rows whose export carried no demographics; age, BMI,
 * SHIM, IPSS and lifestyle there are plausible defaults. No identifiers, dates
 * or free text are carried over, and nothing here is a patient record. They
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
    id: "gg1-large-gland",
    name: "GG1 in a 160 cc gland",
    blurb: "GG1 right \u00b7 PSAD 0.05 \u00b7 PI-RADS 4 apex \u2014 ECE 4%, but the highest upgrade risk on the board",
    record: {
      _schema: "prostate-3d-input-v1",
      patient: { age: 62, psa: 7.9, psa_density: null, bmi: 25, shim: 12, ipss: null, dm: false, htn: false, cad: false, statin: false, smoking: "never", exercise: "active", pfmt: "intensive", alcohol: "none", pde5: true, pde5_plan: "daily" },
      prostate: { volume_cc: 160, dimensions_cm: null, median_lobe_grade: 0 },
      biopsy: { max_grade_group: 1, total_positive_cores: 0, total_cores: 0, max_core_involvement_pct: 35, max_linear_extent_mm: 0, max_pct_pattern45: 0, has_cribriform: 0, has_idc: 0, has_pni: 0, laterality: "bilateral", gg_left: null, gg_right: null, cores_left: null, cores_right: null, mc_left: null, mc_right: null, linear_left: null, linear_right: null, decipher_score: null },
      staging: { epe: false, svi: false, max_pirads: 1, max_suv: null, lesion_size_cm: null, abutment: null, adc_mean: null, epe_mus: false, svi_mus: false, psma_epe: false, psma_svi: false },
      zones: {},
      lesions: [],
    },
    lesionRows: [
      { id: "P-RB-M-bx", source: "Bx", side: "R", zone: "Posterior", score: "1", epe: false, svi: false, corePct: 35, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Base", cribriform: false, idc: false, pni: false },
      { id: "P-RM-M-bx", source: "Bx", side: "R", zone: "Posterior", score: "1", epe: false, svi: false, corePct: 35, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Mid", cribriform: false, idc: false, pni: false },
      { id: "A-RA-mri", source: "MRI", side: "R", zone: "Anterior", score: "4", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 7, mriAbutment: 1, mriAdc: 0, level: "Apex", pirads: 4 },
      { id: "A-RA-mus", source: "MUS", side: "R", zone: "Anterior", score: "4", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: 1, mriAdc: 0, level: "Apex", primus: 4 },
      { id: "A-RA-bx", source: "Bx", side: "R", zone: "Anterior", score: "1", epe: false, svi: false, corePct: 35, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Apex", cribriform: false, idc: false, pni: false },
    ],
  },
  {
    id: "gg2-unilateral",
    name: "GG2 left only, 66 cc",
    blurb: "GG2 left \u00b7 PSMA 6.8 \u00b7 SHIM 1 at 74 \u2014 one-sided NS trade-off with no functional reserve",
    record: {
      _schema: "prostate-3d-input-v1",
      patient: { age: 74, psa: 4.8, psa_density: null, bmi: 26, shim: 1, ipss: null, dm: false, htn: false, cad: false, statin: false, smoking: "never", exercise: "active", pfmt: "intensive", alcohol: "none", pde5: true, pde5_plan: "daily" },
      prostate: { volume_cc: 66, dimensions_cm: null, median_lobe_grade: 0 },
      biopsy: { max_grade_group: 2, total_positive_cores: 0, total_cores: 0, max_core_involvement_pct: 35, max_linear_extent_mm: 0, max_pct_pattern45: 0, has_cribriform: 0, has_idc: 0, has_pni: 0, laterality: "bilateral", gg_left: null, gg_right: null, cores_left: null, cores_right: null, mc_left: null, mc_right: null, linear_left: null, linear_right: null, decipher_score: null },
      staging: { epe: false, svi: false, max_pirads: 1, max_suv: null, lesion_size_cm: null, abutment: null, adc_mean: null, epe_mus: false, svi_mus: false, psma_epe: false, psma_svi: false },
      zones: {},
      lesions: [],
    },
    lesionRows: [
      { id: "P-RB-M-psma", source: "PSMA", side: "R", zone: "Posterior", score: "4.3", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Base", suv: 4.3, psmaLn: false },
      { id: "P-LB-M-mri", source: "MRI", side: "L", zone: "Posterior", score: "3", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: 1, mriAdc: 0, level: "Base", pirads: 3 },
      { id: "P-LB-M-psma", source: "PSMA", side: "L", zone: "Posterior", score: "6.8", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Base", suv: 6.8, psmaLn: false },
      { id: "P-LB-M-bx", source: "Bx", side: "L", zone: "Posterior", score: "2", epe: false, svi: false, corePct: 35, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Base", cribriform: false, idc: false, pni: false },
      { id: "P-LB-L-mus", source: "MUS", side: "L", zone: "Posterolateral", score: "4", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: 1, mriAdc: 0, level: "Base", primus: 4 },
      { id: "P-RM-M-psma", source: "PSMA", side: "R", zone: "Posterior", score: "4.3", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Mid", suv: 4.3, psmaLn: false },
      { id: "P-LM-M-bx", source: "Bx", side: "L", zone: "Posterior", score: "2", epe: false, svi: false, corePct: 35, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Mid", cribriform: false, idc: false, pni: false },
      { id: "A-RA-psma", source: "PSMA", side: "R", zone: "Anterior", score: "4.3", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Apex", suv: 4.3, psmaLn: false },
      { id: "A-LA-bx", source: "Bx", side: "L", zone: "Anterior", score: "2", epe: false, svi: false, corePct: 35, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Apex", cribriform: false, idc: false, pni: false },
    ],
  },
  {
    id: "gg2-apex-concordant",
    name: "Apical GG2, concordant imaging",
    blurb: "GG2 right \u00b7 PI-RADS 4 at 0.6 cm \u00b7 PSAD 0.21 \u2014 apical margin focus, NS 1 left / 2 right",
    record: {
      _schema: "prostate-3d-input-v1",
      patient: { age: 60, psa: 7.19, psa_density: null, bmi: 29, shim: 17, ipss: null, dm: false, htn: false, cad: false, statin: false, smoking: "never", exercise: "moderate", pde5: false },
      prostate: { volume_cc: 35, dimensions_cm: null, median_lobe_grade: 0 },
      biopsy: { max_grade_group: 2, total_positive_cores: 0, total_cores: 0, max_core_involvement_pct: 30, max_linear_extent_mm: 0, max_pct_pattern45: 0, has_cribriform: 0, has_idc: 0, has_pni: 0, laterality: "bilateral", gg_left: null, gg_right: null, cores_left: null, cores_right: null, mc_left: null, mc_right: null, linear_left: null, linear_right: null, decipher_score: null },
      staging: { epe: false, svi: false, max_pirads: 1, max_suv: null, lesion_size_cm: null, abutment: null, adc_mean: null, epe_mus: false, svi_mus: false, psma_epe: false, psma_svi: false },
      zones: {},
      lesions: [],
    },
    lesionRows: [
      { id: "P-RB-M-mri", source: "MRI", side: "R", zone: "Posterior", score: "4", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 6, mriAbutment: 1, mriAdc: 0, level: "Base", pirads: 4 },
      { id: "P-RB-M-mus", source: "MUS", side: "R", zone: "Posterior", score: "4", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: 1, mriAdc: 0, level: "Base", primus: 4 },
      { id: "P-RB-M-bx", source: "Bx", side: "R", zone: "Posterior", score: "2", epe: false, svi: false, corePct: 30, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Base", cribriform: false, idc: false, pni: false },
      { id: "P-LB-M-psma", source: "PSMA", side: "L", zone: "Posterior", score: "4.6", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Base", suv: 4.6, psmaLn: false },
      { id: "P-LB-M-bx", source: "Bx", side: "L", zone: "Posterior", score: "1", epe: false, svi: false, corePct: 30, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Base", cribriform: false, idc: false, pni: false },
      { id: "P-RM-M-psma", source: "PSMA", side: "R", zone: "Posterior", score: "4.2", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Mid", suv: 4.2, psmaLn: false },
      { id: "P-RM-M-mus", source: "MUS", side: "R", zone: "Posterior", score: "4", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: 1, mriAdc: 0, level: "Mid", primus: 4 },
      { id: "P-RM-M-bx", source: "Bx", side: "R", zone: "Posterior", score: "2", epe: false, svi: false, corePct: 30, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Mid", cribriform: false, idc: false, pni: false },
      { id: "P-LM-M-bx", source: "Bx", side: "L", zone: "Posterior", score: "1", epe: false, svi: false, corePct: 30, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Mid", cribriform: false, idc: false, pni: false },
      { id: "A-RA-psma", source: "PSMA", side: "R", zone: "Anterior", score: "6", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Apex", suv: 6, psmaLn: false },
    ],
  },
  {
    id: "gg2-right-small-gland",
    name: "Right-sided GG2, 23 cc gland",
    blurb: "GG2 right \u00b7 cores 45% \u00b7 PI-RADS 4 apex \u2014 NS 1 left / 2 right, the asymmetry case",
    record: {
      _schema: "prostate-3d-input-v1",
      patient: { age: 51, psa: 3.4, psa_density: null, bmi: 24, shim: 16, ipss: null, dm: false, htn: false, cad: false, statin: false, smoking: "never", exercise: "moderate", pde5: false },
      prostate: { volume_cc: 23, dimensions_cm: null, median_lobe_grade: 0 },
      biopsy: { max_grade_group: 2, total_positive_cores: 0, total_cores: 0, max_core_involvement_pct: 45, max_linear_extent_mm: 0, max_pct_pattern45: 0, has_cribriform: 0, has_idc: 0, has_pni: 0, laterality: "bilateral", gg_left: null, gg_right: null, cores_left: null, cores_right: null, mc_left: null, mc_right: null, linear_left: null, linear_right: null, decipher_score: null },
      staging: { epe: false, svi: false, max_pirads: 1, max_suv: null, lesion_size_cm: null, abutment: null, adc_mean: null, epe_mus: false, svi_mus: false, psma_epe: false, psma_svi: false },
      zones: {},
      lesions: [],
    },
    lesionRows: [
      { id: "P-RB-M-bx", source: "Bx", side: "R", zone: "Posterior", score: "2", epe: false, svi: false, corePct: 45, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Base", cribriform: false, idc: false, pni: false },
      { id: "P-RM-M-bx", source: "Bx", side: "R", zone: "Posterior", score: "2", epe: false, svi: false, corePct: 45, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Mid", cribriform: false, idc: false, pni: false },
      { id: "A-RB-psma", source: "PSMA", side: "R", zone: "Anterior", score: "3.9", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Base", suv: 3.9, psmaLn: false },
      { id: "A-LB-psma", source: "PSMA", side: "L", zone: "Anterior", score: "5.5", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Base", suv: 5.5, psmaLn: false },
      { id: "A-RM-psma", source: "PSMA", side: "R", zone: "Anterior", score: "3.9", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Mid", suv: 3.9, psmaLn: false },
      { id: "A-LM-psma", source: "PSMA", side: "L", zone: "Anterior", score: "5.5", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Mid", suv: 5.5, psmaLn: false },
      { id: "A-RA-mri", source: "MRI", side: "R", zone: "Anterior", score: "4", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 7, mriAbutment: 1, mriAdc: 0, level: "Apex", pirads: 4 },
      { id: "A-RA-psma", source: "PSMA", side: "R", zone: "Anterior", score: "3.9", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Apex", suv: 3.9, psmaLn: false },
      { id: "A-RA-mus", source: "MUS", side: "R", zone: "Anterior", score: "4", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: 1, mriAdc: 0, level: "Apex", primus: 4 },
      { id: "A-RA-bx", source: "Bx", side: "R", zone: "Anterior", score: "2", epe: false, svi: false, corePct: 45, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Apex", cribriform: false, idc: false, pni: false },
      { id: "A-LA-psma", source: "PSMA", side: "L", zone: "Anterior", score: "5.5", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Apex", suv: 5.5, psmaLn: false },
    ],
  },
  {
    id: "gg2-psma-only",
    name: "GG2 mapped by PSMA, not MRI",
    blurb: "PI-RADS 3 \u00b7 SUV 9.8 bilateral \u00b7 SHIM 28 at 57 \u2014 PSMA carries the map, functional reserve is high",
    record: {
      _schema: "prostate-3d-input-v1",
      patient: { age: 57, psa: 7.4, psa_density: null, bmi: 28, shim: 28, ipss: null, dm: false, htn: false, cad: false, statin: false, smoking: "never", exercise: "active", pfmt: "intensive", alcohol: "none", pde5: true, pde5_plan: "daily" },
      prostate: { volume_cc: 56, dimensions_cm: null, median_lobe_grade: 0 },
      biopsy: { max_grade_group: 2, total_positive_cores: 0, total_cores: 0, max_core_involvement_pct: 0, max_linear_extent_mm: 0, max_pct_pattern45: 0, has_cribriform: 0, has_idc: 0, has_pni: 0, laterality: "bilateral", gg_left: null, gg_right: null, cores_left: null, cores_right: null, mc_left: null, mc_right: null, linear_left: null, linear_right: null, decipher_score: null },
      staging: { epe: false, svi: false, max_pirads: 1, max_suv: null, lesion_size_cm: null, abutment: null, adc_mean: null, epe_mus: false, svi_mus: false, psma_epe: false, psma_svi: false },
      zones: {},
      lesions: [],
    },
    lesionRows: [
      { id: "P-RB-L-psma", source: "PSMA", side: "R", zone: "Posterolateral", score: "9.8", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Base", suv: 9.8, psmaLn: false },
      { id: "P-RB-M-psma", source: "PSMA", side: "R", zone: "Posterior", score: "1.7", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Base", suv: 1.7, psmaLn: false },
      { id: "P-RM-L-psma", source: "PSMA", side: "R", zone: "Posterolateral", score: "9.8", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Mid", suv: 9.8, psmaLn: false },
      { id: "P-RM-M-psma", source: "PSMA", side: "R", zone: "Posterior", score: "1.7", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Mid", suv: 1.7, psmaLn: false },
      { id: "P-LM-L-psma", source: "PSMA", side: "L", zone: "Posterolateral", score: "4.2", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Mid", suv: 4.2, psmaLn: false },
      { id: "A-RA-mri", source: "MRI", side: "R", zone: "Anterior", score: "3", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: 1, mriAdc: 0, level: "Apex", pirads: 3 },
      { id: "A-RA-psma", source: "PSMA", side: "R", zone: "Anterior", score: "9.8", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Apex", suv: 9.8, psmaLn: false },
      { id: "A-RA-mus", source: "MUS", side: "R", zone: "Anterior", score: "4", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: 1, mriAdc: 0, level: "Apex", primus: 4 },
      { id: "A-LA-mri", source: "MRI", side: "L", zone: "Anterior", score: "3", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: 1, mriAdc: 0, level: "Apex", pirads: 3 },
    ],
  },
  {
    id: "gg2-high-psa-burden",
    name: "PSA 13, cores to 100%",
    blurb: "GG2 right \u00b7 10 positive cores \u00b7 PI-RADS 4 at 1.1 cm \u2014 volume of disease, not grade, drives ECE right",
    record: {
      _schema: "prostate-3d-input-v1",
      patient: { age: 68, psa: 12.98, psa_density: null, bmi: 24, shim: 25, ipss: null, dm: false, htn: false, cad: false, statin: false, smoking: "never", exercise: "moderate", pde5: false },
      prostate: { volume_cc: 57, dimensions_cm: null, median_lobe_grade: 0 },
      biopsy: { max_grade_group: 2, total_positive_cores: 0, total_cores: 0, max_core_involvement_pct: 100, max_linear_extent_mm: 9, max_pct_pattern45: 0, has_cribriform: 0, has_idc: 0, has_pni: 0, laterality: "bilateral", gg_left: null, gg_right: null, cores_left: null, cores_right: null, mc_left: null, mc_right: null, linear_left: null, linear_right: null, decipher_score: null },
      staging: { epe: false, svi: false, max_pirads: 1, max_suv: null, lesion_size_cm: null, abutment: null, adc_mean: null, epe_mus: false, svi_mus: false, psma_epe: false, psma_svi: false },
      zones: {},
      lesions: [],
    },
    lesionRows: [
      { id: "P-RB-L-bx", source: "Bx", side: "R", zone: "Posterolateral", score: "2", epe: false, svi: false, corePct: 42, linear: 3.7, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Base", cribriform: false, idc: false, pni: false },
      { id: "P-RB-M-bx", source: "Bx", side: "R", zone: "Posterior", score: "2", epe: false, svi: false, corePct: 100, linear: 9, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Base", cribriform: false, idc: false, pni: false },
      { id: "P-LB-L-bx", source: "Bx", side: "L", zone: "Posterolateral", score: "1", epe: false, svi: false, corePct: 3, linear: 1.1, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Base", cribriform: false, idc: false, pni: false },
      { id: "P-RM-L-bx", source: "Bx", side: "R", zone: "Posterolateral", score: "2", epe: false, svi: false, corePct: 42, linear: 3.7, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Mid", cribriform: false, idc: false, pni: false },
      { id: "P-RM-M-bx", source: "Bx", side: "R", zone: "Posterior", score: "2", epe: false, svi: false, corePct: 100, linear: 9, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Mid", cribriform: false, idc: false, pni: false },
      { id: "P-LM-L-bx", source: "Bx", side: "L", zone: "Posterolateral", score: "1", epe: false, svi: false, corePct: 3, linear: 1.1, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Mid", cribriform: false, idc: false, pni: false },
      { id: "A-LB-bx", source: "Bx", side: "L", zone: "Anterior", score: "1", epe: false, svi: false, corePct: 13, linear: 2.2, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Base", cribriform: false, idc: false, pni: false },
      { id: "A-LM-bx", source: "Bx", side: "L", zone: "Anterior", score: "1", epe: false, svi: false, corePct: 13, linear: 2.2, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Mid", cribriform: false, idc: false, pni: false },
      { id: "A-RA-mri", source: "MRI", side: "R", zone: "Anterior", score: "4", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 11, mriAbutment: 1, mriAdc: 0, level: "Apex", pirads: 4 },
      { id: "A-RA-bx", source: "Bx", side: "R", zone: "Anterior", score: "2", epe: false, svi: false, corePct: 100, linear: 9, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Apex", cribriform: false, idc: false, pni: false },
      { id: "A-LA-bx", source: "Bx", side: "L", zone: "Anterior", score: "1", epe: false, svi: false, corePct: 13, linear: 2.2, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Apex", cribriform: false, idc: false, pni: false },
    ],
  },
  {
    id: "gg1-anterior-pirads5",
    name: "Anterior GG1 under a PI-RADS 5",
    blurb: "Bx GG1 \u00b7 PI-RADS 5 anterior \u00b7 56 cc \u2014 low ECE, upgrade risk 35%",
    record: {
      _schema: "prostate-3d-input-v1",
      patient: { age: 56, psa: 3.71, psa_density: null, bmi: 31.4, shim: 25, ipss: 3, dm: false, htn: false, cad: false, statin: false, smoking: "never", exercise: "moderate", pde5: false },
      prostate: { volume_cc: 56, dimensions_cm: null, median_lobe_grade: 0 },
      biopsy: { max_grade_group: 1, total_positive_cores: 0, total_cores: 0, max_core_involvement_pct: 60, max_linear_extent_mm: 0, max_pct_pattern45: 0, has_cribriform: 0, has_idc: 0, has_pni: 0, laterality: "bilateral", gg_left: null, gg_right: null, cores_left: null, cores_right: null, mc_left: null, mc_right: null, linear_left: null, linear_right: null, decipher_score: 0.15 },
      staging: { epe: false, svi: false, max_pirads: 1, max_suv: null, lesion_size_cm: null, abutment: null, adc_mean: null, epe_mus: false, svi_mus: false, psma_epe: false, psma_svi: false },
      zones: {},
      lesions: [],
    },
    lesionRows: [
      { id: "P-LM-M-bx", source: "Bx", side: "L", zone: "Posterior", score: "1", epe: false, svi: false, corePct: 35, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Mid", cribriform: false, idc: false, pni: false },
      { id: "A-LA-mri", source: "MRI", side: "L", zone: "Anterior", score: "5", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: 1, mriAdc: 0, level: "Apex", pirads: 5 },
      { id: "A-LA-bx", source: "Bx", side: "L", zone: "Anterior", score: "1", epe: false, svi: false, corePct: 60, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Apex", cribriform: false, idc: false, pni: false },
    ],
  },
  {
    id: "gg5-negative-mri",
    name: "PI-RADS 2 hiding a GG5",
    blurb: "PI-RADS 2 \u00b7 SUV 4.5 \u00b7 biopsy GG5 right \u2014 imaging says quiet, grade says otherwise",
    record: {
      _schema: "prostate-3d-input-v1",
      patient: { age: 52, psa: 5.6, psa_density: null, bmi: 30, shim: 22, ipss: null, dm: false, htn: false, cad: false, statin: false, smoking: "never", exercise: "moderate", pde5: false },
      prostate: { volume_cc: 30, dimensions_cm: null, median_lobe_grade: 0 },
      biopsy: { max_grade_group: 5, total_positive_cores: 0, total_cores: 0, max_core_involvement_pct: 40, max_linear_extent_mm: 0, max_pct_pattern45: 0, has_cribriform: 0, has_idc: 0, has_pni: 0, laterality: "bilateral", gg_left: null, gg_right: null, cores_left: null, cores_right: null, mc_left: null, mc_right: null, linear_left: null, linear_right: null, decipher_score: null },
      staging: { epe: false, svi: false, max_pirads: 1, max_suv: null, lesion_size_cm: null, abutment: null, adc_mean: null, epe_mus: false, svi_mus: false, psma_epe: false, psma_svi: false },
      zones: {},
      lesions: [],
    },
    lesionRows: [
      { id: "P-RB-M-bx", source: "Bx", side: "R", zone: "Posterior", score: "5", epe: false, svi: false, corePct: 20, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Base", cribriform: false, idc: false, pni: false },
      { id: "P-LB-M-bx", source: "Bx", side: "L", zone: "Posterior", score: "2", epe: false, svi: false, corePct: 40, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Base", cribriform: false, idc: false, pni: false },
      { id: "P-RM-M-psma", source: "PSMA", side: "R", zone: "Posterior", score: "4.5", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Mid", suv: 4.5, psmaLn: false },
      { id: "P-RM-M-mus", source: "MUS", side: "R", zone: "Posterior", score: "3", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: 1, mriAdc: 0, level: "Mid", primus: 3 },
      { id: "P-RM-M-bx", source: "Bx", side: "R", zone: "Posterior", score: "5", epe: false, svi: false, corePct: 20, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Mid", cribriform: false, idc: false, pni: false },
      { id: "P-LM-M-bx", source: "Bx", side: "L", zone: "Posterior", score: "2", epe: false, svi: false, corePct: 40, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Mid", cribriform: false, idc: false, pni: false },
      { id: "A-RA-bx", source: "Bx", side: "R", zone: "Anterior", score: "5", epe: false, svi: false, corePct: 20, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Apex", cribriform: false, idc: false, pni: false },
      { id: "A-LA-bx", source: "Bx", side: "L", zone: "Anterior", score: "2", epe: false, svi: false, corePct: 40, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Apex", cribriform: false, idc: false, pni: false },
    ],
  },
  {
    id: "gg3-pirads5-ece",
    name: "PI-RADS 5, GG3 both lobes",
    blurb: "GG3 bilateral \u00b7 left cores 70% \u00b7 PI-RADS 5 \u2014 ECE 33%, NS narrows on the left",
    record: {
      _schema: "prostate-3d-input-v1",
      patient: { age: 56, psa: 4.3, psa_density: null, bmi: 25, shim: 24, ipss: null, dm: false, htn: false, cad: false, statin: false, smoking: "never", exercise: "moderate", pde5: false },
      prostate: { volume_cc: 40, dimensions_cm: null, median_lobe_grade: 0 },
      biopsy: { max_grade_group: 3, total_positive_cores: 0, total_cores: 0, max_core_involvement_pct: 70, max_linear_extent_mm: 0, max_pct_pattern45: 0, has_cribriform: 0, has_idc: 0, has_pni: 0, laterality: "bilateral", gg_left: null, gg_right: null, cores_left: null, cores_right: null, mc_left: null, mc_right: null, linear_left: null, linear_right: null, decipher_score: null },
      staging: { epe: false, svi: false, max_pirads: 1, max_suv: null, lesion_size_cm: null, abutment: null, adc_mean: null, epe_mus: false, svi_mus: false, psma_epe: false, psma_svi: false },
      zones: {},
      lesions: [],
    },
    lesionRows: [
      { id: "P-RB-M-bx", source: "Bx", side: "R", zone: "Posterior", score: "3", epe: false, svi: false, corePct: 33, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Base", cribriform: false, idc: false, pni: false },
      { id: "P-LB-M-mri", source: "MRI", side: "L", zone: "Posterior", score: "5", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: 1, mriAdc: 0, level: "Base", pirads: 5 },
      { id: "P-LB-M-bx", source: "Bx", side: "L", zone: "Posterior", score: "3", epe: false, svi: false, corePct: 70, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Base", cribriform: false, idc: false, pni: false },
      { id: "P-LB-L-mus", source: "MUS", side: "L", zone: "Posterolateral", score: "4", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: 1, mriAdc: 0, level: "Base", primus: 4 },
      { id: "P-RM-M-bx", source: "Bx", side: "R", zone: "Posterior", score: "3", epe: false, svi: false, corePct: 33, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Mid", cribriform: false, idc: false, pni: false },
      { id: "P-LM-M-bx", source: "Bx", side: "L", zone: "Posterior", score: "3", epe: false, svi: false, corePct: 70, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Mid", cribriform: false, idc: false, pni: false },
      { id: "A-RA-bx", source: "Bx", side: "R", zone: "Anterior", score: "3", epe: false, svi: false, corePct: 33, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Apex", cribriform: false, idc: false, pni: false },
      { id: "A-LA-bx", source: "Bx", side: "L", zone: "Anterior", score: "3", epe: false, svi: false, corePct: 70, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Apex", cribriform: false, idc: false, pni: false },
    ],
  },
  {
    id: "gg4-psma-heavy",
    name: "High-risk GG4, PSMA-heavy",
    blurb: "GG4 both lobes \u00b7 SUV 11.1 \u00b7 PSMA in every level \u2014 bilateral ECE near 1 in 3",
    record: {
      _schema: "prostate-3d-input-v1",
      patient: { age: 51, psa: 7.7, psa_density: null, bmi: 31, shim: 21, ipss: null, dm: false, htn: false, cad: false, statin: false, smoking: "never", exercise: "moderate", pde5: false },
      prostate: { volume_cc: 46, dimensions_cm: null, median_lobe_grade: 0 },
      biopsy: { max_grade_group: 4, total_positive_cores: 0, total_cores: 0, max_core_involvement_pct: 59, max_linear_extent_mm: 0, max_pct_pattern45: 0, has_cribriform: 0, has_idc: 0, has_pni: 0, laterality: "bilateral", gg_left: null, gg_right: null, cores_left: null, cores_right: null, mc_left: null, mc_right: null, linear_left: null, linear_right: null, decipher_score: null },
      staging: { epe: false, svi: false, max_pirads: 1, max_suv: null, lesion_size_cm: null, abutment: null, adc_mean: null, epe_mus: false, svi_mus: false, psma_epe: false, psma_svi: false },
      zones: {},
      lesions: [],
    },
    lesionRows: [
      { id: "P-RB-L-mri", source: "MRI", side: "R", zone: "Posterolateral", score: "4", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 8, mriAbutment: 1, mriAdc: 0, level: "Base", pirads: 4 },
      { id: "P-RB-L-psma", source: "PSMA", side: "R", zone: "Posterolateral", score: "7.8", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Base", suv: 7.8, psmaLn: false },
      { id: "P-RB-M-psma", source: "PSMA", side: "R", zone: "Posterior", score: "7.9", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Base", suv: 7.9, psmaLn: false },
      { id: "P-RB-M-mus", source: "MUS", side: "R", zone: "Posterior", score: "5", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: 1, mriAdc: 0, level: "Base", primus: 5 },
      { id: "P-RB-M-bx", source: "Bx", side: "R", zone: "Posterior", score: "4", epe: false, svi: false, corePct: 59, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Base", cribriform: false, idc: false, pni: false },
      { id: "P-LB-M-psma", source: "PSMA", side: "L", zone: "Posterior", score: "11.1", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Base", suv: 11.1, psmaLn: false },
      { id: "P-LB-M-bx", source: "Bx", side: "L", zone: "Posterior", score: "4", epe: false, svi: false, corePct: 1, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Base", cribriform: false, idc: false, pni: false },
      { id: "P-RM-L-psma", source: "PSMA", side: "R", zone: "Posterolateral", score: "7.8", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Mid", suv: 7.8, psmaLn: false },
      { id: "P-RM-M-psma", source: "PSMA", side: "R", zone: "Posterior", score: "7.9", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Mid", suv: 7.9, psmaLn: false },
      { id: "P-RM-M-mus", source: "MUS", side: "R", zone: "Posterior", score: "5", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: 1, mriAdc: 0, level: "Mid", primus: 5 },
      { id: "P-RM-M-bx", source: "Bx", side: "R", zone: "Posterior", score: "4", epe: false, svi: false, corePct: 59, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Mid", cribriform: false, idc: false, pni: false },
      { id: "P-LM-M-psma", source: "PSMA", side: "L", zone: "Posterior", score: "11.1", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Mid", suv: 11.1, psmaLn: false },
      { id: "P-LM-M-bx", source: "Bx", side: "L", zone: "Posterior", score: "4", epe: false, svi: false, corePct: 1, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Mid", cribriform: false, idc: false, pni: false },
      { id: "P-LM-L-mus", source: "MUS", side: "L", zone: "Posterolateral", score: "4", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: 1, mriAdc: 0, level: "Mid", primus: 4 },
      { id: "A-RA-psma", source: "PSMA", side: "R", zone: "Anterior", score: "7.9", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Apex", suv: 7.9, psmaLn: false },
      { id: "A-RA-mus", source: "MUS", side: "R", zone: "Anterior", score: "5", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: 1, mriAdc: 0, level: "Apex", primus: 5 },
      { id: "A-RA-bx", source: "Bx", side: "R", zone: "Anterior", score: "4", epe: false, svi: false, corePct: 59, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Apex", cribriform: false, idc: false, pni: false },
      { id: "A-LA-psma", source: "PSMA", side: "L", zone: "Anterior", score: "11.1", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Apex", suv: 11.1, psmaLn: false },
      { id: "A-LA-bx", source: "Bx", side: "L", zone: "Anterior", score: "4", epe: false, svi: false, corePct: 1, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Apex", cribriform: false, idc: false, pni: false },
    ],
  },
  {
    id: "gg2-mri-epe",
    name: "MRI EPE+ on a GG2",
    blurb: "GG2 bilateral \u00b7 cores 100% \u00b7 PI-RADS 5 with EPE \u2014 ECE 48% on a grade you'd normally spare",
    record: {
      _schema: "prostate-3d-input-v1",
      patient: { age: 65, psa: 6.9, psa_density: null, bmi: 23, shim: 25, ipss: null, dm: false, htn: false, cad: false, statin: false, smoking: "never", exercise: "active", pfmt: "moderate", alcohol: "moderate", pde5: true, pde5_plan: "daily" },
      prostate: { volume_cc: 22, dimensions_cm: null, median_lobe_grade: 0 },
      biopsy: { max_grade_group: 2, total_positive_cores: 0, total_cores: 0, max_core_involvement_pct: 100, max_linear_extent_mm: 9, max_pct_pattern45: 0, has_cribriform: 0, has_idc: 0, has_pni: 0, laterality: "bilateral", gg_left: null, gg_right: null, cores_left: null, cores_right: null, mc_left: null, mc_right: null, linear_left: null, linear_right: null, decipher_score: null },
      staging: { epe: true, svi: false, max_pirads: 1, max_suv: null, lesion_size_cm: null, abutment: null, adc_mean: null, epe_mus: false, svi_mus: false, psma_epe: false, psma_svi: false },
      zones: {},
      lesions: [],
    },
    lesionRows: [
      { id: "P-RB-M-bx", source: "Bx", side: "R", zone: "Posterior", score: "2", epe: false, svi: false, corePct: 100, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Base", cribriform: false, idc: false, pni: false },
      { id: "P-LB-M-bx", source: "Bx", side: "L", zone: "Posterior", score: "2", epe: false, svi: false, corePct: 100, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Base", cribriform: false, idc: false, pni: false },
      { id: "P-RM-M-mri", source: "MRI", side: "R", zone: "Posterior", score: "3", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: 1, mriAdc: 0, level: "Mid", pirads: 3 },
      { id: "P-RM-M-bx", source: "Bx", side: "R", zone: "Posterior", score: "2", epe: false, svi: false, corePct: 100, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Mid", cribriform: false, idc: false, pni: false },
      { id: "P-LM-M-mri", source: "MRI", side: "L", zone: "Posterior", score: "5", epe: true, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: 1, mriAdc: 0, level: "Mid", pirads: 5 },
      { id: "P-LM-M-psma", source: "PSMA", side: "L", zone: "Posterior", score: "6.7", epe: false, svi: false, corePct: 0, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Mid", suv: 6.7, psmaLn: false },
      { id: "P-LM-M-bx", source: "Bx", side: "L", zone: "Posterior", score: "2", epe: false, svi: false, corePct: 100, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Mid", cribriform: false, idc: false, pni: false },
      { id: "A-RA-bx", source: "Bx", side: "R", zone: "Anterior", score: "2", epe: false, svi: false, corePct: 100, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Apex", cribriform: false, idc: false, pni: false },
      { id: "A-LA-bx", source: "Bx", side: "L", zone: "Anterior", score: "2", epe: false, svi: false, corePct: 100, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "Apex", cribriform: false, idc: false, pni: false },
    ],
  },
  /* ---------------------------------------------------------------- *
   * Profile-only cases — tumour profile from COMPASS RARP working      *
   * cohort rows exported without demographics (see file header).        *
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
