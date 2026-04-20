import { useState, useEffect, useCallback, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePatientStore, savePatientToLibrary, loadPatientFromLibrary } from "@/store/patientStore";
import { clinicalStateFromRecord } from "@/lib/compass/clinicalFromRecord";
import { deriveClinicalFromLesions, lesionsFromRows } from "@/lib/utils/normalization";
import { cn } from "@/lib/utils";

const CASE_LOG_KEY = "compass_cases";

interface CaseRecord {
  id: string;
  date: string;
  // inputs
  psa: number;
  vol: number;
  psad: string;
  gg: number;
  cores: number;
  maxcore: number;
  linear: number;
  pirads: number;
  laterality: string;
  gg_left: number;
  gg_right: number;
  mri_epe: number;
  mri_svi: number;
  mri_size: number;
  mri_abutment: number;
  mri_adc: number;
  mus_ece: number;
  mus_svi: number;
  suv: number;
  psma_ln: number;
  psma_lesions: number;
  psma_base: number;
  psma_svi: number;
  ev_lesions: number;
  ev_base: number;
  lesion_count: number;
  // predictions
  pred_ece: number;
  pred_ece_l: number;
  pred_ece_r: number;
  pred_svi: number;
  pred_upgrade: number;
  pred_psm: number;
  pred_bcr: number;
  pred_lni: number;
  ns_left: number;
  ns_right: number;
  // pathology (filled later)
  path_ece: number | null;
  path_ece_l: number | null;
  path_ece_r: number | null;
  path_svi: number | null;
  path_upgrade: number | null;
  path_psm: number | null;
  path_lni: number | null;
  path_gg: number | null;
  path_ns_l: number | null;
  path_ns_r: number | null;
  notes: string;
}

function getCases(): CaseRecord[] {
  try {
    return JSON.parse(localStorage.getItem(CASE_LOG_KEY) || "[]") as CaseRecord[];
  } catch {
    return [];
  }
}

function saveCases(cases: CaseRecord[]) {
  localStorage.setItem(CASE_LOG_KEY, JSON.stringify(cases));
}

function parsePathValue(val: string): number | null {
  if (val === "" || val === null) return null;
  if (/^yes|^y$|^1$/i.test(val.trim())) return 1;
  if (/^no|^n$|^0$/i.test(val.trim())) return 0;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function parseCsv(text: string): CaseRecord[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0]!.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    // Handle quoted fields containing commas
    const values: string[] = [];
    let cur = "";
    let inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === "," && !inQuote) { values.push(cur); cur = ""; continue; }
      cur += ch;
    }
    values.push(cur);
    const row: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      const v = (values[i] ?? "").trim();
      row[h] = v === "" ? (h.startsWith("path_") || h === "notes" ? null : 0) : isNaN(Number(v)) ? v : Number(v);
    });
    // Ensure required string fields
    if (!row["id"]) row["id"] = "C" + Date.now();
    if (!row["notes"]) row["notes"] = "";
    return row as unknown as CaseRecord;
  });
}

function riskCls(v: number) {
  if (v < 15) return "text-emerald-500";
  if (v < 30) return "text-amber-500";
  return "text-red-500";
}

export function CaseLog({ onClose }: { onClose: () => void }) {
  const patients = usePatientStore((s) => s.patients);
  const activeId = usePatientStore((s) => s.activeId);
  const predictions = usePatientStore((s) => s.predictions);
  const importJsonFile = usePatientStore((s) => s.importJsonFile);
  const setActive = usePatientStore((s) => s.setActive);
  const setPatientName = usePatientStore((s) => s.setPatientName);

  const [cases, setCases] = useState<CaseRecord[]>([]);
  const importRef = useRef<HTMLInputElement>(null);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      try {
        if (file.name.toLowerCase().endsWith(".csv")) {
          // Import as CaseLog entries
          const imported = parseCsv(text);
          if (!imported.length) { alert("No valid rows found in CSV."); return; }
          const existing = getCases();
          const existingIds = new Set(existing.map((c) => c.id));
          const newOnes = imported.filter((c) => !existingIds.has(c.id));
          const merged = [...newOnes, ...existing];
          saveCases(merged);
          setCases(merged);
        } else {
          // Import as full patient record (JSON)
          importJsonFile(text, file.name.replace(/\.json$/i, ""));
        }
      } catch {
        alert("Could not import file. Check that it is a valid COMPASS JSON or exported CSV.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const reload = useCallback(() => setCases(getCases()), []);

  useEffect(() => {
    reload();
  }, [reload]);

  const saveCurrentCase = () => {
    const entry = patients.find((p) => p.id === activeId);
    if (!entry || !predictions) {
      alert("No patient data loaded.");
      return;
    }
    const rec = { ...entry.record, lesions: entry.lesionRows };
    const S = deriveClinicalFromLesions(
      clinicalStateFromRecord(rec),
      lesionsFromRows(entry.lesionRows),
    );

    const c: CaseRecord = {
      id: "C" + Date.now(),
      date: new Date().toISOString().split("T")[0]!,
      psa: S.psa,
      vol: S.vol,
      psad: S.psad.toFixed(3),
      gg: S.gg,
      cores: S.cores,
      maxcore: S.maxcore,
      linear: S.linear_mm,
      pirads: S.pirads,
      laterality: S.laterality,
      gg_left: S.gg_left,
      gg_right: S.gg_right,
      mri_epe: S.mri_epe,
      mri_svi: S.mri_svi,
      mri_size: S.mri_size,
      mri_abutment: S.mri_abutment,
      mri_adc: S.mri_adc,
      mus_ece: S.mus_ece,
      mus_svi: S.mus_svi,
      suv: S.suv,
      psma_ln: S.psma_ln,
      psma_lesions: S.psma_lesion_count,
      psma_base: S.psma_at_base,
      psma_svi: S.psma_svi,
      ev_lesions: S.ev_n_lesions,
      ev_base: S.ev_at_base,
      lesion_count: entry.lesionRows.length,
      pred_ece: Math.round(predictions.ece * 100),
      pred_ece_l: Math.round(predictions.eceL * 100),
      pred_ece_r: Math.round(predictions.eceR * 100),
      pred_svi: Math.round(predictions.svi * 100),
      pred_upgrade: Math.round(predictions.upgrade * 100),
      pred_psm: Math.round(predictions.psm * 100),
      pred_bcr: Math.round(predictions.bcr * 100),
      pred_lni: Math.round(predictions.lni * 100),
      ns_left: predictions.nsL,
      ns_right: predictions.nsR,
      path_ece: null,
      path_ece_l: null,
      path_ece_r: null,
      path_svi: null,
      path_upgrade: null,
      path_psm: null,
      path_lni: null,
      path_gg: null,
      path_ns_l: null,
      path_ns_r: null,
      notes: "",
    };

    const updated = [c, ...getCases()];
    saveCases(updated);
    setCases(updated);

    // Also save the full patient record to the library so it can be reloaded.
    // Name defaults to date+clinical summary; updated to notes when user loads.
    savePatientToLibrary({
      id: c.id,
      name: c.notes.trim() || `${c.date} — GG${c.gg} PSA ${c.psa}`,
      record: entry.record,
      lesionRows: entry.lesionRows,
    });
  };

  const updatePath = (idx: number, field: keyof CaseRecord, raw: string) => {
    const updated = getCases();
    if (!updated[idx]) return;
    (updated[idx] as unknown as Record<string, unknown>)[field] = parsePathValue(raw);
    saveCases(updated);
    setCases([...updated]);
  };

  const updateNotes = (idx: number, val: string) => {
    const updated = getCases();
    if (!updated[idx]) return;
    updated[idx]!.notes = val;
    saveCases(updated);
    setCases([...updated]);
  };

  const deleteCase = (idx: number) => {
    if (!confirm("Delete this case?")) return;
    const updated = getCases();
    updated.splice(idx, 1);
    saveCases(updated);
    setCases([...updated]);
  };

  const clearAll = () => {
    if (!confirm("Delete all saved cases?")) return;
    localStorage.removeItem(CASE_LOG_KEY);
    setCases([]);
  };

  const exportCSV = () => {
    const rows = getCases();
    if (rows.length === 0) return;
    const headers = [
      "id","date","psa","vol","psad","gg","cores","maxcore","linear","pirads","laterality",
      "gg_left","gg_right","mri_epe","mri_svi","mri_size","mri_abutment","mri_adc",
      "mus_ece","mus_svi","suv","psma_ln","psma_lesions","psma_base","psma_svi",
      "ev_lesions","ev_base","lesion_count",
      "pred_ece","pred_ece_l","pred_ece_r","pred_svi","pred_upgrade","pred_psm","pred_bcr","pred_lni",
      "ns_left","ns_right",
      "path_ece","path_ece_l","path_ece_r","path_svi","path_upgrade","path_psm","path_lni","path_gg",
      "path_ns_l","path_ns_r","notes",
    ];
    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        headers.map((h) => {
          const v = (r as unknown as Record<string, unknown>)[h];
          return v === null || v === undefined ? "" : String(v).includes(",") ? `"${v}"` : String(v);
        }).join(","),
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compass-cases-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Stats
  const total = cases.length;
  const withPath = cases.filter((c) => c.path_ece !== null).length;
  const eceAccuracy = (() => {
    const evaled = cases.filter((c) => c.path_ece !== null);
    if (evaled.length === 0) return null;
    const correct = evaled.filter((c) => (c.pred_ece >= 50 ? 1 : 0) === c.path_ece).length;
    return Math.round((correct / evaled.length) * 100);
  })();

  const pathFields: { l: string; f: keyof CaseRecord }[] = [
    { l: "ECE", f: "path_ece" },
    { l: "ECE-L", f: "path_ece_l" },
    { l: "ECE-R", f: "path_ece_r" },
    { l: "SVI", f: "path_svi" },
    { l: "Upg", f: "path_upgrade" },
    { l: "PSM", f: "path_psm" },
    { l: "LNI", f: "path_lni" },
    { l: "PathGG", f: "path_gg" },
    { l: "NS-L", f: "path_ns_l" },
    { l: "NS-R", f: "path_ns_r" },
  ];

  return (
    <div
      className="fixed inset-0 z-[200] overflow-y-auto bg-background/97 p-4 sm:p-8"
      style={{ backdropFilter: "blur(4px)" }}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="fixed right-4 top-3 z-[201] h-8 w-8 text-muted-foreground hover:text-foreground"
        aria-label="Close case log"
      >
        <X className="h-4 w-4" />
      </Button>

      <div className="mx-auto max-w-4xl">
        <h2 className="mb-1 text-lg font-semibold text-primary">Prospective Case Log</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Save COMPASS predictions per case. Enter pathology results when available. Data stored in browser localStorage.
        </p>

        <div className="mb-4 flex flex-wrap gap-2">
          <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={saveCurrentCase}>
            + Save Current Case
          </Button>
          <input ref={importRef} type="file" accept=".json,.csv" className="sr-only" onChange={handleImport} aria-hidden />
          <Button size="sm" variant="outline" onClick={() => importRef.current?.click()}>
            Import Case
          </Button>
          <Button size="sm" variant="outline" onClick={exportCSV}>
            Export CSV
          </Button>
          <Button size="sm" variant="outline" className="text-red-500 border-red-500/40 hover:bg-red-500/10" onClick={clearAll}>
            Clear All
          </Button>
        </div>

        {/* Stats row */}
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="rounded-lg border border-border/60 bg-card px-4 py-2 text-center">
            <div className="text-[9px] uppercase text-muted-foreground">Total Cases</div>
            <div className="text-xl font-bold text-primary">{total}</div>
          </div>
          <div className="rounded-lg border border-border/60 bg-card px-4 py-2 text-center">
            <div className="text-[9px] uppercase text-muted-foreground">Path Complete</div>
            <div className={cn("text-xl font-bold", withPath > 0 ? "text-emerald-500" : "text-muted-foreground")}>{withPath}</div>
          </div>
          {eceAccuracy !== null && (
            <div className="rounded-lg border border-border/60 bg-card px-4 py-2 text-center">
              <div className="text-[9px] uppercase text-muted-foreground">ECE Accuracy</div>
              <div className={cn("text-xl font-bold", eceAccuracy >= 70 ? "text-emerald-500" : eceAccuracy >= 50 ? "text-amber-500" : "text-red-500")}>
                {eceAccuracy}%
              </div>
            </div>
          )}
        </div>

        {cases.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">
            No cases saved yet. Load a patient and click "+ Save Current Case".
          </div>
        ) : (
          <div className="space-y-3">
            {cases.map((c, i) => (
              <div
                key={c.id}
                className={cn(
                  "rounded-lg border bg-card p-3",
                  c.path_ece !== null ? "border-emerald-500/40" : "border-border/70",
                )}
              >
                {/* Header */}
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <span className="font-semibold text-primary text-sm">{c.date}</span>
                    <span className="ml-2 text-[11px] text-muted-foreground">
                      GG{c.gg} | PSA {c.psa} | PIRADS {c.pirads} | {c.laterality}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const name = c.notes.trim() || `${c.date} — GG${c.gg} PSA ${c.psa}`;
                        // Try library first (full record), otherwise use the
                        // case log snapshot already loaded into the store on startup.
                        if (!loadPatientFromLibrary(c.id, name)) {
                          setPatientName(c.id, name);
                          setActive(c.id);
                        }
                        onClose();
                      }}
                      className="text-xs text-primary hover:underline"
                    >
                      load
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCase(i)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      delete
                    </button>
                  </div>
                </div>

                {/* Predictions */}
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {[
                    { l: "ECE", v: c.pred_ece, p: c.path_ece },
                    { l: "ECE-L", v: c.pred_ece_l, p: c.path_ece_l },
                    { l: "ECE-R", v: c.pred_ece_r, p: c.path_ece_r },
                    { l: "SVI", v: c.pred_svi, p: c.path_svi },
                    { l: "Upg", v: c.pred_upgrade, p: c.path_upgrade },
                    { l: "PSM", v: c.pred_psm, p: c.path_psm },
                    { l: "LNI", v: c.pred_lni, p: c.path_lni },
                  ].map((pr) => {
                    const match =
                      pr.p !== null && pr.p !== undefined
                        ? (pr.v >= 50 ? 1 : 0) === pr.p
                          ? " ✔"
                          : " ✘"
                        : "";
                    return (
                      <span
                        key={pr.l}
                        className="rounded border border-border/60 bg-muted/30 px-2 py-0.5 text-[10px]"
                      >
                        <span className="text-muted-foreground">{pr.l} </span>
                        <span className={cn("font-bold", riskCls(pr.v))}>{pr.v}%</span>
                        {match && (
                          <span className={match.includes("✔") ? "text-emerald-500" : "text-red-500"}>
                            {match}
                          </span>
                        )}
                      </span>
                    );
                  })}
                  <span className="rounded border border-border/60 bg-muted/30 px-2 py-0.5 text-[10px]">
                    <span className="text-muted-foreground">NS </span>
                    <span className="font-bold">L:G{c.ns_left} R:G{c.ns_right}</span>
                  </span>
                </div>

                {/* Pathology row */}
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span className="font-semibold text-amber-500">PATH:</span>
                  {pathFields.map((pf) => {
                    const val = c[pf.f];
                    const display =
                      val === null || val === undefined
                        ? ""
                        : val === 1
                          ? "yes"
                          : val === 0
                            ? "no"
                            : String(val);
                    return (
                      <span key={pf.f} className="flex items-center gap-0.5">
                        <span className="text-muted-foreground">{pf.l}:</span>
                        <input
                          defaultValue={display}
                          onBlur={(e) => updatePath(i, pf.f, e.target.value)}
                          placeholder="-"
                          className="w-9 rounded border border-border/60 bg-background px-1 py-0.5 text-center text-[9px] text-foreground"
                        />
                      </span>
                    );
                  })}
                </div>

                {/* Notes */}
                <input
                  defaultValue={c.notes}
                  onBlur={(e) => updateNotes(i, e.target.value)}
                  placeholder="Notes..."
                  className="w-full rounded border border-border/60 bg-background px-2 py-1 text-[10px] text-foreground"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
