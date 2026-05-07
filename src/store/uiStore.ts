import { create } from "zustand";
import type { OverlayType } from "@/types/prediction";
import { VIEWS } from "@/lib/three/prostateScene";

export type DesktopTab = "input" | "predictions" | "outcomes";

const WELCOME_SEEN_KEY = "compass-welcome-seen";

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
}));
