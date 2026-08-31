import { create } from "zustand";
import { useUiStore } from "@/store/uiStore";
import { createDefaultZones, createBaseThreeZones } from "@/lib/compass/constants";
import { clinicalStateFromRecord } from "@/lib/compass/clinicalFromRecord";
import { mapLesionsToZones } from "@/lib/compass/lesionZones";
import { runCompassModels } from "@/lib/compass/runCompass";
import { buildProstateRecord } from "@/lib/compass/recordFactory";
import {
  deriveClinicalFromLesions,
  lesionsFromRows,
} from "@/lib/utils/normalization";
import { defaultClinicalState } from "@/types/patient";
import type { ClinicalState, Prostate3DInputV1, ZoneMap } from "@/types/patient";
import type { LesionRow } from "@/types/lesion";
import type { CompassPredictions, ThreeZoneRuntime } from "@/types/prediction";
import { emptyLesion } from "@/types/lesion";

const STORAGE_KEY = "compass-digital-twin-state";
// Bump this version whenever the blank-slate default changes so stale
// localStorage data from previous sessions gets discarded automatically.
// v4: default schema gained the `history` (inflammation-risk inputs) and
// `plan` (surgeon's operative plan) blocks.
const STORAGE_VERSION = 4;
const HISTORY_LIMIT = 40;
// Separate key for cases saved via the CaseLog, so they persist in the dropdown.
const PATIENT_LIBRARY_KEY = "compass-patient-library";
// Same key used by CaseLog.tsx to persist prediction snapshots.
const CASE_LOG_KEY = "compass_cases";

export interface PatientEntry {
  id: string;
  name: string;
  record: Prostate3DInputV1;
  lesionRows: LesionRow[];
}

function clone<T>(x: T): T {
  return structuredClone(x);
}

function ensureLesionIds(rows: LesionRow[]): LesionRow[] {
  return rows.map((r, i) => ({
    ...emptyLesion(r.id || `lesion-${i}`),
    ...r,
    id: r.id || `lesion-${i}`,
  }));
}

function mergeZones(base: ZoneMap): ZoneMap {
  const d = createDefaultZones();
  const out: ZoneMap = { ...d };
  for (const k of Object.keys(d)) {
    const key = k as keyof ZoneMap;
    if (base[key]) {
      out[key] = { ...d[key], ...base[key] };
    }
  }
  return out;
}

interface PatientState {
  patients: PatientEntry[];
  activeId: string | null;
  predictions: CompassPredictions | null;
  threeZones: ThreeZoneRuntime[];
  loading: boolean;
  history: string[];
  historyIndex: number;
  bootstrapFromJson: (rows: { id: string; name: string; record: Prostate3DInputV1 }[]) => void;
  setActive: (id: string) => void;
  setPatientName: (id: string, name: string) => void;
  removePatient: (id: string) => void;
  updateLesionRows: (rows: LesionRow[]) => void;
  addLesion: () => void;
  removeLesion: (id: string) => void;
  updateClinicalForm: (patch: Partial<import("@/types/patient").ClinicalState>) => void;
  /** Wholesale-replaces one patient's record + lesions — used by patient view's "reset to original" after local-only edits (e.g. Modifiable Factors exploration). */
  restorePatientRecord: (id: string, record: Prostate3DInputV1, lesionRows: LesionRow[]) => void;
  newCase: () => void;
  importJsonFile: (text: string, label?: string) => void;
  exportActiveJson: () => string;
  resetActiveToSeed: () => void;
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
  recompute: () => void;
  computeEntryPredictions: (entry: PatientEntry) => {
    S: ClinicalState;
    predictions: CompassPredictions;
  };
}

function snapshot(state: PatientState): string {
  const { patients, activeId } = state;
  return JSON.stringify({ patients, activeId });
}

function applySnapshot(
  set: (fn: (s: PatientState) => Partial<PatientState>) => void,
  json: string,
) {
  try {
    const o = JSON.parse(json) as { patients: PatientEntry[]; activeId: string | null };
    set((state) => ({
      ...state,
      patients: o.patients,
      activeId: o.activeId,
    }));
  } catch {
    /* ignore */
  }
}

export const usePatientStore = create<PatientState>()((set, get) => ({
    patients: [],
    activeId: null,
    predictions: null,
    threeZones: createBaseThreeZones(),
    loading: true,
    history: [],
    historyIndex: -1,

    pushHistory: () => {
      const snap = snapshot(get());
      const { history, historyIndex } = get();
      const next = history.slice(0, historyIndex + 1);
      next.push(snap);
      const trimmed = next.length > HISTORY_LIMIT ? next.slice(-HISTORY_LIMIT) : next;
      set({
        history: trimmed,
        historyIndex: trimmed.length - 1,
      });
    },

    undo: () => {
      const { history, historyIndex } = get();
      if (historyIndex <= 0) return;
      const idx = historyIndex - 1;
      applySnapshot(set, history[idx] ?? "");
      set({ historyIndex: idx });
      get().recompute();
    },

    redo: () => {
      const { history, historyIndex } = get();
      if (historyIndex >= history.length - 1) return;
      const idx = historyIndex + 1;
      applySnapshot(set, history[idx] ?? "");
      set({ historyIndex: idx });
      get().recompute();
    },

    bootstrapFromJson: (rows) => {
      const patients: PatientEntry[] = rows.map((r) => {
        const rec = clone(r.record);
        rec.zones = mergeZones(rec.zones || {});
        return {
          id: r.id,
          name: r.name,
          record: rec,
          lesionRows: ensureLesionIds((rec.lesions as LesionRow[]) || []),
        };
      });
      const first = patients[0]?.id ?? null;
      set({
        patients,
        activeId: first,
        loading: false,
        history: [],
        historyIndex: -1,
      });
      get().recompute();
      get().pushHistory();
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ patients, activeId: first, _v: STORAGE_VERSION }),
        );
      } catch {
        /* private mode */
      }
    },

    setPatientName: (id, name) => {
      set({ patients: get().patients.map((p) => (p.id === id ? { ...p, name } : p)) });
    },

    setActive: (id) => {
      set({ activeId: id });
      get().recompute();
      try {
        const { patients } = get();
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ patients, activeId: id }));
      } catch {
        /* noop */
      }
    },

    removePatient: (id) => {
      const patients = get().patients.filter((p) => p.id !== id);
      let activeId = get().activeId;
      if (activeId === id) activeId = patients[0]?.id ?? null;
      set({ patients, activeId });
      get().recompute();
      get().pushHistory();
    },

    recompute: () => {
      const { patients, activeId } = get();
      const entry = patients.find((p) => p.id === activeId);
      if (!entry) {
        set({ predictions: null, threeZones: createBaseThreeZones() });
        return;
      }
      const record = clone(entry.record);
      record.zones = mergeZones(record.zones);
      record.lesions = entry.lesionRows;
      const S0 = clinicalStateFromRecord(record);
      const S = deriveClinicalFromLesions(S0, lesionsFromRows(entry.lesionRows));
      mapLesionsToZones(record.zones, entry.lesionRows, S);
      const working: Prostate3DInputV1 = { ...record, zones: record.zones };
      const threeZones = clone(createBaseThreeZones());
      const predictions = runCompassModels(S, working, entry.lesionRows, threeZones);
      set({ predictions, threeZones });
    },

    computeEntryPredictions: (entry) => {
      const record = clone(entry.record);
      record.zones = mergeZones(record.zones);
      record.lesions = entry.lesionRows;
      const S0 = clinicalStateFromRecord(record);
      const S = deriveClinicalFromLesions(S0, lesionsFromRows(entry.lesionRows));
      mapLesionsToZones(record.zones, entry.lesionRows, S);
      const working: Prostate3DInputV1 = { ...record, zones: record.zones };
      const threeZones = clone(createBaseThreeZones());
      const predictions = runCompassModels(S, working, entry.lesionRows, threeZones);
      return { S, predictions };
    },

    restorePatientRecord: (id, record, lesionRows) => {
      const { patients } = get();
      const next = patients.map((p) =>
        p.id === id ? { ...p, record: clone(record), lesionRows: ensureLesionIds(clone(lesionRows)) } : p,
      );
      set({ patients: next });
      get().recompute();
    },

    updateLesionRows: (rows) => {
      const { activeId, patients } = get();
      if (!activeId) return;
      const next = patients.map((p) =>
        p.id === activeId ? { ...p, lesionRows: ensureLesionIds(rows) } : p,
      );
      set({ patients: next });
      get().recompute();
    },

    addLesion: () => {
      const { activeId, patients } = get();
      if (!activeId) return;
      const p = patients.find((x) => x.id === activeId);
      if (!p) return;
      const id = `lesion-${Date.now()}`;
      get().updateLesionRows([...p.lesionRows, emptyLesion(id)]);
      get().pushHistory();
    },

    removeLesion: (id) => {
      const { activeId, patients } = get();
      if (!activeId) return;
      const p = patients.find((x) => x.id === activeId);
      if (!p) return;
      get().updateLesionRows(p.lesionRows.filter((l) => l.id !== id));
      get().pushHistory();
    },

    updateClinicalForm: (patch) => {
      const { activeId, patients } = get();
      if (!activeId) return;
      const p = patients.find((x) => x.id === activeId);
      if (!p) return;
      const record = clone(p.record);
      // ── Patient demographics ──────────────────────────────────────────────
      if (patch.psa !== undefined) record.patient.psa = patch.psa;
      if (patch.age !== undefined) record.patient.age = patch.age;
      if (patch.bmi !== undefined) record.patient.bmi = patch.bmi;
      if (patch.dm !== undefined) record.patient.dm = patch.dm;
      if (patch.htn !== undefined) record.patient.htn = patch.htn;
      if (patch.cad !== undefined) record.patient.cad = patch.cad;
      if (patch.smoking !== undefined) record.patient.smoking = patch.smoking;
      if (patch.exercise !== undefined) record.patient.exercise = patch.exercise;
      if (patch.pfmt !== undefined) record.patient.pfmt = patch.pfmt;
      if (patch.alcohol !== undefined) record.patient.alcohol = patch.alcohol;
      if (patch.pde5 !== undefined) {
        record.patient.pde5_plan = patch.pde5;
        record.patient.pde5 = patch.pde5 !== "none";
      }
      if (patch.shim !== undefined) record.patient.shim = patch.shim;
      if (patch.ipss !== undefined) record.patient.ipss = patch.ipss;
      // ── Prostate anatomy ─────────────────────────────────────────────────
      if (patch.vol !== undefined) record.prostate.volume_cc = patch.vol;
      // ── Biopsy ───────────────────────────────────────────────────────────
      if (patch.gg !== undefined) record.biopsy.max_grade_group = patch.gg;
      if (patch.cores !== undefined)
        record.biopsy.total_positive_cores = patch.cores;
      if (patch.maxcore !== undefined)
        record.biopsy.max_core_involvement_pct = patch.maxcore;
      if (patch.linear_mm !== undefined)
        record.biopsy.max_linear_extent_mm = patch.linear_mm;
      if (patch.pct45 !== undefined)
        record.biopsy.max_pct_pattern45 = patch.pct45;
      if (patch.cribriform_bx !== undefined)
        record.biopsy.has_cribriform = patch.cribriform_bx;
      if (patch.idc_bx !== undefined)
        record.biopsy.has_idc = patch.idc_bx;
      if (patch.pni_bx !== undefined)
        record.biopsy.has_pni = patch.pni_bx;
      if (patch.laterality !== undefined)
        record.biopsy.laterality = patch.laterality;
      if (patch.gg_left !== undefined) record.biopsy.gg_left = patch.gg_left;
      if (patch.gg_right !== undefined) record.biopsy.gg_right = patch.gg_right;
      if (patch.cores_left !== undefined) record.biopsy.cores_left = patch.cores_left;
      if (patch.cores_right !== undefined) record.biopsy.cores_right = patch.cores_right;
      if (patch.mc_left !== undefined) record.biopsy.mc_left = patch.mc_left;
      if (patch.mc_right !== undefined) record.biopsy.mc_right = patch.mc_right;
      if (patch.dec !== undefined)
        record.biopsy.decipher_score = patch.dec === null ? null : patch.dec;
      // ── Staging / Imaging ────────────────────────────────────────────────
      if (patch.mri_epe !== undefined) record.staging.epe = !!patch.mri_epe;
      if (patch.mri_svi !== undefined) record.staging.svi = !!patch.mri_svi;
      if (patch.pirads !== undefined) record.staging.max_pirads = patch.pirads;
      if (patch.mri_size !== undefined) record.staging.lesion_size_cm = patch.mri_size;
      if (patch.mri_abutment !== undefined) record.staging.abutment = patch.mri_abutment;
      if (patch.mri_adc !== undefined) record.staging.adc_mean = patch.mri_adc;
      if (patch.mus_ece !== undefined) record.staging.epe_mus = !!patch.mus_ece;
      if (patch.mus_svi !== undefined) record.staging.svi_mus = !!patch.mus_svi;
      if (patch.primus !== undefined) record.staging.max_primus = patch.primus;
      if (patch.psma_epe !== undefined) record.staging.psma_epe = !!patch.psma_epe;
      if (patch.psma_svi !== undefined) record.staging.psma_svi = !!patch.psma_svi;
      if (patch.suv !== undefined) record.staging.max_suv = patch.suv;
      if (patch.psma_ln !== undefined)
        record.staging.lymph_nodes_psma = patch.psma_ln ? "positive" : undefined;
      // ── Anatomy / history (inflammation-risk model) ──────────────────────
      if (patch.median_lobe_grade !== undefined)
        record.prostate.median_lobe_grade = patch.median_lobe_grade;
      const H = (record.history ??= {});
      const hSet: (keyof NonNullable<Prostate3DInputV1["history"]>)[] = [
        "prior_turp", "prior_urolift", "prior_greenlight", "prior_holep",
        "prior_rezum", "prior_pelvic_radiation", "urinary_retention",
        "recurrent_uti", "treated_prostatitis", "biopsy_shows_inflammation",
        "crohns", "ulcerative_colitis", "diverticulitis", "pelvic_abscess",
        "hernia_mesh", "rectal_fistula", "radiation_proctitis",
        "mri_periprostatic_fat_stranding",
      ];
      for (const k of hSet) {
        const v = (patch as Record<string, unknown>)[k];
        if (v !== undefined) (H as Record<string, unknown>)[k] = v;
      }
      if (patch.biopsy_sessions !== undefined) H.biopsy_sessions = patch.biopsy_sessions;
      if (patch.mri_periprostatic_inflammation !== undefined)
        H.mri_periprostatic_inflammation = patch.mri_periprostatic_inflammation;
      if (patch.intraop_inflammation_l !== undefined)
        H.intraop_inflammation_l = patch.intraop_inflammation_l || null;
      if (patch.intraop_inflammation_r !== undefined)
        H.intraop_inflammation_r = patch.intraop_inflammation_r || null;
      // ── Surgeon's operative plan ─────────────────────────────────────────
      const PL = (record.plan ??= {});
      if (patch.plan_ns_override_l !== undefined) PL.ns_override_l = patch.plan_ns_override_l;
      if (patch.plan_ns_override_r !== undefined) PL.ns_override_r = patch.plan_ns_override_r;
      if (patch.plan_hood !== undefined) PL.hood = patch.plan_hood;
      if (patch.plan_bnp !== undefined) PL.bladder_neck_preservation = patch.plan_bnp;
      if (patch.plan_sv_preservation_l !== undefined) PL.sv_preservation_l = patch.plan_sv_preservation_l;
      if (patch.plan_sv_preservation_r !== undefined) PL.sv_preservation_r = patch.plan_sv_preservation_r;
      if (patch.plan_hydrodissection_l !== undefined) PL.hydrodissection_l = patch.plan_hydrodissection_l;
      if (patch.plan_hydrodissection_r !== undefined) PL.hydrodissection_r = patch.plan_hydrodissection_r;
      const next = patients.map((x) =>
        x.id === activeId ? { ...x, record } : x,
      );
      set({ patients: next });
      get().recompute();
    },

    newCase: () => {
      const record = buildProstateRecord(defaultClinicalState(), []);
      const id = `case-${Date.now()}`;
      const entry: PatientEntry = {
        id,
        name: "New Case",
        record,
        lesionRows: [],
      };
      set({ patients: [...get().patients, entry], activeId: id });
      get().recompute();
      get().pushHistory();
    },

    importJsonFile: (text, label) => {
      const data = JSON.parse(text) as Prostate3DInputV1;
      if (data._schema !== "prostate-3d-input-v1") {
        throw new Error('Invalid schema: expected "prostate-3d-input-v1"');
      }
      data.zones = mergeZones(data.zones || {});
      const id = `import-${Date.now()}`;
      const name = label || `Imported ${id}`;
      const entry: PatientEntry = {
        id,
        name,
        record: data,
        lesionRows: ensureLesionIds((data.lesions as LesionRow[]) || []),
      };
      set({ patients: [...get().patients, entry], activeId: id });
      get().recompute();
      get().pushHistory();
    },

    exportActiveJson: () => {
      const { activeId, patients } = get();
      const p = patients.find((x) => x.id === activeId);
      if (!p) return "{}";
      const rec = { ...clone(p.record), lesions: p.lesionRows };
      const S = deriveClinicalFromLesions(
        clinicalStateFromRecord(rec),
        lesionsFromRows(p.lesionRows),
      );
      const out = buildProstateRecord(S, p.lesionRows);
      out.zones = mergeZones(p.record.zones);
      mapLesionsToZones(out.zones, p.lesionRows, S);
      return JSON.stringify(out, null, 2);
    },

    resetActiveToSeed: () => {
      const { activeId, patients } = get();
      const seed = patients.find((p) => p.id === "patient-1");
      if (!activeId || !seed) return;
      const next = patients.map((p) =>
        p.id === activeId
          ? {
              ...p,
              record: clone(seed.record),
              lesionRows: clone(seed.lesionRows),
            }
          : p,
      );
      set({ patients: next });
      get().recompute();
      get().pushHistory();
    },
  }),
);

/** Hydrate from localStorage after patients.json load */
export function hydrateFromLocalStorage(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const o = JSON.parse(raw) as {
      patients: PatientEntry[];
      activeId: string | null;
      _v?: number;
    };
    // If the stored version doesn't match the current schema version, discard
    // stale data so the fresh blank-slate default from patients.json is used.
    if ((o._v ?? 0) !== STORAGE_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    if (o.patients?.length) {
      usePatientStore.setState({
        patients: o.patients,
        activeId: o.activeId,
        loading: false,
      });
      usePatientStore.getState().recompute();
    }
  } catch {
    /* noop */
  }
}

let saveStatusResetTimer: ReturnType<typeof setTimeout> | undefined;

export function autosavePatients(): void {
  useUiStore.getState().setSaveStatus("saving");
  try {
    const { patients, activeId } = usePatientStore.getState();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ patients, activeId, _v: STORAGE_VERSION }),
    );
  } catch {
    /* noop */
  }
  clearTimeout(saveStatusResetTimer);
  saveStatusResetTimer = setTimeout(() => useUiStore.getState().setSaveStatus("saved"), 400);
}

usePatientStore.subscribe(autosavePatients);

/** Save a PatientEntry to the persistent library (used by CaseLog saves). */
export function savePatientToLibrary(entry: PatientEntry): void {
  try {
    const existing = JSON.parse(
      localStorage.getItem(PATIENT_LIBRARY_KEY) || "[]",
    ) as PatientEntry[];
    // Replace if same id exists, otherwise prepend
    const without = existing.filter((e) => e.id !== entry.id);
    localStorage.setItem(
      PATIENT_LIBRARY_KEY,
      JSON.stringify([entry, ...without]),
    );
  } catch {
    /* noop */
  }
}

/**
 * Load a single library patient into the store by id, setting it as active.
 * Uses displayName (e.g. the case notes) as the name shown in the dropdown.
 * Returns true if the library entry was found.
 */
export function loadPatientFromLibrary(id: string, displayName: string): boolean {
  try {
    const library = JSON.parse(
      localStorage.getItem(PATIENT_LIBRARY_KEY) || "[]",
    ) as PatientEntry[];
    const entry = library.find((e) => e.id === id);
    if (!entry) return false;
    const named: PatientEntry = {
      ...entry,
      name: displayName,
      record: { ...entry.record, zones: mergeZones(entry.record.zones || {}) },
      lesionRows: ensureLesionIds(entry.lesionRows || []),
    };
    const { patients } = usePatientStore.getState();
    const existing = patients.find((p) => p.id === id);
    if (existing) {
      // Update name in place and switch to it
      usePatientStore.setState({
        patients: patients.map((p) => (p.id === id ? { ...p, name: displayName } : p)),
        activeId: id,
      });
    } else {
      usePatientStore.setState({ patients: [...patients, named], activeId: id });
    }
    usePatientStore.getState().recompute();
    return true;
  } catch {
    return false;
  }
}

/**
 * Read all case log entries and add them to the store as patients so they
 * appear in the header dropdown. Uses the notes field as the display name.
 * Skips entries already present by id.
 */
export function hydratePatientsFromCaseLog(): void {
  try {
    const raw = localStorage.getItem(CASE_LOG_KEY);
    if (!raw) return;
    const cases = JSON.parse(raw) as Array<{
      id: string; date: string; notes?: string;
      psa: number; vol: number; gg: number; cores: number;
      maxcore: number; linear: number; pirads: number; laterality: string;
      gg_left: number; gg_right: number; mri_epe: number; mri_svi: number;
      mri_size: number; mri_abutment: number; mri_adc: number;
      mus_ece: number; mus_svi: number; suv: number;
      psma_ln: number; psma_svi: number;
    }>;
    if (!cases.length) return;
    const { patients } = usePatientStore.getState();
    const existingIds = new Set(patients.map((p) => p.id));
    const newOnes: PatientEntry[] = cases
      .filter((c) => !existingIds.has(c.id))
      .map((c) => {
        const name = (c.notes || "").trim() || `${c.date} — GG${c.gg} PSA ${c.psa}`;
        const zones = createDefaultZones();
        const record: Prostate3DInputV1 = {
          _schema: "prostate-3d-input-v1",
          patient: {
            age: null, psa: c.psa, psa_density: null, bmi: null,
            shim: null, ipss: null, dm: false, htn: false, cad: false,
            statin: false, smoking: "never", exercise: "moderate", pde5: false,
          },
          prostate: { volume_cc: c.vol, dimensions_cm: null, median_lobe_grade: null },
          biopsy: {
            max_grade_group: c.gg, total_positive_cores: c.cores, total_cores: null,
            max_core_involvement_pct: c.maxcore, max_linear_extent_mm: c.linear,
            max_pct_pattern45: null, has_cribriform: null, has_idc: null, has_pni: null,
            laterality: (c.laterality || "bilateral") as "right" | "left" | "bilateral",
            gg_left: c.gg_left, gg_right: c.gg_right,
            cores_left: null, cores_right: null, mc_left: null, mc_right: null,
            linear_left: null, linear_right: null, decipher_score: null,
          },
          staging: {
            epe: !!c.mri_epe, svi: !!c.mri_svi, max_pirads: c.pirads,
            max_suv: c.suv || null,
            lesion_size_cm: c.mri_size > 0 ? c.mri_size : null,
            abutment: c.mri_abutment >= 0 ? c.mri_abutment : null,
            adc_mean: c.mri_adc > 0 ? c.mri_adc : null,
            epe_mus: !!c.mus_ece, svi_mus: !!c.mus_svi,
            psma_epe: false, psma_svi: !!c.psma_svi,
            lymph_nodes_psma: c.psma_ln ? "positive" : undefined,
          },
          zones,
          lesions: [],
        };
        return { id: c.id, name, record, lesionRows: [] };
      });
    if (newOnes.length) {
      usePatientStore.setState({ patients: [...patients, ...newOnes] });
    }
  } catch {
    /* noop */
  }
}

/** Return all entries from the persistent patient library. */
export function getPatientLibrary(): PatientEntry[] {
  try {
    return JSON.parse(localStorage.getItem(PATIENT_LIBRARY_KEY) || "[]") as PatientEntry[];
  } catch {
    return [];
  }
}

/** Merge entries into the persistent patient library (replaces by id). */
export function mergePatientLibrary(entries: PatientEntry[]): void {
  try {
    const existing = getPatientLibrary();
    const byId = new Map(existing.map((e) => [e.id, e]));
    for (const e of entries) byId.set(e.id, e);
    localStorage.setItem(PATIENT_LIBRARY_KEY, JSON.stringify([...byId.values()]));
  } catch {
    /* noop */
  }
}

/** Load library patients into the store (patients not already present by id). */
export function hydratePatientLibrary(): void {
  try {
    const raw = localStorage.getItem(PATIENT_LIBRARY_KEY);
    if (!raw) return;
    const library = JSON.parse(raw) as PatientEntry[];
    if (!library.length) return;
    const { patients } = usePatientStore.getState();
    const existingIds = new Set(patients.map((p) => p.id));
    const newOnes = library
      .filter((e) => !existingIds.has(e.id))
      .map((e) => ({
        ...e,
        record: { ...e.record, zones: mergeZones(e.record.zones || {}) },
        lesionRows: ensureLesionIds(e.lesionRows || []),
      }));
    if (newOnes.length) {
      usePatientStore.setState({ patients: [...patients, ...newOnes] });
      usePatientStore.getState().recompute();
    }
  } catch {
    /* noop */
  }
}

/**
 * Upsert all library entries into the store — updates existing patients AND
 * adds new ones. Use after a cloud pull so incoming data overwrites stale local state.
 * Preserves the current display name for any patient already in the store.
 */
export function syncPatientLibraryToStore(): void {
  try {
    const raw = localStorage.getItem(PATIENT_LIBRARY_KEY);
    if (!raw) return;
    const library = JSON.parse(raw) as PatientEntry[];
    if (!library.length) return;
    const { patients } = usePatientStore.getState();
    const storeById = new Map(patients.map((p) => [p.id, p]));

    const upserted = library.map((e) => {
      const existing = storeById.get(e.id);
      return {
        ...e,
        // Keep existing display name so the dropdown label doesn't reset
        name: existing?.name ?? e.name,
        record: { ...e.record, zones: mergeZones(e.record.zones || {}) },
        lesionRows: ensureLesionIds(e.lesionRows || []),
      };
    });

    // Append any store patients that weren't in the pulled library
    const libraryIds = new Set(library.map((e) => e.id));
    const storeOnly = patients.filter((p) => !libraryIds.has(p.id));

    usePatientStore.setState({ patients: [...upserted, ...storeOnly] });
    usePatientStore.getState().recompute();
  } catch {
    /* noop */
  }
}

// URL-safe base64 (no +, /, = padding issues in hash)
function b64uEncode(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64uDecode(b64u: string): Uint8Array {
  const b64 = b64u.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function compressToB64u(str: string): Promise<string> {
  const bytes = new TextEncoder().encode(str);
  const cs = new CompressionStream("gzip");
  const writer = cs.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const chunks: Uint8Array[] = [];
  const reader = cs.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return b64uEncode(out);
}

async function decompressFromB64u(b64u: string): Promise<string> {
  const bytes = b64uDecode(b64u);
  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const chunks: Uint8Array[] = [];
  const reader = ds.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return new TextDecoder().decode(out);
}

/** Reuses (or generates and persists) the active patient's stable share id. */
function getOrCreateShareId(): { id: string; entry: PatientEntry } | null {
  const { activeId, patients } = usePatientStore.getState();
  const p = patients.find((x) => x.id === activeId);
  if (!p) return null;
  let shareId = p.record._shareId;
  if (!shareId) {
    // Persist once generated, so re-copying either link later for the same
    // case reuses the same id instead of minting a new one each time.
    shareId = crypto.randomUUID();
    const next = patients.map((x) =>
      x.id === activeId ? { ...x, record: { ...x.record, _shareId: shareId } } : x,
    );
    usePatientStore.setState({ patients: next });
    return { id: shareId, entry: { ...p, record: { ...p.record, _shareId: shareId } } };
  }
  return { id: shareId, entry: p };
}

/**
 * Clinical share link — self-contained, the whole record travels compressed
 * in the URL hash. No server dependency, works even if Turso/the Worker are
 * down. Requires clinical sign-in (Cloudflare Access) to open.
 */
export async function buildClinicalShareUrl(): Promise<string | null> {
  const found = getOrCreateShareId();
  if (!found) return null;
  const { id: shareId, entry: p } = found;
  const data = { ...p.record, _shareId: shareId, lesions: p.lesionRows };
  const encoded = await compressToB64u(JSON.stringify(data));
  return `${window.location.origin}${window.location.pathname}#case=${encoded}`;
}

/**
 * Patient share link — short (`/patient/<id>`, no hash): the record is
 * pushed to Turso (via the Cloudflare Worker proxy, see src/lib/turso.ts)
 * keyed by the same share id, and the recipient's browser fetches it by id
 * instead of decoding a giant URL. Unauthenticated by design (Cloudflare
 * Access is configured to bypass this path) — patients don't have Sinai
 * logins.
 */
export async function buildPatientShareUrl(): Promise<string | null> {
  const found = getOrCreateShareId();
  if (!found) return null;
  const { id: shareId, entry: p } = found;
  const data = { ...p.record, _shareId: shareId, lesions: p.lesionRows };
  const { saveShareCase } = await import("@/lib/turso");
  await saveShareCase(shareId, data);
  return `${window.location.origin}/patient/${shareId}`;
}

/** Applies a decoded shared record as the active patient entry. */
function applySharedRecord(data: Prostate3DInputV1): void {
  data.zones = mergeZones(data.zones || {});
  const id = data._shareId ?? `shared-${Date.now()}`;
  const lesionRows = ensureLesionIds((data.lesions as LesionRow[]) || []);
  const entry: PatientEntry = { id, name: "Shared Case", record: data, lesionRows };
  const { patients } = usePatientStore.getState();
  const existing = patients.findIndex((p) => p.id === id);
  const updated = existing >= 0
    ? patients.map((p, i) => (i === existing ? entry : p))
    : [...patients, entry];
  usePatientStore.setState({ patients: updated, activeId: id, loading: false });
  usePatientStore.getState().recompute();
}

/**
 * If the URL hash contains `#case=<encoded>`, parse it, add the patient to
 * the store as the active entry, and strip the hash from the URL.
 * Supports both gzip-compressed (new) and plain base64 (legacy) payloads.
 * This is the clinical share-link format — self-contained, no server call.
 */
export async function loadSharedCaseFromUrl(): Promise<void> {
  const match = window.location.hash.match(/^#case=(.+)$/);
  if (!match) return;
  try {
    let json: string;
    try {
      json = await decompressFromB64u(match[1]!);
    } catch {
      // Legacy plain base64 fallback
      json = new TextDecoder().decode(Uint8Array.from(atob(match[1]!), (c) => c.charCodeAt(0)));
    }
    const data = JSON.parse(json) as Prostate3DInputV1;
    if (data._schema !== "prostate-3d-input-v1") return;
    applySharedRecord(data);
    history.replaceState(null, "", window.location.pathname + window.location.search);
  } catch {
    /* malformed hash — ignore */
  }
}

/**
 * If the URL path is `/patient/<id>` with no `#case=` hash (the short
 * patient-link format — see buildPatientShareUrl), fetch that case from
 * Turso via the Worker proxy and add it as the active entry. No-op if a
 * hash is present (that path is handled by loadSharedCaseFromUrl instead)
 * or the id isn't found.
 */
export async function loadSharedCaseFromPath(): Promise<void> {
  if (window.location.hash) return;
  const match = window.location.pathname.match(/^\/patient\/([^/]+)\/?$/);
  if (!match) return;
  const id = match[1]!;
  try {
    const { loadShareCase } = await import("@/lib/turso");
    const data = await loadShareCase(id);
    if (!data || (data as Prostate3DInputV1)._schema !== "prostate-3d-input-v1") return;
    applySharedRecord(data as Prostate3DInputV1);
  } catch {
    /* Turso/Worker unreachable or malformed record — leave whatever's already loaded */
  }
}
