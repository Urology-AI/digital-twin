import { cn } from "@/lib/utils";
import type { DifficultyTier } from "@/lib/compass/rarpDifficulty";
import type { RecoveryReserve, ReserveTier } from "@/lib/compass/recoveryReserve";
import type { SidePlan } from "@/types/prediction";

type Tone = "good" | "warn" | "bad" | "muted";

const TONE: Record<Tone, string> = {
  good: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  bad: "text-red-600 dark:text-red-400",
  muted: "text-muted-foreground",
};

const NS_NAME: Record<number, string> = { 1: "Intrafascial", 2: "Interfascial", 3: "Extrafascial" };
const NS_TONE: Record<number, Tone> = { 1: "good", 2: "warn", 3: "bad" };
const HOSTILITY_TONE: Record<SidePlan["hostilityTier"], Tone> = {
  low: "good",
  intermediate: "warn",
  high: "bad",
  "very-high": "bad",
};
const STEP_TONE: Record<DifficultyTier, Tone> = { low: "good", moderate: "warn", high: "bad" };
const RESERVE_TONE: Record<ReserveTier, Tone> = { good: "good", reduced: "warn", poor: "bad" };

function Tile({ label, value, tone, sub }: { label: string; value: string; tone: Tone; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-sm font-semibold capitalize leading-tight", TONE[tone])}>{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

/** One-glance recap of the plan; every figure is computed elsewhere on the page. */
export function PlanSummaryStrip({
  left,
  right,
  bladderNeck,
  apex,
  reserve,
}: {
  left: SidePlan;
  right: SidePlan;
  bladderNeck: DifficultyTier;
  apex: DifficultyTier;
  reserve: RecoveryReserve;
}) {
  const plane = (p: SidePlan) => p.hostilityTier.replace("-", " ");
  const worst = (a: SidePlan, b: SidePlan) =>
    (["low", "intermediate", "high", "very-high"] as const).indexOf(a.hostilityTier) >=
    (["low", "intermediate", "high", "very-high"] as const).indexOf(b.hostilityTier)
      ? a
      : b;
  const worstSide = worst(left, right);
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <Tile label="Left side" value={NS_NAME[left.nsGrade] ?? "—"} tone={NS_TONE[left.nsGrade] ?? "muted"} sub={`Grade ${left.nsGrade}`} />
      <Tile label="Right side" value={NS_NAME[right.nsGrade] ?? "—"} tone={NS_TONE[right.nsGrade] ?? "muted"} sub={`Grade ${right.nsGrade}`} />
      <Tile
        label="Plane risk"
        value={plane(worstSide)}
        tone={HOSTILITY_TONE[worstSide.hostilityTier]}
        sub={`L ${plane(left)} · R ${plane(right)}`}
      />
      <Tile label="Bladder neck" value={bladderNeck} tone={STEP_TONE[bladderNeck]} />
      <Tile label="Apex" value={apex} tone={STEP_TONE[apex]} />
      <Tile
        label="Recovery reserve"
        value={reserve.available && reserve.tier ? reserve.tier : "N/A"}
        tone={reserve.available && reserve.tier ? RESERVE_TONE[reserve.tier] : "muted"}
        sub={reserve.available && reserve.probability !== null ? `${Math.round(reserve.probability * 100)}% at 18 mo` : "SHIM < 12"}
      />
    </div>
  );
}
