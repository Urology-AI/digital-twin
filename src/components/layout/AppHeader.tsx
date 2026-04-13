import {
  BookMarked,
  BookOpen,
  Info,
  Moon,
  Printer,
  Redo2,
  Sun,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePatientStore } from "@/store/patientStore";
import { useUiStore } from "@/store/uiStore";
import { printReport } from "@/lib/compass/printReport";
import { cn } from "@/lib/utils";

export function AppHeader() {
  const dark = useUiStore((s) => s.dark);
  const setDark = useUiStore((s) => s.setDark);
  const setInfoOpen = useUiStore((s) => s.setInfoOpen);
  const setCaseLogOpen = useUiStore((s) => s.setCaseLogOpen);
  const setReferenceOpen = useUiStore((s) => s.setReferenceOpen);
  const patients = usePatientStore((s) => s.patients);
  const activeId = usePatientStore((s) => s.activeId);
  const setActive = usePatientStore((s) => s.setActive);
  const undo = usePatientStore((s) => s.undo);
  const redo = usePatientStore((s) => s.redo);

  const active = patients.find((p) => p.id === activeId);

  return (
    <header className="z-40 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card/95 px-3 backdrop-blur-md sm:px-4 supports-[backdrop-filter]:bg-card/85">
      {/* Brand */}
      <div className="flex shrink-0 flex-col justify-center gap-0.5">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-black tracking-tight text-foreground sm:text-base">
            COMPASS
          </span>
          <span className="hidden text-[10px] font-medium text-muted-foreground sm:inline">
            Prostate cancer · surgical outcomes
          </span>
        </div>
        <div className="hidden items-center gap-1.5 sm:flex">
          <span className="rounded bg-amber-500/15 px-1 py-px text-[8px] font-bold uppercase tracking-wider text-amber-500">
            Research Use Only
          </span>
          <span className="text-[8px] text-muted-foreground/50">IRB: STUDY-14-00050</span>
        </div>
      </div>

      {/* Divider */}
      <div className="hidden h-5 w-px shrink-0 bg-border/70 sm:block" />

      {/* Patient selector */}
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-[260px]">
        <label htmlFor="nav-patient" className="sr-only">Active patient</label>
        <select
          id="nav-patient"
          className={cn(
            "h-8 min-w-0 flex-1 cursor-pointer truncate rounded-lg border border-input/80 bg-muted/50 px-2.5 text-xs font-medium text-foreground shadow-none transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
            "hover:bg-muted/80 sm:text-sm",
          )}
          value={activeId ?? ""}
          onChange={(e) => setActive(e.target.value)}
        >
          {patients.length === 0 ? (
            <option value="">No patients loaded</option>
          ) : (
            patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))
          )}
        </select>
      </div>

      {/* Right actions */}
      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        {/* Undo/Redo */}
        <div className="flex items-center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label="Undo"
            onClick={() => undo()}
          >
            <Undo2 className="h-[15px] w-[15px]" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label="Redo"
            onClick={() => redo()}
          >
            <Redo2 className="h-[15px] w-[15px]" />
          </Button>
        </div>

        <div className="mx-1 h-4 w-px shrink-0 bg-border/60" />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          onClick={() => setDark(!dark)}
        >
          {dark ? (
            <Sun className="h-[15px] w-[15px] text-amber-400" />
          ) : (
            <Moon className="h-[15px] w-[15px] text-muted-foreground" />
          )}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 hidden lg:inline-flex text-purple-400 hover:text-purple-300"
          aria-label="Reference video"
          onClick={() => setReferenceOpen(true)}
        >
          <BookMarked className="h-[15px] w-[15px]" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-emerald-500 hover:text-emerald-400"
          aria-label="Prospective case log"
          onClick={() => setCaseLogOpen(true)}
        >
          <BookOpen className="h-[15px] w-[15px]" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label="Print report"
          onClick={() => printReport()}
        >
          <Printer className="h-[15px] w-[15px]" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-primary"
          aria-label="About COMPASS"
          onClick={() => setInfoOpen(true)}
        >
          <Info className="h-[15px] w-[15px]" />
        </Button>
      </div>

      {active && (
        <span className="sr-only" aria-live="polite">
          Active case: {active.name}
        </span>
      )}
    </header>
  );
}
