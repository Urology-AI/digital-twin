import { useState } from "react";
import { Button } from "@/components/ui/button";
import { usePatientStore } from "@/store/patientStore";
import { parseClinicNote, type ParsedNote } from "@/lib/parseClinicNote";

interface Props {
  onClose: () => void;
}

const ABUTMENT_LABELS: Record<number, string> = {
  "-1": "—",
  "0": "None",
  "1": "Abuts",
  "2": "Broad",
  "3": "Irreg",
  "4": "Bulge",
};

export function ParseNoteModal({ onClose }: Props) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedNote | null>(null);
  const [error, setError] = useState("");

  const updateLesionRows = usePatientStore((s) => s.updateLesionRows);
  const updateClinicalForm = usePatientStore((s) => s.updateClinicalForm);
  const pushHistory = usePatientStore((s) => s.pushHistory);
  const patients = usePatientStore((s) => s.patients);
  const activeId = usePatientStore((s) => s.activeId);
  const entry = patients.find((p) => p.id === activeId);

  function handleParse() {
    setError("");
    const result = parseClinicNote(text);
    if (result.lesions.length === 0 && !result.prostateVolumeCc && !result.biopsyGG) {
      setError(
        "No recognizable data found. Make sure your note contains section headers (Biopsy, MRI, MUS, PSMA) followed by lines with Gleason, PIRADS, PRIMUS, or SUV values.",
      );
      return;
    }
    setParsed(result);
  }

  function handleConfirm() {
    if (!parsed || !entry) return;
    const existing = entry.lesionRows;
    updateLesionRows([...existing, ...parsed.lesions]);
    if (parsed.prostateVolumeCc !== undefined) {
      updateClinicalForm({ vol: parsed.prostateVolumeCc });
    }
    if (parsed.biopsyGG !== undefined) {
      updateClinicalForm({ gg: parsed.biopsyGG });
    }
    if (parsed.biopsyTotalCores !== undefined) {
      updateClinicalForm({ cores: parsed.biopsyTotalCores });
    }
    if (parsed.biopsyMaxCorePct !== undefined) {
      updateClinicalForm({ maxcore: parsed.biopsyMaxCorePct });
    }
    pushHistory();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex w-full max-w-2xl flex-col gap-4 rounded-xl border border-border bg-background p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Import from clinical note</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            ✕
          </button>
        </div>

        {!parsed ? (
          <>
            <p className="text-xs text-muted-foreground">
              Paste your clinical note below. Use section headers{" "}
              <span className="font-mono text-foreground">Biopsy</span>,{" "}
              <span className="font-mono text-foreground">MRI</span>,{" "}
              <span className="font-mono text-foreground">MUS</span>,{" "}
              <span className="font-mono text-foreground">PSMA</span> to separate sections.
            </p>
            <textarea
              className="h-52 w-full resize-y rounded-lg border border-input bg-background p-3 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring/60"
              placeholder={`Biopsy   3\t1st\tGleason 7 (4+3) 80% Left side\n\t\tGleason 7 (4+3) 50% Right side\nMRI\t29cc PIRADS 5 Left PZ base to apex, Abut present, No EPE\nMUS\t36cc PRIMUS 4 Left PL PZ apex to base Abut yes No EPE\n\tPRIMUS 3 Right PL PZ mid to base Abut yes No EPE\nPSMA\tUptake throughout the prostate SUV 12.7`}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleParse} disabled={!text.trim()}>
                Parse note
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-3">
              {/* Clinical field updates */}
              {(parsed.prostateVolumeCc !== undefined ||
                parsed.biopsyGG !== undefined ||
                parsed.biopsyTotalCores !== undefined ||
                parsed.biopsyMaxCorePct !== undefined) && (
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="mb-2 text-xs font-semibold text-foreground">
                    Clinical fields to update
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {parsed.prostateVolumeCc !== undefined && (
                      <span>
                        Prostate volume:{" "}
                        <span className="text-foreground">{parsed.prostateVolumeCc} cc</span>
                      </span>
                    )}
                    {parsed.biopsyGG !== undefined && (
                      <span>
                        Max GG: <span className="text-foreground">{parsed.biopsyGG}</span>
                      </span>
                    )}
                    {parsed.biopsyTotalCores !== undefined && (
                      <span>
                        Positive cores:{" "}
                        <span className="text-foreground">{parsed.biopsyTotalCores}</span>
                      </span>
                    )}
                    {parsed.biopsyMaxCorePct !== undefined && (
                      <span>
                        Max core %:{" "}
                        <span className="text-foreground">{parsed.biopsyMaxCorePct}%</span>
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Lesion preview */}
              {parsed.lesions.length > 0 ? (
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-foreground">
                    {parsed.lesions.length} lesion{parsed.lesions.length > 1 ? "s" : ""} to append
                  </p>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full min-w-[520px] border-collapse text-[11px]">
                      <thead>
                        <tr className="border-b border-border bg-muted/30 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          <th className="px-2 py-1.5">Src</th>
                          <th className="px-2 py-1.5">Side</th>
                          <th className="px-2 py-1.5">Level</th>
                          <th className="px-2 py-1.5">Zone</th>
                          <th className="px-2 py-1.5">Score</th>
                          <th className="px-2 py-1.5">Core%</th>
                          <th className="px-2 py-1.5">Abut</th>
                          <th className="px-2 py-1.5">EPE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.lesions.map((l) => (
                          <tr
                            key={l.id}
                            className="border-b border-border/40 last:border-0 hover:bg-muted/10"
                          >
                            <td className="px-2 py-1 font-medium text-foreground">{l.source}</td>
                            <td className="px-2 py-1">{l.side || "—"}</td>
                            <td className="px-2 py-1">{l.level || "—"}</td>
                            <td className="px-2 py-1">{l.zone || "—"}</td>
                            <td className="px-2 py-1">{l.score}</td>
                            <td className="px-2 py-1">
                              {l.source === "Bx" ? `${l.corePct}%` : "—"}
                            </td>
                            <td className="px-2 py-1">
                              {l.source === "MRI" || l.source === "MUS"
                                ? (ABUTMENT_LABELS[l.mriAbutment] ?? "—")
                                : "—"}
                            </td>
                            <td className="px-2 py-1">
                              {l.source !== "Bx" ? (l.epe ? "Yes" : "No") : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No lesion rows parsed.</p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setParsed(null)}>
                Back
              </Button>
              <Button size="sm" onClick={handleConfirm}>
                Add to patient
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
