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
  svi: boolean;
  mriSize: number;
  linear: number;
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
        svi: l.svi,
        mriSize: l.mriSize,
        linear: l.linear,
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
          svi: e.svi,
          mriSize: e.mriSize,
          linear: e.linear,
          corePct: e.corePct,
          pirads: e.pirads,
          primus: e.primus,
          suv: e.suv,
        });
      }
    }
  }
  return rows;
}

const SOURCE_BG: Partial<Record<LesionSource, string>> = {
  MRI: "bg-blue-500", MUS: "bg-teal-500", PSMA: "bg-purple-500",
  Bx: "bg-amber-600", ExactVu: "bg-teal-600",
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

const EXAMPLE_NOTE = `Biopsy
Gleason 7 (4+3) 5% Right PL PZ
Gleason 6 (3+3) 5% Left
Gleason 6 (3+3) 50% midline
MRI 41cc
PIRADS 5 Right PL PZ mid Abut yes No EPE
PIRADS 4 PZ mid No abut No EPE
MUS 36cc
PRIMUS 4 Left PL PZ mid to apex Abut yes No EPE
PRIMUS 3 Right PL PZ mid to base Abut yes No EPE
PSMA
SUV 12.7 bilateral`;

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

type Step = "example" | "paste" | "check" | "fix";

const STEP_DEFS: { key: Step; label: string; sub: string }[] = [
  { key: "example", label: "Show example",  sub: "See the expected format" },
  { key: "paste",   label: "Paste note",    sub: "Enter your clinical note" },
  { key: "check",   label: "Check data",    sub: "Verify everything was captured" },
  { key: "fix",     label: "Fix entries",   sub: "Correct any errors before applying" },
];

export function NoteImportModal({ onClose, onApply }: Props) {
  const [step, setStep] = useState<Step>("example");
  const [noteText, setNoteText] = useState("");
  const [entries, setEntries] = useState<ReviewEntry[]>([]);
  const [clinical, setClinical] = useState<NoteImportClinical>({});
  const [parseError, setParseError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);

  function handleExtract() {
    setParseError("");
    const parsed = parseClinicNote(noteText);
    if (parsed.lesions.length === 0 && !parsed.prostateVolumeCc && parsed.biopsyGG === undefined) {
      setParseError("No recognizable data found. Make sure your note has section headers: Biopsy, MRI, MUS, PSMA.");
      return;
    }
    setEntries(collapseToReviewEntries(parsed.lesions));
    setClinical({ vol: parsed.prostateVolumeCc, gg: parsed.biopsyGG, cores: parsed.biopsyTotalCores, maxcore: parsed.biopsyMaxCorePct });
    setWarnings(parsed.warnings ?? []);
    setStep("check");
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

  const stepIdx = STEP_DEFS.findIndex((s) => s.key === step);
  const selectCls = "h-7 rounded border border-input bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring/60";

  // counts for check step
  const bxCount   = entries.filter((e) => e.source === "Bx").length;
  const mriCount  = entries.filter((e) => e.source === "MRI").length;
  const musCount  = entries.filter((e) => e.source === "MUS" || e.source === "ExactVu").length;
  const psmaCount = entries.filter((e) => e.source === "PSMA").length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="flex w-full max-w-2xl flex-col rounded-xl border border-border bg-background shadow-2xl"
        style={{ maxHeight: "90vh" }}
      >
        {/* Title bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold text-foreground">Import from clinical note</h2>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">✕</button>
        </div>

        {/* Step progress */}
        <div className="shrink-0 border-b border-border bg-muted/10 px-4 py-3">
          <div className="flex items-start">
            {STEP_DEFS.map((s, i) => {
              const done   = i < stepIdx;
              const active = i === stepIdx;
              return (
                <div key={s.key} className="flex flex-1 flex-col items-center">
                  {/* connector + circle row */}
                  <div className="flex w-full items-center">
                    <div className={cn("h-0.5 flex-1", i === 0 ? "invisible" : done || active ? "bg-primary" : "bg-border")} />
                    <div className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-2",
                      active ? "bg-primary text-primary-foreground ring-primary"
                        : done ? "bg-primary/20 text-primary ring-primary/30"
                        : "bg-muted text-muted-foreground ring-border",
                    )}>
                      {done ? "✓" : i + 1}
                    </div>
                    <div className={cn("h-0.5 flex-1", i === STEP_DEFS.length - 1 ? "invisible" : done ? "bg-primary" : "bg-border")} />
                  </div>
                  {/* label */}
                  <span className={cn("mt-1.5 text-center text-[10px] font-semibold leading-tight",
                    active ? "text-foreground" : done ? "text-primary/60" : "text-muted-foreground/40"
                  )}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Step 1: Show example ── */}
        {step === "example" && (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <p className="text-sm text-muted-foreground">
                Your note needs section headers (<span className="font-mono font-semibold text-foreground">Biopsy</span>, <span className="font-mono font-semibold text-foreground">MRI</span>, <span className="font-mono font-semibold text-foreground">MUS</span>, <span className="font-mono font-semibold text-foreground">PSMA</span>) — each on its own line or at the start of a tab-indented row. Put one finding per line below each header.
              </p>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Example note</span>
                  <button
                    type="button"
                    onClick={() => { setNoteText(EXAMPLE_NOTE); setStep("paste"); }}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Use this example →
                  </button>
                </div>
                <pre className="rounded-lg border border-border bg-muted/20 p-3 font-mono text-[11px] leading-relaxed text-foreground/80 whitespace-pre-wrap">{EXAMPLE_NOTE}</pre>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
                <div className="rounded-lg border border-border bg-muted/10 p-2.5">
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sections</p>
                  {["Biopsy", "MRI", "MUS", "PSMA"].map((s) => <div key={s} className="font-mono text-foreground/80">{s}</div>)}
                </div>
                <div className="rounded-lg border border-border bg-muted/10 p-2.5">
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Zones</p>
                  {["PL PZ (posterolateral)", "PZ (posterior)", "TZ (anterior)", "CZ (medial)"].map((z) => <div key={z} className="text-foreground/80">{z}</div>)}
                </div>
                <div className="rounded-lg border border-border bg-muted/10 p-2.5">
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Levels</p>
                  {["base", "mid", "apex", "base to apex"].map((l) => <div key={l} className="text-foreground/80">{l}</div>)}
                </div>
                <div className="rounded-lg border border-border bg-muted/10 p-2.5">
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Scores</p>
                  <div className="text-foreground/80">Gleason X (a+b) %</div>
                  <div className="text-foreground/80">PIRADS 1–5</div>
                  <div className="text-foreground/80">PRIMUS 1–5</div>
                  <div className="text-foreground/80">SUV (any)</div>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-3">
              <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
              <Button size="sm" onClick={() => setStep("paste")}>Next: Paste note →</Button>
            </div>
          </>
        )}

        {/* ── Step 2: Paste note ── */}
        {step === "paste" && (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <p className="mb-3 text-sm text-muted-foreground">Paste your clinical note below. The parser handles copy-pasted EHR text, tab-indented tables, and inline section headers.</p>
              <textarea
                className="h-60 w-full resize-none rounded-lg border border-input bg-muted/20 p-3 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:bg-background focus:outline-none focus:ring-1 focus:ring-ring/60"
                placeholder={EXAMPLE_NOTE}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                autoFocus
              />
              {parseError && <p className="mt-2 text-xs text-red-500">{parseError}</p>}
            </div>
            <div className="flex shrink-0 items-center justify-between border-t border-border px-5 py-3">
              <Button variant="ghost" size="sm" onClick={() => setStep("example")}>← Back</Button>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
                <Button size="sm" disabled={!noteText.trim()} onClick={handleExtract}>Check data →</Button>
              </div>
            </div>
          </>
        )}

        {/* ── Step 3: Check data ── */}
        {step === "check" && (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              <p className="text-sm text-muted-foreground">Here's what was found in your note. Make sure the counts look right before fixing individual entries.</p>

              {/* Section counts */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: "Biopsy", count: bxCount, color: "bg-amber-600", letter: "B" },
                  { label: "MRI", count: mriCount, color: "bg-blue-500", letter: "M" },
                  { label: "MUS", count: musCount, color: "bg-teal-500", letter: "U" },
                  { label: "PSMA", count: psmaCount, color: "bg-purple-500", letter: "P" },
                ].map(({ label, count, color, letter }) => (
                  <div key={label} className={cn("flex items-center gap-3 rounded-lg border p-3", count > 0 ? "border-border bg-muted/10" : "border-border/30 bg-muted/5 opacity-50")}>
                    <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded text-[10px] font-black text-white", color)}>{letter}</span>
                    <div>
                      <div className="text-lg font-black tabular-nums text-foreground leading-none">{count}</div>
                      <div className="text-[10px] text-muted-foreground">{label} {count === 1 ? "entry" : "entries"}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Clinical fields */}
              {(clinical.vol !== undefined || clinical.gg !== undefined || clinical.cores !== undefined || clinical.maxcore !== undefined) && (
                <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Clinical fields extracted</p>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                    {clinical.vol !== undefined && <span className="text-muted-foreground">Volume <span className="font-semibold text-foreground">{clinical.vol} cc</span></span>}
                    {clinical.gg !== undefined && <span className="text-muted-foreground">Max GG <span className="font-semibold text-foreground">{clinical.gg}</span></span>}
                    {clinical.cores !== undefined && <span className="text-muted-foreground">+ve cores <span className="font-semibold text-foreground">{clinical.cores}</span></span>}
                    {clinical.maxcore !== undefined && <span className="text-muted-foreground">Max core% <span className="font-semibold text-foreground">{clinical.maxcore}%</span></span>}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {warnings.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-600">Parser warnings — review these</p>
                  <ul className="space-y-0.5">
                    {warnings.map((w, i) => <li key={i} className="text-xs text-amber-600/80">{w}</li>)}
                  </ul>
                </div>
              )}

              {entries.length === 0 && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2.5 text-sm text-red-500">
                  No lesion entries found — go back and check your note format.
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center justify-between border-t border-border px-5 py-3">
              <Button variant="ghost" size="sm" onClick={() => setStep("paste")}>← Back</Button>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
                <Button size="sm" disabled={entries.length === 0} onClick={() => setStep("fix")}>Fix entries →</Button>
              </div>
            </div>
          </>
        )}

        {/* ── Step 4: Fix entries ── */}
        {step === "fix" && (
          <>
            <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
              <p className="text-sm text-muted-foreground">Correct any side, zone, level, or score before applying to the grid.</p>

              {entries.map((e) => (
                <div key={e.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/10 px-3 py-2.5">
                  <span className={cn("inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[9px] font-black text-white", SOURCE_BG[e.source] ?? "bg-slate-500")}>
                    {SOURCE_LABEL[e.source] ?? e.source[0]}
                  </span>

                  <select className={selectCls} value={e.side} onChange={(ev) => update(e.id, { side: ev.target.value as "L" | "R" | "" })}>
                    <option value="L">Left</option>
                    <option value="R">Right</option>
                    <option value="">Both</option>
                  </select>

                  <select className={selectCls + " w-36"} value={e.zone} onChange={(ev) => update(e.id, { zone: ev.target.value })}>
                    {ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
                  </select>

                  <div className="flex items-center gap-1">
                    {LEVELS.map((lv) => (
                      <button
                        key={lv}
                        type="button"
                        onClick={() => toggleLevel(e.id, lv)}
                        className={cn(
                          "h-7 min-w-[1.75rem] rounded px-1.5 text-xs font-semibold transition-colors",
                          e.levels.includes(lv) ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted/70",
                        )}
                      >
                        {lv[0]}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    className="h-7 w-14 rounded border border-input bg-background px-1.5 text-right text-xs focus:outline-none focus:ring-1 focus:ring-ring/60"
                    value={e.score}
                    placeholder={SCORE_PH[e.source] ?? "score"}
                    onChange={(ev) => update(e.id, { score: ev.target.value })}
                  />

                  <span className="text-[10px] text-muted-foreground/70">
                    {(e.source === "MRI" || e.source === "MUS") && `Abut: ${ABUT_LABEL[e.mriAbutment] ?? "—"} · EPE: ${e.epe ? "Yes" : "No"}`}
                    {e.source === "Bx" && e.corePct > 0 && `${e.corePct}% core`}
                  </span>

                  <button
                    type="button"
                    onClick={() => setEntries((es) => es.filter((x) => x.id !== e.id))}
                    className="ml-auto text-xs text-muted-foreground/30 hover:text-destructive"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="flex shrink-0 items-center justify-between border-t border-border px-5 py-3">
              <Button variant="ghost" size="sm" onClick={() => setStep("check")}>← Back</Button>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
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
