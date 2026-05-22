import { useState } from "react";
import { Button } from "@/components/ui/button";
import { parseClinicNote } from "@/lib/parseClinicNote";
import { emptyLesion, type LesionRow, type LesionSource } from "@/types/lesion";
import { cn } from "@/lib/utils";

const LEVELS = ["Base", "Mid", "Apex"] as const;
type Level = (typeof LEVELS)[number];

const ZONES = ["Posterior", "Posterolateral", "Anterior", "Medial", "Lateral"] as const;

interface ReviewEntry {
  id: string;
  source: LesionSource;
  side: "L" | "R" | "";
  zone: string;
  levels: Level[];
  score: string;
  mriAbutment: number;
  epe: boolean;
  corePct: number;
  pirads?: number;
  primus?: number;
  suv?: number;
}

function uid() {
  return `re-${Math.random().toString(36).slice(2, 9)}`;
}

function collapseToReviewEntries(lesions: LesionRow[]): ReviewEntry[] {
  const map = new Map<string, ReviewEntry>();
  for (const l of lesions) {
    const key = `${l.source}|${l.side}|${l.zone}|${l.score}`;
    const existing = map.get(key);
    const lv = l.level as Level | "";
    if (existing) {
      if (lv && !existing.levels.includes(lv)) existing.levels.push(lv);
    } else {
      map.set(key, {
        id: uid(),
        source: l.source,
        side: l.side,
        zone: l.zone || "Posterior",
        levels: lv ? [lv] : [],
        score: l.score,
        mriAbutment: l.mriAbutment,
        epe: l.epe,
        corePct: l.corePct,
        pirads: l.pirads,
        primus: l.primus,
        suv: l.suv,
      });
    }
  }
  return Array.from(map.values());
}

function reviewEntriesToRows(entries: ReviewEntry[]): LesionRow[] {
  const rows: LesionRow[] = [];
  for (const e of entries) {
    const sides: ("L" | "R")[] = e.side === "" ? ["L", "R"] : [e.side];
    const levelsToUse: (Level | "")[] = e.levels.length > 0 ? e.levels : [""];
    for (const s of sides) {
      for (const lv of levelsToUse) {
        rows.push({
          ...emptyLesion(`${e.id}-${s}-${lv}`),
          source: e.source,
          side: s,
          zone: e.zone,
          level: lv,
          score: e.score,
          mriAbutment: e.mriAbutment,
          epe: e.epe,
          corePct: e.corePct,
          pirads: e.pirads,
          primus: e.primus,
          suv: e.suv,
          svi: false,
        });
      }
    }
  }
  return rows;
}

const SOURCE_BG: Partial<Record<LesionSource, string>> = {
  MRI: "bg-blue-500",
  MUS: "bg-teal-500",
  PSMA: "bg-purple-500",
  Bx: "bg-amber-600",
  ExactVu: "bg-teal-600",
};
const SOURCE_LABEL: Partial<Record<LesionSource, string>> = {
  MRI: "M", MUS: "U", PSMA: "P", Bx: "B", ExactVu: "U",
};
const ABUT_LABEL: Record<number, string> = {
  "-1": "—", "0": "None", "1": "Abuts", "2": "Broad", "3": "Irreg", "4": "Bulge",
};
const SCORE_PH: Partial<Record<LesionSource, string>> = {
  MRI: "PI-RADS", MUS: "PRI-MUS", PSMA: "SUV", Bx: "GG",
};

export interface NoteImportClinical {
  vol?: number;
  gg?: number;
  cores?: number;
  maxcore?: number;
}

interface Props {
  onClose: () => void;
  onApply: (rows: LesionRow[], clinical: NoteImportClinical) => void;
}

export function NoteImportModal({ onClose, onApply }: Props) {
  const [step, setStep] = useState<"paste" | "review">("paste");
  const [noteText, setNoteText] = useState("");
  const [entries, setEntries] = useState<ReviewEntry[]>([]);
  const [clinical, setClinical] = useState<NoteImportClinical>({});
  const [parseError, setParseError] = useState("");

  function handleExtract() {
    setParseError("");
    const parsed = parseClinicNote(noteText);
    if (
      parsed.lesions.length === 0 &&
      !parsed.prostateVolumeCc &&
      parsed.biopsyGG === undefined
    ) {
      setParseError(
        "No recognizable data found. Make sure your note has section headers: Biopsy, MRI, MUS, PSMA.",
      );
      return;
    }
    setEntries(collapseToReviewEntries(parsed.lesions));
    setClinical({
      vol: parsed.prostateVolumeCc,
      gg: parsed.biopsyGG,
      cores: parsed.biopsyTotalCores,
      maxcore: parsed.biopsyMaxCorePct,
    });
    setStep("review");
  }

  function update(id: string, patch: Partial<ReviewEntry>) {
    setEntries((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function toggleLevel(id: string, lv: Level) {
    setEntries((es) =>
      es.map((e) => {
        if (e.id !== id) return e;
        const has = e.levels.includes(lv);
        return { ...e, levels: has ? e.levels.filter((l) => l !== lv) : [...e.levels, lv] };
      }),
    );
  }

  function handleApply() {
    onApply(reviewEntriesToRows(entries), clinical);
    onClose();
  }

  const selectCls =
    "h-7 rounded border border-input bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring/60";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="flex w-full max-w-2xl flex-col rounded-xl border border-border bg-background shadow-2xl"
        style={{ maxHeight: "88vh" }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Import from clinical note</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {step === "paste"
                ? "Paste note — use Biopsy / MRI / MUS / PSMA section headers"
                : "Review extracted entries — fix side, zone, or score before applying"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {(["paste", "review"] as const).map((s, i) => (
                <span
                  key={s}
                  className={cn(
                    "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                    step === s
                      ? "bg-primary text-primary-foreground"
                      : step === "review" && s === "paste"
                        ? "bg-primary/30 text-primary"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {i + 1}
                </span>
              ))}
            </div>
            <button
              onClick={onClose}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── Step 1: Paste ── */}
        {step === "paste" && (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <textarea
                className="h-56 w-full resize-none rounded-lg border border-input bg-muted/20 p-3 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:bg-background focus:outline-none focus:ring-1 focus:ring-ring/60"
                placeholder={[
                  "Biopsy   3\t1st\tGleason 7 (4+3) 80% Left side",
                  "\t\tGleason 7 (4+3) 50% Right side",
                  "MRI\t29cc PIRADS 5 Left PZ base to apex, Abut present, No EPE",
                  "MUS\t36cc PRIMUS 4 Left PL PZ apex to base Abut yes No EPE",
                  "\tPRIMUS 3 Right PL PZ mid to base Abut yes No EPE",
                  "PSMA\tUptake throughout the prostate SUV 12.7",
                ].join("\n")}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                autoFocus
              />
              {parseError && (
                <p className="mt-2 text-xs text-red-500">{parseError}</p>
              )}
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-3">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" disabled={!noteText.trim()} onClick={handleExtract}>
                Extract data →
              </Button>
            </div>
          </>
        )}

        {/* ── Step 2: Review & fix ── */}
        {step === "review" && (
          <>
            <div className="flex-1 space-y-2.5 overflow-y-auto px-5 py-4">
              {entries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No lesion entries — go back and check your note.</p>
              ) : (
                entries.map((e) => (
                  <div
                    key={e.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/10 px-3 py-2.5"
                  >
                    {/* Source badge */}
                    <span
                      className={cn(
                        "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[9px] font-black text-white",
                        SOURCE_BG[e.source] ?? "bg-slate-500",
                      )}
                    >
                      {SOURCE_LABEL[e.source] ?? e.source[0]}
                    </span>

                    {/* Side */}
                    <select
                      className={selectCls}
                      value={e.side}
                      onChange={(ev) => update(e.id, { side: ev.target.value as "L" | "R" | "" })}
                    >
                      <option value="L">Left</option>
                      <option value="R">Right</option>
                      <option value="">Both</option>
                    </select>

                    {/* Zone */}
                    <select
                      className={selectCls + " w-36"}
                      value={e.zone}
                      onChange={(ev) => update(e.id, { zone: ev.target.value })}
                    >
                      {ZONES.map((z) => (
                        <option key={z} value={z}>{z}</option>
                      ))}
                    </select>

                    {/* Level chips — toggle each */}
                    <div className="flex items-center gap-1">
                      {LEVELS.map((lv) => (
                        <button
                          key={lv}
                          type="button"
                          onClick={() => toggleLevel(e.id, lv)}
                          title={lv}
                          className={cn(
                            "h-7 min-w-[1.75rem] rounded px-1.5 text-xs font-semibold transition-colors",
                            e.levels.includes(lv)
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                          )}
                        >
                          {lv[0]}
                        </button>
                      ))}
                    </div>

                    {/* Score */}
                    <input
                      type="text"
                      className="h-7 w-14 rounded border border-input bg-background px-1.5 text-right text-xs focus:outline-none focus:ring-1 focus:ring-ring/60"
                      value={e.score}
                      placeholder={SCORE_PH[e.source] ?? "score"}
                      onChange={(ev) => update(e.id, { score: ev.target.value })}
                    />

                    {/* Contextual detail */}
                    <span className="text-[10px] text-muted-foreground/70">
                      {(e.source === "MRI" || e.source === "MUS") &&
                        `Abut: ${ABUT_LABEL[e.mriAbutment] ?? "—"} · EPE: ${e.epe ? "Yes" : "No"}`}
                      {e.source === "Bx" && e.corePct > 0 && `${e.corePct}% core`}
                    </span>

                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => setEntries((es) => es.filter((x) => x.id !== e.id))}
                      className="ml-auto text-xs text-muted-foreground/30 hover:text-destructive"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}

              {/* Clinical updates summary */}
              {(clinical.vol !== undefined ||
                clinical.gg !== undefined ||
                clinical.cores !== undefined ||
                clinical.maxcore !== undefined) && (
                <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Clinical fields
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    {clinical.vol !== undefined && (
                      <span>Volume: <span className="font-medium text-foreground">{clinical.vol} cc</span></span>
                    )}
                    {clinical.gg !== undefined && (
                      <span>Max GG: <span className="font-medium text-foreground">{clinical.gg}</span></span>
                    )}
                    {clinical.cores !== undefined && (
                      <span>+ve cores: <span className="font-medium text-foreground">{clinical.cores}</span></span>
                    )}
                    {clinical.maxcore !== undefined && (
                      <span>Max core%: <span className="font-medium text-foreground">{clinical.maxcore}%</span></span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-between border-t border-border px-5 py-3">
              <Button variant="ghost" size="sm" onClick={() => setStep("paste")}>
                ← Back
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button size="sm" disabled={entries.length === 0} onClick={handleApply}>
                  Apply to grid ({entries.length})
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
