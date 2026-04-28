import { create } from "zustand";
import type { OverlayType } from "@/types/prediction";
import { VIEWS } from "@/lib/three/prostateScene";

export type MobileWorkspace = "viewer" | "insights" | "clinical" | "reference" | "outcomes";
export type DesktopTab = "input" | "viewer" | "predictions";

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
  explainKey: string | null;
  targetRot: { x: number; y: number };
  /** Below lg breakpoint: which full-screen panel is shown */
  mobileWorkspace: MobileWorkspace;
  /** Above lg breakpoint: which full-screen desktop tab is shown */
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
  setExplainKey: (k: string | null) => void;
  setView: (name: keyof typeof VIEWS) => void;
  setMobileWorkspace: (w: MobileWorkspace) => void;
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
  explainKey: null,
  targetRot: { x: 0, y: 0 },
  mobileWorkspace: "clinical",
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
  setExplainKey: (k) => set({ explainKey: k }),
  setView: (name) => {
    const v = VIEWS[name];
    if (v) set({ targetRot: { x: v.x, y: v.y } });
  },
  setMobileWorkspace: (w) => set({ mobileWorkspace: w }),
  setDesktopTab: (t) => set({ desktopTab: t }),
}));
