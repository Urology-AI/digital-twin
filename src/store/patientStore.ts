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
          JSON.stringify({ patients, activeId: first }),
        );
      } catch {
        /* private mode */
      }
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
