import { create } from "zustand";
import type { OverlayType } from "@/types/prediction";
import { VIEWS } from "@/lib/three/prostateScene";

export type DesktopTab = "input" | "predictions" | "outcomes";

const WELCOME_SEEN_KEY = "compass-welcome-seen";
const TUTORIAL_TOTAL_STEPS = 8;

function readWelcomeSeen(): boolean {
  try {
    return localStorage.getItem(WELCOME_SEEN_KEY) === "1";
  } catch {
    return false;
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
  referenceOpen: boolean;
  chatOpen: boolean;
  welcomeOpen: boolean;
  explainKey: string | null;
  tutorialStep: number | null;
  /** When non-null the tutorial drives the ZoneInputWizard inner tab */
  wizardTab: 1 | 2 | null;
  targetRot: { x: number; y: number };
  /** Active workspace tab — same on desktop and mobile */
  desktopTab: DesktopTab;
  setDark: (v: boolean) => void;
  setOverlay: (o: OverlayType) => void;
  toggleHeatmap: () => void;
  toggleLabels: () => void;
  toggleLesionsOnly: () => void;
  setInfoOpen: (v: boolean) => void;
  setCaseLogOpen: (v: boolean) => void;
  setReferenceOpen: (v: boolean) => void;
  setChatOpen: (v: boolean) => void;
  setWelcomeOpen: (v: boolean) => void;
  dismissWelcome: () => void;
  setExplainKey: (k: string | null) => void;
  setView: (name: keyof typeof VIEWS) => void;
  setDesktopTab: (t: DesktopTab) => void;
  startTutorial: () => void;
  nextTutorialStep: () => void;
  prevTutorialStep: () => void;
  endTutorial: () => void;
  setWizardTab: (t: 1 | 2 | null) => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  dark: true,
  overlay: "cancer",
  heatmapVisible: false,
  labelsVisible: true,
  lesionsOnly: false,
  infoOpen: false,
  caseLogOpen: false,
  referenceOpen: false,
  chatOpen: false,
  welcomeOpen: !readWelcomeSeen(),
  explainKey: null,
  tutorialStep: null,
  wizardTab: null,
  targetRot: { x: 0, y: 0 },
  desktopTab: "input" as DesktopTab,
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
  setReferenceOpen: (v) => set({ referenceOpen: v }),
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
