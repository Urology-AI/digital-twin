import { create } from "zustand";
import type { OverlayType } from "@/types/prediction";
import { VIEWS } from "@/lib/three/prostateScene";

export type DesktopTab = "input" | "predictions" | "outcomes" | "inflammation";

const WELCOME_SEEN_KEY = "compass-welcome-seen";
const TUTORIAL_TOTAL_STEPS = 8;

function readWelcomeSeen(): boolean {
  try {
    return localStorage.getItem(WELCOME_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * A link built for a patient uses the `/patient/<id>` path (not a query
 * flag) so a Cloudflare Access rule can match on it — Access matches
 * hostname/path, not query strings. Unlike the old `?view=patient` flag,
 * this path is never stripped from the URL: it needs to stay put so every
 * subsequent request (including a reload) keeps hitting a path Access is
 * configured to leave unauthenticated. Checked fresh on every load.
 */
function readPatientViewPath(): boolean {
  try {
    return window.location.pathname.startsWith("/patient/");
  } catch {
    return false;
  }
}

/**
 * The clinical app only renders under /clinical/* — Cloudflare Access
 * gates exactly this path prefix (and nothing else), so root ("/") can be
 * an open public landing page and /patient/<id> stays open too, with no
 * path-precedence ambiguity between competing Access applications.
 */
export function readClinicalPath(): boolean {
  try {
    return window.location.pathname.startsWith("/clinical");
  } catch {
    return false;
  }
}

/**
 * Secondary signal for a clinician's own in-app "preview patient view"
 * toggle, which — unlike a patient link — doesn't change the URL. Without
 * this, a clinician's page refresh while previewing would silently drop
 * back to the clinical shell. sessionStorage (not localStorage — scoped to
 * this tab, cleared when it closes) is that signal, written whenever
 * patient view is entered/left via `setPatientView`.
 */
const PATIENT_VIEW_SESSION_KEY = "compass-patient-view-session";

function readPatientViewSession(): { patientView: boolean; locked: boolean } {
  try {
    const raw = sessionStorage.getItem(PATIENT_VIEW_SESSION_KEY);
    if (!raw) return { patientView: false, locked: false };
    const parsed = JSON.parse(raw);
    return { patientView: !!parsed.patientView, locked: !!parsed.locked };
  } catch {
    return { patientView: false, locked: false };
  }
}

function writePatientViewSession(patientView: boolean, locked: boolean) {
  try {
    if (!patientView) sessionStorage.removeItem(PATIENT_VIEW_SESSION_KEY);
    else sessionStorage.setItem(PATIENT_VIEW_SESSION_KEY, JSON.stringify({ patientView, locked }));
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
  shareOpen: boolean;
  chatOpen: boolean;
  welcomeOpen: boolean;
  explainKey: string | null;
  tutorialStep: number | null;
  /** When non-null the tutorial drives the ZoneInputWizard inner tab */
  wizardTab: 1 | 2 | null;
  targetRot: { x: number; y: number };
  /** Active workspace tab — same on desktop and mobile */
  desktopTab: DesktopTab;
  /** Simplified patient-facing screen — own layout, no clinical tabs/numbers. */
  patientView: boolean;
  /**
   * True when this session arrived via a patient link (`?view=patient`) —
   * patients only ever get patient view, so "Back to clinical view" is
   * hidden. False for a clinician who toggled into patient view from within
   * their own session — they can freely switch back.
   */
  patientViewLocked: boolean;
  /** Full-screen 3D model overlay, opened on demand from within patient view. */
  patientView3DOpen: boolean;
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
  setShareOpen: (v: boolean) => void;
  setPrintReportOpen: (v: boolean) => void;
  setReferenceOpen: (v: boolean) => void;
  setCreditsOpen: (v: boolean) => void;
  setChatOpen: (v: boolean) => void;
  setWelcomeOpen: (v: boolean) => void;
  dismissWelcome: () => void;
  setExplainKey: (k: string | null) => void;
  setView: (name: keyof typeof VIEWS) => void;
  setDesktopTab: (t: DesktopTab) => void;
  setPatientView: (v: boolean) => void;
  setPatientView3DOpen: (v: boolean) => void;
  startTutorial: () => void;
  nextTutorialStep: () => void;
  prevTutorialStep: () => void;
  endTutorial: () => void;
  setWizardTab: (t: 1 | 2 | null) => void;
}

const fromPath = readPatientViewPath();
const fromSession = readPatientViewSession();
const initialPatientView = fromPath || fromSession.patientView;
const initialPatientViewLocked = fromPath || fromSession.locked;
// Keep the session fallback in sync too, so the clinician-preview path
// (sessionStorage-only, no URL signal) stays consistent.
if (fromPath) writePatientViewSession(true, true);

export const useUiStore = create<UiState>((set, get) => ({
  dark: true,
  overlay: "cancer",
  heatmapVisible: false,
  labelsVisible: true,
  lesionsOnly: false,
  infoOpen: false,
  caseLogOpen: false,
  shareOpen: false,
  printReportOpen: false,
  referenceOpen: false,
  creditsOpen: false,
  chatOpen: false,
  welcomeOpen: !readWelcomeSeen(),
  explainKey: null,
  tutorialStep: null,
  wizardTab: null,
  targetRot: { x: 0, y: 0 },
  desktopTab: "input" as DesktopTab,
  patientView: initialPatientView,
  patientViewLocked: initialPatientViewLocked,
  patientView3DOpen: false,
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
  setShareOpen: (v) => set({ shareOpen: v }),
  setPrintReportOpen: (v) => set({ printReportOpen: v }),
  setReferenceOpen: (v) => set({ referenceOpen: v }),
  setCreditsOpen: (v) => set({ creditsOpen: v }),
  setChatOpen: (v) => set({ chatOpen: v }),
  setWelcomeOpen: (v) => set({ welcomeOpen: v }),
  dismissWelcome: () => {
    try { localStorage.setItem(WELCOME_SEEN_KEY, "1"); } catch { /* private mode */ }
    set({ welcomeOpen: false });
  },
  setExplainKey: (k) => set({ explainKey: k }),
  setView: (name) => {
    const v = VIEWS[name];
    if (v) set({ targetRot: { x: v.x, y: v.y } });
  },
  setDesktopTab: (t) => set({ desktopTab: t }),
  setPatientView: (v) => {
    // A clinician's own "Switch to patient view" toggle is never locked —
    // only a link opened with ?view=patient sets patientViewLocked. Leaving
    // via "Back to clinical view" (only reachable when unlocked) clears the
    // session fallback too, so a later refresh doesn't re-enter patient view.
    const locked = v && get().patientViewLocked;
    writePatientViewSession(v, locked);
    set({ patientView: v, patientViewLocked: locked, patientView3DOpen: false });
  },
  setPatientView3DOpen: (v) => set({ patientView3DOpen: v }),
  startTutorial: () => {
    try { localStorage.setItem(WELCOME_SEEN_KEY, "1"); } catch { /* private mode */ }
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
