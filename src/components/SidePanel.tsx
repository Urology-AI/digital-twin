import { Cpu, ClipboardList, Activity } from "lucide-react";
import { ClinicalWorkspace } from "@/components/ClinicalWorkspace";
import { FunctionalOutcomesWorkspace } from "@/components/FunctionalOutcomesWorkspace";
import { usePatientStore } from "@/store/patientStore";
import { useUiStore } from "@/store/uiStore";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { cn } from "@/lib/utils";

const DESKTOP_TABS = [
  { id: "clinical",  label: "Data",     Icon: ClipboardList },
  { id: "outcomes",  label: "Outcomes", Icon: Activity },
] as const;

type DesktopTab = typeof DESKTOP_TABS[number]["id"];

export function SidePanel() {
  const patients = usePatientStore((s) => s.patients);
  const activeId = usePatientStore((s) => s.activeId);
  const active = patients.find((p) => p.id === activeId);
  const isDesktop = useIsDesktop();

  const mobileWorkspace = useUiStore((s) => s.mobileWorkspace);
  const setMobileWorkspace = useUiStore((s) => s.setMobileWorkspace);

  // Derive active desktop tab from global workspace state; default to "clinical"
  const desktopTab: DesktopTab =
    mobileWorkspace === "outcomes" ? "outcomes" : "clinical";

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

        {/* Desktop tab switcher */}
        <div className="flex shrink-0 items-center gap-0.5 rounded-lg bg-muted/60 p-0.5">
          {DESKTOP_TABS.map(({ id, label, Icon }) => {
            const active = desktopTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setMobileWorkspace(id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all",
                  active
                    ? "bg-card shadow-sm text-foreground ring-1 ring-black/[0.06] dark:ring-white/[0.08]"
                    : "text-muted-foreground hover:bg-background/50",
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="app-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain bg-muted/10 dark:bg-background/50">
        {isDesktop && desktopTab === "clinical" && <ClinicalWorkspace />}
        {isDesktop && desktopTab === "outcomes" && <FunctionalOutcomesWorkspace />}
      </div>
    </aside>
  );
}
