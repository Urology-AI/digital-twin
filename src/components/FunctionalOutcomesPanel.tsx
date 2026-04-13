import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePatientStore } from "@/store/patientStore";
import { deriveClinicalFromLesions, lesionsFromRows } from "@/lib/utils/normalization";
import { clinicalStateFromRecord } from "@/lib/compass/clinicalFromRecord";
import {
  computeFunctionalOutcomes,
  type PfmtLevel,
  type Pde5Regimen,
  type AlcoholLevel,
  type SmokingStatus,
  type ExerciseLevel,
} from "@/lib/compass/functionalOutcomes";
import { cn } from "@/lib/utils";

// ── Segment button helper ─────────────────────────────────────────────────────
interface SegButtonProps<T extends string> {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}

function SegButton<T extends string>({ options, value, onChange }: SegButtonProps<T>) {
  return (
    <div className="flex rounded-md overflow-hidden border border-border divide-x divide-border">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex-1 px-2 py-1 text-[11px] font-medium transition-colors",
            value === opt.value
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:bg-muted/60",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── NS Grade badge ────────────────────────────────────────────────────────────
function NsBadge({ grade }: { grade: number }) {
  const cls =
    grade === 1
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30"
      : grade === 2
      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-amber-500/30"
      : "bg-red-500/15 text-red-600 dark:text-red-400 ring-red-500/30";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset",
        cls,
      )}
    >
      Grade {grade}
    </span>
  );
}

// ── Mini bar chart ────────────────────────────────────────────────────────────
const TIME_LABELS = ["6 wk", "3 mo", "6 mo", "12 mo", "18 mo"];

interface BarChartProps {
  values: (number | null)[];
  color: "blue" | "violet";
  label: string;
}

function BarChart({ values, color, label }: BarChartProps) {
  const barBase =
    color === "blue"
      ? "bg-blue-500/30 border-t-2 border-blue-500"
      : "bg-violet-500/30 border-t-2 border-violet-500";
  const textCls =
    color === "blue" ? "text-blue-500" : "text-violet-500";

  return (
    <div className="flex-1 min-w-0">
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        {label}
      </div>
      <div className="flex gap-1">
        {values.map((val, i) => (
          <div
            key={i}
            style={{ height: "80px" }}
            className="flex flex-1 flex-col items-center justify-end gap-1"
          >
            {val !== null ? (
              <>
                <div className={cn("text-[10px] font-bold", textCls)}>{val}%</div>
                <div
                  style={{
                    height: `${val}%`,
                    maxHeight: "64px",
                    minHeight: "4px",
                  }}
                  className={cn("w-full rounded-t", barBase)}
                />
              </>
            ) : (
              <>
                <div className="text-[10px] font-bold text-muted-foreground/40">N/A</div>
                <div
                  style={{ height: "4px" }}
                  className="w-full rounded-t bg-muted/40"
                />
              </>
            )}
            <div className="text-[9px] text-muted-foreground text-center leading-tight">
              {TIME_LABELS[i]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Info chip (read-only clinical factor) ─────────────────────────────────────
function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1 text-[11px]">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

// ── Adj chip (positive / negative / neutral) ──────────────────────────────────
function AdjChip({ label, value }: { label: string; value: number }) {
  const cls =
    value > 0
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : value < 0
      ? "bg-red-500/10 text-red-500 dark:text-red-400"
      : "bg-muted/40 text-muted-foreground";
  const sign = value > 0 ? "+" : "";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold", cls)}>
      {label}: {sign}{value}pp
    </span>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export function FunctionalOutcomesPanel() {
  const predictions = usePatientStore((s) => s.predictions);
  const patients = usePatientStore((s) => s.patients);
  const activeId = usePatientStore((s) => s.activeId);

  // Modifiable factors with UI controls
  const [pfmt, setPfmt] = useState<PfmtLevel>("basic");
  const [pde5, setPde5] = useState<Pde5Regimen>("prn");
  const [alcohol, setAlcohol] = useState<AlcoholLevel>("moderate");

  // Derive clinical state from the active patient
  const entry = patients.find((p) => p.id === activeId);
  const hasPredictions = predictions !== null && entry !== null;

  if (!hasPredictions || !entry) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No patient data available. Load a patient to see functional outcomes.
        </CardContent>
      </Card>
    );
  }

  const rec = { ...entry.record, lesions: entry.lesionRows };
  const S = deriveClinicalFromLesions(
    clinicalStateFromRecord(rec),
    lesionsFromRows(entry.lesionRows),
  );

  const nsL = predictions.nsL as 1 | 2 | 3;
  const nsR = predictions.nsR as 1 | 2 | 3;

  // Map pde5 from clinical state — override only if explicit
  const clinicalPde5: Pde5Regimen =
    S.pde5 === "daily" || S.pde5 === "prn" || S.pde5 === "none"
      ? (S.pde5 as Pde5Regimen)
      : pde5;

  const smoking: SmokingStatus =
    S.smoking === "never" || S.smoking === "former" || S.smoking === "current"
      ? (S.smoking as SmokingStatus)
      : "never";

  const exercise: ExerciseLevel =
    S.exercise === "sedentary" || S.exercise === "light" || S.exercise === "moderate" || S.exercise === "active"
      ? (S.exercise as ExerciseLevel)
      : "moderate";

  const result = computeFunctionalOutcomes({
    nsL,
    nsR,
    age: S.age,
    shim: S.shim,
    ipss: S.ipss,
    bmi: S.bmi,
    pfmt,
    exercise,
    smoking,
    pde5: clinicalPde5 === pde5 ? pde5 : clinicalPde5,
    alcohol,
    dm: S.dm,
    htn: S.htn,
    cad: S.cad,
  });

  const comorbidLabels: string[] = [];
  if (S.dm) comorbidLabels.push("DM");
  if (S.htn) comorbidLabels.push("HTN");
  if (S.cad) comorbidLabels.push("CAD");

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base font-semibold">
                COMPASS — Functional Outcomes
              </CardTitle>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Predicted potency &amp; continence recovery after robotic prostatectomy
              </p>
            </div>
            <div className="shrink-0 rounded bg-muted/60 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Mount Sinai
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {/* NS Grade row */}
          <div className="flex items-center gap-3 rounded-lg bg-muted/30 px-3 py-2 text-sm">
            <span className="text-[11px] text-muted-foreground font-medium">Nerve Sparing:</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">Left</span>
              <NsBadge grade={nsL} />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">Right</span>
              <NsBadge grade={nsR} />
            </div>
            <span className="ml-auto text-[10px] text-muted-foreground italic">auto-populated</span>
          </div>
        </CardContent>
      </Card>

      {/* Hero numbers */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Potency at 12 mo
            </div>
            {result.shimValid ? (
              <>
                <div className="text-4xl font-bold text-blue-500">{result.potency12}%</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">probability</div>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-muted-foreground/50">N/A</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">SHIM &lt; 12</div>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Continence at 12 mo
            </div>
            <div className="text-4xl font-bold text-violet-500">{result.continence12}%</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">probability</div>
          </CardContent>
        </Card>
      </div>

      {/* SHIM warning */}
      {!result.shimValid && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-3 px-4 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              <span className="font-semibold">SHIM &lt; 12</span> — Preoperative erectile dysfunction. Potency recovery prediction is not applicable.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Recovery timeline charts */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Recovery Timeline</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex gap-4">
            <BarChart
              values={result.potencyTimeline}
              color="blue"
              label="Potency"
            />
            <BarChart
              values={result.continenceTimeline}
              color="violet"
              label="Continence"
            />
          </div>
        </CardContent>
      </Card>

      {/* Lifestyle adjustments */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Lifestyle Adjustments</CardTitle>
          <p className="text-[11px] text-muted-foreground">
            Net impact of modifiable and clinical factors on predicted outcomes
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2">
            <AdjChip label="Potency" value={result.potencyAdj} />
            <AdjChip label="Continence" value={result.continenceAdj} />
          </div>
        </CardContent>
      </Card>

      {/* Modifiable factors controls */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Modifiable Factors</CardTitle>
          <p className="text-[11px] text-muted-foreground">
            Adjust these to explore how lifestyle changes affect recovery
          </p>
        </CardHeader>
        <CardContent className="pt-0 flex flex-col gap-3">
          <div>
            <div className="mb-1 text-[11px] font-medium text-muted-foreground">
              Pelvic Floor Muscle Training (PFMT)
            </div>
            <SegButton<PfmtLevel>
              options={[
                { label: "None", value: "none" },
                { label: "Basic", value: "basic" },
                { label: "Moderate", value: "moderate" },
                { label: "Intensive", value: "intensive" },
              ]}
              value={pfmt}
              onChange={setPfmt}
            />
          </div>

          <div>
            <div className="mb-1 text-[11px] font-medium text-muted-foreground">
              PDE5 Inhibitors
            </div>
            <SegButton<Pde5Regimen>
              options={[
                { label: "None", value: "none" },
                { label: "PRN", value: "prn" },
                { label: "Daily", value: "daily" },
              ]}
              value={pde5}
              onChange={setPde5}
            />
          </div>

          <div>
            <div className="mb-1 text-[11px] font-medium text-muted-foreground">
              Alcohol Use
            </div>
            <SegButton<AlcoholLevel>
              options={[
                { label: "None", value: "none" },
                { label: "Moderate", value: "moderate" },
                { label: "Heavy", value: "heavy" },
              ]}
              value={alcohol}
              onChange={setAlcohol}
            />
          </div>
        </CardContent>
      </Card>

      {/* Read-only clinical factors */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Clinical Factors</CardTitle>
          <p className="text-[11px] text-muted-foreground">
            Edit via the Data tab wizard
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-1.5">
            <InfoChip label="Age" value={`${S.age} yr`} />
            <InfoChip label="SHIM" value={String(S.shim)} />
            <InfoChip label="IPSS" value={String(S.ipss)} />
            <InfoChip label="BMI" value={`${S.bmi.toFixed(1)}`} />
            <InfoChip
              label="Smoking"
              value={smoking.charAt(0).toUpperCase() + smoking.slice(1)}
            />
            <InfoChip
              label="Exercise"
              value={exercise.charAt(0).toUpperCase() + exercise.slice(1)}
            />
            {comorbidLabels.length > 0 && (
              <InfoChip label="Comorbidities" value={comorbidLabels.join(", ")} />
            )}
            {comorbidLabels.length === 0 && (
              <InfoChip label="Comorbidities" value="None" />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <p className="px-1 text-[10px] text-muted-foreground/60 text-center leading-relaxed">
        For research and clinical decision support only. Not validated for individual patient counseling without physician oversight. Predictions based on institutional COMPASS model data.
      </p>
    </div>
  );
}
