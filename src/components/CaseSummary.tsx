import { usePatientStore } from "@/store/patientStore";
import { useUiStore } from "@/store/uiStore";
import { deriveClinicalFromLesions, lesionsFromRows } from "@/lib/utils/normalization";
import { clinicalStateFromRecord } from "@/lib/compass/clinicalFromRecord";
import { cn } from "@/lib/utils";

/**
 * The inputs these predictions were computed from, in one strip above the
 * numbers: what was entered, what each modality contributed, and what is still
 * missing. Derives ClinicalState the same way PredictionPanel does, so a value
 * shown here is exactly the value the models saw.
 */

function Stat({ label, value, missing }: { label: string; value: string; missing?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("truncate text-base font-bold tabular-nums", missing ? "text-muted-foreground/40" : "text-foreground")}>
        {value}
      </div>
    </div>
  );
}

function SourceChip({ label, detail, present }: { label: string; detail: string; present: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs",
        present
          ? "border-primary/30 bg-primary/10 font-semibold text-primary"
          : "border-dashed border-border text-muted-foreground/50",
      )}
    >
      {label}
      <span className={cn("font-normal", present ? "text-primary/70" : "")}>{detail}</span>
    </span>
  );
}

export function CaseSummary() {
  const patients = usePatientStore((s) => s.patients);
  const activeId = usePatientStore((s) => s.activeId);
  const setDesktopTab = useUiStore((s) => s.setDesktopTab);
  const entry = patients.find((p) => p.id === activeId);

  if (!entry) return null;

  const rows = entry.lesionRows;
  const S = deriveClinicalFromLesions(
    clinicalStateFromRecord({ ...entry.record, lesions: rows }),
    lesionsFromRows(rows),
  );

  // Same high-risk rule the PLND block uses — keep the two in step.
  const isHighRisk = S.gg >= 4 || S.psa > 20;

  const maxOf = (pred: (r: typeof rows[number]) => boolean, val: (r: typeof rows[number]) => number) =>
    rows.filter(pred).reduce((m, r) => Math.max(m, val(r) || 0), 0);

  const piradsMax = maxOf((r) => r.source === "MRI", (r) => r.pirads ?? parseInt(r.score, 10));
  const primusMax = maxOf((r) => r.source === "MUS" || r.source === "ExactVu", (r) => r.primus ?? parseInt(r.score, 10));
  const suvMax = maxOf((r) => r.source === "PSMA", (r) => r.suv ?? parseFloat(r.score));
  const bxCount = rows.filter((r) => r.source === "Bx").length;

  const laterality =
    S.laterality === "bilateral" ? "Bilateral" : S.laterality === "left" ? "Left only" : "Right only";

  const missing: string[] = [];
  if (!S.age) missing.push("age");
  if (!S.psa) missing.push("PSA");
  if (!S.vol) missing.push("prostate volume");
  if (!S.gg) missing.push("biopsy grade group");

  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-3 sm:p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Case summary</div>
          <div className="truncate text-sm font-semibold text-foreground">{entry.name}</div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold",
            isHighRisk ? "bg-red-500/15 text-red-600 dark:text-red-400" : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
          )}
        >
          {isHighRisk ? "NCCN high risk" : "Non-high risk"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        <Stat label="Age" value={S.age ? `${S.age}` : "—"} missing={!S.age} />
        <Stat label="PSA" value={S.psa ? `${S.psa}` : "—"} missing={!S.psa} />
        <Stat label="Volume" value={S.vol ? `${S.vol} cc` : "—"} missing={!S.vol} />
        <Stat label="PSAD" value={S.psad ? S.psad.toFixed(2) : "—"} missing={!S.psad} />
        <Stat label="Grade group" value={S.gg ? `GG ${S.gg}` : "—"} missing={!S.gg} />
        <Stat label="Laterality" value={rows.length ? laterality : "—"} missing={!rows.length} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <SourceChip label="Biopsy" detail={bxCount ? `${bxCount} zone${bxCount > 1 ? "s" : ""}` : "not entered"} present={bxCount > 0} />
        <SourceChip label="MRI" detail={piradsMax ? `PI-RADS ${piradsMax}` : "not entered"} present={piradsMax > 0} />
        <SourceChip label="MUS" detail={primusMax ? `PRI-MUS ${primusMax}` : "not entered"} present={primusMax > 0} />
        <SourceChip label="PSMA" detail={suvMax ? `SUV ${suvMax}` : "not entered"} present={suvMax > 0} />
      </div>

      {missing.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
          <span>
            Predictions are running on defaults for: <span className="font-semibold">{missing.join(", ")}</span>.
          </span>
          <button
            type="button"
            onClick={() => setDesktopTab("input")}
            className="font-semibold underline underline-offset-2 hover:no-underline"
          >
            Add data
          </button>
        </div>
      )}
    </div>
  );
}
