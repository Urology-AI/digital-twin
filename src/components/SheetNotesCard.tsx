import { usePatientStore } from "@/store/patientStore";

/**
 * Safe-sheet rows that no model reads — ASA and comorbidities, DVT risk, type
 * of surgery, DRE, comments and the source text of each study. Present only on
 * cases imported from a sheet. Read-only: it is the record of what the sheet
 * said, shown beside the numbers, not an input.
 */
const ORDER = [
  "Type of surgery", "ASA", "DVT Risk", "General Surgery", "Abdominal wall",
  "Trans operative care", "Reason for overnight stay", "LNs on PSMA",
  "Additional Images", "UA/UCx", "Discrepancy", "Research consent",
  "Surgeon comments", "Biopsy", "MRI", "MUS", "PSMA",
];
/** Rows already shown as model inputs elsewhere. */
const HIDDEN = new Set(["PSA"]);

export function SheetNotesCard() {
  const notes = usePatientStore(
    (s) => s.patients.find((p) => p.id === s.activeId)?.record.sheet_notes,
  );
  if (!notes) return null;

  const keys = Object.keys(notes).filter((k) => !HIDDEN.has(k) && notes[k]);
  if (!keys.length) return null;
  const rank = (k: string) => (ORDER.includes(k) ? ORDER.indexOf(k) : ORDER.length);
  keys.sort((a, b) => rank(a) - rank(b));

  return (
    <details className="mb-3 rounded-lg border border-border/70 bg-muted/20 text-sm" data-testid="sheet-notes">
      <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Safe sheet notes · {keys.length} rows
      </summary>
      <dl className="grid grid-cols-[minmax(0,9rem)_1fr] gap-x-3 gap-y-1.5 px-3 pb-3 pt-1">
        {keys.map((k) => (
          <div key={k} className="contents">
            <dt className="text-xs font-semibold text-muted-foreground">{k}</dt>
            <dd className="break-words text-xs text-foreground">{notes[k]}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
