import { create } from "zustand";
import { createDefaultZones, createBaseThreeZones } from "@/lib/compass/constants";
import { clinicalStateFromRecord } from "@/lib/compass/clinicalFromRecord";
import { mapLesionsToZones } from "@/lib/compass/lesionZones";
import { runCompassModels } from "@/lib/compass/runCompass";
import { buildProstateRecord } from "@/lib/compass/recordFactory";
import {
  deriveClinicalFromLesions,
  lesionsFromRows,
} from "@/lib/utils/normalization";
import type { Prostate3DInputV1, ZoneMap } from "@/types/patient";
import type { LesionRow } from "@/types/lesion";
import type { CompassPredictions, ThreeZoneRuntime } from "@/types/prediction";
import { emptyLesion } from "@/types/lesion";

const STORAGE_KEY = "compass-digital-twin-state";
// Bump this version whenever the blank-slate default changes so stale
// localStorage data from previous sessions gets discarded automatically.
const STORAGE_VERSION = 3;
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
  importJsonFile: (text: string, label?: string) => void;
  exportActiveJson: () => string;
  resetActiveToSeed: () => void;
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
  recompute: () => void;
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
      const next = patients.map((x) =>
        x.id === activeId ? { ...x, record } : x,
      );
      set({ patients: next });
      get().recompute();
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

export function autosavePatients(): void {
  const { patients, activeId } = usePatientStore.getState();
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ patients, activeId, _v: STORAGE_VERSION }),
    );
  } catch {
    /* noop */
  }
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
