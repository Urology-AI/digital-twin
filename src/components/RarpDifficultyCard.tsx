import { Wrench } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EvidenceInfo } from "@/components/EvidenceInfo";
import type { StepDifficulty } from "@/lib/compass/rarpDifficulty";
import { cn } from "@/lib/utils";

const TIER_TONE = {
  low: "text-emerald-600 dark:text-emerald-400",
  moderate: "text-amber-600 dark:text-amber-400",
  high: "text-red-600 dark:text-red-400",
} as const;

const SOURCES = ["Bladder-neck difficulty weights", "Apical / anastomosis difficulty weights", "Bladder-neck / apical difficulty tier cutpoints"];

function Step({ title, d, note }: { title: string; d: StepDifficulty; note?: string }) {
  return (
    <div className="rounded-lg border border-border p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
        <div className={cn("text-sm font-semibold uppercase", TIER_TONE[d.tier])}>{d.tier}</div>
      </div>
      {note && <p className="mt-1 text-xs font-medium text-foreground">{note}</p>}
      {d.contributors.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">No difficulty factors recorded.</p>
      ) : (
        <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          {d.contributors.map((c) => (
            <li key={c.label} className="flex justify-between gap-2">
              <span>{c.label}</span>
              <span className="tabular-nums">+{c.points.toFixed(1)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RarpDifficultyCard({
  bladderNeck,
  apex,
}: {
  bladderNeck: StepDifficulty & { reconstructionLikely: boolean };
  apex: StepDifficulty;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <span className="text-muted-foreground"><Wrench className="h-4 w-4" /></span>
          Bladder-neck &amp; apical difficulty
          <EvidenceInfo title="Bladder-neck and apical difficulty" tags={SOURCES} />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Research use only. Provisional points, not fitted; independent of the nerve-sparing plan.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Step
            title="Bladder neck"
            d={bladderNeck}
            note={bladderNeck.reconstructionLikely ? "Plan for bladder-neck reconstruction" : undefined}
          />
          <Step title="Apex / anastomosis" d={apex} />
        </div>
      </CardContent>
    </Card>
  );
}
