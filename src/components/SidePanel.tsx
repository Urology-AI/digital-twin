import { Cpu } from "lucide-react";
import { ClinicalWorkspace } from "@/components/ClinicalWorkspace";
import { usePatientStore } from "@/store/patientStore";
import { cn } from "@/lib/utils";

export function SidePanel() {
  const patients = usePatientStore((s) => s.patients);
  const activeId = usePatientStore((s) => s.activeId);
  const active = patients.find((p) => p.id === activeId);

  return (
    <aside
      className={cn(
        "hidden min-h-0 w-[700px] shrink-0 flex-col border-r border-border bg-card",
        "lg:flex",
      )}
    >
      {/* Panel header */}
      <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-border bg-muted/20 px-4">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15">
          <Cpu className="h-3.5 w-3.5 text-primary" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            COMPASS Digital Twin
          </div>
          {active && (
            <div className="truncate text-[10px] text-muted-foreground/70">
              {active.name}
            </div>
          )}
        </div>
      </div>

      <div className="app-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain bg-muted/10 dark:bg-background/50">
        <ClinicalWorkspace />
      </div>
    </aside>
  );
}
