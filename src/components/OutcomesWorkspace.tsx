import { UserRound } from "lucide-react";
import { FunctionalOutcomesPanel } from "@/components/FunctionalOutcomesPanel";
import { ModifiableFactorsPanel } from "@/components/ModifiableFactorsPanel";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/store/uiStore";

export function OutcomesWorkspace() {
  const setPatientView = useUiStore((s) => s.setPatientView);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden" data-tutorial="outcomes">
      <div className="flex shrink-0 justify-end border-b border-border px-5 py-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => setPatientView(true)}
        >
          <UserRound className="h-3.5 w-3.5" />
          Patient summary
        </Button>
      </div>
      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Left: Modifiable Factors */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain app-scroll border-b border-border px-5 py-5 lg:border-b-0 lg:border-r">
          <ModifiableFactorsPanel />
        </div>
        {/* Right: NS grades + recovery chart */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain app-scroll px-5 py-5">
          <FunctionalOutcomesPanel />
        </div>
      </div>
    </div>
  );
}
