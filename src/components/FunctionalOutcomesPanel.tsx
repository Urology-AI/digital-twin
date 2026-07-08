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

/** Approximate 90% CI on logit scale (SE ≈ 0.58 logit units, z = 1.64) */
function computeCI(pct: number): { lo: number; hi: number } {
  const p = pct / 100;
  if (p <= 0.001 || p >= 0.999) return { lo: pct, hi: pct };
  const L = Math.log(p / (1 - p));
  const lo = 1 / (1 + Math.exp(-(L - 0.951)));
  const hi = 1 / (1 + Math.exp(-(L + 0.951)));
  return { lo: Math.round(Math.max(1, lo * 100)), hi: Math.round(Math.min(99, hi * 100)) };
}

// ── Info modal ────────────────────────────────────────────────────────────────
function InfoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-card shadow-xl overflow-y-auto max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">How predictions are calculated</h2>
          <button type="button" onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-lg leading-none">✕</button>
        </div>
        <div className="px-5 py-4 space-y-5 text-sm">

          <section>
            <h3 className="font-semibold mb-1.5">Nerve-Sparing Grade (1–3)</h3>
            <p className="text-muted-foreground text-xs mb-2">
              Assigned per side from biopsy, MRI, and ECE model output.
            </p>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1 pr-3 font-semibold">Grade</th>
                  <th className="text-left py-1 pr-3 font-semibold">Meaning</th>
                  <th className="text-left py-1 font-semibold">When assigned</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/40">
                  <td className="py-1 pr-3 text-emerald-600 dark:text-emerald-400 font-bold">1 — Full</td>
                  <td className="py-1 pr-3">Intrafascial</td>
                  <td className="py-1">No cancer on side, or GG ≤ 2, ≤ 2 cores, ECE &lt; 10%</td>
                </tr>
                <tr className="border-b border-border/40">
                  <td className="py-1 pr-3 text-amber-600 dark:text-amber-400 font-bold">2 — Partial</td>
                  <td className="py-1 pr-3">Interfascial</td>
                  <td className="py-1">Cancer present, moderate ECE risk</td>
                </tr>
                <tr>
                  <td className="py-1 pr-3 text-red-600 dark:text-red-400 font-bold">3 — Sacrifice</td>
                  <td className="py-1 pr-3">Wide excision</td>
                  <td className="py-1">Posterolateral ECE ≥ 30%, base ECE, SVI ≥ 25%, or MRI EPE + posterior ECE</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <h3 className="font-semibold mb-1.5">Recovery Trajectories</h3>
            <p className="text-muted-foreground text-xs mb-2">
              Base rates come from NS-grade lookup tables (COMPASS institutional cohort), then adjusted for individual factors.
            </p>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1 pr-3 font-semibold">NS scenario</th>
                  <th className="text-left py-1 pr-3 font-semibold">Potency 12 mo</th>
                  <th className="text-left py-1 font-semibold">Continence 12 mo</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                {[
                  ["Both Grade 1", "90%", "96%"],
                  ["One G1, one G2", "85%", "95%"],
                  ["Both Grade 2", "81%", "94%"],
                  ["One G3, one G1", "~82%", "~93%"],
                  ["One G3, one G2", "84%", "93%"],
                  ["Both Grade 3", "72%", "89%"],
                ].map(([s, p, c]) => (
                  <tr key={s} className="border-b border-border/40">
                    <td className="py-1 pr-3">{s}</td>
                    <td className="py-1 pr-3">{p}</td>
                    <td className="py-1">{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h3 className="font-semibold mb-1.5">Individual Adjustments</h3>
            <p className="text-muted-foreground text-xs mb-2">
              Applied as percentage-point deltas on top of the base rate. The <span className="font-semibold">adj</span> badge shows the net total.
            </p>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1 pr-3 font-semibold">Factor</th>
                  <th className="text-left py-1 pr-3 font-semibold">Potency</th>
                  <th className="text-left py-1 font-semibold">Continence</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                {[
                  ["Age ≤ 50", "×1.10", "—"],
                  ["Age 65–70", "×0.85–0.95", "×0.95"],
                  ["SHIM 21–25 (required)", "×1.0", "—"],
                  ["SHIM 12–16", "×0.85–0.92", "—"],
                  ["SHIM < 12", "N/A (not shown)", "—"],
                  ["Daily PDE5i", "+8 pp", "—"],
                  ["Intensive PFMT", "+6 pp", "+10 pp"],
                  ["Active exercise", "+4 pp", "+3 pp"],
                  ["Obesity (BMI ≥ 30)", "−8 pp", "−5 pp"],
                  ["Diabetes", "−8 pp", "−3 pp"],
                  ["Current smoker", "−8 pp", "−2 pp"],
                  ["Heavy alcohol", "−10 pp", "−2 pp"],
                  ["High IPSS (>19)", "—", "−10 pp"],
                ].map(([f, p, c]) => (
                  <tr key={f} className="border-b border-border/40">
                    <td className="py-1 pr-3">{f}</td>
                    <td className="py-1 pr-3">{p}</td>
                    <td className="py-1">{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <p className="text-xs text-muted-foreground border-t border-border pt-3">
            These are population-level probabilities from the COMPASS cohort (IRB STUDY-14-00050, Mount Sinai). Not a guarantee for any individual. Final NS grade may change intraoperatively.
          </p>
        </div>
      </div>
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
  const [infoOpen, setInfoOpen] = useState(false);

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
      <InfoModal open={infoOpen} onClose={() => setInfoOpen(false)} />

      {/* NS Grade selectors */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Nerve-Sparing Grade</CardTitle>
            <button type="button" onClick={() => setInfoOpen(true)}
              className="flex h-5 w-5 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 text-[11px] font-bold leading-none transition-colors"
              title="How NS grade and outcomes are calculated"
            >i</button>
          </div>
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
                {(() => { const ci = computeCI(result.potency12 ?? 0); return (
                  <div className="text-[10px] leading-tight text-muted-foreground/60 mt-0.5">{ci.lo}–{ci.hi}%</div>
                ); })()}
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
            {(() => { const ci = computeCI(result.continence12); return (
              <div className="text-[10px] leading-tight text-muted-foreground/60 mt-0.5">{ci.lo}–{ci.hi}%</div>
            ); })()}
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
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold">Recovery Trajectories</CardTitle>
              <button type="button" onClick={() => setInfoOpen(true)}
                className="flex h-5 w-5 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 text-[11px] font-bold leading-none transition-colors"
                title="How trajectories are calculated"
              >i</button>
            </div>
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
