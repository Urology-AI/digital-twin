import { ChevronDown, ChevronLeft, ChevronUp, Minus, Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { emitZoomNudge } from "@/lib/three/zoomBridge";
import { usePatientStore } from "@/store/patientStore";
import { useUiStore } from "@/store/uiStore";
import { printReport } from "@/lib/compass/printReport";
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
  { id: "ece",    label: "ECE",   activeColor: "text-amber-400 border-amber-500/60 bg-amber-500/10" },
  { id: "svi",    label: "SVI",   activeColor: "text-purple-400 border-purple-500/60 bg-purple-500/10" },
  { id: "psm",    label: "PSM",   activeColor: "text-sky-400 border-sky-500/60 bg-sky-500/10" },
];

const LEGEND: Record<OverlayType, { title: string; gradient: string; low: string; high: string; note: string }> = {
  cancer: {
    title: "csPCa risk",
    gradient: "linear-gradient(to right,#22c55e,#eab308,#ef4444)",
    low: "Low", high: "High",
    note: "Green <10% · Amber 10–25% · Red >25%",
  },
  ece: {
    title: "ECE risk",
    gradient: "linear-gradient(to right,#22c55e,#f59e0b,#ef4444)",
    low: "Low", high: "High",
    note: "Green <10% · Amber 10–25% · Red >25%",
  },
  svi: {
    title: "SVI risk",
    gradient: "linear-gradient(to right,#22c55e,#f59e0b,#ef4444)",
    low: "Low", high: "High",
    note: "Green <15% · Amber 15–30% · Red >30%",
  },
  psm: {
    title: "PSM risk",
    gradient: "linear-gradient(to right,#3080c0,#60a0e0,#ef4444)",
    low: "Low", high: "High",
    note: "Blue <15% · Amber 15–35% · Red >35%",
  },
};

const pillBase =
  "h-7 rounded-md border px-2.5 text-[11px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60";

const sectionLabel = "mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/50";

export function ControlsOverlay() {
  const overlay        = useUiStore((s) => s.overlay);
  const heatmapVisible = useUiStore((s) => s.heatmapVisible);
  const labelsVisible  = useUiStore((s) => s.labelsVisible);
  const lesionsOnly    = useUiStore((s) => s.lesionsOnly);
  const setOverlay     = useUiStore((s) => s.setOverlay);
  const toggleHeatmap  = useUiStore((s) => s.toggleHeatmap);
  const toggleLabels   = useUiStore((s) => s.toggleLabels);
  const toggleLesionsOnly = useUiStore((s) => s.toggleLesionsOnly);
  const setView        = useUiStore((s) => s.setView);
  const setCaseLogOpen = useUiStore((s) => s.setCaseLogOpen);
  const leg = LEGEND[overlay];

  const predictions = usePatientStore((s) => s.predictions);
  const patients    = usePatientStore((s) => s.patients);
  const activeId    = usePatientStore((s) => s.activeId);
  const entry       = patients.find((p) => p.id === activeId);

  const [legendOpen, setLegendOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const OPTIONS = [
    { label: "Heatmap", active: heatmapVisible, toggle: toggleHeatmap },
    { label: "Labels",  active: labelsVisible,  toggle: toggleLabels },
    { label: "Lesions", active: lesionsOnly,    toggle: toggleLesionsOnly },
  ];

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════
          DESKTOP LAYOUT (lg+): all controls always visible
      ════════════════════════════════════════════════════════════════ */}

      {/* Top-left: view preset buttons */}
      <div className="pointer-events-auto absolute left-2 top-2 z-10 hidden lg:flex flex-wrap gap-1">
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

      {/* Top-right: overlay type pills + toggles + actions */}
      <div className="pointer-events-auto absolute right-2 top-2 z-10 hidden lg:block">
        <div className="glass flex max-w-[calc(100%-1rem)] flex-wrap items-center justify-end gap-0.5 rounded-lg p-1">
          {OVERLAYS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setOverlay(o.id)}
              className={cn(pillBase, overlay === o.id ? o.activeColor : "border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/10")}
            >
              {o.label}
            </button>
          ))}
          {OPTIONS.map(({ label, active, toggle }) => (
            <button
              key={label}
              type="button"
              onClick={toggle}
              className={cn(pillBase, active ? "border-primary/60 bg-primary/15 text-primary" : "border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/10")}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => printReport()}
            disabled={!entry || !predictions}
            className={cn(pillBase, "border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed")}
          >
            Print
          </button>
          <button
            type="button"
            onClick={() => setCaseLogOpen(true)}
            className={cn(pillBase, "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10")}
          >
            Cases
          </button>
        </div>
      </div>

      {/* Bottom-right: legend (collapsible) */}
      <div className="pointer-events-auto absolute bottom-3 right-2 z-10 hidden w-52 overflow-hidden rounded-lg glass lg:block">
        <button
          type="button"
          className="flex w-full items-center justify-between px-3 py-2 text-[11px] font-semibold text-primary"
          onClick={() => setLegendOpen((v) => !v)}
        >
          <span>{leg.title}</span>
          {legendOpen
            ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
            : <ChevronUp   className="h-3 w-3 text-muted-foreground" />}
        </button>
        {legendOpen && (
          <div className="px-3 pb-3">
            <div className="h-2 w-full rounded-full" style={{ background: leg.gradient }} />
            <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
              <span>{leg.low}</span><span>Moderate</span><span>{leg.high}</span>
            </div>
            <p className="mt-1.5 whitespace-nowrap text-[9px] leading-snug text-muted-foreground/80">{leg.note}</p>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          MOBILE LAYOUT (max-lg): zoom left, controls side-drawer right
      ════════════════════════════════════════════════════════════════ */}

      {/* Zoom buttons — left side so they don't conflict with the drawer tab */}
      <div
        className="pointer-events-auto absolute left-2 z-20 flex flex-col gap-1.5 lg:hidden"
        style={{ bottom: "calc(0.5rem + 4rem + env(safe-area-inset-bottom, 0px))" }}
        role="group"
        aria-label="3D zoom"
      >
        <Button
          type="button" variant="secondary" size="icon"
          className="glass h-10 w-10 rounded-xl border-white/10 shadow-lg"
          aria-label="Zoom in"
          onClick={() => emitZoomNudge(-0.45)}
        >
          <Plus className="h-4 w-4 text-foreground" />
        </Button>
        <Button
          type="button" variant="secondary" size="icon"
          className="glass h-10 w-10 rounded-xl border-white/10 shadow-lg"
          aria-label="Zoom out"
          onClick={() => emitZoomNudge(0.45)}
        >
          <Minus className="h-4 w-4 text-foreground" />
        </Button>
        <p className="text-center text-[8px] leading-tight text-muted-foreground/70">Drag · pinch</p>
      </div>

      {/* Backdrop — dims canvas when drawer is open, tap to close */}
      {drawerOpen && (
        <div
          className="pointer-events-auto absolute inset-0 z-[19] lg:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden
        />
      )}

      {/* Edge tab handle — always visible on the right edge, vertically centred */}
      <button
        type="button"
        onClick={() => setDrawerOpen((v) => !v)}
        className={cn(
          "pointer-events-auto absolute right-0 top-1/2 z-[21] -translate-y-1/2 lg:hidden",
          "glass flex h-14 w-5 flex-col items-center justify-center rounded-l-xl border-r-0 shadow-md transition-colors",
          drawerOpen
            ? "border-primary/60 bg-primary/10 text-primary"
            : "border-white/10 text-muted-foreground",
        )}
        aria-label={drawerOpen ? "Close 3D controls" : "Open 3D controls"}
      >
        <ChevronLeft
          className={cn("h-3.5 w-3.5 transition-transform duration-200", drawerOpen && "rotate-180")}
        />
      </button>

      {/* Drawer panel — slides in from the right */}
      <div
        className={cn(
          "pointer-events-auto absolute bottom-0 right-0 top-0 z-20 w-[196px] lg:hidden",
          "flex flex-col overflow-y-auto overscroll-contain",
          "glass border-l border-white/[0.08]",
          "transition-transform duration-200 ease-out",
          drawerOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Drawer header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.07] px-3 py-2.5">
          <span className="text-[11px] font-semibold text-foreground/70">3D Controls</span>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-white/10 hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-3">
          {/* View presets */}
          <div>
            <p className={sectionLabel}>View</p>
            <div className="grid grid-cols-3 gap-1">
              {VIEWS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setView(id)}
                  className="rounded-md border border-white/10 py-1.5 text-[11px] font-medium text-muted-foreground transition-all hover:bg-white/10 hover:text-foreground active:scale-95"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Overlay type */}
          <div>
            <p className={sectionLabel}>Heatmap</p>
            <div className="grid grid-cols-2 gap-1">
              {OVERLAYS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setOverlay(o.id)}
                  className={cn(
                    "rounded-md border py-1.5 text-[11px] font-medium transition-all active:scale-95",
                    overlay === o.id ? o.activeColor : "border-white/10 text-muted-foreground hover:bg-white/10 hover:text-foreground",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div>
            <p className={sectionLabel}>Options</p>
            <div className="flex flex-col gap-1">
              {OPTIONS.map(({ label, active, toggle }) => (
                <button
                  key={label}
                  type="button"
                  onClick={toggle}
                  className={cn(
                    "flex items-center justify-between rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-all",
                    active
                      ? "border-primary/60 bg-primary/10 text-primary"
                      : "border-white/10 text-muted-foreground hover:bg-white/10 hover:text-foreground",
                  )}
                >
                  <span>{label}</span>
                  <span className={cn("h-2 w-2 rounded-full transition-colors", active ? "bg-primary" : "bg-white/20")} />
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div>
            <p className={sectionLabel}>Actions</p>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => printReport()}
                disabled={!entry || !predictions}
                className="flex-1 rounded-md border border-white/10 py-1.5 text-[11px] font-medium text-muted-foreground transition-all hover:bg-white/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                Print
              </button>
              <button
                type="button"
                onClick={() => setCaseLogOpen(true)}
                className="flex-1 rounded-md border border-emerald-500/40 py-1.5 text-[11px] font-medium text-emerald-400 transition-all hover:bg-emerald-500/10"
              >
                Cases
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="overflow-hidden rounded-lg border border-white/[0.07]">
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 text-[11px] font-semibold text-primary"
              onClick={() => setLegendOpen((v) => !v)}
            >
              <span>{leg.title}</span>
              {legendOpen
                ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
                : <ChevronUp   className="h-3 w-3 text-muted-foreground" />}
            </button>
            {legendOpen && (
              <div className="px-3 pb-3">
                <div className="h-2 w-full rounded-full" style={{ background: leg.gradient }} />
                <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
                  <span>{leg.low}</span><span>Moderate</span><span>{leg.high}</span>
                </div>
                <p className="mt-1.5 text-[9px] leading-snug text-muted-foreground/80">{leg.note}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
