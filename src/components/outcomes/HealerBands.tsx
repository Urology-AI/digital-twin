import { Card, CardContent, CardTitle } from "@/components/ui/card";
import type { HealerTier } from "@/lib/compass/functionalOutcomes";
import { EvidenceInfo } from "@/components/EvidenceInfo";
import {
  FULL_RECOVERY_THRESHOLD,
  HEALER_THRESHOLD,
} from "@/lib/compass/planningEvidence";

const TITLE: Record<HealerTier, string> = {
  super: "Super healer",
  healer: "Healer",
  delayed: "Delayed healer",
  "non-recovery": "Unlikely to recover unaided",
};

const CAPTION: Record<HealerTier, string> = {
  super: "full potency recovery by 6 weeks",
  healer: "potency ≥ 50% by 12 months",
  delayed: "potency ≥ 50% around 18 months",
  "non-recovery": "does not reach 50% unaided",
};

type Bands = { super: number; healer: number; delayed: number };

function Bar({ bands }: { bands: Bands }) {
  return (
    <>
      <div className="flex h-3 overflow-hidden rounded-full border border-border">
        <div className="bg-emerald-500" style={{ width: `${bands.super * 100}%` }} />
        <div className="bg-sky-500" style={{ width: `${bands.healer * 100}%` }} />
        <div className="bg-amber-500" style={{ width: `${bands.delayed * 100}%` }} />
        <div className="flex-1 bg-muted" />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> super {Math.round(bands.super * 100)}%
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-sky-500" /> healer {Math.round(bands.healer * 100)}%
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-500" /> delayed {Math.round(bands.delayed * 100)}%
        </span>
      </div>
    </>
  );
}

/**
 * Erectile-recovery phenotype: probability mass in each recovery window.
 * `compact` renders just the labelled bar (for embedding elsewhere); the full
 * form wraps it in a titled card.
 */
export function HealerBands({
  tier,
  bands,
  compact = false,
  className,
}: {
  tier: HealerTier;
  bands: Bands;
  compact?: boolean;
  className?: string;
}) {
  if (compact) {
    return (
      <div className={className}>
        <Bar bands={bands} />
      </div>
    );
  }
  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="mb-2 flex items-baseline gap-2">
          <CardTitle className="text-base font-semibold">{TITLE[tier]}</CardTitle>
          <span className="text-xs text-muted-foreground">{CAPTION[tier]}</span>
          <EvidenceInfo
            className="ml-auto self-center"
            title="Recovery phenotype"
            entries={[HEALER_THRESHOLD, FULL_RECOVERY_THRESHOLD]}
          />
        </div>
        <Bar bands={bands} />
      </CardContent>
    </Card>
  );
}
