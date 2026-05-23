import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePatientStore } from "@/store/patientStore";
import type { LesionRow } from "@/types/lesion";
import { ParseNoteModal } from "@/components/ParseNoteModal";

const SOURCES = ["MRI", "MUS", "PSMA", "Bx", "ExactVu"] as const;
const SIDES = ["L", "R"] as const;
const LEVELS = ["", "Base", "Mid", "Apex"] as const;
const POSITIONS = [
  "",
  "Anterior",
  "Posterior",
  "Posterolateral",
  "Medial",
  "Lateral",
] as const;
const ABUTMENT_OPTS = [
  { v: -1, l: "—" },
  { v: 0, l: "None" },
  { v: 1, l: "Abuts" },
  { v: 2, l: "Broad" },
  { v: 3, l: "Irreg" },
  { v: 4, l: "Bulge" },
] as const;

const selectCls =
  "h-8 w-full rounded border border-input/90 bg-background px-1.5 text-[11px] shadow-sm focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/60 dark:border-input";

const numInputCls =
  "h-8 w-16 rounded border border-input/90 bg-background px-1.5 text-[11px] text-right shadow-sm focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/60 dark:border-input";

function NA() {
  return <span className="text-[10px] text-muted-foreground/40">—</span>;
}

function scorePlaceholder(src: string) {
  if (src === "Bx") return "GG";
  if (src === "PSMA") return "SUV";
  if (src === "MUS" || src === "ExactVu") return "PriMUS";
  return "PIRADS";
}

function updateRow(
  rows: LesionRow[],
  id: string,
  patch: Partial<LesionRow>,
): LesionRow[] {
  return rows.map((r) => (r.id === id ? { ...r, ...patch } : r));
}

export function LesionTable() {
  const [showImport, setShowImport] = useState(false);
  const patients = usePatientStore((s) => s.patients);
  const activeId = usePatientStore((s) => s.activeId);
  const updateLesionRows = usePatientStore((s) => s.updateLesionRows);
  const addLesion = usePatientStore((s) => s.addLesion);
  const removeLesion = usePatientStore((s) => s.removeLesion);
  const pushHistory = usePatientStore((s) => s.pushHistory);

  const entry = patients.find((p) => p.id === activeId);
  if (!entry) return null;

  const rows = entry.lesionRows;

  return (
    <Card className="border-border">
      <CardHeader className="border-b border-border bg-muted/20 pb-3">
        <CardTitle className="text-sm font-semibold text-foreground">Lesions</CardTitle>
        <p className="text-xs text-muted-foreground">
          Columns show/hide based on source. Scroll right on small screens.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 overflow-x-auto overscroll-x-contain pt-4 [-webkit-overflow-scrolling:touch]">
        <table className="w-full min-w-[780px] border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-border/80 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-1 py-1.5">Src</th>
              <th className="px-1 py-1.5">Side</th>
              <th className="px-1 py-1.5">Lvl</th>
              <th className="px-1 py-1.5">Pos</th>
              <th className="px-1 py-1.5">Score</th>
              <th className="px-1 py-1.5 text-center">Core%</th>
              <th className="px-1 py-1.5 text-center">Lin mm</th>
              <th className="px-1 py-1.5 text-center">Size mm</th>
              <th className="px-1 py-1.5">Abut</th>
              <th className="px-1 py-1.5 text-center">ADC</th>
              <th className="px-1 py-1.5 text-center">EPE</th>
              <th className="px-1 py-1.5 text-center">SVI</th>
              <th className="w-7 px-1 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isBx = r.source === "Bx";
              const isMRI = r.source === "MRI";
              const isMUS = r.source === "MUS" || r.source === "ExactVu";
              const isPSMA = r.source === "PSMA";
              const showCoreLin = isBx;
              const showSize = !isBx;
              const showAbut = isMRI || isMUS;
              const showAdc = isMRI;
              const showEpe = !isBx;
              const showSvi = isMRI || isMUS || isPSMA;

              return (
                <tr key={r.id} className="border-b border-border/40 hover:bg-muted/10">
                  {/* Source */}
                  <td className="px-1 py-1">
                    <select
                      className={selectCls}
                      value={r.source}
                      onChange={(e) =>
                        updateLesionRows(
                          updateRow(rows, r.id, {
                            source: e.target.value as LesionRow["source"],
                          }),
                        )
                      }
                    >
                      {SOURCES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  {/* Side */}
                  <td className="px-1 py-1">
                    <select
                      className={selectCls + " w-14"}
                      value={r.side}
                      onChange={(e) =>
                        updateLesionRows(
                          updateRow(rows, r.id, {
                            side: e.target.value as LesionRow["side"],
                          }),
                        )
                      }
                    >
                      {SIDES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  {/* Level */}
                  <td className="px-1 py-1">
                    <select
                      className={selectCls + " w-16"}
                      value={r.level}
                      onChange={(e) =>
                        updateLesionRows(
                          updateRow(rows, r.id, {
                            level: e.target.value as LesionRow["level"],
                          }),
                        )
                      }
                    >
                      {LEVELS.map((s) => (
                        <option key={s || "—"} value={s}>{s || "—"}</option>
                      ))}
                    </select>
                  </td>
                  {/* Position */}
                  <td className="px-1 py-1">
                    <select
                      className={selectCls + " w-28"}
                      value={r.zone}
                      onChange={(e) =>
                        updateLesionRows(updateRow(rows, r.id, { zone: e.target.value }))
                      }
                    >
                      {POSITIONS.map((s) => (
                        <option key={s || "—"} value={s}>{s || "—"}</option>
                      ))}
                    </select>
                  </td>
                  {/* Score */}
                  <td className="px-1 py-1">
                    <Input
                      className="h-8 w-14 px-1.5 text-[11px]"
                      value={r.score}
                      placeholder={scorePlaceholder(r.source)}
                      onChange={(e) =>
                        updateLesionRows(updateRow(rows, r.id, { score: e.target.value }))
                      }
                    />
                  </td>
                  {/* Core % (Bx only) */}
                  <td className="px-1 py-1 text-center">
                    {showCoreLin ? (
                      <input
                        type="number"
                        className={numInputCls}
                        value={r.corePct || ""}
                        placeholder="%"
                        onChange={(e) =>
                          updateLesionRows(
                            updateRow(rows, r.id, {
                              corePct: parseFloat(e.target.value) || 0,
                            }),
                          )
                        }
                      />
                    ) : (
                      <NA />
                    )}
                  </td>
                  {/* Linear mm (Bx only) */}
                  <td className="px-1 py-1 text-center">
                    {showCoreLin ? (
                      <input
                        type="number"
                        className={numInputCls}
                        value={r.linear || ""}
                        placeholder="mm"
                        onChange={(e) =>
                          updateLesionRows(
                            updateRow(rows, r.id, {
                              linear: parseFloat(e.target.value) || 0,
                            }),
                          )
                        }
                      />
                    ) : (
                      <NA />
                    )}
                  </td>
                  {/* Size mm (non-Bx) */}
                  <td className="px-1 py-1 text-center">
                    {showSize ? (
                      <input
                        type="number"
                        className={numInputCls}
                        value={r.mriSize || ""}
                        placeholder="mm"
                        onChange={(e) =>
                          updateLesionRows(
                            updateRow(rows, r.id, {
                              mriSize: parseFloat(e.target.value) || 0,
                            }),
                          )
                        }
                      />
                    ) : (
                      <NA />
                    )}
                  </td>
                  {/* Abutment select (MRI/MUS) */}
                  <td className="px-1 py-1">
                    {showAbut ? (
                      <select
                        className={selectCls + " w-16"}
                        value={r.mriAbutment}
                        onChange={(e) =>
                          updateLesionRows(
                            updateRow(rows, r.id, {
                              mriAbutment: parseInt(e.target.value, 10),
                            }),
                          )
                        }
                      >
                        {ABUTMENT_OPTS.map((o) => (
                          <option key={o.v} value={o.v}>{o.l}</option>
                        ))}
                      </select>
                    ) : (
                      <NA />
                    )}
                  </td>
                  {/* ADC (MRI only) */}
                  <td className="px-1 py-1 text-center">
                    {showAdc ? (
                      <input
                        type="number"
                        className={numInputCls + " w-20"}
                        value={r.mriAdc || ""}
                        placeholder="ADC"
                        onChange={(e) =>
                          updateLesionRows(
                            updateRow(rows, r.id, {
                              mriAdc: parseFloat(e.target.value) || 0,
                            }),
                          )
                        }
                      />
                    ) : (
                      <NA />
                    )}
                  </td>
                  {/* EPE (non-Bx) */}
                  <td className="px-1 py-1 text-center">
                    {showEpe ? (
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-input accent-primary"
                        checked={r.epe}
                        onChange={(e) =>
                          updateLesionRows(updateRow(rows, r.id, { epe: e.target.checked }))
                        }
                      />
                    ) : (
                      <NA />
                    )}
                  </td>
                  {/* SVI (MRI/MUS/PSMA) */}
                  <td className="px-1 py-1 text-center">
                    {showSvi ? (
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-input accent-primary"
                        checked={r.svi}
                        onChange={(e) =>
                          updateLesionRows(updateRow(rows, r.id, { svi: e.target.checked }))
                        }
                      />
                    ) : (
                      <NA />
                    )}
                  </td>
                  {/* Remove */}
                  <td className="px-1 py-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        removeLesion(r.id);
                        pushHistory();
                      }}
                    >
                      ×
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-8 text-xs"
            onClick={() => {
              addLesion();
              pushHistory();
            }}
          >
            + Add lesion
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-8 text-xs"
            onClick={() => setShowImport(true)}
          >
            Import from note
          </Button>
          {rows.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                if (!window.confirm("Clear all lesions?")) return;
                updateLesionRows([]);
                pushHistory();
              }}
            >
              Clear all
            </Button>
          )}
        </div>
        {showImport && <ParseNoteModal onClose={() => setShowImport(false)} />}
      </CardContent>
    </Card>
  );
}
