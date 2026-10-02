import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ConfidenceLevel, PipsCounseling, SideCounseling } from "@/lib/compass/pipsCounseling";
import type { EvidenceTier } from "@/lib/compass/inflammationRisk";
import type { HostilityTier } from "@/lib/compass/planeHostility";

const pct = (v: number) => `${Math.round(v * 100)}%`;

const CONF_TONE: Record<ConfidenceLevel, { label: string; dot: string }> = {
  high: { label: "No data-quality flags", dot: "bg-emerald-500" },
  reduced: { label: "Confidence reduced", dot: "bg-amber-500" },
  low: { label: "Low confidence, review required", dot: "bg-red-500" },
};

const TIER_TONE: Record<HostilityTier, { chip: string; bar: string; text: string }> = {
  low: { chip: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 dark:text-emerald-400", bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  intermediate: { chip: "bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-400", bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  high: { chip: "bg-orange-500/10 text-orange-700 ring-orange-500/30 dark:text-orange-400", bar: "bg-orange-500", text: "text-orange-600 dark:text-orange-400" },
  "very-high": { chip: "bg-red-500/10 text-red-700 ring-red-500/30 dark:text-red-400", bar: "bg-red-500", text: "text-red-600 dark:text-red-400" },
};

const EVIDENCE_TONE: Record<EvidenceTier, { label: string; cls: string; hint: string }> = {
  direct: {
    label: "Direct",
    cls: "text-emerald-700 ring-emerald-500/40 dark:text-emerald-400",
    hint: "Measured plane/fibrosis or an independent radical-prostatectomy difficulty predictor",
  },
  surrogate: {
    label: "Surrogate",
    cls: "text-amber-700 ring-amber-500/40 dark:text-amber-400",
    hint: "Evidence only for surgical surrogates (nerve-sparing rate, operative time, rectal injury, margins)",
  },
  unvalidated: {
    label: "Unvalidated",
    cls: "text-sky-700 ring-sky-500/40 dark:text-sky-400",
    hint: "Scored research input or expert prior: validated for something else (e.g. EPE), not against the plane. Provisional",
  },
  null: {
    label: "Null",
    cls: "text-muted-foreground ring-border",
    hint: "Studied and shown to have no effect on the plane or nerve-sparing; zero weight",
  },
  none: {
    label: "No RP data",
    cls: "text-muted-foreground ring-border",
    hint: "No radical-prostatectomy plane evidence: expert prior, or shown as context only",
  },
};

/** Small-caps section label used throughout the Planning tab. */
function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{children}</div>;
}

function SideColumn({ c }: { c: SideCounseling }) {
  const conf = CONF_TONE[c.confidence.level];
  const tone = TIER_TONE[c.hostilityTier];
  const maxPts = Math.max(0.01, ...c.contributors.map((x) => x.points));
  const rows = [
    {
      q: "Chance this bundle can be preserved oncologically",
      a: `${pct(c.preservableOncologically)} (1 − PIPS-EPE)`,
      mono: true,
    },
    { q: "Will intended nerve sparing be reduced intra-operatively?", a: c.planReduction.text },
    { q: "Could findings or frozen sections change the plan?", a: c.intraopChange.text },
  ];
  return (
    <section className="flex flex-col rounded-xl border border-border bg-card/60 shadow-sm">
      <header className="space-y-3 p-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Eyebrow>{c.side} side · plane risk</Eyebrow>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={cn("text-3xl font-semibold leading-none tabular-nums", tone.text)}>
                {pct(c.technicallyDifficult)}
              </span>
              <span className="text-[11px] text-muted-foreground">PIPS-H, provisional</span>
            </div>
          </div>
          <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset", tone.chip)}>
            {c.hostilityTier.replace("-", " ")}
          </span>
        </div>

        {/* Track with tier boundaries at 25 / 50 / 75 % */}
        <div className="relative h-2 rounded-full bg-muted">
          <div className={cn("h-full rounded-full", tone.bar)} style={{ width: `${c.technicallyDifficult * 100}%` }} />
          {[25, 50, 75].map((t) => (
            <span key={t} className="absolute top-0 h-full w-px bg-background/80" style={{ left: `${t}%` }} aria-hidden />
          ))}
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className={cn("h-1.5 w-1.5 rounded-full", conf.dot)} aria-hidden />
          {conf.label}
        </div>
        {c.confidence.reasons.length > 0 && (
          <ul className="list-disc space-y-0.5 pl-4 text-[11px] leading-snug text-muted-foreground">
            {c.confidence.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
      </header>

      <div className="border-t border-border px-4 py-3">
        <Eyebrow>What drives this score</Eyebrow>
        {c.contributors.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No risk factors recorded on this side.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border/60">
            {c.contributors.map((x, i) => (
              <li key={i} className="py-2">
                <div className="flex items-start gap-2 text-xs">
                  <span className="min-w-0 flex-1 break-words leading-snug text-foreground/90">{x.label}</span>
                  <span
                    className={cn(
                      "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset",
                      EVIDENCE_TONE[x.evidence].cls,
                    )}
                    title={EVIDENCE_TONE[x.evidence].hint}
                  >
                    {EVIDENCE_TONE[x.evidence].label}
                  </span>
                  <span className="w-12 shrink-0 text-right font-medium tabular-nums text-foreground/80">
                    {x.points === 0 ? <span className="font-normal text-muted-foreground">context</span> : `+${x.points.toFixed(2)}`}
                  </span>
                </div>
                {x.points > 0 && (
                  <div className="mt-1.5 h-0.5 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full opacity-70", tone.bar)} style={{ width: `${(x.points / maxPts) * 100}%` }} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-border px-4 py-3">
        <Eyebrow>Counseling</Eyebrow>
        <dl className="mt-2 space-y-3 text-xs">
          {rows.map((r) => (
            <div key={r.q}>
              <dt className="font-medium text-foreground">{r.q}</dt>
              <dd className={cn("mt-0.5 leading-snug text-muted-foreground", r.mono && "tabular-nums")}>{r.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/**
 * Periprostatic inflammation / plane risk, split by side, with the PIPS
 * counseling statements and the recovery scenarios. Replaces the old single
 * whole-patient card at the top of the Planning tab.
 */
export function PeriprostaticRiskBySide({
  counseling,
  title,
  wholePatient,
}: {
  counseling: PipsCounseling;
  title: ReactNode;
  wholePatient: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        {title}
        <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
          Plane risk is scored for each side separately (PIPS-H). A difficult plane is not poor surgical
          performance, and a plan to preserve a bundle never overrides oncologic judgment. Research use only.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <SideColumn c={counseling.left} />
          <SideColumn c={counseling.right} />
        </div>

        {wholePatient}

        <div>
          <Eyebrow>Expected recovery at 12 months, by how much nerve sparing is achieved</Eyebrow>
          <div className="mt-2 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/40 text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Scenario</th>
                  <th className="px-3 py-2 text-right font-medium">Erectile function (potency)</th>
                  <th className="px-3 py-2 text-right font-medium">Continence</th>
                </tr>
              </thead>
              <tbody>
                {counseling.recovery.map((r) => (
                  <tr key={r.label} className="border-t border-border/60">
                    <td className="px-3 py-2">{r.label}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {r.potency12 == null ? <span className="font-normal text-muted-foreground">n/a (baseline SHIM &lt; 12)</span> : `${r.potency12}%`}
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{r.continence12}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            From the functional-outcome nomogram, built on a selected single-surgeon cohort, so treat the absolute
            values as best-case; the differences between scenarios are the useful part.
          </p>
        </div>

        <div>
          <div className="mb-1.5 flex items-center gap-1.5">
            <TriangleAlert className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <Eyebrow>Key sources of uncertainty</Eyebrow>
          </div>
          <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-muted-foreground">
            {counseling.uncertainty.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
