import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ConfidenceLevel, PipsCounseling, SideCounseling } from "@/lib/compass/pipsCounseling";
import type { EvidenceTier } from "@/lib/compass/inflammationRisk";
import type { HostilityTier } from "@/lib/compass/planeHostility";

const pct = (v: number) => `${Math.round(v * 100)}%`;

const CONF_TONE: Record<ConfidenceLevel, { label: string; cls: string }> = {
  high: { label: "No data-quality flags", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  reduced: { label: "Confidence reduced", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  low: { label: "Low confidence, review required", cls: "bg-red-500/10 text-red-700 dark:text-red-400" },
};

const TIER_TONE: Record<HostilityTier, { pill: string; bar: string }> = {
  low: { pill: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" },
  intermediate: { pill: "bg-amber-500/10 text-amber-600 dark:text-amber-400", bar: "bg-amber-500" },
  high: { pill: "bg-orange-500/10 text-orange-600 dark:text-orange-400", bar: "bg-orange-500" },
  "very-high": { pill: "bg-red-500/10 text-red-600 dark:text-red-400", bar: "bg-red-500" },
};

const EVIDENCE_TONE: Record<EvidenceTier, { label: string; cls: string; hint: string }> = {
  direct: {
    label: "direct",
    cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    hint: "Measured plane/fibrosis or an independent radical-prostatectomy difficulty predictor",
  },
  surrogate: {
    label: "surrogate",
    cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    hint: "Evidence only for surgical surrogates (nerve-sparing rate, operative time, rectal injury, margins)",
  },
  unvalidated: {
    label: "unvalidated",
    cls: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
    hint: "Scored research input or expert prior: validated for something else (e.g. EPE), not against the plane. Provisional",
  },
  null: {
    label: "null",
    cls: "bg-muted text-muted-foreground",
    hint: "Studied and shown to have no effect on the plane or nerve-sparing; zero weight",
  },
  none: {
    label: "no RP data",
    cls: "bg-muted text-muted-foreground",
    hint: "No radical-prostatectomy plane evidence: expert prior, or shown as context only",
  },
};

function SideColumn({ c }: { c: SideCounseling }) {
  const conf = CONF_TONE[c.confidence.level];
  const tone = TIER_TONE[c.hostilityTier];
  const maxPts = Math.max(0.01, ...c.contributors.map((x) => x.points));
  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold capitalize">{c.side} side</span>
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold uppercase", tone.pill)}>
          {c.hostilityTier.replace("-", " ")} · {pct(c.technicallyDifficult)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", tone.bar)} style={{ width: `${c.technicallyDifficult * 100}%` }} />
      </div>
      <span className={cn("inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold", conf.cls)}>{conf.label}</span>
      {c.confidence.reasons.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-muted-foreground">
          {c.confidence.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      {c.contributors.length === 0 ? (
        <p className="text-xs text-muted-foreground">No risk factors recorded on this side.</p>
      ) : (
        <div className="space-y-1.5">
          {c.contributors.map((x, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate text-muted-foreground" title={x.label}>
                {x.label}
              </span>
              <span
                className={cn(
                  "w-20 shrink-0 rounded px-1 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide",
                  EVIDENCE_TONE[x.evidence].cls,
                )}
                title={EVIDENCE_TONE[x.evidence].hint}
              >
                {EVIDENCE_TONE[x.evidence].label}
              </span>
              <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">
                {x.points === 0 ? "context" : `+${x.points.toFixed(2)}`}
              </span>
              <span className="sr-only">{Math.round((x.points / maxPts) * 100)}% of the largest contributor</span>
            </div>
          ))}
        </div>
      )}

      <dl className="space-y-2 border-t border-border pt-3 text-xs">
        <div>
          <dt className="font-medium text-foreground">Chance this bundle can be preserved oncologically</dt>
          <dd className="tabular-nums text-muted-foreground">{pct(c.preservableOncologically)} (1 − PIPS-EPE)</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Will intended nerve sparing be reduced intra-operatively?</dt>
          <dd className="text-muted-foreground">{c.planReduction.text}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Could findings or frozen sections change the plan?</dt>
          <dd className="text-muted-foreground">{c.intraopChange.text}</dd>
        </div>
      </dl>
    </div>
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
        <p className="text-[11px] leading-snug text-muted-foreground">
          Plane risk is scored for each side separately (PIPS-H). A difficult plane is not poor surgical
          performance, and a plan to preserve a bundle never overrides oncologic judgment. Research use only.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <SideColumn c={counseling.left} />
          <SideColumn c={counseling.right} />
        </div>

        {wholePatient}

        <div>
          <div className="mb-1.5 text-xs font-medium text-foreground">
            Expected recovery at 12 months, by how much nerve sparing is achieved
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-3 font-medium">Scenario</th>
                  <th className="py-1 pr-3 font-medium">Erectile function (potency)</th>
                  <th className="py-1 font-medium">Continence</th>
                </tr>
              </thead>
              <tbody>
                {counseling.recovery.map((r) => (
                  <tr key={r.label} className="border-t border-border/60">
                    <td className="py-1 pr-3">{r.label}</td>
                    <td className="py-1 pr-3 tabular-nums">{r.potency12 == null ? "n/a (baseline SHIM < 12)" : `${r.potency12}%`}</td>
                    <td className="py-1 tabular-nums">{r.continence12}%</td>
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
          <div className="mb-1 flex items-center gap-1 text-xs font-medium text-foreground">
            <TriangleAlert className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            Key sources of uncertainty
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
