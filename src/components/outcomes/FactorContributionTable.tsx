import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FUNCTIONAL_MODEL_CITATION,
  type FactorContribution,
} from "@/lib/compass/functionalOutcomes";

/** Small ±pp cell, green good / red bad. `invert` flips the colour sense. */
export function PpCell({ v, invert = false }: { v: number; invert?: boolean }) {
  if (v === 0) return <span className="text-muted-foreground/40">·</span>;
  const good = invert ? v < 0 : v > 0;
  return (
    <span className={good ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}>
      {v > 0 ? "+" : ""}
      {v}
    </span>
  );
}

/**
 * Per-factor percentage-point contributions to the 12-month functional numbers.
 * Shared by the Factors tab; hand it modifiableFactorBreakdown(...) output.
 */
export function FactorContributionTable({ rows }: { rows: FactorContribution[] }) {
  if (rows.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Factor contributions</CardTitle>
        <p className="text-xs text-muted-foreground">
          Percentage-point effect of each active factor on the 12-month numbers. Modifiable factors
          are the levers a patient can pull before surgery.
        </p>
        <p className="text-[10px] leading-snug text-muted-foreground/60">{FUNCTIONAL_MODEL_CITATION}</p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1 text-sm tabular-nums">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Factor
          </div>
          <div className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Potency
          </div>
          <div className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Contin.
          </div>
          <div className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            BCR risk
          </div>
          {rows.map((r) => (
            <div key={r.label} className="contents">
              <div className="truncate">
                <span className={r.modifiable ? "text-foreground" : "text-muted-foreground"}>
                  {r.label}
                </span>{" "}
                <span className="text-xs capitalize text-muted-foreground/60">{r.detail}</span>
                {!r.modifiable && (
                  <span className="ml-1 text-[9px] uppercase text-muted-foreground/50">fixed</span>
                )}
              </div>
              <div className="text-right">
                <PpCell v={r.pot} />
              </div>
              <div className="text-right">
                <PpCell v={r.cont} />
              </div>
              <div className="text-right">
                <PpCell v={r.bcrRisk} invert />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
