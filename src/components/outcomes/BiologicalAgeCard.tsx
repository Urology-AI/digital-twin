import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { ageAdjustment } from "@/lib/compass/functionalOutcomes";
import {
  computeBiologicalAge,
  type BiologicalAgeInputs,
} from "@/lib/compass/biologicalAge";
import {
  BIOLOGICAL_AGE_ALCOHOL,
  BIOLOGICAL_AGE_BMI,
  BIOLOGICAL_AGE_COMORBID,
  BIOLOGICAL_AGE_EXERCISE,
  BIOLOGICAL_AGE_FRAMING,
  BIOLOGICAL_AGE_SMOKING,
} from "@/lib/compass/planningEvidence";
import { EvidenceInfo } from "@/components/EvidenceInfo";
import { cn } from "@/lib/utils";

const BIOLOGICAL_AGE_EVIDENCE = [
  BIOLOGICAL_AGE_FRAMING,
  BIOLOGICAL_AGE_BMI,
  BIOLOGICAL_AGE_SMOKING,
  BIOLOGICAL_AGE_EXERCISE,
  BIOLOGICAL_AGE_ALCOHOL,
  BIOLOGICAL_AGE_COMORBID,
];


/** |years| → the band we show instead of a spuriously precise year figure. */
function burdenBand(years: number): "Low" | "Medium" | "High" {
  const y = Math.abs(years);
  return y >= 2 ? "High" : y >= 1 ? "Medium" : "Low";
}

/**
 * Biological age — the modifiable-factor burden re-expressed in years. Its own
 * card, above the factor table: the same inputs counted a second way, and a
 * counselling display only, never a model input.
 */
export function BiologicalAgeCard({ bio: inputs }: { bio: BiologicalAgeInputs }) {
  if (!(inputs.age > 0)) return null;
  const bio = computeBiologicalAge(inputs);
  const chronoFactor = ageAdjustment(bio.chronological);
  const bioFactor = ageAdjustment(bio.biological);
  const older = bio.offset > 0;
  const younger = bio.offset < 0;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold">Biological age</CardTitle>
            <EvidenceInfo title="Biological age" entries={BIOLOGICAL_AGE_EVIDENCE} />
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                "text-xl font-bold tabular-nums",
                older ? "text-amber-500 dark:text-amber-400"
                  : younger ? "text-emerald-600 dark:text-emerald-400"
                  : "text-foreground",
              )}
            >
              {bio.biological}
            </span>
            <span className="text-[11px] text-muted-foreground">
              vs. {bio.chronological} chronological
              {bio.potentialGain > 0 && <> · best achievable {bio.bestAchievable}</>}
            </span>
          </div>
        </div>

        {bio.contributions.length > 0 && (
          <div className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
            {bio.contributions.map((c) => (
              <div key={c.label} className="contents">
                <div className="truncate text-muted-foreground">{c.label}</div>
                <div
                  className={cn(
                    "text-right",
                    c.years > 0
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-emerald-600 dark:text-emerald-400",
                  )}
                >
                  {c.years > 0 ? "↑" : "↓"} {burdenBand(c.years)}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
          The potency curve&rsquo;s age factor is{" "}
          <span className="font-semibold tabular-nums">{chronoFactor.toFixed(2)}</span> at{" "}
          {bio.chronological}; at {bio.biological} it would be{" "}
          <span className="font-semibold tabular-nums">{bioFactor.toFixed(2)}</span>. Shown for
          counselling, not applied — the nomogram already charges these factors as direct
          recovery deltas, so age would double-count them.
        </p>
      </CardContent>
    </Card>
  );
}
