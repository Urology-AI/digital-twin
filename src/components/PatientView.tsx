import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Box, Loader2, RotateCcw, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePatientStore } from "@/store/patientStore";
import { useUiStore } from "@/store/uiStore";
import { parseClinicalText, type ParsedClinicalFields } from "@/lib/api";
import { ModifiableFactorsPanel } from "@/components/ModifiableFactorsPanel";
import { FunctionalOutcomesPanel } from "@/components/FunctionalOutcomesPanel";

/**
 * Simplified patient-facing screen — own layout, no clinical tabs, no
 * numeric risk predictions, no coefficient/research tooling. Reads and
 * writes the same `patientStore` as the clinical views so it always stays
 * in sync with the active case; it just shows/edits far less of it.
 *
 * Two columns: Inputs (left) | Recovery (right). The 3D model isn't shown
 * inline — it's the same always-mounted `ThreeCanvas` singleton, repositioned
 * to a full-screen overlay by App.tsx when `patientView3DOpen` is toggled on
 * here, rather than permanently occupying half the screen.
 */

export function PatientViewHeader() {
  const setPatientView = useUiStore((s) => s.setPatientView);
  const setPatientView3DOpen = useUiStore((s) => s.setPatientView3DOpen);
  const patientViewLocked = useUiStore((s) => s.patientViewLocked);
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-4 py-3">
      <div className="min-w-0">
        <div className="truncate text-lg font-bold text-foreground">COMPASS — your summary</div>
        <div className="text-xs text-muted-foreground">A simplified view of your case — talk to your care team about any of this.</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setPatientView3DOpen(true)} className="gap-1.5">
          <Box className="h-4 w-4" /> View 3D model
        </Button>
        {/* Patients arriving via a patient link stay in patient view — only a
            clinician who toggled in from their own session can switch back. */}
        {!patientViewLocked && (
          <Button variant="ghost" size="sm" onClick={() => setPatientView(false)} className="gap-1.5">
            <X className="h-4 w-4" /> Back to clinical view
          </Button>
        )}
      </div>
    </div>
  );
}

function ReportImport() {
  const updateClinicalForm = usePatientStore((s) => s.updateClinicalForm);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedClinicalFields | null>(null);
  const [applied, setApplied] = useState(false);

  async function handleExtract() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    setParsed(null);
    setApplied(false);
    try {
      const fields = await parseClinicalText(text);
      if (Object.keys(fields).length === 0) setError("No clinical values found in that text.");
      else setParsed(fields);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function handleApply() {
    if (!parsed) return;
    updateClinicalForm(parsed as Parameters<typeof updateClinicalForm>[0]);
    setApplied(true);
    setParsed(null);
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">Have a report or after-visit summary?</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste the text below and we'll pull out the values automatically. Review before applying.
        </p>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste your biopsy report, MRI report, or clinic note here…"
        className="h-32 w-full resize-y rounded-lg border border-input bg-background p-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40"
      />
      <Button onClick={handleExtract} disabled={busy || !text.trim()} className="gap-1.5">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        Extract details
      </Button>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {parsed && (
        <div className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2.5 text-sm">
          <div className="mb-1.5 font-semibold text-sky-400">We found these values</div>
          <div className="mb-2 flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
            {Object.entries(parsed).map(([k, v]) => (
              <span key={k}>
                <span className="text-foreground">{k}</span>: {String(v)}
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleApply}>Looks right — use these</Button>
            <Button size="sm" variant="ghost" onClick={() => setParsed(null)}>Discard</Button>
          </div>
        </div>
      )}

      {applied && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-500">
          Applied — your details below have been updated.
        </div>
      )}
    </div>
  );
}

function BasicsField({ label, hint, value, locked, onChange, ...inputProps }: {
  label: string;
  hint?: string;
  value: string;
  locked: boolean;
  onChange: (v: string) => void;
} & Omit<ComponentProps<typeof Input>, "value" | "onChange">) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">
        {label} {hint && <span className="text-muted-foreground">{hint}</span>}
      </label>
      {locked ? (
        <div className="flex h-9 items-center rounded-md border border-border bg-muted/40 px-3 text-sm text-foreground">
          {value || "—"}
        </div>
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} {...inputProps} />
      )}
    </div>
  );
}

function Basics() {
  const patients = usePatientStore((s) => s.patients);
  const activeId = usePatientStore((s) => s.activeId);
  const updateClinicalForm = usePatientStore((s) => s.updateClinicalForm);
  const patientViewLocked = useUiStore((s) => s.patientViewLocked);
  const entry = patients.find((p) => p.id === activeId);

  const [age, setAge] = useState("");
  const [psa, setPsa] = useState("");
  const [vol, setVol] = useState("");

  useEffect(() => {
    if (!entry) return;
    const rec = entry.record;
    setAge(rec.patient.age != null && rec.patient.age > 0 ? String(rec.patient.age) : "");
    setPsa(rec.patient.psa != null && rec.patient.psa > 0 ? String(rec.patient.psa) : "");
    setVol(rec.prostate.volume_cc != null && rec.prostate.volume_cc > 0 ? String(rec.prostate.volume_cc) : "");
  }, [entry?.id, entry?.record.patient.age, entry?.record.patient.psa, entry?.record.prostate.volume_cc]);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 text-base font-semibold text-foreground">Your basics</h3>
      <div className="grid grid-cols-3 gap-3">
        <BasicsField
          label="Age" locked={patientViewLocked} value={age}
          type="number" min={18} max={120} inputMode="numeric" placeholder="65"
          onChange={(v) => { setAge(v); updateClinicalForm({ age: parseInt(v) || undefined }); }}
        />
        <BasicsField
          label="PSA" hint="(ng/mL)" locked={patientViewLocked} value={psa}
          type="number" step="0.1" inputMode="decimal" placeholder="6.5"
          onChange={(v) => { setPsa(v); updateClinicalForm({ psa: parseFloat(v) || 0 }); }}
        />
        <BasicsField
          label="Prostate volume" hint="(cc)" locked={patientViewLocked} value={vol}
          type="number" step="0.1" inputMode="decimal" placeholder="45"
          onChange={(v) => { setVol(v); updateClinicalForm({ vol: parseFloat(v) || 45 }); }}
        />
      </div>
    </div>
  );
}

/**
 * Warns when the active case has drifted from the pristine snapshot the
 * patient link originally carried (e.g. from exploring Modifiable Factors),
 * and offers a one-click reset. Only shown for locked (patient-link)
 * sessions — a clinician previewing their own case doesn't need this, it's
 * already their live data either way.
 */
function useResetToOriginal() {
  const patients = usePatientStore((s) => s.patients);
  const activeId = usePatientStore((s) => s.activeId);
  const restorePatientRecord = usePatientStore((s) => s.restorePatientRecord);
  const entry = patients.find((p) => p.id === activeId);

  const snapshotRef = useRef<{ id: string; record: string; lesionRows: string } | null>(null);
  if (entry && snapshotRef.current?.id !== entry.id) {
    snapshotRef.current = {
      id: entry.id,
      record: JSON.stringify(entry.record),
      lesionRows: JSON.stringify(entry.lesionRows),
    };
  }

  const isDirty =
    !!entry &&
    !!snapshotRef.current &&
    (JSON.stringify(entry.record) !== snapshotRef.current.record ||
      JSON.stringify(entry.lesionRows) !== snapshotRef.current.lesionRows);

  const reset = () => {
    if (!snapshotRef.current) return;
    restorePatientRecord(
      snapshotRef.current.id,
      JSON.parse(snapshotRef.current.record),
      JSON.parse(snapshotRef.current.lesionRows),
    );
  };

  return { isDirty, reset };
}

function ResetBanner({ isDirty, onReset }: { isDirty: boolean; onReset: () => void }) {
  if (!isDirty) return null;
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-600 dark:text-amber-300">
      <span>You've changed some values below — this won't be saved to your care team's original case.</span>
      <Button size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={onReset}>
        <RotateCcw className="h-3.5 w-3.5" /> Reset to original
      </Button>
    </div>
  );
}

export function PatientView() {
  const heatmapVisible = useUiStore((s) => s.heatmapVisible);
  const toggleHeatmap = useUiStore((s) => s.toggleHeatmap);
  const overlay = useUiStore((s) => s.overlay);
  const setOverlay = useUiStore((s) => s.setOverlay);
  const patientViewLocked = useUiStore((s) => s.patientViewLocked);
  const { isDirty, reset } = useResetToOriginal();

  // Patients get a simplified cancer-risk heatmap on the 3D model (plain
  // Low/Moderate/High colouring, no ECE/SVI/PSM jargon or numeric legend —
  // those clinical overlay controls aren't rendered in patient view at all).
  // Force the overlay on and pinned to "cancer" for the duration of patient
  // view; restore whatever it was set to when leaving.
  useEffect(() => {
    const wasVisible = heatmapVisible;
    const prevOverlay = overlay;
    setOverlay("cancer");
    if (!wasVisible) toggleHeatmap();
    return () => {
      setOverlay(prevOverlay);
      if (!wasVisible) toggleHeatmap();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background lg:flex-row">
      {/* Left: Inputs */}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain app-scroll border-b border-border px-4 py-4 lg:border-b-0 lg:border-r lg:px-6 lg:py-6">
        {patientViewLocked && <ResetBanner isDirty={isDirty} onReset={reset} />}
        <div className="space-y-4">
          {/* Report import edits clinical fields directly — not offered on a
              locked (view-only) patient-link session. */}
          {!patientViewLocked && <ReportImport />}
          <Basics />
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-base font-semibold text-foreground">Things you can influence</h3>
            <ModifiableFactorsPanel />
          </div>
        </div>
      </div>
      {/* Right: Recovery */}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain app-scroll px-4 py-4 lg:px-6 lg:py-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-base font-semibold text-foreground">Recovery outlook</h3>
          <FunctionalOutcomesPanel />
        </div>
      </div>
    </div>
  );
}
