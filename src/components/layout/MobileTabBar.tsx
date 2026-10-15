import { Activity, ClipboardList, FlaskConical, Layers } from "lucide-react";
import { useUiStore, type DesktopTab } from "@/store/uiStore";
import { cn } from "@/lib/utils";

const TABS: { id: DesktopTab; label: string; Icon: typeof Activity }[] = [
  { id: "input",        label: "Input",       Icon: ClipboardList },
  { id: "predictions",  label: "Predictions", Icon: Activity },
  { id: "outcomes",     label: "Factors",     Icon: Layers },
  { id: "plan",         label: "Planning",    Icon: FlaskConical },
];

export function MobileTabBar() {
  const desktopTab = useUiStore((s) => s.desktopTab);
  const setDesktopTab = useUiStore((s) => s.setDesktopTab);
  return (
    <nav
      className="safe-bottom w-full shrink-0 border-t border-border bg-card/95 px-3 pt-2 backdrop-blur-xl lg:hidden"
      aria-label="Primary workspace"
    >
      <div
        className="mx-auto flex max-w-sm items-stretch gap-1 rounded-2xl bg-muted/60 p-1 dark:bg-muted/40"
        role="tablist"
      >
        {TABS.map(({ id, label, Icon }) => {
          const active = desktopTab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setDesktopTab(id)}
              className={cn(
                "flex min-h-[48px] flex-1 touch-manipulation flex-col items-center justify-center gap-1 rounded-xl px-2 py-1.5 transition-all active:scale-[0.97]",
                active
                  ? "bg-card shadow-sm ring-1 ring-black/[0.06] dark:ring-white/[0.08]"
                  : "hover:bg-background/50",
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
                aria-hidden
              />
              <span className={cn(
                "text-[10px] font-semibold tracking-wide transition-colors",
                active ? "text-foreground" : "text-muted-foreground",
              )}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
      <div className="h-2 shrink-0" aria-hidden />
    </nav>
  );
}
