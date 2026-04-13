import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ClinicalWorkspace } from "@/components/ClinicalWorkspace";
import { ControlsOverlay } from "@/components/ControlsOverlay";
import { InsightsWorkspace } from "@/components/InsightsWorkspace";
import { AppHeader } from "@/components/layout/AppHeader";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { SidePanel } from "@/components/SidePanel";
import { ThreeCanvas } from "@/components/ThreeCanvas";
import { ZoneLabelsOverlay } from "@/components/ZoneLabelsOverlay";
import { CaseLog } from "@/components/CaseLog";
import { InfoPanel } from "@/components/InfoPanel";
import { ReferencePanel } from "@/components/ReferencePanel";
import { PREDICTION_EXPLANATIONS } from "@/lib/compass/explainPrediction";
import {
  deriveClinicalFromLesions,
  lesionsFromRows,
} from "@/lib/utils/normalization";
import { clinicalStateFromRecord } from "@/lib/compass/clinicalFromRecord";
import patientsCatalog from "@/data/patients.json";
import {
  hydrateFromLocalStorage,
  usePatientStore,
} from "@/store/patientStore";
import { useUiStore } from "@/store/uiStore";
import { cn } from "@/lib/utils";

/** Offset above mobile tab bar (h-16) + safe area */
const MOBILE_CHROME_BOTTOM =
  "max-lg:bottom-[calc(0.75rem+4rem+env(safe-area-inset-bottom,0px))]";

function DimOverlay() {
  const patients = usePatientStore((s) => s.patients);
  const activeId = usePatientStore((s) => s.activeId);
  const entry = patients.find((p) => p.id === activeId);
  if (!entry) return null;
  const rec = { ...entry.record, lesions: entry.lesionRows };
  const S = deriveClinicalFromLesions(
    clinicalStateFromRecord(rec),
    lesionsFromRows(entry.lesionRows),
  );
  const vol = entry.record.prostate.volume_cc ?? S.vol;
  const d = entry.record.prostate.dimensions_cm;
  return (
    <div
      className={cn(
        "pointer-events-none absolute left-2 z-10 rounded-lg border border-border/60 bg-black/75 px-2.5 py-1.5 text-[10px] text-muted-foreground backdrop-blur sm:px-3 sm:py-2 sm:text-[11px] lg:bottom-3 lg:left-3",
        MOBILE_CHROME_BOTTOM,
      )}
    >
      <span className="font-semibold text-primary">{vol} cc</span>
      {d && (
        <>
          {" "}
          | {d.ap} × {d.transverse} × {d.cc} cm{" "}
          <span className="hidden opacity-70 sm:inline">(AP × TR × CC)</span>
        </>
      )}
      {" | "}
      PSAD <span className="text-primary">{S.psad.toFixed(3)}</span>
    </div>
  );
}

export default function App() {
  const bootstrapFromJson = usePatientStore((s) => s.bootstrapFromJson);
  const infoOpen = useUiStore((s) => s.infoOpen);
  const setInfoOpen = useUiStore((s) => s.setInfoOpen);
  const caseLogOpen = useUiStore((s) => s.caseLogOpen);
  const setCaseLogOpen = useUiStore((s) => s.setCaseLogOpen);
  const referenceOpen = useUiStore((s) => s.referenceOpen);
  const setReferenceOpen = useUiStore((s) => s.setReferenceOpen);
  const explainKey = useUiStore((s) => s.explainKey);
  const setExplainKey = useUiStore((s) => s.setExplainKey);
  const dark = useUiStore((s) => s.dark);
  const mobileWorkspace = useUiStore((s) => s.mobileWorkspace);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    hydrateFromLocalStorage();
    const st = usePatientStore.getState();
    if (st.patients.length === 0) {
      bootstrapFromJson(
        patientsCatalog.patients as {
          id: string;
          name: string;
          record: import("@/types/patient").Prostate3DInputV1;
        }[],
      );
    } else {
      st.recompute();
      usePatientStore.setState({ loading: false });
    }
  }, [bootstrapFromJson]);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-background">
      <AppHeader />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <SidePanel />

        <main className="relative flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
          {/*
            Viewer stays mounted with real dimensions on small screens (absolute fill)
            so WebGL resize/orbit/zoom keep working when switching Data / Results / 3D tabs.
          */}
          <div
            className={cn(
              "relative z-0 min-h-0 min-w-0 w-full flex-1 bg-muted/20",
              "max-lg:absolute max-lg:inset-0",
              "lg:relative lg:flex lg:min-h-0",
            )}
          >
            <div className="absolute inset-0 min-h-0 min-w-0">
              <ThreeCanvas />
            </div>
            <ControlsOverlay />
            <ZoneLabelsOverlay />
            <DimOverlay />
          </div>

          <div
            className={cn(
              "relative z-10 min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden overscroll-contain bg-muted/20 app-scroll dark:bg-background",
              "max-lg:absolute max-lg:inset-0",
              mobileWorkspace === "insights" ? "max-lg:flex max-lg:flex-col" : "max-lg:hidden",
              "lg:hidden",
            )}
          >
            <InsightsWorkspace />
          </div>

          <div
            className={cn(
              "relative z-10 min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden overscroll-contain bg-muted/20 app-scroll dark:bg-background",
              "max-lg:absolute max-lg:inset-0",
              mobileWorkspace === "clinical" ? "max-lg:flex max-lg:flex-col" : "max-lg:hidden",
              "lg:hidden",
            )}
          >
            <ClinicalWorkspace compact />
          </div>

          {/* Reference tab — mobile only */}
          <div
            className={cn(
              "relative z-10 min-h-0 w-full flex-1",
              "max-lg:absolute max-lg:inset-0",
              mobileWorkspace === "reference" ? "max-lg:flex max-lg:flex-col" : "max-lg:hidden",
              "lg:hidden",
            )}
          >
            {mobileWorkspace === "reference" && <ReferencePanel />}
          </div>
        </main>
      </div>

      <MobileTabBar />

      {infoOpen && (
        <InfoPanel onClose={() => setInfoOpen(false)} />
      )}

      {caseLogOpen && (
        <CaseLog onClose={() => setCaseLogOpen(false)} />
      )}

      {referenceOpen && (
        <ReferencePanel modal onClose={() => setReferenceOpen(false)} />
      )}

      {explainKey && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[70vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card p-5 shadow-xl">
            <div className="mb-2 text-sm font-semibold text-primary">
              Explain prediction
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {PREDICTION_EXPLANATIONS[explainKey] ?? "No description."}
            </p>
            <Button
              type="button"
              className="mt-4"
              variant="secondary"
              onClick={() => setExplainKey(null)}
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
