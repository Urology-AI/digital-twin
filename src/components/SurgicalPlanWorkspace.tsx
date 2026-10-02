import { useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SurgicalPlanPanel } from "@/components/SurgicalPlanPanel";
import { PlanningInputsPanel } from "@/components/PlanningInputsPanel";
import { useUiStore } from "@/store/uiStore";

export function SurgicalPlanWorkspace() {
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
        {/* Left: surgical history & anatomy — feeds inflammation risk + the plan */}
        <div className="overflow-y-auto overflow-x-hidden overscroll-contain app-scroll border-b border-border px-5 py-5 lg:w-[360px] lg:shrink-0 lg:border-b-0 lg:border-r">
          <PlanningInputsPanel />
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
