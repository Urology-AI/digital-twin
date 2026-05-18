import { FunctionalOutcomesPanel } from "@/components/FunctionalOutcomesPanel";
import { ModifiableFactorsPanel } from "@/components/ModifiableFactorsPanel";

export function OutcomesWorkspace() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden lg:flex-row" data-tutorial="outcomes">
      {/* Left: Modifiable Factors */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain app-scroll border-b border-border px-5 py-5 lg:border-b-0 lg:border-r">
        <ModifiableFactorsPanel />
      </div>
      {/* Right: NS grades + recovery chart */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain app-scroll px-5 py-5">
        <FunctionalOutcomesPanel />
      </div>
    </div>
  );
}
