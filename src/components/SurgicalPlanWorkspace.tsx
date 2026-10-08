import { useCallback, useEffect, useState } from "react";
import { FlaskConical, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SurgicalPlanPanel } from "@/components/SurgicalPlanPanel";
import { SheetNotesCard } from "@/components/SheetNotesCard";
import { PlanningInputsPanel } from "@/components/PlanningInputsPanel";
import { useUiStore } from "@/store/uiStore";

const SIDEBAR_KEY = "compass-plan-sidebar";
const SIDEBAR_MIN = 280;
const SIDEBAR_MAX = 560;
const SIDEBAR_DEFAULT = 360;

function loadSidebar(): { width: number; collapsed: boolean } {
  try {
    const raw = JSON.parse(localStorage.getItem(SIDEBAR_KEY) ?? "null");
    const w = Number(raw?.width);
    return {
      width: Number.isFinite(w) ? Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, w)) : SIDEBAR_DEFAULT,
      collapsed: raw?.collapsed === true,
    };
  } catch {
    return { width: SIDEBAR_DEFAULT, collapsed: false };
  }
}

export function SurgicalPlanWorkspace() {
  const [sidebar, setSidebar] = useState(loadSidebar);
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, JSON.stringify(sidebar));
    } catch {
      /* storage unavailable: the layout just resets next visit */
    }
  }, [sidebar]);

  const startResize = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebar.width;
    const move = (ev: PointerEvent) =>
      setSidebar((s) => ({
        ...s,
        width: Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startW + ev.clientX - startX)),
      }));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, [sidebar.width]);

  const desktopTab = useUiStore((s) => s.desktopTab);
  // The workspace stays mounted (tabs use CSS visibility), so re-arm the
  // notice every time the user leaves the Planning tab.
  const [acknowledged, setAcknowledged] = useState(false);
  useEffect(() => {
    if (desktopTab !== "plan") setAcknowledged(false);
  }, [desktopTab]);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden" data-tutorial="plan">
      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Left: surgical history & anatomy — feeds inflammation risk + the plan.
            Resizable (drag the divider) and collapsible on desktop. */}
        {!sidebar.collapsed && (
          <div
            style={{ "--side-w": `${sidebar.width}px` } as React.CSSProperties}
            className="overflow-y-auto overflow-x-hidden overscroll-contain app-scroll border-b border-border px-5 py-5 lg:w-[var(--side-w)] lg:shrink-0 lg:border-b-0"
          >
            <SheetNotesCard />
            <PlanningInputsPanel />
          </div>
        )}
        {/* The divider line is the drag handle: a 1px rule with a wide invisible grab area
            centred on it, and the collapse button sitting on the line. */}
        <div className="relative hidden w-px shrink-0 bg-border lg:block">
          {!sidebar.collapsed && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize inputs panel"
              title="Drag to resize · double-click to reset"
              onPointerDown={startResize}
              onDoubleClick={() => setSidebar((s) => ({ ...s, width: SIDEBAR_DEFAULT }))}
              className="group absolute inset-y-0 -left-1.5 z-10 w-3 cursor-col-resize touch-none"
            >
              <div className="mx-auto h-full w-0.5 rounded-full bg-transparent transition-colors group-hover:bg-primary/50 group-active:bg-primary" />
            </div>
          )}
          <button
            type="button"
            onClick={() => setSidebar((s) => ({ ...s, collapsed: !s.collapsed }))}
            aria-label={sidebar.collapsed ? "Show inputs panel" : "Hide inputs panel"}
            title={sidebar.collapsed ? "Show inputs panel" : "Hide inputs panel"}
            className={`absolute top-3 z-20 rounded-full border border-border bg-card p-1 text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground ${sidebar.collapsed ? "left-1" : "left-0 -translate-x-1/2"}`}
          >
            {sidebar.collapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
          </button>
        </div>
        {/* Right: operative plan + inflammation risk + impact */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain app-scroll px-5 py-5">
          <SurgicalPlanPanel />
        </div>
      </div>

      {!acknowledged && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="planning-dev-title"
          className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
        >
          <div className="max-w-md rounded-xl border border-amber-500/40 bg-card p-5 shadow-lg">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <FlaskConical className="h-5 w-5" aria-hidden />
              <h2 id="planning-dev-title" className="text-base font-semibold">
                Still in development
              </h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              The Planning tab is still under development. Its inflammation-risk and plane-hostility
              weights are provisional, expert-set priors that have not been fitted or validated, and
              outputs are for research use only, not for clinical decisions.
            </p>
            <div className="mt-4 flex justify-end">
              <Button onClick={() => setAcknowledged(true)} autoFocus>
                Continue to Planning
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
