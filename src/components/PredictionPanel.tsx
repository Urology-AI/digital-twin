import { Button } from "@/components/ui/button";
import { predictEcePatient, clampEcePatient } from "@/lib/models/ece";
import { predictSviPatient } from "@/lib/models/svi";
import { predictLni } from "@/lib/models/lni";
import { predictBcrPreop } from "@/lib/models/bcr";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PREDICTION_EXPLANATIONS } from "@/lib/compass/explainPrediction";
import { usePatientStore } from "@/store/patientStore";
import { useUiStore } from "@/store/uiStore";
import {
  deriveClinicalFromLesions,
  lesionsFromRows,
} from "@/lib/utils/normalization";
import { clinicalStateFromRecord } from "@/lib/compass/clinicalFromRecord";
import { cn } from "@/lib/utils";

// NS Grade → PSM → BCR data from 5,003-side database
const NSG_DATA = {
  1: { psm: 11.6, bcr_no: 3.4, bcr_psm: 3.3, apex_psm: 3.0, apex_bcr: 5, pl_psm: 0.8, pl_bcr: 0, base_psm: 1.6, base_bcr: 0, ant_psm: 1.7, ant_bcr: 0, post_psm: 3.0, post_bcr: 0 },
  2: { psm: 12.0, bcr_no: 9.2, bcr_psm: 16.0, apex_psm: 2.5, apex_bcr: 20, pl_psm: 1.2, pl_bcr: 8, base_psm: 1.8, base_bcr: 23, ant_psm: 1.5, ant_bcr: 6, post_psm: 3.0, post_bcr: 20 },
  3: { psm: 16.7, bcr_no: 21.6, bcr_psm: 27.6, apex_psm: 1.8, apex_bcr: 15, pl_psm: 0.7, pl_bcr: 25, base_psm: 4.4, base_bcr: 37, ant_psm: 1.4, ant_bcr: 25, post_psm: 3.3, post_bcr: 28 },
} as const;

const STATION_FP: Record<string, { fp: number; note: string }> = {
  "external iliac": { fp: 90, note: "Highest FP rate — 90% benign. Predominantly low-grade patients." },
  "internal iliac": { fp: 20, note: "Low FP rate — high clinical significance." },
  "obturator": { fp: 25, note: "Low FP rate — clinically significant when positive." },
  "common iliac": { fp: 50, note: "Moderate FP rate. Concerning if high SUV." },
  "perirectal": { fp: 15, note: "Rare but concerning. Low FP rate." },
  "presacral": { fp: 30, note: "Moderate concern." },
  "paraaortic": { fp: 40, note: "Extended field. May indicate higher stage." },
  "inguinal": { fp: 70, note: "Often reactive." },
  "retroperitoneal": { fp: 50, note: "Moderate concern. Check SUVmax." },
};

function riskCls(v: number) {
  if (v < 0.15) return "text-emerald-500";
  if (v < 0.3) return "text-amber-500";
  return "text-red-500";
}

/** Approximate 90% CI on logit scale (SE ≈ 0.58 logit units, z = 1.64) */
function computeCI(p: number): { lo: number; hi: number } {
  if (p <= 0.001 || p >= 0.999) return { lo: p, hi: p };
  const L = Math.log(p / (1 - p));
  const lo = 1 / (1 + Math.exp(-(L - 0.951)));
  const hi = 1 / (1 + Math.exp(-(L + 0.951)));
  return { lo: Math.max(0.01, lo), hi: Math.min(0.99, hi) };
}

function bcrColor(pct: number) {
  if (pct === 0) return "text-emerald-500";
  if (pct < 15) return "text-amber-500";
  return "text-red-500";
}

interface LnNode {
  location?: string;
  suv?: number;
  side?: string;
}

function NsGradeTag({ grade }: { grade: number }) {
  return (
    <span
      className={cn(
        "rounded px-2 py-0.5 text-sm font-bold",
        grade === 1
          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          : grade === 2
            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
            : "bg-red-500/15 text-red-600 dark:text-red-400",
      )}
    >
      Grade {grade}
    </span>
  );
}

export function PredictionPanel() {
  const predictions = usePatientStore((s) => s.predictions);
  const patients = usePatientStore((s) => s.patients);
  const activeId = usePatientStore((s) => s.activeId);
  const entry = patients.find((p) => p.id === activeId);
  const setExplainKey = useUiStore((s) => s.setExplainKey);

  if (!predictions || !entry) {
    return (
      <Card className="border-dashed border-border/80 bg-muted/10">
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Select a patient to run COMPASS models.
          </p>
        </CardContent>
      </Card>
    );
  }

  const record = { ...entry.record, lesions: entry.lesionRows };
  const S = deriveClinicalFromLesions(
    clinicalStateFromRecord(record),
    lesionsFromRows(entry.lesionRows),
  );

  const isHighRisk = S.gg >= 4 || S.psa > 20;
  const psmaLn = S.psma_ln || 0;
  const lniRisk = predictions.lni;

  // SVI: only colour when ≥ 10%
  const sviNeutral = predictions.svi < 0.10;

  const preds = [
    { k: "ECE",     v: predictions.ece,     neutral: false },
    { k: "SVI",     v: predictions.svi,     neutral: sviNeutral },
    { k: "Upgrade", v: predictions.upgrade, neutral: false },
    { k: "PSM",     v: predictions.psm,     neutral: false },
    { k: "BCR",     v: predictions.bcr,     neutral: false },
    { k: "LNI",     v: predictions.lni,     neutral: false },
  ] as const;

  // NS zone detail
  const L = predictions.nsDetailL ?? { nsGrade: predictions.nsL, zones: {}, alerts: [], has_zone_data: false };
  const R = predictions.nsDetailR ?? { nsGrade: predictions.nsR, zones: {}, alerts: [], has_zone_data: false };
  const zones5 = [
    { k: "posterolateral", l: "Posterolateral" },
    { k: "base", l: "Base" },
    { k: "apex", l: "Apex" },
    { k: "anterior", l: "Anterior" },
    { k: "bladder_neck", l: "Bladder Neck" },
  ];
  let lHasZones = L.has_zone_data;
  let rHasZones = R.has_zone_data;
  zones5.forEach((z) => {
    if ((L.zones?.[z.k] ?? 0) > 0) lHasZones = true;
    if ((R.zones?.[z.k] ?? 0) > 0) rHasZones = true;
  });

  const gradesToShow =
    predictions.nsL === predictions.nsR
      ? [{ grade: predictions.nsL, label: `Grade ${predictions.nsL}`, isLeft: true }]
      : [
          { grade: predictions.nsL, label: `L Grade ${predictions.nsL}`, isLeft: true },
          { grade: predictions.nsR, label: `R Grade ${predictions.nsR}`, isLeft: false },
        ];

  let plndTitle: string, plndColor: string;
  if (!isHighRisk && !psmaLn) {
    plndTitle = "Consider Omitting PLND";
    plndColor = "border-l-emerald-500";
  } else if (!isHighRisk && psmaLn) {
    plndTitle = "Limited PLND";
    plndColor = "border-l-amber-500";
  } else if (isHighRisk && !psmaLn) {
    plndTitle = "Extended PLND Recommended";
    plndColor = "border-l-amber-500";
  } else {
    plndTitle = "Extended PLND — High Priority";
    plndColor = "border-l-red-500";
  }

  const lymphNodes = (entry.record.staging?.lymph_nodes_psma ?? null) as LnNode[] | null;

  return (
    <TooltipProvider delayDuration={200}>
      <Card className="border-border/70" data-tutorial="prediction-panel">
        <CardHeader className="border-b border-border/50 bg-gradient-to-br from-muted/40 to-transparent pb-4 dark:from-muted/25">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl font-semibold text-foreground">
                COMPASS predictions
              </CardTitle>
              <CardDescription>
                Preoperative outcome predictions at time of radical prostatectomy.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0 text-sm"
              onClick={() => setExplainKey("overview")}
            >
              Explain
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {/* 6 prediction value cards — extra top margin so floating overlays
              (e.g. CSPCA-by-zone popout from the 3D canvas) don't overlap. */}
          <div className="mb-4 mt-4 grid grid-cols-3 gap-2 sm:gap-3">
            {preds.map((p) => {
              const ci = computeCI(p.v);
              return (
                <Tooltip key={p.k}>
                  <TooltipTrigger asChild>
                    <div className="rounded-xl border border-border/70 bg-card px-2 py-2 text-center shadow-sm transition-shadow hover:shadow-md cursor-default sm:px-3 sm:py-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">{p.k}</div>
                      <div className={cn("text-xl font-bold tabular-nums sm:text-2xl lg:text-3xl", p.neutral ? "text-muted-foreground/50" : riskCls(p.v))}>
                        {Math.round(p.v * 100)}%
                      </div>
                      {p.neutral
                        ? <div className="text-[10px] leading-tight text-muted-foreground/40 sm:text-xs">low</div>
                        : <div className="text-[10px] leading-tight text-muted-foreground/35 sm:text-xs">{Math.round(ci.lo * 100)}–{Math.round(ci.hi * 100)}%</div>
                      }
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[220px]">
                    {PREDICTION_EXPLANATIONS[p.k] ?? p.k}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          {/* Two-column layout: NS (left) + Surgical Consequence + PLND (right) — stacks on narrow */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

            {/* Left: Nerve Sparing 5-zone */}
            <div data-tutorial="ns-grades">
              <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary">Nerve sparing — 5-zone</div>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-1.5 pr-2 font-medium" />
                    <th className="px-2 py-1.5 font-medium">Left</th>
                    <th className="px-2 py-1.5 font-medium">Right</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/60">
                    <td className="py-1.5 font-medium">Side ECE</td>
                    <td className={cn("py-1.5 px-2", riskCls(predictions.eceL))}>{Math.round(predictions.eceL * 100)}%</td>
                    <td className={cn("py-1.5 px-2", riskCls(predictions.eceR))}>{Math.round(predictions.eceR * 100)}%</td>
                  </tr>
                  {predictions.ece >= 0.05 && (
                    <tr className="border-b border-border/60 text-muted-foreground">
                      <td className="py-1.5">If ECE</td>
                      <td colSpan={2} className="px-2 py-1.5">
                        <span className="text-emerald-500">{Math.round((1 - predictions.extensive) * 100)}% focal</span>
                        {" · "}
                        <span className={predictions.extensive >= 0.5 ? "text-red-500" : "text-amber-500"}>{Math.round(predictions.extensive * 100)}% extensive</span>
                      </td>
                    </tr>
                  )}
                  {zones5.map((z) => {
                    const lv = (L.zones?.[z.k] ?? 0) as number;
                    const rv = (R.zones?.[z.k] ?? 0) as number;
                    return (
                      <tr key={z.k} className="border-b border-border/40 text-muted-foreground">
                        <td className="py-1.5">{z.l}</td>
                        <td className={cn("px-2 py-1.5", lHasZones ? riskCls(lv) : "")}>
                          {lHasZones ? (lv > 0 && lv < 0.005 ? "< 1%" : `${Math.round(lv * 100)}%`) : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className={cn("px-2 py-1.5", rHasZones ? riskCls(rv) : "")}>
                          {rHasZones ? (rv > 0 && rv < 0.005 ? "< 1%" : `${Math.round(rv * 100)}%`) : <span className="text-muted-foreground/40">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td className="py-1.5 font-bold">NS grade</td>
                    <td className="px-2 py-1.5"><NsGradeTag grade={predictions.nsL} /></td>
                    <td className="px-2 py-1.5"><NsGradeTag grade={predictions.nsR} /></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Right: Surgical Consequence + PLND Decision */}
            <div>
              {gradesToShow.map((gs, idx) => {
                const g = gs.grade as 1 | 2 | 3;
                if (g < 1 || g > 3) return null;
                const gd = NSG_DATA[g];
                return (
                  <div key={gs.label} className={cn(idx > 0 && "mt-3 border-t border-border pt-3")}>
                    <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary">Surgical Consequence — {gs.label}</div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded border border-border bg-muted/30 p-2 text-center">
                        <div className="text-xs text-muted-foreground">PSM Rate</div>
                        <div className="text-base font-bold text-amber-500">{gd.psm}%</div>
                      </div>
                      <div className="rounded border border-border bg-muted/30 p-2 text-center">
                        <div className="text-xs text-muted-foreground">BCR if PSM−</div>
                        <div className={cn("text-base font-bold", bcrColor(gd.bcr_no))}>{gd.bcr_no}%</div>
                      </div>
                      <div className="rounded border border-border bg-muted/30 p-2 text-center">
                        <div className="text-xs text-muted-foreground">BCR if PSM+</div>
                        <div className={cn("text-base font-bold", bcrColor(gd.bcr_psm))}>{gd.bcr_psm}%</div>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className={cn(
                "mb-2 text-sm font-semibold uppercase tracking-wide text-primary",
                gradesToShow.length > 0 && "mt-3 border-t border-border pt-3",
              )}>PLND decision</div>
              <div className={cn("mb-3 rounded-md border border-border border-l-4 bg-muted/30 p-3", plndColor)}>
                <div className="text-base font-bold">{plndTitle}</div>
              </div>
              <div className="mb-3 grid grid-cols-3 gap-2">
                <div className="rounded border border-border bg-muted/30 p-2.5 text-center">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">LNI Risk</div>
                  <div className={cn("text-lg font-bold", lniRisk < 0.05 ? "text-emerald-500" : lniRisk < 0.15 ? "text-amber-500" : "text-red-500")}>{Math.round(lniRisk * 100)}%</div>
                </div>
                <div className="rounded border border-border bg-muted/30 p-2.5 text-center">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">NCCN Risk</div>
                  <div className={cn("text-lg font-bold", isHighRisk ? "text-red-500" : "text-emerald-500")}>{isHighRisk ? "High" : "Non-High"}</div>
                </div>
                <div className="rounded border border-border bg-muted/30 p-2.5 text-center">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">PSMA LN</div>
                  <div className={cn("text-lg font-bold", psmaLn ? "text-red-500" : "text-emerald-500")}>{psmaLn ? "Positive" : "Negative"}</div>
                </div>
              </div>

              {psmaLn > 0 && Array.isArray(lymphNodes) && lymphNodes.length > 0 && (
                <div>
                  <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary">PSMA LN+ Station Analysis</div>
                  <div className="space-y-2">
                    {lymphNodes.map((ln, i) => {
                      const loc = (ln.location ?? "").toLowerCase();
                      const suv = ln.suv ?? 0;
                      const side = ln.side === "L" ? "Left" : ln.side === "R" ? "Right" : "Bilateral";
                      const matchedKey = Object.keys(STATION_FP).find((k) => loc.includes(k));
                      const fpData = (matchedKey ? STATION_FP[matchedKey] : null) ?? { fp: 50, note: "Station not characterized." };
                      let suvLabel: string, suvCls: string;
                      if (suv > 6) { suvLabel = "Likely true positive"; suvCls = "text-red-500"; }
                      else if (suv >= 3.5) { suvLabel = "Indeterminate"; suvCls = "text-amber-500"; }
                      else if (suv > 0) { suvLabel = "Likely reactive"; suvCls = "text-emerald-500"; }
                      else { suvLabel = "No SUV data"; suvCls = "text-muted-foreground"; }
                      return (
                        <div key={i} className="rounded border border-border bg-muted/30 p-2 text-sm">
                          <div className="font-semibold capitalize">{matchedKey ?? loc} <span className="font-normal text-muted-foreground">({side})</span></div>
                          {suv > 0 && <div className="mt-0.5">SUV: <span className={cn("font-bold", suvCls)}>{suv}</span> — {suvLabel}</div>}
                          <div className="mt-0.5 text-muted-foreground">Station FP: <span className={cn("font-bold", fpData.fp >= 30 ? "text-amber-500" : "text-emerald-500")}>{fpData.fp}%</span></div>
                          <div className="mt-0.5 text-xs text-muted-foreground/70">{fpData.note}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Multi-case comparison */}
          {patients.length > 1 && (
            <details className="group">
              <summary className="flex cursor-pointer list-none select-none items-center justify-between rounded-md px-1 py-1.5 text-sm font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
                <span>Multi-case comparison ({patients.length} cases)</span>
                <svg className="h-3 w-3 shrink-0 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 3.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </summary>
              <div className="mt-1 overflow-x-auto rounded-lg border border-border/50 bg-muted/20">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-1.5 pl-2 pr-1 font-medium">Case</th>
                      <th className="px-1 py-1.5 text-center font-medium">ECE</th>
                      <th className="px-1 py-1.5 text-center font-medium">SVI</th>
                      <th className="px-1 py-1.5 text-center font-medium">LNI</th>
                      <th className="px-1 py-1.5 pr-2 text-center font-medium">BCR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patients.map((pat) => {
                      const isActive = pat.id === activeId;
                      const rec = { ...pat.record, lesions: pat.lesionRows };
                      const S0 = clinicalStateFromRecord(rec);
                      const S = deriveClinicalFromLesions(S0, lesionsFromRows(pat.lesionRows));
                      const ece = clampEcePatient(predictEcePatient(S));
                      const svi = predictSviPatient(S);
                      const lni = predictLni(S);
                      const bcr = predictBcrPreop(S);
                      return (
                        <tr
                          key={pat.id}
                          className={cn(
                            "border-b border-border/30 last:border-0",
                            isActive && "bg-primary/5",
                          )}
                        >
                          <td className="max-w-[72px] truncate py-1.5 pl-2 pr-1">
                            <span className={cn("font-medium", isActive && "text-primary")}>
                              {isActive && <span className="mr-0.5">▶</span>}{pat.name}
                            </span>
                          </td>
                          <td className={cn("px-1 py-1.5 text-center font-bold tabular-nums", riskCls(ece))}>
                            {Math.round(ece * 100)}%
                          </td>
                          <td className={cn("px-1 py-1.5 text-center font-bold tabular-nums", svi < 0.1 ? "text-muted-foreground/40" : riskCls(svi))}>
                            {Math.round(svi * 100)}%
                          </td>
                          <td className={cn("px-1 py-1.5 text-center font-bold tabular-nums", riskCls(lni))}>
                            {Math.round(lni * 100)}%
                          </td>
                          <td className={cn("px-1 py-1.5 pr-2 text-center font-bold tabular-nums", riskCls(bcr))}>
                            {Math.round(bcr * 100)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          )}

        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
