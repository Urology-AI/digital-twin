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

const EXAMPLE_NOTE = `Biopsy
Gleason 7 (4+3) 80% Left side
Gleason 7 (4+3) 50% Right side

MRI 29cc
PIRADS 5 Left PZ base to apex extending to central and TZ Abut present No EPE

MUS 36cc
PRIMUS 4 Left PL PZ apex to base Abut yes No EPE
PRIMUS 3 Right PL PZ mid to base Abut yes No EPE

PSA 19.93 SHIM 23 Left: 3 (Ant + Post) Right: 3 (post)`;

type Step = "format" | "enter" | "review";

const STEPS: { key: Step; label: string }[] = [
  { key: "format", label: "Format" },
  { key: "enter", label: "Enter" },
  { key: "review", label: "Review" },
];

export function ParseNoteModal({ onClose }: Props) {
  const [step, setStep] = useState<Step>("format");
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
        "No recognizable data found. Check that section headers (Biopsy, MRI, MUS, PSMA, PSA) appear at the start of a line.",
      );
      return;
    }
    setParsed(result);
    setStep("review");
  }

  function handleConfirm() {
    if (!parsed || !entry) return;
    updateLesionRows([...entry.lesionRows, ...parsed.lesions]);
    if (parsed.prostateVolumeCc !== undefined) updateClinicalForm({ vol: parsed.prostateVolumeCc });
    if (parsed.biopsyGG !== undefined) updateClinicalForm({ gg: parsed.biopsyGG });
    if (parsed.biopsyTotalCores !== undefined) updateClinicalForm({ cores: parsed.biopsyTotalCores });
    if (parsed.biopsyMaxCorePct !== undefined) updateClinicalForm({ maxcore: parsed.biopsyMaxCorePct });
    if (parsed.psa !== undefined) updateClinicalForm({ psa: parsed.psa });
    pushHistory();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex w-full max-w-2xl flex-col gap-4 rounded-xl border border-border bg-background p-6 shadow-xl">

        {/* Header + step indicator */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Import from clinical note</h2>
            <div className="mt-1 flex items-center gap-1">
              {STEPS.map(({ key, label }, i) => (
                <span key={key} className="flex items-center gap-1">
                  {i > 0 && <span className="text-[10px] text-muted-foreground/30">›</span>}
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                      step === key ? "text-foreground" : "text-muted-foreground/35"
                    }`}
                  >
                    {i + 1}. {label}
                  </span>
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            ✕
          </button>
        </div>

        {/* ── Step 1: Format reference ───────────────────────────────────── */}
        {step === "format" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {/* Live example */}
              <div className="flex flex-col gap-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Example note
                </p>
                <pre className="flex-1 overflow-auto rounded-lg border border-border bg-muted/30 p-3 text-[11px] font-mono leading-relaxed text-foreground">
{`Biopsy
Gleason 7 (4+3) 80% Left side
Gleason 7 (4+3) 50% Right side

MRI 29cc
PIRADS 5 Left PZ base to apex
  extending to TZ Abut present No EPE

MUS 36cc
PRIMUS 4 Left PL PZ apex to base
  Abut yes No EPE
PRIMUS 3 Right PL PZ mid to base
  Abut yes No EPE

PSA 19.93 SHIM 23 Left: 3 Right: 3`}
                </pre>
              </div>

              {/* Reference card */}
              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Format rules
                </p>

                {/* Section rows */}
                <div className="space-y-1.5">
                  {[
                    {
                      hdr: "Biopsy",
                      key: "Gleason X (a+b)",
                      opt: "% core  ·  Left/Right  ·  PL PZ / PZ / TZ  ·  base/mid/apex",
                    },
                    {
                      hdr: "MRI",
                      key: "PIRADS X  or  Xcc",
                      opt: "side  ·  zone  ·  level / base to apex  ·  extending to TZ  ·  Abut yes/no  ·  EPE/No EPE",
                    },
                    {
                      hdr: "MUS",
                      key: "PRIMUS X",
                      opt: "side  ·  PL PZ / PZ  ·  level / apex to base  ·  Abut yes/no",
                    },
                    {
                      hdr: "PSMA",
                      key: "SUV X",
                      opt: "side  ·  zone  ·  level",
                    },
                    {
                      hdr: "PSA",
                      key: "PSA X  SHIM X",
                      opt: "Left: N  Right: N (core counts)  — sets PSA field",
                    },
                  ].map(({ hdr, key, opt }) => (
                    <div
                      key={hdr}
                      className="rounded border border-border/60 bg-muted/20 px-2 py-1.5"
                    >
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-mono text-[11px] font-bold text-foreground">
                          {hdr}
                        </span>
                        <span className="font-mono text-[10px] text-primary/80">{key}</span>
                      </div>
                      <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
                        {opt}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Zone / level legend */}
                <div className="rounded border border-border/60 bg-muted/20 px-2 py-1.5">
                  <p className="mb-1 text-[10px] font-semibold text-muted-foreground">
                    Keywords
                  </p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                    <span>
                      <span className="font-mono text-foreground">PL PZ / PL</span> → Posterolateral
                    </span>
                    <span>
                      <span className="font-mono text-foreground">PZ</span> → Posterior
                    </span>
                    <span>
                      <span className="font-mono text-foreground">TZ / AZ</span> → Anterior
                    </span>
                    <span>
                      <span className="font-mono text-foreground">Left / Right</span> → side
                    </span>
                    <span>
                      <span className="font-mono text-foreground">base / mid / apex</span> → level
                    </span>
                    <span>
                      <span className="font-mono text-foreground">base to apex</span> → all levels
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setText(EXAMPLE_NOTE);
                  setStep("enter");
                }}
              >
                Use example
              </Button>
              <Button size="sm" onClick={() => setStep("enter")}>
                Next →
              </Button>
            </div>
          </>
        )}

        {/* ── Step 2: Enter note ────────────────────────────────────────── */}
        {step === "enter" && (
          <>
            <p className="text-xs text-muted-foreground">
              Paste or type your note. Start each section with{" "}
              <span className="font-mono text-foreground">Biopsy</span>,{" "}
              <span className="font-mono text-foreground">MRI</span>,{" "}
              <span className="font-mono text-foreground">MUS</span>,{" "}
              <span className="font-mono text-foreground">PSMA</span>, or{" "}
              <span className="font-mono text-foreground">PSA</span> at the beginning of a line.
            </p>
            <textarea
              autoFocus
              className="h-52 w-full resize-y rounded-lg border border-input bg-background p-3 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring/60"
              placeholder={`Biopsy\nGleason 7 (4+3) 5% Right PL PZ\nGleason 6 (3+3) 5% Left\nGleason 6 (3+3) 50%\n\nMRI 41cc\nPIRADS 5 Right PL PZ mid Abut yes No EPE\nPIRADS 4 PZ mid No abut No EPE`}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setStep("format")}>
                ← Back
              </Button>
              <Button size="sm" onClick={handleParse} disabled={!text.trim()}>
                Parse note
              </Button>
            </div>
          </>
        )}

        {/* ── Step 3: Review ────────────────────────────────────────────── */}
        {step === "review" && parsed && (
          <>
            <div className="space-y-3">
              {/* Warnings */}
              {parsed.warnings.length > 0 && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                  <p className="mb-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                    {parsed.warnings.length} warning
                    {parsed.warnings.length > 1 ? "s" : ""} — review before importing
                  </p>
                  <ul className="space-y-0.5">
                    {parsed.warnings.map((w, i) => (
                      <li key={i} className="text-[11px] text-amber-700 dark:text-amber-300">
                        · {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Clinical field updates */}
              {(parsed.prostateVolumeCc !== undefined ||
                parsed.biopsyGG !== undefined ||
                parsed.biopsyTotalCores !== undefined ||
                parsed.biopsyMaxCorePct !== undefined ||
                parsed.psa !== undefined ||
                parsed.shim !== undefined) && (
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="mb-2 text-xs font-semibold text-foreground">
                    Clinical fields to update
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {parsed.psa !== undefined && (
                      <span>
                        PSA: <span className="text-foreground">{parsed.psa} ng/mL</span>
                      </span>
                    )}
                    {parsed.shim !== undefined && (
                      <span>
                        SHIM: <span className="text-foreground">{parsed.shim}</span>
                      </span>
                    )}
                    {parsed.prostateVolumeCc !== undefined && (
                      <span>
                        Volume:{" "}
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setParsed(null);
                  setStep("enter");
                }}
              >
                ← Back
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
