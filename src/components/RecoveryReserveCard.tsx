import { HeartPulse } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { RecoveryReserve, ReserveTier } from "@/lib/compass/recoveryReserve";

const TIER: Record<ReserveTier, { label: string; chip: string; bar: string; text: string }> = {
  good: { label: "Good", chip: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 dark:text-emerald-400", bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  reduced: { label: "Reduced", chip: "bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-400", bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  poor: { label: "Poor", chip: "bg-red-500/10 text-red-700 ring-red-500/30 dark:text-red-400", bar: "bg-red-500", text: "text-red-600 dark:text-red-400" },
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{children}</div>;
}

/** PIPS-R: baseline capacity of nerve, vessel and corporal tissue to recover. */
export function RecoveryReserveCard({ reserve }: { reserve: RecoveryReserve }) {
  const tier = reserve.tier ? TIER[reserve.tier] : null;
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="text-muted-foreground"><HeartPulse className="h-4 w-4" /></span>
          Recovery reserve (PIPS-R)
        </div>
        <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
          The patient's own capacity to recover erectile function, independent of the operation. It shapes
          counseling and rehabilitation, never the plane. Expected results for the planned operation are in
          Impact below.
        </p>

        {!reserve.available || !tier || reserve.probability === null ? (
          <p className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            Not estimated: baseline SHIM is below 12, so unassisted recovery is not modelled. Counsel on
            assisted recovery and rehabilitation options instead.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-[minmax(0,260px)_1fr]">
            <div className="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-sm">
              <Eyebrow>Baseline capacity</Eyebrow>
              <span className={cn("inline-block rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset", tier.chip)}>
                {tier.label}
              </span>
              <p className="text-[11px] leading-snug text-muted-foreground">
                Rated good, reduced or poor from age, baseline SHIM and comorbidities (provisional cut-points).
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <Eyebrow>What lowers it</Eyebrow>
                {reserve.drivers.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">Nothing recorded lowers the reserve.</p>
                ) : (
                  <ul className="mt-1 divide-y divide-border/60">
                    {reserve.drivers.map((d) => (
                      <li key={d.label} className="flex items-baseline gap-2 py-2 text-xs">
                        <span className="min-w-0 flex-1 text-foreground/90">
                          {d.label} <span className="text-muted-foreground">({d.detail})</span>
                        </span>
                        <span className="w-14 shrink-0 text-right font-medium tabular-nums text-foreground/80">-{d.cost} pp</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {reserve.notModelled.length > 0 && (
          <div className="rounded-lg bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            <span className="font-medium">Present but not modelled:</span> {reserve.notModelled.join("; ")}. These
            probably lower the reserve further; the nomogram has no validated penalty for them.
          </div>
        )}
        <p className="text-[11px] leading-snug text-muted-foreground">
          From the functional-outcome nomogram (selected single-surgeon cohort), with the patient's PDE5, exercise
          and pelvic-floor settings held neutral. PDE5 response, erection hardness, testosterone, neuropathy and
          penile Doppler are not inputs.
        </p>
      </CardContent>
    </Card>
  );
}
