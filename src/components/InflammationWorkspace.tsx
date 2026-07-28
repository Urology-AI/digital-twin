import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, FileJson, Play, RotateCcw, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useInflammationStore } from "@/store/inflammationStore";
import { DEFAULT_INFLAMMATION_CONFIG, nsGrade, scoreSide } from "@/lib/inflammation/model";
import { exportCSV, saveJSON } from "@/lib/inflammation/exportRow";
import { validateCohort, type CohortValidationSummary } from "@/lib/inflammation/validation";
import { cohortSchema } from "@/types/inflammation";
import { InflammationSourcesModal } from "@/components/InflammationSourcesModal";
import type {
  InflammationConfig,
  PatientInflammationInput,
  SideInflammationInput,
  SideInflammationResult,
} from "@/types/inflammation";

/* ---------------------------------------------------------------------- */
/* Field descriptors — mirrors the standalone HTML instrument             */
/* ---------------------------------------------------------------------- */

type FieldDef<T> =
  | { id: keyof T; t: "num"; l: string; h?: string; step?: number; plausible?: [number, number] }
  | { id: keyof T; t: "sel"; l: string; h?: string; o: [string, string][] }
  | { id: keyof T; t: "chk"; l: string }
  | { group: string };

const PATIENT_FIELDS: FieldDef<PatientInflammationInput>[] = [
  { id: "psa", t: "num", l: "Serum PSA", h: "ng/mL", step: 0.1, plausible: [0.1, 500] },
  { id: "vol", t: "num", l: "Prostate volume", h: "mL", step: 1, plausible: [10, 200] },
  { id: "priorBx", t: "sel", l: "Prior biopsy sessions", h: "count", o: [["", "—"], ["1", "1"], ["2", "2"], ["3", "3 or more"]] },
  { id: "route", t: "sel", l: "Biopsy route", h: "approach", o: [["", "—"], ["tp", "Transperineal"], ["tr", "Transrectal"]] },
  { id: "bxMri", t: "num", l: "Biopsy → MRI interval", h: "days", step: 1, plausible: [0, 365] },
  { id: "bxSurg", t: "num", l: "Biopsy → surgery interval", h: "days", step: 1, plausible: [0, 365] },
  { id: "bmi", t: "num", l: "BMI", h: "kg/m²", step: 0.1, plausible: [14, 60] },
  { id: "mets", t: "sel", l: "Metabolic syndrome components", h: "0–5", o: [["", "—"], ["0", "0"], ["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"]] },
  { id: "crp", t: "num", l: "CRP", h: "mg/L", step: 0.1, plausible: [0, 200] },
  { id: "nlr", t: "num", l: "Neutrophil–lymphocyte ratio", h: "ratio", step: 0.1, plausible: [0.3, 20] },
  { id: "priorIntv", t: "chk", l: "Prior TURP, focal therapy, BCG, or documented chronic prostatitis" },
  { id: "psaPrior", t: "num", l: "Prior PSA (earlier timepoint)", h: "ng/mL", step: 0.1, plausible: [0.1, 500] },
  { id: "psaPriorMonths", t: "num", l: "Interval since prior PSA", h: "months", step: 1, plausible: [0, 120] },
];

const SIDE_FIELDS: FieldDef<SideInflammationInput>[] = [
  { group: "MRI — capsular interface geometry" },
  { id: "ccl", t: "num", l: "Capsular contact length", h: "mm", step: 1, plausible: [0, 60] },
  { id: "angle", t: "num", l: "Contact angle", h: "degrees", step: 1, plausible: [0, 180] },
  { id: "caps", t: "sel", l: "Capsular integrity", h: "0–2", o: [["", "—"], ["0", "0 intact"], ["1", "1 thinned"], ["2", "2 interrupted"]] },
  { id: "epeGr", t: "sel", l: "Mehralivand EPE grade", h: "0–3", o: [["", "—"], ["0", "0"], ["1", "1"], ["2", "2"], ["3", "3"]] },
  { id: "morph", t: "sel", l: "Periprostatic abnormality shape", h: "pattern", o: [["", "—"], ["nod", "Nodular / mass-like"], ["band", "Band, wedge or reticular"], ["none", "No periprostatic change"]] },
  { id: "anch", t: "sel", l: "Contiguous with PI-RADS 4–5 lesion", h: "anchoring", o: [["", "—"], ["yes", "Yes — anchored"], ["no", "No — free-standing"]] },

  { group: "MRI — quantitative" },
  { id: "adcI", t: "num", l: "ADC at tumour–capsule interface", h: "×10⁻³", step: 0.01, plausible: [0.3, 2.5] },
  { id: "adcL", t: "num", l: "ADC of index lesion core", h: "×10⁻³", step: 0.01, plausible: [0.3, 2.5] },
  { id: "t2Ratio", t: "num", l: "T2 signal ratio (interface / contralateral fat)", h: "ratio", step: 0.01, plausible: [0.3, 3] },
  { id: "dce", t: "sel", l: "DCE curve at the interface", h: "type", o: [["", "—"], ["3", "Type 3 washout"], ["12", "Type 1–2, rim or delayed"]] },
  { id: "t1hi", t: "chk", l: "T1 hyperintensity at capsule (haemorrhage or thrombosed vein)" },

  { group: "Periprostatic soft tissue" },
  { id: "fatPl", t: "sel", l: "Fat plane character", h: "0–2", o: [["", "—"], ["0", "0 preserved"], ["1", "1 reticular / stranded"], ["2", "2 effaced"]] },
  { id: "pdff", t: "chk", l: "Reduced periprostatic fat fraction vs. contralateral (Dixon PDFF)" },
  { id: "sym", t: "chk", l: "Bilateral, roughly symmetric periprostatic change" },
  { id: "vein", t: "chk", l: "Prominent or asymmetric periprostatic venous plexus" },

  { group: "Periprostatic adipose tissue (PPAT)" },
  { id: "rwo", t: "num", l: "Chemical-shift water:oil ratio (RWO)", h: "index", step: 1, plausible: [0, 100] },
  { id: "ppatFibrosis", t: "chk", l: "High PPAT radiomic fiber complexity (T1W)" },
  { id: "ppatGeom", t: "chk", l: "Altered PPAT geometric shape descriptors" },

  { group: "PSMA PET" },
  { id: "suvL", t: "num", l: "SUVmax of index intraprostatic lesion", h: "SUV", step: 0.1, plausible: [0, 40] },
  { id: "suvP", t: "num", l: "SUVmax at the capsular contact", h: "SUV", step: 0.1, plausible: [0, 40] },
  { id: "psmaFocalUptake", t: "chk", l: "Focal periprostatic uptake, distinct from lesion (not diffuse/background)" },

  { group: "Micro-ultrasound (ExactVu)" },
  { id: "mus1", t: "chk", l: "Capsular bulging" },
  { id: "mus2", t: "chk", l: "Visible capsular breach" },
  { id: "mus3", t: "chk", l: "Hypoechoic halo" },
  { id: "mus4", t: "chk", l: "Obliteration of vesiculo-prostatic angle" },

  { group: "Biopsy — oncological" },
  { id: "gg", t: "sel", l: "Highest ipsilateral grade group", h: "1–5", o: [["", "—"], ["1", "GG 1"], ["2", "GG 2"], ["3", "GG 3"], ["4", "GG 4"], ["5", "GG 5"]] },
  { id: "posC", t: "num", l: "Ipsilateral positive cores", h: "percent", step: 1, plausible: [0, 100] },
  { id: "maxI", t: "num", l: "Greatest single-core involvement", h: "percent", step: 1, plausible: [0, 100] },
  { id: "pni", t: "chk", l: "Perineural invasion in ipsilateral cores" },

  { group: "Biopsy — inflammatory" },
  { id: "iraniG", t: "sel", l: "Irani G (stromal infiltrate)", h: "0–3", o: [["", "—"], ["0", "0"], ["1", "1"], ["2", "2"], ["3", "3"]] },
  { id: "iraniA", t: "sel", l: "Irani A (glandular aggressiveness)", h: "0–3", o: [["", "—"], ["0", "0"], ["1", "1"], ["2", "2"], ["3", "3"]] },
  { id: "gran", t: "chk", l: "Granulomatous inflammation reported" },
  { id: "nCores", t: "num", l: "Ipsilateral cores taken", h: "count", step: 1, plausible: [1, 30] },

  { group: "Interval imaging (kinetics)" },
  {
    id: "mriIntervalChange",
    t: "sel",
    l: "Interval MRI change, this side's finding",
    h: "vs. prior MRI",
    o: [["", "—"], ["growing", "Growing"], ["stable", "Stable"], ["shrinking", "Shrinking"], ["new", "New"]],
  },

  { group: "Outcome — post-op ground truth (optional)" },
  { id: "outEce", t: "sel", l: "Whole-mount ECE, this side", h: "pathology", o: [["", "—"], ["yes", "Yes"], ["no", "No"]] },
  { id: "outInflGrade", t: "sel", l: "Whole-mount periprostatic inflammation grade", h: "0–3", o: [["", "—"], ["0", "0 none"], ["1", "1 mild"], ["2", "2 moderate"], ["3", "3 severe"]] },
  { id: "outPlaneCall", t: "sel", l: "Intraoperative plane actually used (pre-pathology)", h: "NS grade", o: [["", "—"], ["1", "Grade 1 — intrafascial"], ["2", "Grade 2 — interfascial"], ["3", "Grade 3 — wide"], ["4", "Grade 4 — extrafascial"]] },
];

const SIDE_FIELD_GROUPS = groupFieldDefs(SIDE_FIELDS);

function isFieldFilled(def: FieldDef<Record<string, unknown>>, value: unknown): boolean {
  if ("group" in def) return false;
  if (def.t === "chk") return Boolean(value);
  return value !== null && value !== undefined && value !== "";
}

/** Splits a flat field-def list into { group, fields } sections, keyed by preceding `{ group }` markers. */
function groupFieldDefs<T extends Record<string, unknown>>(defs: FieldDef<T>[]): { group: string; fields: Exclude<FieldDef<T>, { group: string }>[] }[] {
  const sections: { group: string; fields: Exclude<FieldDef<T>, { group: string }>[] }[] = [];
  for (const def of defs) {
    if ("group" in def) {
      sections.push({ group: def.group, fields: [] });
      continue;
    }
    if (sections.length === 0) sections.push({ group: "General", fields: [] });
    sections[sections.length - 1]!.fields.push(def);
  }
  return sections;
}

/* ---------------------------------------------------------------------- */
/* Generic field renderer                                                 */
/* ---------------------------------------------------------------------- */

function FieldRow<T extends Record<string, unknown>>({
  def,
  value,
  onChange,
}: {
  def: Exclude<FieldDef<T>, { group: string }>;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (def.t === "chk") {
    return (
      <label className="flex items-start gap-2 py-1 text-xs leading-snug text-foreground">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-primary"
        />
        <span>{def.l}</span>
      </label>
    );
  }
  if (def.t === "sel") {
    return (
      <div className="grid grid-cols-[1fr_100px] items-center gap-2 py-1">
        <label className="text-xs leading-snug text-foreground">
          {def.l}
          {def.h && <span className="ml-1 font-mono text-[10px] text-muted-foreground">{def.h}</span>}
        </label>
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-1.5 font-mono text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40"
        >
          {def.o.map(([v, t]) => (
            <option key={v} value={v}>{t}</option>
          ))}
        </select>
      </div>
    );
  }
  const numValue = value as number | null;
  const outOfRange =
    numValue !== null && numValue !== undefined && def.plausible !== undefined &&
    (numValue < def.plausible[0] || numValue > def.plausible[1]);
  return (
    <div className="py-1">
      <div className="grid grid-cols-[1fr_100px] items-center gap-2">
        <label className="text-xs leading-snug text-foreground">
          {def.l}
          {def.h && <span className="ml-1 font-mono text-[10px] text-muted-foreground">{def.h}</span>}
        </label>
        <Input
          type="number"
          step={def.step ?? 1}
          value={numValue ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : parseFloat(e.target.value))}
          className={cn("h-8 font-mono text-xs", outOfRange && "border-amber-500 focus-visible:ring-amber-500/40")}
        />
      </div>
      {outOfRange && def.plausible && (
        <div className="mt-0.5 flex items-center justify-end gap-1 text-right font-mono text-[10px] text-amber-500">
          <AlertTriangle className="h-3 w-3 shrink-0" /> outside typical range ({def.plausible[0]}–{def.plausible[1]})
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Readout card                                                           */
/* ---------------------------------------------------------------------- */

function ReadoutCard({
  name,
  r,
  anch,
}: {
  name: string;
  r: SideInflammationResult;
  anch: SideInflammationInput["anch"];
}) {
  const gA = nsGrade(r.pAdj);
  const gR = nsGrade(r.pRaw);
  const crossed = gA.n !== gR.n;
  const delta = r.pRaw - r.pAdj;

  const flags: { tone: "hot" | "warn" | "cool"; text: string }[] = [];
  if (crossed) {
    flags.push({
      tone: "hot",
      text: `Grade-sensitive. Unadjusted estimate sits in ${gR.label.split(" —")[0]}, inflammation-adjusted in ${gA.label.split(" —")[0]}. Deploy frozen section rather than choosing a width.`,
    });
  }
  if (r.pAdj > 21 && r.pAdj <= 73 && r.inflScore >= 55) {
    flags.push({ tone: "warn", text: "Ambiguous quadrant. Meaningful extension risk on a heavily inflamed side. Frozen section, not reflexive width." });
  }
  if (r.pAdj <= 21 && r.inflScore >= 55 && r.hasSoftEvidence) {
    flags.push({ tone: "cool", text: "Overcall candidate. Periprostatic abnormality present on a heavily inflamed side with low residual extension risk." });
  }
  if (anch === "no" && r.inflScore >= 40) {
    flags.push({ tone: "cool", text: "Free-standing abnormality, on an inflamed side. Strongly favours a benign process." });
  }
  if (r.touched < 8) {
    flags.push({ tone: "warn", text: `Sparse input. ${r.touched} fields entered on this side. Blank fields are neutral, so the estimate drifts toward the intercept.` });
  }

  const top = (terms: { label: string; value: number }[], n: number) =>
    terms
      .slice()
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, n);

  const drivers = top(r.hardTerms.concat(r.softTerms), 5);
  const inflDrivers = top(r.inflTerms, 5);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-baseline justify-between gap-2 border-b border-border bg-muted/40 py-2.5">
        <CardTitle className="font-mono text-[11px] uppercase tracking-wider">{name}</CardTitle>
        <span className="font-mono text-xs font-semibold">{r.inflScore.toFixed(0)} / 100</span>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-amber-500">{r.inflScore.toFixed(0)}</span>
            <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              inflammation index /100 <span className="opacity-70">(primary outcome)</span>
            </span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-muted">
            <div className="h-full rounded-full bg-amber-500" style={{ width: `${r.inflScore}%` }} />
          </div>
        </div>

        <div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-red-500">{r.pAdj.toFixed(1)}%</span>
            <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              adjusted P(ECE) <span className="opacity-70">(secondary outcome)</span>
            </span>
          </div>
          <div className="font-mono text-[11px] text-muted-foreground">
            unadjusted <b className="text-foreground">{r.pRaw.toFixed(1)}%</b> → λ={r.lambda.toFixed(2)} → correction −{delta.toFixed(1)} pts
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-muted">
            <div className="h-full rounded-full bg-red-500" style={{ width: `${Math.max(0, Math.min(100, r.pAdj))}%` }} />
          </div>
        </div>

        <div className="border-t border-border pt-2.5">
          <div className="text-sm font-semibold">{gA.label}</div>
          <div className="text-xs text-muted-foreground">{gA.desc}</div>
          {flags.map((f, i) => (
            <div
              key={i}
              className={cn(
                "mt-2 rounded-md border-l-2 px-2.5 py-2 text-xs leading-relaxed",
                f.tone === "hot" && "border-red-500 bg-red-500/10 text-red-700 dark:text-red-300",
                f.tone === "warn" && "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                f.tone === "cool" && "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
              )}
            >
              {f.text}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 font-mono text-[11px] sm:grid-cols-2">
          <div>
            <div className="mb-1 uppercase tracking-wide text-muted-foreground">Top extension drivers</div>
            {drivers.length === 0 && <div className="text-muted-foreground">no entries</div>}
            {drivers.map((d, i) => (
              <div key={i} className="flex justify-between gap-2 border-b border-dotted border-border py-0.5">
                <span className="truncate text-muted-foreground">{d.label}</span>
                <span className={d.value > 0 ? "text-red-500" : "text-emerald-500"}>{d.value > 0 ? "+" : ""}{d.value.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="mb-1 uppercase tracking-wide text-muted-foreground">Top inflammation drivers</div>
            {inflDrivers.length === 0 && <div className="text-muted-foreground">no entries</div>}
            {inflDrivers.map((d, i) => (
              <div key={i} className="flex justify-between gap-2 border-b border-dotted border-border py-0.5">
                <span className="truncate text-muted-foreground">{d.label}</span>
                <span className="text-red-500">+{d.value.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------------------------------------------------------------- */
/* Main workspace                                                         */
/* ---------------------------------------------------------------------- */

/* ---------------------------------------------------------------------- */
/* Decision grid                                                          */
/* ---------------------------------------------------------------------- */

function yScale(p: number): number {
  const bands: [number, number, number, number][] = [
    [0, 10, 0, 0.25],
    [10, 21, 0.25, 0.5],
    [21, 73, 0.5, 0.75],
    [73, 100, 0.75, 1],
  ];
  for (const [lo, hi, a, b] of bands) {
    if (p <= hi) return a + (b - a) * ((p - lo) / (hi - lo));
  }
  return 1;
}

function DecisionGrid({ resultL, resultR }: { resultL: SideInflammationResult; resultR: SideInflammationResult }) {
  const X0 = 92, X1 = 640, Y0 = 46, Y1 = 372;
  const px = (v: number) => X0 + (X1 - X0) * (v / 100);
  const py = (v: number) => Y1 - (Y1 - Y0) * yScale(v);

  const thresholds = [10, 21, 73];
  const bandLabels: [string, number][] = [
    ["Grade 1", 5],
    ["Grade 2", 15],
    ["Grade 3", 45],
    ["Grade 4", 86],
  ];
  const markers: [SideInflammationResult, string, string][] = [
    [resultL, "L", "Left"],
    [resultR, "R", "Right"],
  ];

  return (
    <section>
      <h2 className="mb-2 border-b border-border pb-1.5 font-mono text-[11px] uppercase tracking-wider">Decision grid</h2>
      <div className="rounded-md border border-border bg-muted/20 p-4">
        <svg viewBox="0 0 700 470" width="100%" role="img" aria-label="Adjusted probability of extracapsular extension plotted against the periprostatic inflammation index for each lobe.">
          <rect x={px(55)} y={Y0} width={X1 - px(55)} height={Y1 - Y0} fill="#F8F0DD" opacity={0.25} />
          {thresholds.map((v) => (
            <g key={v}>
              <line x1={X0} y1={py(v)} x2={X1} y2={py(v)} stroke="currentColor" strokeOpacity={0.3} strokeWidth={1} strokeDasharray="3 3" />
              <text x={X0 - 9} y={py(v) + 4} textAnchor="end" fontFamily="ui-monospace,Menlo,monospace" fontSize={11} fill="currentColor" opacity={0.6}>
                {v}%
              </text>
            </g>
          ))}
          <line x1={px(55)} y1={Y0} x2={px(55)} y2={Y1} stroke="#A8760C" strokeWidth={1} strokeDasharray="4 3" />

          {bandLabels.map(([t, v]) => (
            <text key={t} x={X1 - 6} y={py(v) + 4} textAnchor="end" fontFamily="ui-monospace,Menlo,monospace" fontSize={10.5} fill="currentColor" opacity={0.35} letterSpacing={1}>
              {t.toUpperCase()}
            </text>
          ))}

          <rect x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} fill="none" stroke="currentColor" strokeWidth={1.5} />
          <text x={X0} y={Y1 + 30} fontFamily="ui-monospace,Menlo,monospace" fontSize={11} fill="currentColor" opacity={0.6}>0</text>
          <text x={px(55)} y={Y1 + 30} textAnchor="middle" fontFamily="ui-monospace,Menlo,monospace" fontSize={11} fill="#A8760C">55</text>
          <text x={X1} y={Y1 + 30} textAnchor="end" fontFamily="ui-monospace,Menlo,monospace" fontSize={11} fill="currentColor" opacity={0.6}>100</text>
          <text x={(X0 + X1) / 2} y={Y1 + 52} textAnchor="middle" fontFamily="ui-monospace,Menlo,monospace" fontSize={11} letterSpacing={1.6} fill="currentColor">
            PERIPROSTATIC INFLAMMATION INDEX
          </text>
          <text x={26} y={(Y0 + Y1) / 2} textAnchor="middle" transform={`rotate(-90 26 ${(Y0 + Y1) / 2})`} fontFamily="ui-monospace,Menlo,monospace" fontSize={11} letterSpacing={1.6} fill="currentColor">
            ADJUSTED P(ECE)
          </text>
          <text x={X0} y={Y0 - 14} fontFamily="ui-monospace,Menlo,monospace" fontSize={10.5} letterSpacing={1.4} fill="currentColor" opacity={0.6}>
            EACH BAND SCALED TO EQUAL HEIGHT
          </text>

          {markers.map(([r, k]) => {
            if (!r || r.touched === 0) return null;
            const x = px(r.inflScore), yA = py(r.pAdj), yR = py(r.pRaw);
            const showArrow = Math.abs(yR - yA) > 3;
            return (
              <g key={k}>
                {showArrow && (
                  <>
                    <line x1={x} y1={yR} x2={x} y2={yA + 7} stroke="#8E2B20" strokeWidth={1.5} opacity={0.55} />
                    <circle cx={x} cy={yR} r={3} fill="none" stroke="#8E2B20" strokeWidth={1.2} opacity={0.55} />
                    <path d={`M${x - 4} ${yA + 9} L${x} ${yA + 3} L${x + 4} ${yA + 9}`} fill="none" stroke="#8E2B20" strokeWidth={1.5} opacity={0.55} />
                  </>
                )}
                <circle cx={x} cy={yA} r={8.5} fill="#8E2B20" />
                <text x={x} y={yA + 3.6} textAnchor="middle" fontFamily="ui-monospace,Menlo,monospace" fontSize={10.5} fontWeight={600} fill="#fff">
                  {k}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="mt-2.5 font-mono text-[10.5px] leading-relaxed text-muted-foreground">
          <b className="text-foreground">Vertical arrow</b> = movement from unadjusted to inflammation-adjusted P(ECE). Arrow length is the magnitude of the overcall correction.
          <br />
          <b className="text-foreground">Horizontal bands</b> = Martini incremental nerve-sparing thresholds (10% / 21% / 73%), scaled so each band occupies equal height.
          <br />
          <b className="text-foreground">Right half</b> = inflammation score ≥55, where the extracapsular read is least trustworthy in either direction.
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* Cohort validation                                                      */
/* ---------------------------------------------------------------------- */

function fmtAuc(a: { auc: number | null; nPos: number; nNeg: number }): string {
  if (a.auc === null) return `n/a (need both outcome classes; nPos=${a.nPos}, nNeg=${a.nNeg})`;
  return `${a.auc.toFixed(3)} (nPos=${a.nPos}, nNeg=${a.nNeg})`;
}

function CohortValidationSection({ cfg }: { cfg: InflammationConfig }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [summary, setSummary] = useState<CohortValidationSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <section>
      <h2 className="mb-2 border-b border-border pb-1.5 font-mono text-[11px] uppercase tracking-wider">
        Cohort validation
      </h2>
      <CardDescription className="mb-3">
        Upload a JSON array of cases (each shaped like a single "Save case" export: <code className="rounded bg-muted px-1 text-[11px]">{`{ patient, sides: { L, R } }`}</code>)
        with <code className="rounded bg-muted px-1 text-[11px]">outInflGrade</code> / <code className="rounded bg-muted px-1 text-[11px]">outEce</code> filled
        in from whole-mount pathology. Reports discrimination (AUC) for the inflammation index against any periprostatic
        inflammation (primary outcome) and for adjusted P(ECE) against side-specific extracapsular extension (secondary outcome).
        Runs entirely in the browser — nothing is uploaded anywhere.
      </CardDescription>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload className="h-3.5 w-3.5" /> Load cohort (JSON array)
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
              let parsed: unknown;
              try {
                parsed = JSON.parse(String(ev.target?.result));
              } catch (err) {
                setError(`Could not parse JSON: ${err instanceof Error ? err.message : String(err)}`);
                setSummary(null);
                return;
              }
              const result = cohortSchema.safeParse(parsed);
              if (!result.success) {
                setError(result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
                setSummary(null);
                return;
              }
              setError(null);
              setSummary(validateCohort(result.data, cfg));
            };
            reader.readAsText(file);
            e.target.value = "";
          }}
        />
      </div>
      {error && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-red-500">
          <AlertTriangle className="h-3.5 w-3.5" /> {error}
        </div>
      )}
      {summary && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Card>
            <CardHeader className="border-b border-border bg-muted/40 py-2">
              <CardTitle className="font-mono text-[11px] uppercase tracking-wider">
                Inflammation index — primary outcome
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3 font-mono text-xs">
              AUC vs. any periprostatic inflammation, whole-mount: <b>{fmtAuc(summary.inflammation)}</b>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="border-b border-border bg-muted/40 py-2">
              <CardTitle className="font-mono text-[11px] uppercase tracking-wider">
                Adjusted P(ECE) — secondary outcome
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3 font-mono text-xs">
              AUC vs. whole-mount ECE, this side: <b>{fmtAuc(summary.epe)}</b>
            </CardContent>
          </Card>
          <div className="font-mono text-[11px] text-muted-foreground sm:col-span-2">
            {summary.nCases} case{summary.nCases === 1 ? "" : "s"} loaded, {summary.nSidesScored} side{summary.nSidesScored === 1 ? "" : "s"} with at least one field entered.
          </div>
        </div>
      )}
    </section>
  );
}

export function InflammationWorkspace() {
  const patient = useInflammationStore((s) => s.patient);
  const sides = useInflammationStore((s) => s.sides);
  const cfg = useInflammationStore((s) => s.cfg);
  const isCustomCfg = useInflammationStore((s) => s.isCustomCfg);
  const setPatientField = useInflammationStore((s) => s.setPatientField);
  const setSideField = useInflammationStore((s) => s.setSideField);
  const mirrorSide = useInflammationStore((s) => s.mirrorSide);
  const applyCfgJson = useInflammationStore((s) => s.applyCfgJson);
  const resetCfg = useInflammationStore((s) => s.resetCfg);
  const clearAll = useInflammationStore((s) => s.clearAll);
  const loadState = useInflammationStore((s) => s.loadState);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cfgText, setCfgText] = useState(() => JSON.stringify(cfg, null, 2));
  const [cfgMsg, setCfgMsg] = useState<{ text: string; tone: "ok" | "err" } | null>(null);

  const resultL = useMemo(() => scoreSide(patient, sides.L, cfg), [patient, sides.L, cfg]);
  const resultR = useMemo(() => scoreSide(patient, sides.R, cfg), [patient, sides.R, cfg]);

  const hasAnyInput =
    Object.values(patient).some((v) => v !== null && v !== false) ||
    resultL.touched > 0 ||
    resultR.touched > 0;

  const [hasRun, setHasRun] = useState(false);
  const [showSources, setShowSources] = useState(false);

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto overflow-x-hidden overscroll-contain app-scroll px-5 py-5" data-tutorial="inflammation">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex items-start justify-between gap-3 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs leading-relaxed text-red-700 dark:text-red-300">
          <div>
            <b>Experimental feature — not a validated nomogram, not for clinical use.</b> Every coefficient below is
            an expert prior derived from published effect directions, not a fitted regression coefficient. This tool
            is deliberately kept separate from the main COMPASS ECE prediction until it is fitted on real whole-mount
            outcome data and merged by design decision. Use it to standardise data capture and structure the
            nerve-sparing discussion — not as a sole determinant of surgical plane.
            {isCustomCfg && <span className="ml-1 font-semibold">Custom coefficients active.</span>}
          </div>
          <Button size="sm" variant="outline" className="shrink-0 border-red-500/40 text-red-700 hover:bg-red-500/10 dark:text-red-300" onClick={() => setShowSources(true)}>
            Sources
          </Button>
        </div>
        {showSources && <InflammationSourcesModal onClose={() => setShowSources(false)} />}

        {/* Patient-level */}
        <section>
          <h2 className="mb-2 border-b border-border pb-1.5 font-mono text-[11px] uppercase tracking-wider">Patient-level</h2>
          <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            {PATIENT_FIELDS.map((f, i) =>
              "group" in f ? null : (
                <FieldRow
                  key={String(f.id) + i}
                  def={f}
                  value={patient[f.id]}
                  onChange={(v) => setPatientField(f.id, v as never)}
                />
              ),
            )}
          </div>
          {patient.psa !== null && patient.vol && patient.vol > 0 && (
            <div className="mt-1 font-mono text-[11px] text-muted-foreground">
              PSA density <b className="text-foreground">{(patient.psa / patient.vol).toFixed(3)}</b> ng/mL/mL
            </div>
          )}
        </section>

        {/* Side-specific entry */}
        <section>
          <div className="mb-2 flex items-center justify-between border-b border-border pb-1.5">
            <h2 className="font-mono text-[11px] uppercase tracking-wider">Side-specific entry</h2>
            <Button size="sm" variant="ghost" onClick={() => mirrorSide("L", "R")}>
              Mirror left → right
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {(["L", "R"] as const).map((s) => (
              <Card key={s}>
                <CardHeader className="flex-row items-baseline justify-between border-b border-border bg-muted/40 py-2">
                  <CardTitle className="font-mono text-xs uppercase tracking-wider">{s === "L" ? "Left lobe" : "Right lobe"}</CardTitle>
                  <span className="font-mono text-[10px] text-muted-foreground">{s === "L" ? resultL.touched : resultR.touched} fields</span>
                </CardHeader>
                <CardContent className="pt-1">
                  {SIDE_FIELD_GROUPS.map((g, gi) => {
                    const isOutcome = g.group.startsWith("Outcome");
                    const filled = g.fields.filter((f) => isFieldFilled(f, sides[s][f.id])).length;
                    return (
                      <details key={g.group} className="border-b border-border py-1 last:border-b-0" open={gi === 0}>
                        <summary className="flex cursor-pointer items-center justify-between py-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                          <span>{g.group}</span>
                          {!isOutcome && (
                            <span className={cn("font-mono text-[10px] normal-case", filled > 0 ? "text-foreground" : "text-muted-foreground")}>
                              {filled}/{g.fields.length}
                            </span>
                          )}
                        </summary>
                        <div className="pb-1">
                          {g.fields.map((f, i) => (
                            <FieldRow
                              key={String(f.id) + i}
                              def={f}
                              value={sides[s][f.id]}
                              onChange={(v) => setSideField(s, f.id, v as never)}
                            />
                          ))}
                        </div>
                      </details>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Run */}
        <div className="flex justify-center">
          <Button size="sm" disabled={!hasAnyInput} onClick={() => setHasRun(true)}>
            <Play className="h-3.5 w-3.5" /> Run model
          </Button>
        </div>

        {/* Readout */}
        {hasRun && (
          <section>
            <h2 className="mb-2 border-b border-border pb-1.5 font-mono text-[11px] uppercase tracking-wider">Readout</h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ReadoutCard name="Left lobe" r={resultL} anch={sides.L.anch} />
              <ReadoutCard name="Right lobe" r={resultR} anch={sides.R.anch} />
            </div>
          </section>
        )}

        {/* Export / tools */}
        <section>
          <h2 className="mb-2 border-b border-border pb-1.5 font-mono text-[11px] uppercase tracking-wider">Export &amp; tools</h2>
          <CardDescription className="mb-3">
            Exports go to a standalone CSV/JSON row format for this instrument only — they are not written into
            the patient case library.
          </CardDescription>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => exportCSV(patient, sides, cfg)}>
              <Download className="h-3.5 w-3.5" /> Append CSV row
            </Button>
            <Button size="sm" variant="outline" onClick={() => saveJSON(patient, sides)}>
              <FileJson className="h-3.5 w-3.5" /> Save case (JSON)
            </Button>
            <Button size="sm" variant="ghost" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> Load case
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  let parsedJson: unknown;
                  try {
                    parsedJson = JSON.parse(String(ev.target?.result));
                  } catch (err) {
                    setLoadError(`Could not parse JSON: ${err instanceof Error ? err.message : String(err)}`);
                    return;
                  }
                  const result = loadState(parsedJson);
                  setLoadError(result.ok ? null : result.error);
                };
                reader.readAsText(file);
                e.target.value = "";
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                clearAll();
                setHasRun(false);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear all
            </Button>
            {isCustomCfg && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  resetCfg();
                  setCfgText(JSON.stringify(DEFAULT_INFLAMMATION_CONFIG, null, 2));
                  setCfgMsg({ text: "Defaults restored.", tone: "ok" });
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" /> Restore default coefficients
              </Button>
            )}
          </div>
          {loadError && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-red-500">
              <AlertTriangle className="h-3.5 w-3.5" /> {loadError}
            </div>
          )}

          <details className="mt-4 rounded-md border border-border bg-muted/20">
            <summary className="cursor-pointer px-3 py-2 font-mono text-[11px] uppercase tracking-wider">
              Coefficients — edit and apply
            </summary>
            <div className="space-y-2.5 border-t border-border px-3 py-3">
              <p className="max-w-[78ch] text-xs leading-relaxed text-muted-foreground">
                Every weight is a log-odds contribution for the ECE axis or a point contribution for the
                inflammation axis. <code className="rounded bg-muted px-1 text-[11px]">eceHard</code> holds terms
                that periprostatic inflammation cannot mimic; only{" "}
                <code className="rounded bg-muted px-1 text-[11px]">eceSoft</code> is shrunk, and only when it is
                pushing upward. Paste fitted betas here when you have them.
              </p>
              <textarea
                value={cfgText}
                onChange={(e) => setCfgText(e.target.value)}
                spellCheck={false}
                className="h-56 w-full resize-y rounded-md border border-input bg-background p-2.5 font-mono text-[11px] leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const result = applyCfgJson(cfgText);
                    setCfgMsg(
                      result.ok
                        ? { text: "Coefficients applied.", tone: "ok" }
                        : { text: `Invalid coefficients: ${result.error}`, tone: "err" },
                    );
                  }}
                >
                  Apply coefficients
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    resetCfg();
                    setCfgText(JSON.stringify(DEFAULT_INFLAMMATION_CONFIG, null, 2));
                    setCfgMsg({ text: "Defaults restored.", tone: "ok" });
                  }}
                >
                  Restore defaults
                </Button>
              </div>
              {cfgMsg && (
                <div className={cn("font-mono text-[11px]", cfgMsg.tone === "ok" ? "text-emerald-500" : "text-red-500")}>
                  {cfgMsg.text}
                </div>
              )}
            </div>
          </details>
        </section>

        {/* Decision grid */}
        {hasRun && <DecisionGrid resultL={resultL} resultR={resultR} />}

        {/* Cohort validation */}
        <CohortValidationSection cfg={cfg} />
      </div>
    </div>
  );
}
