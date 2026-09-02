import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronsUpDown, FilePlus2, RotateCcw, Upload, Check } from "lucide-react";
import { usePatientStore } from "@/store/patientStore";
import { clinicalStateFromRecord } from "@/lib/compass/clinicalFromRecord";
import { DEMO_CASES } from "@/data/demoCases";

/**
 * Shortcut key per demo case, in picker order: 1–9, then 0 for the tenth, then
 * letters. Cases past the end of this list simply have no shortcut.
 */
const DEMO_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "Q", "W", "E", "R", "T", "Y"];
import { cn } from "@/lib/utils";

/** Compact risk label from the current predictions, for the trigger chip. */
function riskChip(ece: number | undefined, svi: number | undefined) {
  const top = Math.max(ece ?? 0, svi ?? 0);
  if (top >= 0.3) return { label: "High risk", cls: "bg-red-500/15 text-red-500" };
  if (top >= 0.12) return { label: "Intermediate", cls: "bg-amber-500/15 text-amber-500" };
  return { label: "Low risk", cls: "bg-emerald-500/15 text-emerald-500" };
}

function caseSubtitle(record: Parameters<typeof clinicalStateFromRecord>[0]) {
  const S = clinicalStateFromRecord(record);
  return `GG${S.gg || "—"} · PSA ${S.psa}`;
}

export function CasePicker({ sampleOnly = false }: { sampleOnly?: boolean }) {
  const patients = usePatientStore((s) => s.patients);
  const activeId = usePatientStore((s) => s.activeId);
  const predictions = usePatientStore((s) => s.predictions);
  const loading = usePatientStore((s) => s.loading);
  const setActive = usePatientStore((s) => s.setActive);
  const newCase = usePatientStore((s) => s.newCase);
  const loadDemoCase = usePatientStore((s) => s.loadDemoCase);
  const resetActiveCase = usePatientStore((s) => s.resetActiveCase);
  const importJsonFile = usePatientStore((s) => s.importJsonFile);

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const openPanel = () => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setPos({ left: r.left, top: r.bottom + 4 });
    setOpen((v) => !v);
  };

  const active = patients.find((p) => p.id === activeId);
  const chip = riskChip(predictions?.ece, predictions?.svi);
  const yourCases = patients.filter((p) => !p.demoId);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Shortcut keys load the matching demo case (unless typing in a field)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const i = DEMO_KEYS.indexOf(e.key.toUpperCase());
      if (i >= 0 && i < DEMO_CASES.length) {
        loadDemoCase(DEMO_CASES[i]!);
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [loadDemoCase]);

  const onImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      file.text().then((text) => {
        try {
          importJsonFile(text, file.name.replace(/\.json$/i, ""));
          setOpen(false);
        } catch (err) {
          alert(`Import failed: ${(err as Error).message}`);
        }
      });
      e.target.value = "";
    },
    [importJsonFile],
  );

  return (
    <div ref={rootRef} className="relative flex min-w-0 flex-1 items-center sm:max-w-[280px]">
      <button
        ref={triggerRef}
        type="button"
        data-tutorial="patient-select"
        disabled={loading}
        onClick={openPanel}
        className={cn(
          "flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg border border-input/80 bg-muted/50 px-2.5",
          "text-xs font-medium text-foreground transition-colors hover:bg-muted/80 sm:text-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
          loading && "opacity-60",
        )}
      >
        <span className="truncate">{active?.name ?? "No case"}</span>
        {active && (
          <span className={cn("hidden shrink-0 rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wider sm:inline", chip.cls)}>
            {chip.label}
          </span>
        )}
        <ChevronsUpDown className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          style={{ left: pos.left, top: pos.top }}
          className="fixed z-[60] w-[320px] overflow-hidden rounded-xl border border-border bg-popover shadow-xl"
        >
          <div className="max-h-[70vh] overflow-y-auto p-1.5">
            <p className="px-2 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Demo cases
            </p>
            {DEMO_CASES.map((d, i) => {
              const loaded = active?.demoId === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => { loadDemoCase(d); setOpen(false); }}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/60",
                    loaded && "bg-primary/[0.07]",
                  )}
                >
                  <kbd
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold",
                      DEMO_KEYS[i]
                        ? "border-border bg-muted text-muted-foreground"
                        : "border-transparent text-transparent",
                    )}
                  >
                    {DEMO_KEYS[i] ?? ""}
                  </kbd>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      {d.name}
                      {loaded && <Check className="h-3.5 w-3.5 text-primary" />}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">{d.blurb}</span>
                  </span>
                </button>
              );
            })}

            {!sampleOnly && yourCases.length > 0 && (
              <>
                <p className="px-2 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Your cases
                </p>
                {yourCases.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setActive(p.id); setOpen(false); }}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/60",
                      p.id === activeId && "bg-primary/[0.07]",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
                        {p.name}
                        {p.id === activeId && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">{caseSubtitle(p.record)}</span>
                    </span>
                  </button>
                ))}
              </>
            )}
          </div>

          {!sampleOnly && (
          <div className="flex items-center gap-1 border-t border-border bg-muted/30 p-1.5">
            <button
              type="button"
              onClick={() => { newCase(); setOpen(false); }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            >
              <FilePlus2 className="h-3.5 w-3.5" /> New blank
            </button>
            <button
              type="button"
              onClick={() => { resetActiveCase(); setOpen(false); }}
              disabled={!active}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground disabled:opacity-40"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset case
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            >
              <Upload className="h-3.5 w-3.5" /> Import JSON
            </button>
          </div>
          )}
        </div>,
        document.body,
      )}

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={onImport}
      />
    </div>
  );
}
