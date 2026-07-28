/**
 * Standalone store for the side-specific ECE / periprostatic-inflammation
 * research instrument. Deliberately independent of `patientStore` — this
 * prototype has its own localStorage key and its own export format, and is
 * not part of the `Prostate3DInputV1` schema. Nothing here bumps
 * `STORAGE_VERSION` or touches the main case library.
 */
import { create } from "zustand";
import {
  emptyPatientInput,
  emptySideInput,
  inflammationConfigSchema,
  patientInflammationInputSchema,
  sideInflammationInputSchema,
  type InflammationConfig,
  type PatientInflammationInput,
  type SideInflammationInput,
} from "@/types/inflammation";
import { DEFAULT_INFLAMMATION_CONFIG, OUTCOME_KEYS } from "@/lib/inflammation/model";

const STORAGE_KEY = "compass-ppi-standalone-v1";

interface InflammationStoreState {
  patient: PatientInflammationInput;
  sides: { L: SideInflammationInput; R: SideInflammationInput };
  cfg: InflammationConfig;
  isCustomCfg: boolean;
  setPatientField: <K extends keyof PatientInflammationInput>(
    field: K,
    value: PatientInflammationInput[K],
  ) => void;
  setSideField: <K extends keyof SideInflammationInput>(
    side: "L" | "R",
    field: K,
    value: SideInflammationInput[K],
  ) => void;
  /** Copies all non-outcome fields from one side to the other; each side's own ground-truth fields are left untouched. */
  mirrorSide: (from: "L" | "R", to: "L" | "R") => void;
  /** Validates `cfg` against `inflammationConfigSchema` before applying it. */
  applyCfgJson: (raw: string) => { ok: true } | { ok: false; error: string };
  resetCfg: () => void;
  clearAll: () => void;
  /** Validates the loaded case against the input schemas before applying it. */
  loadState: (raw: unknown) => { ok: true } | { ok: false; error: string };
}

type Persisted = Pick<InflammationStoreState, "patient" | "sides" | "cfg" | "isCustomCfg">;

function persist(state: Persisted) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode / quota */
  }
}

// Backfill fields added after a case was persisted (old localStorage payloads
// predate them, so plain object values would otherwise be `undefined` instead
// of `null` and slip past the model's `!== null` checks) — then validate, so
// a corrupted or hand-edited value fails loudly here instead of crashing
// mid-calculation later.
const patientDefaults = emptyPatientInput();
const sideDefaults = emptySideInput();

function loadPersisted(): Persisted {
  const fallback: Persisted = {
    patient: patientDefaults,
    sides: { L: sideDefaults, R: sideDefaults },
    cfg: DEFAULT_INFLAMMATION_CONFIG,
    isCustomCfg: false,
  };
  let raw: unknown;
  try {
    const item = localStorage.getItem(STORAGE_KEY);
    if (!item) return fallback;
    raw = JSON.parse(item);
  } catch {
    return fallback;
  }
  const r = raw as Partial<Persisted> | null;

  const patientParsed = patientInflammationInputSchema.safeParse({ ...patientDefaults, ...r?.patient });
  if (!patientParsed.success) console.warn("Discarding corrupted persisted PPI patient data:", patientParsed.error.message);

  const lSide = { ...sideDefaults, ...r?.sides?.L };
  const rSide = { ...sideDefaults, ...r?.sides?.R };
  const lParsed = sideInflammationInputSchema.safeParse(lSide);
  const rParsed = sideInflammationInputSchema.safeParse(rSide);
  if (!lParsed.success) console.warn("Discarding corrupted persisted PPI left-side data:", lParsed.error.message);
  if (!rParsed.success) console.warn("Discarding corrupted persisted PPI right-side data:", rParsed.error.message);

  const cfgParsed = inflammationConfigSchema.safeParse(r?.cfg);
  if (r?.cfg && !cfgParsed.success) console.warn("Discarding corrupted persisted PPI coefficients:", cfgParsed.error.message);

  return {
    patient: patientParsed.success ? patientParsed.data : patientDefaults,
    sides: {
      L: lParsed.success ? lParsed.data : sideDefaults,
      R: rParsed.success ? rParsed.data : sideDefaults,
    },
    cfg: cfgParsed.success ? cfgParsed.data : DEFAULT_INFLAMMATION_CONFIG,
    isCustomCfg: cfgParsed.success ? Boolean(r?.isCustomCfg) : false,
  };
}

const persisted = loadPersisted();

export const useInflammationStore = create<InflammationStoreState>((set, get) => ({
  patient: persisted.patient,
  sides: persisted.sides,
  cfg: persisted.cfg,
  isCustomCfg: persisted.isCustomCfg,
  setPatientField: (field, value) => {
    const next = { ...get().patient, [field]: value };
    set({ patient: next });
    persist({ patient: next, sides: get().sides, cfg: get().cfg, isCustomCfg: get().isCustomCfg });
  },
  setSideField: (side, field, value) => {
    const nextSide = { ...get().sides[side], [field]: value };
    const nextSides = { ...get().sides, [side]: nextSide };
    set({ sides: nextSides });
    persist({ patient: get().patient, sides: nextSides, cfg: get().cfg, isCustomCfg: get().isCustomCfg });
  },
  mirrorSide: (from, to) => {
    if (from === to) return;
    const source = get().sides[from];
    const target = get().sides[to];
    const nextTarget = { ...target };
    for (const [k, v] of Object.entries(source)) {
      if (!OUTCOME_KEYS.has(k)) (nextTarget as Record<string, unknown>)[k] = v;
    }
    const nextSides = { ...get().sides, [to]: nextTarget };
    set({ sides: nextSides });
    persist({ patient: get().patient, sides: nextSides, cfg: get().cfg, isCustomCfg: get().isCustomCfg });
  },
  applyCfgJson: (raw) => {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch (err) {
      return { ok: false, error: `Could not parse JSON: ${err instanceof Error ? err.message : String(err)}` };
    }
    const result = inflammationConfigSchema.safeParse(parsedJson);
    if (!result.success) {
      return { ok: false, error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
    }
    set({ cfg: result.data, isCustomCfg: true });
    persist({ patient: get().patient, sides: get().sides, cfg: result.data, isCustomCfg: true });
    return { ok: true };
  },
  resetCfg: () => {
    set({ cfg: DEFAULT_INFLAMMATION_CONFIG, isCustomCfg: false });
    persist({ patient: get().patient, sides: get().sides, cfg: DEFAULT_INFLAMMATION_CONFIG, isCustomCfg: false });
  },
  clearAll: () => {
    const patient = emptyPatientInput();
    const sides = { L: emptySideInput(), R: emptySideInput() };
    set({ patient, sides });
    persist({ patient, sides, cfg: get().cfg, isCustomCfg: get().isCustomCfg });
  },
  loadState: (raw) => {
    const r = raw as { patient?: unknown; sides?: { L?: unknown; R?: unknown } } | null;
    if (!r?.patient || !r.sides?.L || !r.sides?.R) {
      return { ok: false, error: "File does not match the expected { patient, sides: { L, R } } shape." };
    }
    const patientParsed = patientInflammationInputSchema.safeParse({ ...patientDefaults, ...(r.patient as object) });
    const lParsed = sideInflammationInputSchema.safeParse({ ...sideDefaults, ...(r.sides.L as object) });
    const rParsed = sideInflammationInputSchema.safeParse({ ...sideDefaults, ...(r.sides.R as object) });
    const firstError = [patientParsed, lParsed, rParsed].find((p) => !p.success);
    if (firstError && !firstError.success) {
      return { ok: false, error: firstError.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
    }
    if (!patientParsed.success || !lParsed.success || !rParsed.success) {
      return { ok: false, error: "Could not validate the loaded case." };
    }
    const nextPatient = patientParsed.data;
    const nextSides = { L: lParsed.data, R: rParsed.data };
    set({ patient: nextPatient, sides: nextSides });
    persist({ patient: nextPatient, sides: nextSides, cfg: get().cfg, isCustomCfg: get().isCustomCfg });
    return { ok: true };
  },
}));
