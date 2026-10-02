import { useMemo } from "react";
import { Activity, ChevronRight, Droplets, RotateCcw, ShieldCheck, TriangleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { HealerBands } from "@/components/outcomes/HealerBands";
import { usePatientStore } from "@/store/patientStore";
import {
  deriveClinicalFromLesions,
  lesionsFromRows,
} from "@/lib/utils/normalization";
import { clinicalStateFromRecord } from "@/lib/compass/clinicalFromRecord";
import { EvidenceInfo } from "@/components/EvidenceInfo";
import {
  computeFunctionalOutcomes,
  type AlcoholLevel,
  type ExerciseLevel,
  type FunctionalInputs,
  type Pde5Regimen,
  type PfmtLevel,
  type PlanModifiers,
  type SmokingStatus,
} from "@/lib/compass/functionalOutcomes";
import { bcrByPlan } from "@/lib/compass/bcrByPlan";
import { useUiStore } from "@/store/uiStore";
import { MODIFIABLE_BCR } from "@/lib/compass/planningEvidence";
import { PeriprostaticRiskBySide } from "@/components/PipsCounselingCard";
import { buildPipsCounseling } from "@/lib/compass/pipsCounseling";
import { RecoveryReserveCard } from "@/components/RecoveryReserveCard";
import { computeRecoveryReserve } from "@/lib/compass/recoveryReserve";
import { PDI_ITEMS, PDI_MAX, pdiTotal } from "@/lib/compass/planeDifficultyIndex";
import type { ClinicalState } from "@/types/patient";
import type { SidePlan } from "@/types/prediction";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */

const pf = (v: string): PfmtLevel =>
  (["none", "basic", "moderate", "intensive"] as string[]).includes(v) ? (v as PfmtLevel) : "basic";
const ex = (v: string): ExerciseLevel =>
  (["sedentary", "light", "moderate", "active"] as string[]).includes(v) ? (v as ExerciseLevel) : "moderate";
const sm = (v: string): SmokingStatus =>
  (["never", "former", "current"] as string[]).includes(v) ? (v as SmokingStatus) : "never";
const p5 = (v: string): Pde5Regimen =>
  (["none", "prn", "daily"] as string[]).includes(v) ? (v as Pde5Regimen) : "prn";

function baseInputs(S: ClinicalState): Omit<FunctionalInputs, "nsL" | "nsR" | "plan"> {
  return {
    age: S.age,
    shim: S.shim,
    ipss: S.ipss,
    bmi: S.bmi,
    pfmt: pf(S.pfmt),
    exercise: ex(S.exercise),
    smoking: sm(S.smoking),
    pde5: p5(S.pde5),
    alcohol: (S.alcohol || "moderate") as AlcoholLevel,
    dm: S.dm,
    htn: S.htn,
    cad: S.cad,
  };
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

const HEALER_LABEL: Record<string, string> = {
  super: "Super healer",
  healer: "Healer",
  delayed: "Delayed healer",
  "non-recovery": "Unaided recovery unlikely",
};

const NS_META: Record<number, { name: string; tone: string }> = {
  1: { name: "Intrafascial", tone: "emerald" },
  2: { name: "Interfascial", tone: "amber" },
  3: { name: "Extrafascial", tone: "red" },
};

/** Everything cited by one card, gathered behind that card's single ⓘ. */
const SIDE_SOURCES = [
  "NS grade model",
  "Fascial-plane nomenclature",
  "Fascial-plane nomenclature & athermal technique",
  "PIPS-EPE tier cutpoints",
  "PIPS-H MRI plane-phenotype weights",
  "PIPS EPE x hostility decision matrix",
  "Per-zone NS-grade ECE thresholds",
  "Zone dissection-alert thresholds",
  "Zone dissection-alert thresholds (NVB course)",
  "Zone dissection-alert thresholds (PSMA-at-base ECE rate)",
  "Zonal ECE distribution",
  "Hydrodissection",
  "Seminal-vesicle tip-sparing candidacy",
];

const IMPACT_SOURCES = [
  "Functional-outcome nomogram",
  "Functional-outcome nomogram (recovery trajectory)",
  "Plan functional deltas",
  "Plan effect on positive-margin rate",
  "BCR event-timing fractions",
  "Obesity → BCR risk",
];


const INFLAMMATION_SOURCES = [
  "Inflammation-risk framing",
  "Inflammation-risk weights (prior pelvic radiation)",
  "Inflammation → grade escalation",
];

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
      <span className="text-muted-foreground">{icon}</span>
      {children}
    </div>
  );
}

function DeltaBadge({ from, to, invert = false }: { from: number; to: number; invert?: boolean }) {
  const d = Math.round((to - from) * 100);
  const tone =
    d === 0
      ? "bg-muted text-muted-foreground"
      : (invert ? d < 0 : d > 0)
        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        : "bg-red-500/10 text-red-500";
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums", tone)}>
      {d > 0 ? "+" : ""}
      {d} pp
    </span>
  );
}

function ImpactTile({
  label,
  sub,
  baseline,
  withPlan,
  invert = false,
  accent,
}: {
  label: string;
  sub: string;
  baseline: number;
  withPlan: number;
  invert?: boolean;
  /** Tailwind bg-* class for the progress fill (positive outcomes). Ignored when `invert`. */
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-border p-3.5">
      <div className="flex items-start justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <DeltaBadge from={baseline} to={withPlan} invert={invert} />
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tabular-nums text-foreground">{pct(withPlan)}</span>
        <span className="text-xs text-muted-foreground tabular-nums">from {pct(baseline)}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", invert ? "bg-red-400/80" : accent ?? "bg-foreground/25")}
          style={{ width: `${Math.min(100, withPlan * 100)}%` }}
        />
      </div>
      <div className="mt-1.5 text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
}

/** Tri-state control: Auto (follow the model) / Yes / No. */
function TriToggle({
  icon,
  title,
  resolved,
  detail,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  /** the value the plan resolved to (shown as a chip when on "Auto") */
  resolved: boolean;
  detail: string;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
  sources?: string[];
}) {
  const opts: { v: boolean | null; l: string }[] = [
    { v: null, l: "Auto" },
    { v: true, l: "Yes" },
    { v: false, l: "No" },
  ];
  const active = value === null ? resolved : value;
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        active ? "border-primary/40 bg-primary/[0.05]" : "border-border",
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5", active ? "text-primary" : "text-muted-foreground")}>{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">
              {title}
              {value === null && (
                <span className="ml-1.5 text-[10px] font-medium text-muted-foreground">
                  model: {resolved ? "yes" : "no"}
                </span>
              )}
            </span>
            <div className="flex shrink-0 overflow-hidden rounded-md border border-border">
              {opts.map((o) => (
                <button
                  key={o.l}
                  type="button"
                  onClick={() => onChange(o.v)}
                  className={cn(
                    "px-2 py-0.5 text-[11px] font-semibold transition-colors",
                    value === o.v
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:bg-muted/60",
                  )}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">{detail}</p>
        </div>
      </div>
    </div>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length},1fr)` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-lg border px-2 py-2 text-center transition-colors",
            value === o.value
              ? "border-primary bg-primary text-primary-foreground shadow-sm"
              : "border-border bg-card text-muted-foreground hover:bg-muted/60",
          )}
        >
          <span className="block text-sm font-semibold capitalize">{o.label}</span>
          {o.hint && (
            <span
              className={cn(
                "mt-0.5 block text-[10px] leading-tight",
                value === o.value ? "text-primary-foreground/80" : "text-muted-foreground/70",
              )}
            >
              {o.hint}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* side card                                                          */
/* ------------------------------------------------------------------ */

function SideCard({
  plan,
  sideEce,
  hydroOverride,
  svOverride,
  onOverride,
  onHydro,
  onSv,
}: {
  plan: SidePlan;
  sideEce: number;
  hydroOverride: boolean | null;
  svOverride: boolean | null;
  onOverride: (g: number | null) => void;
  onHydro: (v: boolean | null) => void;
  onSv: (v: boolean | null) => void;
}) {
  const label = plan.side === "left" ? "Left" : "Right";
  const recGrade = plan.recommendedGrade;
  const meta = NS_META[plan.nsGrade] ?? NS_META[2]!;
  return (
    <Card className="overflow-hidden">
      <div
        className={cn(
          "flex items-center justify-between border-b border-border px-4 py-2.5",
          meta.tone === "emerald" && "bg-emerald-500/[0.07]",
          meta.tone === "amber" && "bg-amber-500/[0.07]",
          meta.tone === "red" && "bg-red-500/[0.07]",
        )}
      >
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          {label} side
          <EvidenceInfo title={`${label} side — plan`} tags={SIDE_SOURCES} />
        </span>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-bold",
            plan.decisionCode === "defer"
              ? "bg-red-500/15 text-red-600 dark:text-red-400"
              : meta.tone === "emerald" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
            plan.decisionCode !== "defer" && meta.tone === "amber" && "bg-amber-500/15 text-amber-600 dark:text-amber-400",
            plan.decisionCode !== "defer" && meta.tone === "red" && "bg-red-500/15 text-red-600 dark:text-red-400",
          )}
        >
          {plan.decisionCode === "defer" ? "DEFER" : plan.plane}
        </span>
      </div>

      <CardContent className="space-y-4 p-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Nerve-sparing grade</span>
            {plan.overridden ? (
              <button
                type="button"
                onClick={() => onOverride(null)}
                className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                <RotateCcw className="h-3 w-3" />
                reset to model: grade {recGrade}
              </button>
            ) : (
              <span className="text-[11px] text-muted-foreground">tap to override</span>
            )}
          </div>
          <Segmented
            value={String(plan.nsGrade)}
            onChange={(v) => onOverride(Number(v) === recGrade ? null : Number(v))}
            options={[
              { value: "1", label: "1", hint: "Intrafascial" },
              { value: "2", label: "2", hint: "Interfascial" },
              { value: "3", label: "3", hint: "Wide" },
            ]}
          />
          {plan.pipsGrade !== recGrade && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
              <span className="text-muted-foreground">
                5-zone model: <span className="font-semibold text-foreground">grade {recGrade}</span>
                {" · "}PIPS (side ECE {Math.round(sideEce * 100)}%, high):{" "}
                <span className="font-semibold text-red-600 dark:text-red-400">grade {plan.pipsGrade}</span>
              </span>
              {plan.nsGrade !== plan.pipsGrade && (
                <button
                  type="button"
                  onClick={() => onOverride(plan.pipsGrade)}
                  className="font-medium text-primary hover:underline"
                >
                  use grade {plan.pipsGrade}
                </button>
              )}
            </div>
          )}
          <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{plan.gradeRationale}</p>
        </div>

        {plan.hostileProtocol && (
          <div className="flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-2 text-[11px] leading-snug text-amber-700 dark:text-amber-300/90">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Hostile-plane protocol: early exposure, athermal low-traction dissection, alternate direction,
            hydrodissection, and consent for an intraoperative plane change — fibrosis alone does not justify a
            wider excision here.
          </div>
        )}

        <div>
          <div className="mb-1.5 text-xs font-semibold text-foreground">Zone grade</div>
          <div className="flex flex-wrap gap-1">
            {(["posterolateral", "base", "apex", "anterior", "bladder_neck"] as const).map((z) => {
              const g = plan.zoneGrades[z] ?? 1;
              return (
                <span
                  key={z}
                  className={cn(
                    "rounded-md px-2 py-1 text-[11px] font-medium",
                    g === 1 && "bg-muted text-muted-foreground",
                    g === 2 && "bg-amber-500/12 text-amber-600 dark:text-amber-400",
                    g === 3 && "bg-red-500/12 text-red-600 dark:text-red-400",
                  )}
                >
                  {z.replace("_", " ")} <span className="font-bold">{g}</span>
                </span>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <TriToggle
            icon={<Droplets className="h-4 w-4" />}
            title="Hydrodissection of NVB"
            detail={plan.hydrodissection.rationale}
            resolved={plan.hydrodissection.value}
            value={hydroOverride}
            onChange={onHydro}
          />
          <TriToggle
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Seminal-vesicle tip-sparing"
            detail={plan.svPreservation.rationale}
            resolved={plan.svPreservation.value}
            value={svOverride}
            onChange={onSv}
          />
        </div>

        {plan.cautions.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-2.5">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
              <TriangleAlert className="h-3.5 w-3.5" />
              Cautions
            </div>
            <ul className="list-disc space-y-0.5 pl-4 text-xs text-amber-700 dark:text-amber-300/90">
              {plan.cautions.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* panel                                                              */
/* ------------------------------------------------------------------ */

export function SurgicalPlanPanel() {
  const predictions = usePatientStore((s) => s.predictions);
  const patients = usePatientStore((s) => s.patients);
  const activeId = usePatientStore((s) => s.activeId);
  const updateClinicalForm = usePatientStore((s) => s.updateClinicalForm);
  const setInfoOpen = useUiStore((s) => s.setInfoOpen);
  const setDesktopTab = useUiStore((s) => s.setDesktopTab);

  const entry = patients.find((p) => p.id === activeId) ?? null;
  const S = useMemo(
    () =>
      entry
        ? deriveClinicalFromLesions(
            clinicalStateFromRecord({ ...entry.record, lesions: entry.lesionRows }),
            lesionsFromRows(entry.lesionRows),
          )
        : null,
    [entry],
  );

  const computed = useMemo(() => {
    if (!predictions || !S) return null;
    const { plan, inflammation } = predictions;
    const base = baseInputs(S);

    // Baseline = the model's recommended NS grade + standard technique, but the
    // SAME patient (inflammation tier carries into both arms so the delta is
    // purely the surgical choices).
    const baselineMods: PlanModifiers = {
      svPreservationL: true,
      svPreservationR: true,
      hydrodissectionL: false,
      hydrodissectionR: false,
      inflammationTier: inflammation.tier,
    };
    const baseline = computeFunctionalOutcomes({
      ...base,
      nsL: plan.left.recommendedGrade,
      nsR: plan.right.recommendedGrade,
      plan: baselineMods,
    });

    const planMods: PlanModifiers = {
      svPreservationL: plan.left.svPreservation.value,
      svPreservationR: plan.right.svPreservation.value,
      hydrodissectionL: plan.left.hydrodissection.value,
      hydrodissectionR: plan.right.hydrodissection.value,
      inflammationTier: inflammation.tier,
    };
    const withPlan = computeFunctionalOutcomes({
      ...base,
      nsL: plan.left.nsGrade,
      nsR: plan.right.nsGrade,
      plan: planMods,
    });

    const bcr = bcrByPlan(
      S,
      predictions.bcr,
      {
        nsGrade: Math.max(plan.left.recommendedGrade, plan.right.recommendedGrade),
        hydrodissection: false,
        inflammationTier: inflammation.tier,
      },
      {
        nsGrade: Math.max(plan.left.nsGrade, plan.right.nsGrade),
        hydrodissection: planMods.hydrodissectionL || planMods.hydrodissectionR,
        inflammationTier: inflammation.tier,
      },
    );

    const counseling = buildPipsCounseling(S, plan, predictions.eceL, predictions.eceR, base);

    const reserve = computeRecoveryReserve(S, base);

    return { baseline, withPlan, bcr, counseling, reserve };
  }, [predictions, S]);

  if (!predictions || !entry || !S || !computed) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No patient data available.
        </CardContent>
      </Card>
    );
  }

  const { plan, inflammation } = predictions;
  const { baseline, withPlan, bcr, counseling, reserve } = computed;

  const tierTone =
    inflammation.tier === "high"
      ? { text: "text-red-600 dark:text-red-400", bg: "bg-red-500/10", bar: "bg-red-500" }
      : inflammation.tier === "moderate"
        ? { text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", bar: "bg-amber-500" }
        : { text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", bar: "bg-emerald-500" };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 pb-12">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-border pb-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Operative plan</h2>
          <p className="text-xs text-muted-foreground">
            Side-specific nerve-sparing plan, plane risk and recovery outlook for this case.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold uppercase tracking-wide">
          <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">Research use only</span>
          <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-700 ring-1 ring-inset ring-amber-500/30 dark:text-amber-400">
            Provisional weights
          </span>
        </div>
      </header>

      {plan.gates.activeInfection && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold">Defer surgery — active infection</div>
            <p className="mt-0.5 text-xs leading-snug">
              Bacterial prostatitis, abscess, fistula, sepsis, or a positive culture with symptoms — treat/drain and
              re-image at 6–12 weeks before elective prostatectomy. Neither side has been scored below.
            </p>
          </div>
        </div>
      )}
      {plan.gates.imagingDiscordant && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold">Imaging discordant — multidisciplinary review</div>
            <p className="mt-0.5 text-xs leading-snug">
              MRI, PSMA-PET, biopsy, and/or micro-ultrasound disagree on side or extent. Resolve by review before
              finalizing the plane; the numbers below should not be trusted at face value until then.
            </p>
          </div>
        </div>
      )}
      {plan.gates.mriArtifact && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold text-foreground">Reduced confidence — MRI artifact</div>
            <p className="mt-0.5 text-xs leading-snug">
              MRI degraded by hip hardware or motion. Confidence in both PIPS-EPE and PIPS-H is lower than usual;
              consider micro-ultrasound or PSMA-PET as a substitute local-staging input.
            </p>
          </div>
        </div>
      )}
      {plan.gates.keyDataMissing && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold text-foreground">Reduced confidence — key data missing</div>
            <p className="mt-0.5 text-xs leading-snug">
              No MRI plane read, no baseline IIEF, or prior operative reports unavailable. Obtain them before
              finalizing the plan.
            </p>
          </div>
        </div>
      )}

      {!plan.gates.activeInfection && (
        <PeriprostaticRiskBySide
          counseling={counseling}
          title={
            <div className="flex items-center gap-1.5">
              <SectionTitle icon={<TriangleAlert className="h-4 w-4" />}>
                Periprostatic inflammation &amp; plane risk, by side
              </SectionTitle>
              <EvidenceInfo title="Periprostatic inflammation risk" tags={INFLAMMATION_SOURCES} />
            </div>
          }
          alerts={
            inflammation.reviewMri || inflammation.intraopObserved ? (
              <div className="space-y-2 text-xs">
                {inflammation.reviewMri && (
                  <div className="flex gap-2 rounded-lg bg-amber-500/10 p-2.5 text-amber-700 dark:text-amber-300">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Review the MRI for tell-tale signs of periprostatic inflammation or fatty change
                    (reticular fat stranding, effaced fat planes, dilated venous plexus) before finalising
                    the plan.
                  </div>
                )}
                {inflammation.intraopObserved && (
                  <p className="text-muted-foreground">Estimate driven by the recorded intra-operative inflammation grade.</p>
                )}
              </div>
            ) : null
          }
        />
      )}

      {!plan.gates.activeInfection && <RecoveryReserveCard reserve={reserve} />}

      {/* ── Impact ─────────────────────────────────────────────── */}
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <SectionTitle icon={<Activity className="h-4 w-4" />}>
                Impact vs. nerve-sparing grade alone
              </SectionTitle>
              <EvidenceInfo title="Impact vs. nerve-sparing grade alone" tags={IMPACT_SOURCES} />
            </div>
          </div>
          <p className="-mt-2 text-[11px] text-muted-foreground">
            Outcomes are adjusted for the whole-patient inflammation tier:{" "}
            <span className={cn("font-semibold uppercase", tierTone.text)}>
              {inflammation.tier} · {pct(inflammation.score)}
            </span>
            .
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ImpactTile
              label="Continence"
              sub="at 12 months · 0–1 pad"
              baseline={baseline.continence12 / 100}
              withPlan={withPlan.continence12 / 100}
              accent="bg-violet-500/80"
            />
            {baseline.potency12 != null && withPlan.potency12 != null ? (
              <ImpactTile
                label="Potency"
                sub="at 12 months · SHIM ≥ 12"
                baseline={baseline.potency12 / 100}
                withPlan={withPlan.potency12 / 100}
                accent="bg-blue-500/80"
              />
            ) : (
              <div className="rounded-lg border border-border p-3.5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Potency
                </div>
                <div className="mt-1 text-2xl font-semibold text-muted-foreground/50">N/A</div>
                <div className="mt-1 text-[10px] text-muted-foreground">SHIM &lt; 12 at baseline</div>
              </div>
            )}
            <ImpactTile
              label="BCR 1 year"
              sub="cumulative incidence"
              baseline={bcr.baseline.y1}
              withPlan={bcr.withPlan.y1}
              invert
            />
            <ImpactTile
              label="BCR 2–3 years"
              sub="cumulative incidence"
              baseline={bcr.baseline.y23}
              withPlan={bcr.withPlan.y23}
              invert
            />
          </div>

          {withPlan.healerTier && withPlan.healerBands && (
            <div className="rounded-lg border border-border p-3">
              <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Erectile-recovery phenotype
                </span>
                {baseline.healerTier && (
                  <>
                    <span className="text-xs text-muted-foreground">
                      {HEALER_LABEL[baseline.healerTier]}
                    </span>
                    <span className="text-muted-foreground/50">→</span>
                  </>
                )}
                <span className="text-xs font-semibold text-foreground">
                  {HEALER_LABEL[withPlan.healerTier]}
                </span>
              </div>
              <HealerBands compact tier={withPlan.healerTier} bands={withPlan.healerBands} />
            </div>
          )}

          <button
            type="button"
            onClick={() => setDesktopTab("outcomes")}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Recovery trajectory &amp; modifiable patient factors
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-muted-foreground">Factors</span>
          </button>
        </CardContent>
      </Card>

      {/* ── Per-side plan ──────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SideCard
          plan={plan.left}
          sideEce={predictions.eceL}
          hydroOverride={S.plan_hydrodissection_l}
          svOverride={S.plan_sv_preservation_l}
          onOverride={(g) => updateClinicalForm({ plan_ns_override_l: g })}
          onHydro={(v) => updateClinicalForm({ plan_hydrodissection_l: v })}
          onSv={(v) => updateClinicalForm({ plan_sv_preservation_l: v })}
        />
        <SideCard
          plan={plan.right}
          sideEce={predictions.eceR}
          hydroOverride={S.plan_hydrodissection_r}
          svOverride={S.plan_sv_preservation_r}
          onOverride={(g) => updateClinicalForm({ plan_ns_override_r: g })}
          onHydro={(v) => updateClinicalForm({ plan_hydrodissection_r: v })}
          onSv={(v) => updateClinicalForm({ plan_sv_preservation_r: v })}
        />
      </div>

      {/* ── Intra-operative record ─────────────────────────────── */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Intra-op inflammation grade (overrides the estimate)
            </div>
            {(["l", "r"] as const).map((sd) => {
              const val = sd === "l" ? S.intraop_inflammation_l : S.intraop_inflammation_r;
              return (
                <div key={sd} className="flex items-center gap-3">
                  <span className="w-6 text-xs font-semibold text-muted-foreground">
                    {sd.toUpperCase()}
                  </span>
                  <div className="flex flex-1 overflow-hidden rounded-md border border-border divide-x divide-border">
                    {[0, 1, 2, 3].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() =>
                          updateClinicalForm(
                            sd === "l"
                              ? { intraop_inflammation_l: n }
                              : { intraop_inflammation_r: n },
                          )
                        }
                        className={cn(
                          "flex-1 py-1.5 text-xs font-semibold transition-colors",
                          val === n
                            ? "bg-primary text-primary-foreground"
                            : "bg-card text-muted-foreground hover:bg-muted/60",
                        )}
                      >
                        {n === 0 ? "None" : n}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <details className="space-y-2 border-t border-border pt-3">
            <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Plane Difficulty Index (reference standard — recorded, not scored)
            </summary>
            <p className="pt-2 text-[11px] leading-snug text-muted-foreground">
              Score each item 0 (none) to 3 (severe) per side after dissection. No model reads these;
              they are collected so PIPS-H weights can later be fitted against a structured outcome.
            </p>
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-2 gap-y-1 text-xs">
              <span />
              <span className="text-center font-semibold text-muted-foreground">L</span>
              <span className="text-center font-semibold text-muted-foreground">R</span>
              {PDI_ITEMS.map((item, i) => (
                <PdiRow key={item} index={i} label={item} S={S} onChange={updateClinicalForm} />
              ))}
              <span className="font-semibold text-foreground">Total (of {PDI_MAX})</span>
              <span className="text-center font-semibold tabular-nums">{pdiTotal(S.plane_difficulty_l)}</span>
              <span className="text-center font-semibold tabular-nums">{pdiTotal(S.plane_difficulty_r)}</span>
            </div>
          </details>
        </CardContent>
      </Card>

      {S.bmi >= 30 && (
        <p className="text-[11px] leading-snug text-muted-foreground">
          BMI {S.bmi.toFixed(0)}: ~
          {Math.round(
            (S.bmi >= 35 ? MODIFIABLE_BCR.value.bmi_ge_35 : MODIFIABLE_BCR.value.bmi_ge_30) * 100,
          )}{" "}
          pp on BCR (low-confidence). Weight loss also aids continence &amp; recovery.
        </p>
      )}

      <button
        type="button"
        onClick={() => setInfoOpen(true)}
        className="self-start text-[11px] font-medium text-primary hover:underline"
      >
        Evidence &amp; sources →
      </button>
    </div>
  );
}

/** One Plane Difficulty Index item: a 0–3 score for each side. */
function PdiRow({
  index,
  label,
  S,
  onChange,
}: {
  index: number;
  label: string;
  S: ClinicalState;
  onChange: (patch: Partial<ClinicalState>) => void;
}) {
  const set = (side: "l" | "r", n: number) => {
    const key = side === "l" ? "plane_difficulty_l" : "plane_difficulty_r";
    const next = [...S[key]];
    next[index] = n;
    onChange({ [key]: next } as Partial<ClinicalState>);
  };
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      {(["l", "r"] as const).map((side) => (
        <select
          key={side}
          aria-label={`${label} (${side === "l" ? "left" : "right"})`}
          value={(side === "l" ? S.plane_difficulty_l : S.plane_difficulty_r)[index]}
          onChange={(e) => set(side, Number(e.target.value))}
          className="h-7 rounded-md border border-border bg-card px-1 text-xs"
        >
          {[0, 1, 2, 3].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      ))}
    </>
  );
}
