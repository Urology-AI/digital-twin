import { useState, useEffect, useRef } from "react";
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
      <div className="mb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{side}</div>
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
                "w-full rounded-lg border-2 px-3 py-2.5 text-left transition-all",
                active ? activeCls : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:bg-muted/60",
              )}
            >
              <div className="text-sm font-bold">{label}</div>
              <div className="text-xs opacity-70">{desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}


// ── Line chart ────────────────────────────────────────────────────────────────
const TIME_LABELS = ["6 wk", "3 mo", "6 mo", "12 mo", "18 mo"];

function RecoveryLineChart({ potency, continence }: {
  potency: (number | null)[];
  continence: (number | null)[];
}) {
  const W = 400, H = 140;
  const padL = 34, padR = 12, padT = 22, padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = TIME_LABELS.length;

  const xOf = (i: number) => padL + (i / (n - 1)) * plotW;
  const yOf = (v: number) => padT + (1 - v / 100) * plotH;

  function buildPath(vals: (number | null)[]) {
    let d = "", pen = false;
    vals.forEach((v, i) => {
      if (v === null) { pen = false; return; }
      d += `${pen ? "L" : "M"}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)} `;
      pen = true;
    });
    return d;
  }

  const grids = [25, 50, 75, 100];
  const potencyHasData = potency.some(v => v !== null);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" style={{ height: H }}>
      {/* Grid lines */}
      {grids.map(g => (
        <line key={g} x1={padL} y1={yOf(g)} x2={W - padR} y2={yOf(g)}
          stroke="currentColor" strokeOpacity={0.08} strokeWidth={1} />
      ))}
      {/* Y-axis labels */}
      {grids.map(g => (
        <text key={g} x={padL - 6} y={yOf(g)} textAnchor="end" dominantBaseline="middle"
          fill="currentColor" fillOpacity={0.35} fontSize={9}>{g}%</text>
      ))}
      {/* X-axis baseline */}
      <line x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH}
        stroke="currentColor" strokeOpacity={0.15} strokeWidth={1} />
      {/* X-axis labels */}
      {TIME_LABELS.map((lbl, i) => (
        <text key={i} x={xOf(i)} y={H - 4} textAnchor="middle"
          fill="currentColor" fillOpacity={0.45} fontSize={10}>{lbl}</text>
      ))}

      {/* Continence line + dots */}
      <path d={buildPath(continence)} fill="none" stroke="#8b5cf6" strokeWidth={2.5}
        strokeLinecap="round" strokeLinejoin="round" />
      {continence.map((v, i) => v !== null && (
        <g key={i}>
          <circle cx={xOf(i)} cy={yOf(v)} r={3.5} fill="#8b5cf6" />
          <text x={xOf(i)} y={yOf(v) + 14} textAnchor="middle" fill="#8b5cf6" fontSize={9} fontWeight="bold">{v}%</text>
        </g>
      ))}

      {/* Potency line + dots (only if SHIM valid) */}
      {potencyHasData && (
        <>
          <path d={buildPath(potency)} fill="none" stroke="#3b82f6" strokeWidth={2.5}
            strokeLinecap="round" strokeLinejoin="round" />
          {potency.map((v, i) => v !== null && (
            <g key={i}>
              <circle cx={xOf(i)} cy={yOf(v)} r={3.5} fill="#3b82f6" />
              <text x={xOf(i)} y={yOf(v) - 8} textAnchor="middle" fill="#3b82f6" fontSize={9} fontWeight="bold">{v}%</text>
            </g>
          ))}
        </>
      )}
    </svg>
  );
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

  // Reset NS overrides when the active patient changes
  const prevActiveId = useRef(activeId);
  useEffect(() => {
    if (prevActiveId.current === activeId) return;
    prevActiveId.current = activeId;
    setNsOverrideL(null);
    setNsOverrideR(null);
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
    age: S.age, shim: S.shim, ipss: S.ipss, bmi: S.bmi,
    pfmt: toPfmtLevel(S.pfmt),
    exercise: toExerciseLevel(S.exercise),
    smoking: toSmokingStatus(S.smoking),
    pde5: toPde5Regimen(S.pde5),
    alcohol: (S.alcohol || "moderate") as AlcoholLevel,
    dm: S.dm, htn: S.htn, cad: S.cad,
  });

  return (
    <div className="flex flex-col gap-4">

      {/* NS Grade selectors */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Nerve-Sparing Grade</CardTitle>
          <p className="text-xs text-muted-foreground">
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
              <span className="text-xs text-muted-foreground">
                {nsOverrideL !== null && nsOverrideR !== null ? "Both sides" : nsOverrideL !== null ? "Left" : "Right"} overridden
                {" "}(predicted L:{modelNsL} R:{modelNsR})
              </span>
              <button type="button"
                onClick={() => { setNsOverrideL(null); setNsOverrideR(null); }}
                className="text-xs font-semibold text-primary hover:underline"
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
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Potency at 12 mo
            </div>
            {result.shimValid ? (
              <>
                <div className="text-5xl font-bold text-blue-500">{result.potency12}%</div>
                <div className="text-xs text-muted-foreground mt-0.5">SHIM ≥12</div>
              </>
            ) : (
              <>
                <div className="text-3xl font-bold text-muted-foreground/50">N/A</div>
                <div className="text-xs text-muted-foreground mt-0.5">SHIM &lt; 12</div>
              </>
            )}
            {/* Delta badge */}
            <div className={cn(
              "absolute right-3 top-4 rounded-full px-2 py-0.5 text-xs font-bold",
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
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Continence at 12 mo
            </div>
            <div className="text-5xl font-bold text-violet-500">{result.continence12}%</div>
            <div className="text-xs text-muted-foreground mt-0.5">0–1 pad</div>
            {/* Delta badge */}
            <div className={cn(
              "absolute right-3 top-4 rounded-full px-2 py-0.5 text-xs font-bold",
              result.continenceAdj > 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : result.continenceAdj < 0 ? "bg-red-500/10 text-red-500" : "bg-muted text-muted-foreground",
            )}>
              {result.continenceAdj >= 0 ? "+" : ""}{result.continenceAdj}% adj
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Recovery timeline */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Recovery Trajectories</CardTitle>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {result.shimValid && (
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-4 rounded-full bg-blue-500 inline-block" />
                  Potency
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-4 rounded-full bg-violet-500 inline-block" />
                Continence
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 pb-3">
          <RecoveryLineChart
            potency={result.shimValid ? result.potencyTimeline : result.potencyTimeline.map(() => null)}
            continence={result.continenceTimeline}
          />
        </CardContent>
      </Card>


    </div>
  );
}
