import { useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ControlsOverlay } from "@/components/ControlsOverlay";
import { AppHeader } from "@/components/layout/AppHeader";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { OutcomesWorkspace } from "@/components/OutcomesWorkspace";
import { InflammationWorkspace } from "@/components/InflammationWorkspace";
import { PatientView, PatientViewHeader } from "@/components/PatientView";
import { ThreeCanvas } from "@/components/ThreeCanvas";
import { ZoneLabelsOverlay } from "@/components/ZoneLabelsOverlay";
import { OrientationBadge } from "@/components/OrientationBadge";
import { CaseLog } from "@/components/CaseLog";
import { ShareLinkModal } from "@/components/ShareLinkModal";
import { ChatWidget } from "@/components/ChatWidget";
import { InfoPanel } from "@/components/InfoPanel";
import { ReferencePanel } from "@/components/ReferencePanel";
import { PredictionPanel } from "@/components/PredictionPanel";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { PrintReportModal } from "@/components/PrintReportModal";
import { CreditsModal } from "@/components/CreditsModal";
import { ZoneInputWizard } from "@/components/ZoneInputWizard";
import { PREDICTION_EXPLANATIONS } from "@/lib/compass/explainPrediction";
import {
  deriveClinicalFromLesions,
  lesionsFromRows,
} from "@/lib/utils/normalization";
import { clinicalStateFromRecord } from "@/lib/compass/clinicalFromRecord";
import patientsCatalog from "@/data/patients.json";
import {
  hydrateFromLocalStorage,
  hydratePatientsFromCaseLog,
  hydratePatientLibrary,
  loadSharedCaseFromPath,
  loadSharedCaseFromUrl,
  usePatientStore,
} from "@/store/patientStore";
import { useUiStore, readClinicalPath } from "@/store/uiStore";
import { PublicLandingPage } from "@/components/PublicLandingPage";
import { cn } from "@/lib/utils";

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
  const psadValid = isFinite(S.psad) && S.psad > 0;
  return (
    <div className="pointer-events-none absolute left-2 z-10 rounded-lg border border-border/60 bg-black/75 px-2.5 py-1.5 text-[10px] text-muted-foreground backdrop-blur sm:px-3 sm:py-2 sm:text-[11px] max-lg:top-2 lg:bottom-3 lg:left-3">
      <span className="font-semibold text-primary">{vol} cc</span>
      {d && (
        <>
          {" "}
          | {d.ap} × {d.transverse} × {d.cc} cm{" "}
          <span className="hidden opacity-70 sm:inline">(AP × TR × CC)</span>
        </>
      )}
      {psadValid && (
        <> {" | "}PSAD <span className="text-primary">{S.psad.toFixed(3)}</span></>
      )}
    </div>
  );
}

export default function App() {
  const bootstrapFromJson = usePatientStore((s) => s.bootstrapFromJson);
  const infoOpen = useUiStore((s) => s.infoOpen);
  const setInfoOpen = useUiStore((s) => s.setInfoOpen);
  const caseLogOpen = useUiStore((s) => s.caseLogOpen);
  const setCaseLogOpen = useUiStore((s) => s.setCaseLogOpen);
  const shareOpen = useUiStore((s) => s.shareOpen);
  const setShareOpen = useUiStore((s) => s.setShareOpen);
  const referenceOpen = useUiStore((s) => s.referenceOpen);
  const setReferenceOpen = useUiStore((s) => s.setReferenceOpen);
  const explainKey = useUiStore((s) => s.explainKey);
  const setExplainKey = useUiStore((s) => s.setExplainKey);
  const welcomeOpen = useUiStore((s) => s.welcomeOpen);
  const creditsOpen = useUiStore((s) => s.creditsOpen);
  const setCreditsOpen = useUiStore((s) => s.setCreditsOpen);
  const dark = useUiStore((s) => s.dark);
  const desktopTab = useUiStore((s) => s.desktopTab);
  const patientView = useUiStore((s) => s.patientView);

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
    // Load saved library entries (full records) then fall back to case log snapshots.
    hydratePatientLibrary();
    hydratePatientsFromCaseLog();
    // Load a case embedded in the URL hash (clinical share links), or — if
    // there's no hash — fetch it from Turso by the /patient/<id> path (short
    // patient links). The path itself is deliberately left in place either
    // way — see readPatientViewPath in uiStore for why.
    void loadSharedCaseFromUrl();
    void loadSharedCaseFromPath();
  }, [bootstrapFromJson]);

  const onPredictions = desktopTab === "predictions";
  const patientView3DOpen = useUiStore((s) => s.patientView3DOpen);
  const setPatientView3DOpen = useUiStore((s) => s.setPatientView3DOpen);

  // Root ("/") is the only path with no Access application on it, so it
  // must stay a plain public landing page — the full clinical shell only
  // renders under /clinical (Access-gated) or for a patient link.
  if (!patientView && !readClinicalPath()) {
    return <PublicLandingPage />;
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-background">
      {patientView ? <PatientViewHeader /> : <AppHeader />}

      {/*
        Single content area — ThreeCanvas mounted once here so the WebGL context
        is never destroyed when switching tabs or workspaces. The canvas wrapper
        resizes (instead of remounts) when the active tab changes.
      */}
      <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">

        {/* ── ThreeCanvas background (always mounted, z-0) ──────────────── */}
        {/*
          Default: full-screen (covered by panels on input/outcomes/patient-view).
          Predictions tab: right half desktop / bottom half mobile.
          Patient view + "View 3D model" open: full-screen fixed overlay, above everything.
        */}
        <div
          className={cn(
            "bg-muted/20",
            patientView && patientView3DOpen
              ? "fixed inset-0 z-40"
              : cn("absolute inset-0 z-0", onPredictions && "lg:left-1/2", onPredictions && "max-lg:top-[42%]"),
          )}
        >
          <div className="absolute inset-0 min-h-0 min-w-0" data-tutorial="three-canvas">
            <ThreeCanvas />
          </div>
          {/* Controls/labels: visible on the predictions tab (clinical view only) */}
          <div className={cn((!onPredictions || patientView) && "hidden")}>
            <ControlsOverlay />
            <ZoneLabelsOverlay />
            <OrientationBadge />
            <DimOverlay />
          </div>
          {patientView && patientView3DOpen && (
            <>
              <OrientationBadge />
              <Button
                variant="secondary"
                size="sm"
                className="absolute right-4 top-4 z-50 gap-1.5 shadow-lg"
                onClick={() => setPatientView3DOpen(false)}
              >
                <X className="h-4 w-4" /> Close 3D model
              </Button>
              <div className="pointer-events-none absolute inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4">
                <div className="flex items-center gap-2 rounded-lg bg-black/70 px-3 py-1.5 text-xs text-white/90 backdrop-blur">
                  <span className="h-2 w-6 rounded-full" style={{ background: "linear-gradient(to right,#22c55e,#eab308,#ef4444)" }} />
                  <span>Lower risk</span>
                  <span className="mx-1 text-white/40">→</span>
                  <span>Higher risk</span>
                </div>
                <div className="rounded-lg bg-black/70 px-4 py-2.5 text-center text-sm text-white/90 backdrop-blur">
                  This is a 3D model of your prostate, colored by cancer risk, built from your own scan measurements. Drag to rotate.
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Input tab ────────────────────────────────────────────────── */}
        <div
          className={cn(
            "absolute inset-0 z-10 overflow-hidden bg-background",
            !patientView && desktopTab === "input" ? "flex flex-col" : "hidden",
          )}
        >
          <ZoneInputWizard />
        </div>

        {/* ── Predictions tab: PredictionPanel (left/top) | 3D (right/bottom) */}
        <div
          className={cn(
            "absolute z-10 overflow-y-auto overflow-x-hidden overscroll-contain bg-background app-scroll px-5 py-5",
            !patientView && onPredictions ? "block" : "hidden",
            // Desktop: left half. Mobile: top half.
            "lg:left-0 lg:right-1/2 lg:top-0 lg:bottom-0",
            "max-lg:top-0 max-lg:bottom-[58%] max-lg:left-0 max-lg:right-0",
          )}
        >
          <PredictionPanel />
        </div>

        {/* ── Outcomes tab: full-width split workspace ──────────────────── */}
        <div
          className={cn(
            "absolute inset-0 z-10 overflow-hidden bg-background",
            !patientView && desktopTab === "outcomes" ? "flex" : "hidden",
          )}
        >
          <OutcomesWorkspace />
        </div>

        {/* ── Experimental tab: standalone inflammation research instrument ── */}
        <div
          className={cn(
            "absolute inset-0 z-10 overflow-hidden bg-background",
            !patientView && desktopTab === "inflammation" ? "flex" : "hidden",
          )}
        >
          <InflammationWorkspace />
        </div>

        {/* ── Patient view: full-width Inputs | Recovery, 3D model behind a button ── */}
        <div
          className={cn(
            "absolute inset-0 z-10 overflow-hidden bg-background",
            patientView ? "block" : "hidden",
          )}
        >
          <PatientView />
        </div>

      </div>

      {!patientView && <MobileTabBar />}

      {/* Desktop-only footer */}
      <footer className="hidden lg:flex h-7 shrink-0 items-center justify-end gap-3 border-t border-border/50 bg-card/60 px-4">
        <span className="text-[10px] text-muted-foreground/50">
          COMPASS · Tewari Lab · Mount Sinai · Research Use Only
        </span>
        <button
          type="button"
          onClick={() => setReferenceOpen(true)}
          className="rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/70 hover:bg-muted/70 hover:text-foreground transition-colors"
        >
          Reference
        </button>
        <button
          type="button"
          onClick={() => setCreditsOpen(true)}
          className="rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/70 hover:bg-muted/70 hover:text-foreground transition-colors"
        >
          Credits
        </button>
      </footer>

      <ChatWidget />

      {infoOpen && (
        <InfoPanel onClose={() => setInfoOpen(false)} />
      )}

      {caseLogOpen && (
        <CaseLog onClose={() => setCaseLogOpen(false)} />
      )}

      {shareOpen && (
        <ShareLinkModal onClose={() => setShareOpen(false)} />
      )}

      {referenceOpen && (
        <ReferencePanel modal onClose={() => setReferenceOpen(false)} />
      )}

      {/* Welcome screen and tutorial are clinical-onboarding UI — "Take the
          Tour" drives desktopTab, which is hidden behind patient view, so
          both are suppressed there rather than left to dead-end. */}
      {welcomeOpen && !patientView && <WelcomeScreen />}
      {creditsOpen && <CreditsModal onClose={() => setCreditsOpen(false)} />}
      {!patientView && <TutorialOverlay />}
      <PrintReportModal />

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
