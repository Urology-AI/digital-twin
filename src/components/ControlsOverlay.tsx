import { ChevronDown, ChevronUp, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { emitZoomNudge } from "@/lib/three/zoomBridge";
import { usePatientStore } from "@/store/patientStore";
import { useUiStore } from "@/store/uiStore";
import {
  deriveClinicalFromLesions,
  lesionsFromRows,
} from "@/lib/utils/normalization";
import { clinicalStateFromRecord } from "@/lib/compass/clinicalFromRecord";
import { printReport } from "@/lib/printReport";
import type { OverlayType } from "@/types/prediction";
import { cn } from "@/lib/utils";

const VIEWS = [
  { id: "anterior", label: "Ant" },
  { id: "posterior", label: "Post" },
  { id: "base", label: "Base" },
  { id: "apex", label: "Apex" },
  { id: "left", label: "Left" },
  { id: "right", label: "Right" },
] as const;

const OVERLAYS: { id: OverlayType; label: string; activeColor: string }[] = [
  { id: "cancer", label: "csPCa", activeColor: "text-red-400 border-red-500/60 bg-red-500/10" },
  { id: "ece", label: "ECE", activeColor: "text-amber-400 border-amber-500/60 bg-amber-500/10" },
  { id: "svi", label: "SVI", activeColor: "text-purple-400 border-purple-500/60 bg-purple-500/10" },
  { id: "psm", label: "PSM", activeColor: "text-sky-400 border-sky-500/60 bg-sky-500/10" },
];

const LEGEND: Record<OverlayType, { title: string; gradient: string; low: string; high: string }> = {
  cancer: {
    title: "csPCa risk",
    gradient: "linear-gradient(to right,#22c55e,#eab308,#ef4444)",
    low: "Low",
    high: "High",
  },
  ece: {
    title: "ECE risk",
    gradient: "linear-gradient(to right,#22c55e,#f59e0b,#ef4444)",
    low: "Low",
    high: "High",
  },
  svi: {
    title: "SVI risk",
    gradient: "linear-gradient(to right,#4060a0,#a855f7,#ef4444)",
    low: "Low",
    high: "High",
  },
  psm: {
    title: "PSM risk",
    gradient: "linear-gradient(to right,#3080c0,#60a0e0,#ef4444)",
    low: "Low",
    high: "High",
  },
};

const pillBase =
  "h-7 rounded-md border px-2.5 text-[11px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60";

export function ControlsOverlay() {
  const overlay = useUiStore((s) => s.overlay);
  const heatmapVisible = useUiStore((s) => s.heatmapVisible);
  const labelsVisible = useUiStore((s) => s.labelsVisible);
  const lesionsOnly = useUiStore((s) => s.lesionsOnly);
  const setOverlay = useUiStore((s) => s.setOverlay);
  const toggleHeatmap = useUiStore((s) => s.toggleHeatmap);
  const toggleLabels = useUiStore((s) => s.toggleLabels);
  const toggleLesionsOnly = useUiStore((s) => s.toggleLesionsOnly);
  const setView = useUiStore((s) => s.setView);
  const setCaseLogOpen = useUiStore((s) => s.setCaseLogOpen);
  const leg = LEGEND[overlay];

  const predictions = usePatientStore((s) => s.predictions);
  const patients = usePatientStore((s) => s.patients);
  const activeId = usePatientStore((s) => s.activeId);
  const entry = patients.find((p) => p.id === activeId);

  const [legendOpen, setLegendOpen] = useState(true);

  function handlePrint() {
    if (!entry || !predictions) return;
    const record = { ...entry.record, lesions: entry.lesionRows };
    const S = deriveClinicalFromLesions(
      clinicalStateFromRecord(record),
      lesionsFromRows(entry.lesionRows),
    );
    printReport(S, predictions, entry.lesionRows);
  }

  return (
    <>
      {/* ── Top-left: view buttons ── */}
      <div className="pointer-events-auto absolute left-2 top-2 z-10 flex flex-wrap gap-1">
        <div className="glass flex items-center gap-0.5 rounded-lg p-1">
          {VIEWS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className="rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-all hover:bg-white/10 hover:text-foreground active:scale-95"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Top-right: overlay pills + toggles + print/cases (all in one flex-wrap row, matching HTML) ── */}
      <div
        className={cn(
          "pointer-events-auto absolute z-10",
          "lg:right-2 lg:top-2",
          "max-lg:left-2 max-lg:bottom-[calc(0.75rem+4rem+env(safe-area-inset-bottom,0px))]",
        )}
      >
        <div className="glass flex flex-wrap items-center justify-end gap-0.5 rounded-lg p-1" style={{ maxWidth: "53vw" }}>
          {OVERLAYS.map((o) => {
            const active = overlay === o.id;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setOverlay(o.id)}
                className={cn(
                  pillBase,
                  active
                    ? o.activeColor
                    : "border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/10",
                )}
              >
                {o.label}
              </button>
            );
          })}
          {[
            { label: "Heatmap", active: heatmapVisible, toggle: toggleHeatmap },
            { label: "Labels", active: labelsVisible, toggle: toggleLabels },
            { label: "Lesions", active: lesionsOnly, toggle: toggleLesionsOnly },
          ].map(({ label, active, toggle }) => (
            <button
              key={label}
              type="button"
              onClick={toggle}
              className={cn(
                pillBase,
                active
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/10",
              )}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={handlePrint}
            disabled={!entry || !predictions}
            className={cn(
              pillBase,
              "border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed",
            )}
          >
            Print
          </button>
          <button
            type="button"
            onClick={() => setCaseLogOpen(true)}
            className={cn(
              pillBase,
              "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10",
            )}
          >
            Cases
          </button>
        </div>
      </div>

      {/* ── Bottom-right (desktop) / Bottom-left (mobile): legend (collapsible) ── */}
      <div
        className={cn(
          "pointer-events-auto absolute z-10 w-52 overflow-hidden rounded-lg transition-all",
          "lg:bottom-3 lg:right-2 lg:left-auto",
          "max-lg:left-2 max-lg:bottom-[calc(0.75rem+7.5rem+env(safe-area-inset-bottom,0px))]",
          "glass",
        )}
      >
        <button
          type="button"
          className="flex w-full items-center justify-between px-3 py-2 text-[11px] font-semibold text-primary"
          onClick={() => setLegendOpen((v) => !v)}
        >
          <span>{leg.title}</span>
          {legendOpen ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-3 w-3 text-muted-foreground" />
          )}
        </button>
        {legendOpen && (
          <div className="px-3 pb-3">
            <div
              className="h-2 w-full rounded-full"
              style={{ background: leg.gradient }}
            />
            <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
              <span>{leg.low}</span>
              <span>Moderate</span>
              <span>{leg.high}</span>
            </div>
            <p className="mt-1.5 whitespace-nowrap text-[9px] leading-snug text-muted-foreground/80">
              Green &lt;10% · Amber 10–30% · Red &gt;30%
            </p>
          </div>
        )}
      </div>

      {/* ── Bottom-right: zoom (mobile only) ── */}
      <div
        className={cn(
          "pointer-events-auto absolute right-2 z-20 flex flex-col gap-1.5 lg:hidden",
          "bottom-[calc(0.5rem+4rem+env(safe-area-inset-bottom,0px))]",
        )}
        role="group"
        aria-label="3D zoom"
      >
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="glass h-10 w-10 rounded-xl border-white/10 shadow-lg"
          aria-label="Zoom in"
          onClick={() => emitZoomNudge(-0.45)}
        >
          <Plus className="h-4 w-4 text-foreground" />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="glass h-10 w-10 rounded-xl border-white/10 shadow-lg"
          aria-label="Zoom out"
          onClick={() => emitZoomNudge(0.45)}
        >
          <Minus className="h-4 w-4 text-foreground" />
        </Button>
        <p className="text-center text-[8px] leading-tight text-muted-foreground/70">
          Drag · pinch
        </p>
      </div>
    </>
  );
}
