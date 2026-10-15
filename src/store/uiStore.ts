import { create } from "zustand";
import type { OverlayType } from "@/types/prediction";
import { VIEWS } from "@/lib/three/prostateScene";
import { isDemoMode } from "@/lib/demoMode";
import { isOfflineBuild } from "@/lib/offlineBuild";

export type DesktopTab = "input" | "predictions" | "outcomes" | "plan";

const WELCOME_SEEN_KEY = "compass-welcome-seen";
const TUTORIAL_TOTAL_STEPS = 8;

function readWelcomeSeen(): boolean {
  try {
    return localStorage.getItem(WELCOME_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

const PATIENT_LANG_KEY = "compass-patient-lang";
function readPatientLang(): "en" | "es" {
  try { return !isDemoMode() && localStorage.getItem(PATIENT_LANG_KEY) === "es" ? "es" : "en"; } catch { return "en"; }
}

/** Tabs of patient mode (see PatientView.tsx). */
export type PatientTab = "case" | "surgery" | "factors" | "prep";

/**
 * Signal for a clinician's in-app "preview patient view" toggle, which
 * doesn't change the URL. Without this, a page refresh while previewing
 * would silently drop back to the clinical shell. sessionStorage (not
 * localStorage — scoped to this tab, cleared when it closes) is that signal,
 * written whenever patient view is entered/left via `setPatientView`.
 */
const PATIENT_VIEW_SESSION_KEY = "compass-patient-view-session";

function readPatientViewSession(): boolean {
  try {
    const raw = sessionStorage.getItem(PATIENT_VIEW_SESSION_KEY);
    return raw ? !!JSON.parse(raw).patientView : false;
  } catch {
    return false;
  }
}

function writePatientViewSession(patientView: boolean) {
  try {
    if (!patientView) sessionStorage.removeItem(PATIENT_VIEW_SESSION_KEY);
    else sessionStorage.setItem(PATIENT_VIEW_SESSION_KEY, JSON.stringify({ patientView }));
  } catch {
    /* private mode */
  }
}

interface UiState {
  dark: boolean;
  overlay: OverlayType;
  heatmapVisible: boolean;
  labelsVisible: boolean;
  lesionsOnly: boolean;
  infoOpen: boolean;
  caseLogOpen: boolean;
  printReportOpen: boolean;
  referenceOpen: boolean;
  creditsOpen: boolean;
  welcomeOpen: boolean;
  explainKey: string | null;
  tutorialStep: number | null;
  /** When non-null the tutorial drives the ZoneInputWizard inner tab */
  wizardTab: 1 | 2 | null;
  targetRot: { x: number; y: number };
  /** Active workspace tab — same on desktop and mobile */
  desktopTab: DesktopTab;
  /** Overview mode: every tab renders its key points instead of full detail. */
  overview: boolean;
  /** Simplified patient-facing screen — own layout, no clinical tabs/numbers. */
  patientView: boolean;
  /** Full-screen 3D model overlay, opened on demand from within patient view. */
  patientView3DOpen: boolean;
  /** which patient-mode tab is showing */
  patientTab: PatientTab;
  /** patient-mode language (English / Spanish) */
  patientLang: "en" | "es";
  /** Full-screen presenter overlay — big-type highlight of ECE/SVI/potency/continence for showing to a patient or in a meeting. */
  presenterView: boolean;
  /** Local autosave status, shown as a header dot — reflects localStorage writes only, not cloud sync. */
  saveStatus: "saving" | "saved";
  setSaveStatus: (v: "saving" | "saved") => void;
  setDark: (v: boolean) => void;
  setOverlay: (o: OverlayType) => void;
  toggleHeatmap: () => void;
  toggleLabels: () => void;
  toggleLesionsOnly: () => void;
  setInfoOpen: (v: boolean) => void;
  setCaseLogOpen: (v: boolean) => void;
  setPrintReportOpen: (v: boolean) => void;
  setReferenceOpen: (v: boolean) => void;
  setCreditsOpen: (v: boolean) => void;
  setWelcomeOpen: (v: boolean) => void;
  dismissWelcome: () => void;
  setExplainKey: (k: string | null) => void;
  setView: (name: keyof typeof VIEWS) => void;
  setDesktopTab: (t: DesktopTab) => void;
  setOverview: (v: boolean) => void;
  setPatientView: (v: boolean) => void;
  setPatientView3DOpen: (v: boolean) => void;
  setPatientTab: (t: PatientTab) => void;
  setPatientLang: (l: "en" | "es") => void;
  setPresenterView: (v: boolean) => void;
  startTutorial: () => void;
  nextTutorialStep: () => void;
  prevTutorialStep: () => void;
  endTutorial: () => void;
  setWizardTab: (t: 1 | 2 | null) => void;
}

const initialPatientView = readPatientViewSession();

export const useUiStore = create<UiState>((set, get) => ({
  dark: true,
  overlay: "cancer",
  heatmapVisible: false,
  labelsVisible: true,
  lesionsOnly: false,
  infoOpen: false,
  caseLogOpen: false,
  printReportOpen: false,
  referenceOpen: false,
  creditsOpen: false,
  // The offline app skips the welcome/tour and opens straight into the workspace.
  welcomeOpen: !isOfflineBuild() && !readWelcomeSeen(),
  explainKey: null,
  tutorialStep: null,
  wizardTab: null,
  targetRot: { x: 0, y: 0 },
  desktopTab: "input" as DesktopTab,
  overview: false,
  patientView: initialPatientView,
  patientView3DOpen: false,
  patientTab: "case",
  patientLang: readPatientLang(),
  presenterView: false,
  saveStatus: "saved",
  setSaveStatus: (v) => set({ saveStatus: v }),
  setDark: (v) => {
    set({ dark: v });
    document.documentElement.classList.toggle("dark", v);
  },
  setOverlay: (o) => set({ overlay: o }),
  toggleHeatmap: () => set({ heatmapVisible: !get().heatmapVisible }),
  toggleLabels: () => set({ labelsVisible: !get().labelsVisible }),
  toggleLesionsOnly: () => set({ lesionsOnly: !get().lesionsOnly }),
  setInfoOpen: (v) => set({ infoOpen: v }),
  setCaseLogOpen: (v) => set({ caseLogOpen: v }),
  setPrintReportOpen: (v) => set({ printReportOpen: v }),
  setReferenceOpen: (v) => set({ referenceOpen: v }),
  setCreditsOpen: (v) => set({ creditsOpen: v }),
  setWelcomeOpen: (v) => set({ welcomeOpen: v }),
  dismissWelcome: () => {
    try { if (!isDemoMode()) localStorage.setItem(WELCOME_SEEN_KEY, "1"); } catch { /* private mode */ }
    set({ welcomeOpen: false });
  },
  setExplainKey: (k) => set({ explainKey: k }),
  setView: (name) => {
    const v = VIEWS[name];
    if (v) set({ targetRot: { x: v.x, y: v.y } });
  },
  setDesktopTab: (t) => set({ desktopTab: t }),
  setOverview: (v) => set({ overview: v }),
  setPatientView: (v) => {
    // Leaving via "Back to clinical view" clears the session flag too, so a
    // later refresh doesn't re-enter patient view.
    writePatientViewSession(v);
    set({ patientView: v, patientView3DOpen: false });
  },
  setPatientView3DOpen: (v) => set({ patientView3DOpen: v }),
  setPatientTab: (t) => set({ patientTab: t, patientView3DOpen: false }),
  setPatientLang: (l) => {
    // A per-viewer convenience, not case data — but the public demo keeps nothing.
    try { if (!isDemoMode()) localStorage.setItem(PATIENT_LANG_KEY, l); } catch { /* private mode */ }
    set({ patientLang: l });
  },
  setPresenterView: (v) => set({ presenterView: v }),
  startTutorial: () => {
    try { if (!isDemoMode()) localStorage.setItem(WELCOME_SEEN_KEY, "1"); } catch { /* private mode */ }
    set({ tutorialStep: 0, welcomeOpen: false, desktopTab: "input", wizardTab: null });
  },
  nextTutorialStep: () => {
    const { tutorialStep } = get();
    if (tutorialStep === null) return;
    const next = tutorialStep + 1;
    if (next >= TUTORIAL_TOTAL_STEPS) {
      set({ tutorialStep: null, wizardTab: null });
      return;
    }
    const tabForStep: Record<number, DesktopTab> = {
      0: "input", 1: "input", 2: "input", 3: "input",
      4: "predictions", 5: "predictions", 6: "predictions", 7: "outcomes",
    };
    const wizardTabForStep: Record<number, 1 | 2 | null> = {
      2: 1, 3: 2,
    };
    set({
      tutorialStep: next,
      desktopTab: tabForStep[next] ?? get().desktopTab,
      wizardTab: wizardTabForStep[next] ?? null,
    });
  },
  prevTutorialStep: () => {
    const { tutorialStep } = get();
    if (tutorialStep === null || tutorialStep === 0) return;
    const prev = tutorialStep - 1;
    const tabForStep: Record<number, DesktopTab> = {
      0: "input", 1: "input", 2: "input", 3: "input",
      4: "predictions", 5: "predictions", 6: "predictions", 7: "outcomes",
    };
    const wizardTabForStep: Record<number, 1 | 2 | null> = {
      2: 1, 3: 2,
    };
    set({
      tutorialStep: prev,
      desktopTab: tabForStep[prev] ?? get().desktopTab,
      wizardTab: wizardTabForStep[prev] ?? null,
    });
  },
  endTutorial: () => set({ tutorialStep: null, wizardTab: null }),
  setWizardTab: (t) => set({ wizardTab: t }),
}));
