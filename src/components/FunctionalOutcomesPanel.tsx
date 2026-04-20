import { useState, useEffect, useRef } from "react";
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

// ── Segment button ────────────────────────────────────────────────────────────
function SegButton<T extends string>({
  options, value, onChange,
}: { options: { label: string; value: T }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-md overflow-hidden border border-border divide-x divide-border">
      {options.map((opt) => (
        <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
          className={cn(
            "flex-1 px-2 py-1 text-[11px] font-medium transition-colors",
            value === opt.value
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:bg-muted/60",
          )}
        >{opt.label}</button>
      ))}
    </div>
  );
}

// ── Slider row ────────────────────────────────────────────────────────────────
function SliderField({
  label, value, min, max, step = 1, display, onChange, warning,
}: {
  label: string; value: number; min: number; max: number; step?: number;
  display: string; onChange: (v: number) => void; warning?: string;
}) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        <span className="font-mono text-[11px] font-bold text-primary">{display}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full cursor-pointer accent-primary"
        style={{ height: "4px" }}
      />
      {warning && (
        <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-500">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {warning}
        </div>
      )}
    </div>
  );
}

// ── NS Grade selector ─────────────────────────────────────────────────────────
const NS_GRADES = [
  { grade: 1, label: "Grade 1", desc: "Intrafascial" },
  { grade: 2, label: "Grade 2", desc: "Interfascial" },
  { grade: 3, label: "Grade 3", desc: "Wide excision" },
] as const;

function NsGradeSelector({ side, value, onChange }: {
  side: "Left" | "Right"; value: 1 | 2 | 3; onChange: (g: 1 | 2 | 3) => void;
}) {
  return (
    <div className="flex-1 min-w-0">
      <div className="mb-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{side}</div>
      <div className="flex flex-col gap-1.5">
        {NS_GRADES.map(({ grade, label, desc }) => {
          const active = value === grade;
          const activeCls =
            grade === 1 ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : grade === 2 ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400"
            : "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400";
          return (
            <button key={grade} type="button" onClick={() => onChange(grade as 1 | 2 | 3)}
              className={cn(
                "w-full rounded-lg border-2 px-3 py-2 text-left transition-all",
                active ? activeCls : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:bg-muted/60",
              )}
            >
              <div className="text-[12px] font-bold">{label}</div>
              <div className="text-[10px] opacity-70">{desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── NS grade chip (summary) ───────────────────────────────────────────────────
function NsChip({ side, grade }: { side: "Left" | "Right"; grade: 1 | 2 | 3 }) {
  const dotCls = grade === 1 ? "bg-emerald-500" : grade === 2 ? "bg-amber-500" : "bg-red-500";
  const chipCls =
    grade === 1 ? "border-emerald-500/40 bg-emerald-500/7 text-emerald-600 dark:text-emerald-400"
    : grade === 2 ? "border-amber-500/40 bg-amber-500/7 text-amber-600 dark:text-amber-400"
    : "border-red-500/40 bg-red-500/7 text-red-600 dark:text-red-400";
  const gradeLabel = ["", "Intrafascial", "Interfascial", "Wide excision"][grade];
  return (
    <div className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold", chipCls)}>
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotCls)} />
      {side}: Grade {grade} — {gradeLabel}
    </div>
  );
}

// ── Bar chart ─────────────────────────────────────────────────────────────────
const TIME_LABELS = ["6 wk", "3 mo", "6 mo", "12 mo", "18 mo"];

function BarChart({ values, color, label }: {
  values: (number | null)[]; color: "blue" | "violet"; label: string;
}) {
  const barBase = color === "blue"
    ? "bg-blue-500/20 border-t-2 border-blue-500"
    : "bg-violet-500/20 border-t-2 border-violet-500";
  const textCls = color === "blue" ? "text-blue-500" : "text-violet-500";
  return (
    <div className="flex-1 min-w-0">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span className={cn("h-1.5 w-1.5 rounded-full", color === "blue" ? "bg-blue-500" : "bg-violet-500")} />
        {label} Recovery Trajectory
      </div>
      <div className="flex gap-1" style={{ height: "80px" }}>
        {values.map((val, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
            {val !== null ? (
              <>
                <div className={cn("text-[10px] font-bold", textCls)}>{val}%</div>
                <div style={{ height: `${val}%`, maxHeight: "60px", minHeight: "4px" }}
                  className={cn("w-full rounded-t", barBase)} />
              </>
            ) : (
              <>
                <div className="text-[10px] font-bold text-muted-foreground/40">N/A</div>
                <div style={{ height: "4px" }} className="w-full rounded-t bg-muted/40" />
              </>
            )}
            <div className="text-[9px] text-muted-foreground text-center leading-tight">{TIME_LABELS[i]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MF adjustment range badge ─────────────────────────────────────────────────
function RangeBadge({ range, tone }: { range: string; tone: "pos" | "neg" | "neu" }) {
  const cls =
    tone === "pos" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    : tone === "neg" ? "bg-red-500/10 text-red-500 dark:text-red-400"
    : "bg-muted/60 text-muted-foreground";
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold font-mono", cls)}>{range}</span>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function toSmokingStatus(v: string): SmokingStatus {
  return (["never","former","current"] as string[]).includes(v) ? v as SmokingStatus : "never";
}
function toExerciseLevel(v: string): ExerciseLevel {
  return (["sedentary","light","moderate","active"] as string[]).includes(v) ? v as ExerciseLevel : "moderate";
}
function toPfmtLevel(v: string): PfmtLevel {
  return (["none","basic","moderate","intensive"] as string[]).includes(v) ? v as PfmtLevel : "basic";
}
function toPde5Regimen(v: string): Pde5Regimen {
  return (["none","prn","daily"] as string[]).includes(v) ? v as Pde5Regimen : "prn";
}

// ── Main panel ────────────────────────────────────────────────────────────────
export function FunctionalOutcomesPanel() {
  const predictions = usePatientStore((s) => s.predictions);
  const patients    = usePatientStore((s) => s.patients);
  const activeId    = usePatientStore((s) => s.activeId);

  const entry = patients.find((p) => p.id === activeId) ?? null;
  const S = entry
    ? deriveClinicalFromLesions(
        clinicalStateFromRecord({ ...entry.record, lesions: entry.lesionRows }),
        lesionsFromRows(entry.lesionRows),
      )
    : null;

  // ── All hooks ─────────────────────────────────────────────────────────────
  const [nsOverrideL, setNsOverrideL] = useState<1|2|3|null>(null);
  const [nsOverrideR, setNsOverrideR] = useState<1|2|3|null>(null);

  // Patient factors (local sliders)
  const [ageLocal,  setAgeLocal]  = useState(() => S?.age  ?? 64);
  const [shimLocal, setShimLocal] = useState(() => S?.shim ?? 21);
  const [ipssLocal, setIpssLocal] = useState(() => S?.ipss ?? 8);
  const [bmiLocal,  setBmiLocal]  = useState(() => S?.bmi  ?? 27);

  // Modifiable factors
  const [pfmt,     setPfmt]     = useState<PfmtLevel>    (() => toPfmtLevel(S?.pfmt     ?? "basic"));
  const [exercise, setExercise] = useState<ExerciseLevel>(() => toExerciseLevel(S?.exercise ?? "moderate"));
  const [smoking,  setSmoking]  = useState<SmokingStatus>(() => toSmokingStatus(S?.smoking  ?? "never"));
  const [pde5,     setPde5]     = useState<Pde5Regimen>  (() => toPde5Regimen(S?.pde5     ?? "prn"));
  const [alcohol,  setAlcohol]  = useState<AlcoholLevel> ("moderate");
  const [dm,  setDm]  = useState(() => S?.dm  ?? false);
  const [htn, setHtn] = useState(() => S?.htn ?? false);
  const [cad, setCad] = useState(() => S?.cad ?? false);

  // Sync all local state when the active patient changes
  const prevActiveId = useRef(activeId);
  useEffect(() => {
    if (prevActiveId.current === activeId) return;
    prevActiveId.current = activeId;
    const st = usePatientStore.getState();
    const e  = st.patients.find((p) => p.id === activeId);
    if (!e) return;
    const cs = deriveClinicalFromLesions(
      clinicalStateFromRecord({ ...e.record, lesions: e.lesionRows }),
      lesionsFromRows(e.lesionRows),
    );
    setNsOverrideL(null); setNsOverrideR(null);
    setAgeLocal(cs.age); setShimLocal(cs.shim); setIpssLocal(cs.ipss); setBmiLocal(cs.bmi);
    setPfmt(toPfmtLevel(cs.pfmt));
    setExercise(toExerciseLevel(cs.exercise));
    setSmoking(toSmokingStatus(cs.smoking));
    setPde5(toPde5Regimen(cs.pde5));
    setDm(cs.dm); setHtn(cs.htn); setCad(cs.cad);
  }, [activeId]);

  // ── Early return ─────────────────────────────────────────────────────────
  if (!predictions || !entry || !S) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No patient data available.
        </CardContent>
      </Card>
    );
  }

  const modelNsL = predictions.nsL as 1|2|3;
  const modelNsR = predictions.nsR as 1|2|3;
  const nsL: 1|2|3 = nsOverrideL ?? modelNsL;
  const nsR: 1|2|3 = nsOverrideR ?? modelNsR;

  const result = computeFunctionalOutcomes({
    nsL, nsR,
    age: ageLocal, shim: shimLocal, ipss: ipssLocal, bmi: bmiLocal,
    pfmt, exercise, smoking, pde5, alcohol,
    dm, htn, cad,
  });

  // Per-factor adjustment ranges for the grid
  const cc = (dm ? 1 : 0) + (htn ? 1 : 0) + (cad ? 1 : 0);
  const mfGrid = [
    {
      label: `BMI (${bmiLocal.toFixed(1)})`,
      range: bmiLocal < 25 ? "±2%" : bmiLocal < 30 ? "-2 to -5%" : "-5 to -12%",
      tone: (bmiLocal < 25 ? "neu" : "neg") as "neu"|"neg"|"pos",
    },
    {
      label: "Pelvic Floor Training",
      range: ({ none:"±0%", basic:"+0–3%", moderate:"+2–5%", intensive:"+4–8%" } as Record<PfmtLevel,string>)[pfmt],
      tone: (pfmt === "none" ? "neu" : "pos") as "neu"|"neg"|"pos",
    },
    {
      label: "Exercise Level",
      range: ({ sedentary:"-2 to -5%", light:"±0%", moderate:"+1–3%", active:"+2–5%" } as Record<ExerciseLevel,string>)[exercise],
      tone: (exercise === "sedentary" ? "neg" : exercise === "light" ? "neu" : "pos") as "neu"|"neg"|"pos",
    },
    {
      label: "PDE5 Inhibitors",
      range: ({ none:"±0%", prn:"+3–5%", daily:"+5–10%" } as Record<Pde5Regimen,string>)[pde5],
      tone: (pde5 === "none" ? "neu" : "pos") as "neu"|"neg"|"pos",
    },
    {
      label: "Smoking Status",
      range: ({ never:"±0%", former:"-1 to -3%", current:"-5 to -10%" } as Record<SmokingStatus,string>)[smoking],
      tone: (smoking === "never" ? "neu" : "neg") as "neu"|"neg"|"pos",
    },
    {
      label: "Alcohol Usage",
      range: ({ none:"+1–3%", moderate:"±0%", heavy:"-8 to -12%" } as Record<AlcoholLevel,string>)[alcohol],
      tone: (alcohol === "heavy" ? "neg" : alcohol === "none" ? "pos" : "neu") as "neu"|"neg"|"pos",
    },
    {
      label: "Comorbidities",
      range: cc === 0 ? "±0%" : `-${cc * 3} to -${cc * 8}%`,
      tone: (cc === 0 ? "neu" : "neg") as "neu"|"neg"|"pos",
    },
  ];

  return (
    <div className="flex flex-col gap-4">

      {/* Header + attribution */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base font-semibold">COMPASS — Functional Outcomes</CardTitle>
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
          {/* Attribution strip */}
          <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/[0.05] px-3 py-2">
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Predictions based on outcomes from <span className="font-semibold text-foreground">Dr. Ash Tewari, M.D.</span><br />
              Chairman, Dept. of Urology · Icahn School of Medicine at Mount Sinai · 2023–2026
            </p>
            <div className="shrink-0 rounded-lg border border-primary/25 bg-card px-3 py-1.5 font-mono text-[12px] font-bold text-primary">
              n = 1,535
            </div>
          </div>
          {/* NS grade chips */}
          <div className="flex flex-wrap gap-2">
            <NsChip side="Left"  grade={nsL} />
            <NsChip side="Right" grade={nsR} />
          </div>
        </CardContent>
      </Card>

      {/* NS Grade selectors */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Nerve-Sparing Grade</CardTitle>
          <p className="text-[11px] text-muted-foreground">
            Model-predicted by default — override to plan a specific approach
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex gap-4">
            <NsGradeSelector side="Left"  value={nsL} onChange={setNsOverrideL} />
            <NsGradeSelector side="Right" value={nsR} onChange={setNsOverrideR} />
          </div>
          {(nsOverrideL !== null || nsOverrideR !== null) && (
            <div className="mt-3 flex items-center justify-between rounded-md bg-muted/40 px-3 py-1.5">
              <span className="text-[10px] text-muted-foreground">
                {nsOverrideL !== null && nsOverrideR !== null ? "Both sides" : nsOverrideL !== null ? "Left" : "Right"} overridden
                {" "}(predicted L:{modelNsL} R:{modelNsR})
              </span>
              <button type="button"
                onClick={() => { setNsOverrideL(null); setNsOverrideR(null); }}
                className="text-[10px] font-semibold text-primary hover:underline"
              >Reset</button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hero numbers */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-blue-500 to-primary" />
          <CardContent className="p-4 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              ⚡ Potency at 12 mo
            </div>
            {result.shimValid ? (
              <>
                <div className="text-4xl font-bold text-blue-500">{result.potency12}%</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">SHIM ≥12</div>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-muted-foreground/50">N/A</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">SHIM &lt; 12</div>
              </>
            )}
            {/* Delta badge */}
            <div className={cn(
              "absolute right-3 top-4 rounded-full px-2 py-0.5 text-[10px] font-bold",
              result.potencyAdj > 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : result.potencyAdj < 0 ? "bg-red-500/10 text-red-500" : "bg-muted text-muted-foreground",
            )}>
              {result.potencyAdj >= 0 ? "+" : ""}{result.potencyAdj}% adj
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-violet-500 to-primary" />
          <CardContent className="p-4 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              💧 Continence at 12 mo
            </div>
            <div className="text-4xl font-bold text-violet-500">{result.continence12}%</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">0–1 pad</div>
            {/* Delta badge */}
            <div className={cn(
              "absolute right-3 top-4 rounded-full px-2 py-0.5 text-[10px] font-bold",
              result.continenceAdj > 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : result.continenceAdj < 0 ? "bg-red-500/10 text-red-500" : "bg-muted text-muted-foreground",
            )}>
              {result.continenceAdj >= 0 ? "+" : ""}{result.continenceAdj}% adj
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SHIM < 12 warning */}
      {!result.shimValid && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-start gap-2 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              <span className="font-semibold">SHIM &lt; 12</span> — Preoperative erectile dysfunction. Potency recovery prediction is not applicable.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Recovery timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Recovery Trajectories</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 flex flex-col gap-4">
          <BarChart values={result.potencyTimeline}    color="blue"   label="Potency" />
          <BarChart values={result.continenceTimeline} color="violet" label="Continence" />
        </CardContent>
      </Card>

      {/* Patient Factors — interactive sliders */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Patient Factors</CardTitle>
          <p className="text-[11px] text-muted-foreground">Adjust to model different patient profiles</p>
        </CardHeader>
        <CardContent className="pt-0">
          <SliderField
            label="Age" value={ageLocal} min={40} max={85}
            display={`${ageLocal} yrs`}
            onChange={setAgeLocal}
          />
          <SliderField
            label="Baseline SHIM" value={shimLocal} min={1} max={25}
            display={String(shimLocal)}
            onChange={setShimLocal}
            warning={shimLocal < 12 ? "SHIM < 12 — potency prediction unavailable" : undefined}
          />
          <SliderField
            label="Baseline IPSS" value={ipssLocal} min={0} max={35}
            display={String(ipssLocal)}
            onChange={setIpssLocal}
          />
        </CardContent>
      </Card>

      {/* Modifiable Factors */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Modifiable Factors</CardTitle>
          <p className="text-[11px] text-muted-foreground">Adjust to explore how lifestyle changes affect recovery</p>
        </CardHeader>
        <CardContent className="pt-0 flex flex-col gap-3">
          <div>
            <div className="mb-1 text-[11px] font-medium text-muted-foreground">BMI</div>
            <SliderField
              label="" value={bmiLocal} min={18} max={45} step={0.5}
              display={bmiLocal.toFixed(1)}
              onChange={setBmiLocal}
            />
          </div>
          <div>
            <div className="mb-1 text-[11px] font-medium text-muted-foreground">Pelvic Floor Training (PFMT)</div>
            <SegButton<PfmtLevel>
              options={[{ label:"None", value:"none" },{ label:"Basic", value:"basic" },{ label:"Moderate", value:"moderate" },{ label:"Intensive", value:"intensive" }]}
              value={pfmt} onChange={setPfmt}
            />
          </div>
          <div>
            <div className="mb-1 text-[11px] font-medium text-muted-foreground">Exercise Level</div>
            <SegButton<ExerciseLevel>
              options={[{ label:"Sedentary", value:"sedentary" },{ label:"Light", value:"light" },{ label:"Moderate", value:"moderate" },{ label:"Active", value:"active" }]}
              value={exercise} onChange={setExercise}
            />
          </div>
          <div>
            <div className="mb-1 text-[11px] font-medium text-muted-foreground">Smoking Status</div>
            <SegButton<SmokingStatus>
              options={[{ label:"Never", value:"never" },{ label:"Former", value:"former" },{ label:"Current", value:"current" }]}
              value={smoking} onChange={setSmoking}
            />
          </div>
          <div>
            <div className="mb-1 text-[11px] font-medium text-muted-foreground">PDE5 Inhibitor Plan</div>
            <SegButton<Pde5Regimen>
              options={[{ label:"None", value:"none" },{ label:"PRN", value:"prn" },{ label:"Daily", value:"daily" }]}
              value={pde5} onChange={setPde5}
            />
          </div>
          <div>
            <div className="mb-1 text-[11px] font-medium text-muted-foreground">Alcohol Usage</div>
            <SegButton<AlcoholLevel>
              options={[{ label:"None", value:"none" },{ label:"Moderate", value:"moderate" },{ label:"Heavy", value:"heavy" }]}
              value={alcohol} onChange={setAlcohol}
            />
          </div>
          <div>
            <div className="mb-1 text-[11px] font-medium text-muted-foreground">Comorbidities</div>
            <div className="flex gap-2">
              {([["Diabetes", dm, setDm], ["HTN", htn, setHtn], ["CAD", cad, setCad]] as [string, boolean, (v: boolean) => void][]).map(
                ([label, val, set]) => (
                  <button key={label} type="button" onClick={() => set(!val)}
                    className={cn(
                      "flex-1 rounded-md border-2 px-2 py-1.5 text-[11px] font-semibold transition-all",
                      val ? "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400"
                          : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:bg-muted/60",
                    )}
                  >{label}</button>
                )
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modifiable Factor Adjustments grid */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Modifiable Factor Adjustments</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-2">
            {mfGrid.map((item) => (
              <div key={item.label}
                className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2"
              >
                <span className="text-[11px] text-muted-foreground">{item.label}</span>
                <RangeBadge range={item.range} tone={item.tone} />
              </div>
            ))}
          </div>

          {/* Net lifestyle adjustment */}
          <div className="mt-3 flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2.5">
            <span className="text-[11px] font-medium text-muted-foreground">Net lifestyle adjustment</span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                <span className={cn(
                  "font-mono text-[12px] font-bold",
                  result.potencyAdj >= 0 ? "text-blue-500" : "text-red-500"
                )}>
                  {result.potencyAdj >= 0 ? "+" : ""}{result.potencyAdj}%
                </span>
                <span className="text-[10px] text-muted-foreground">potency</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0" />
                <span className={cn(
                  "font-mono text-[12px] font-bold",
                  result.continenceAdj >= 0 ? "text-violet-500" : "text-red-500"
                )}>
                  {result.continenceAdj >= 0 ? "+" : ""}{result.continenceAdj}%
                </span>
                <span className="text-[10px] text-muted-foreground">continence</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <div className="rounded-lg border border-l-2 border-amber-500/25 border-l-amber-500 bg-amber-500/5 px-4 py-3 text-[10px] text-muted-foreground leading-relaxed">
        <span className="font-semibold text-amber-600 dark:text-amber-400">Research use only.</span>{" "}
        Based on 1,535 RALP outcomes from Dr. Ash Tewari's registry, Mount Sinai (2023–2026). Modifiable factor adjustments are literature-calibrated. Does not replace clinical judgment.
      </div>

    </div>
  );
}
