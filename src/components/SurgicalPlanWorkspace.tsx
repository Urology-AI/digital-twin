import { SurgicalPlanPanel } from "@/components/SurgicalPlanPanel";
import { PlanningInputsPanel } from "@/components/PlanningInputsPanel";

export function SurgicalPlanWorkspace() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden" data-tutorial="plan">
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
    </div>
  );
}
