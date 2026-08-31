import { useMemo } from "react";
import { Activity, Droplets, RotateCcw, ShieldCheck, TriangleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { usePatientStore } from "@/store/patientStore";
import {
  deriveClinicalFromLesions,
  lesionsFromRows,
} from "@/lib/utils/normalization";
import { clinicalStateFromRecord } from "@/lib/compass/clinicalFromRecord";
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

const NS_META: Record<number, { name: string; tone: string }> = {
  1: { name: "Intrafascial", tone: "emerald" },
  2: { name: "Interfascial", tone: "amber" },
  3: { name: "Extrafascial", tone: "red" },
};

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
  accent,
  invert = false,
}: {
  label: string;
  sub: string;
  baseline: number;
  withPlan: number;
  accent: string;
  invert?: boolean;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className={cn("absolute inset-x-0 top-0 h-[3px]", accent)} />
      <CardContent className="p-3.5">
        <div className="flex items-start justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <DeltaBadge from={baseline} to={withPlan} invert={invert} />
        </div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-3xl font-bold tabular-nums">{pct(withPlan)}</span>
          <span className="text-xs text-muted-foreground tabular-nums">from {pct(baseline)}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full", invert ? "bg-red-400" : "bg-primary")}
            style={{ width: `${Math.min(100, withPlan * 100)}%` }}
          />
        </div>
        <div className="mt-1.5 text-[10px] text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
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
                <span className="ml-1.5 text-[10px] font-semibold uppercase text-muted-foreground">
                  · auto: {resolved ? "yes" : "no"}
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
  hydroOverride,
  svOverride,
  onOverride,
  onHydro,
  onSv,
}: {
  plan: SidePlan;
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
        <span className="text-sm font-semibold">{label} side</span>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-bold",
            meta.tone === "emerald" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
            meta.tone === "amber" && "bg-amber-500/15 text-amber-600 dark:text-amber-400",
            meta.tone === "red" && "bg-red-500/15 text-red-600 dark:text-red-400",
          )}
        >
          {plan.plane}
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
            onChange={(v) => onOverride(Number(v))}
            options={[
              { value: "1", label: "1", hint: "Intrafascial" },
              { value: "2", label: "2", hint: "Interfascial" },
              { value: "3", label: "3", hint: "Wide" },
            ]}
          />
          <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{plan.gradeRationale}</p>
        </div>

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
                    g === 1 && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                    g === 2 && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                    g === 3 && "bg-red-500/10 text-red-600 dark:text-red-400",
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
      hood: "none",
      bnPreservation: false,
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
      hood: plan.hood.value,
      bnPreservation: plan.bladderNeckPreservation.value,
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

    return { baseline, withPlan, bcr };
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
  const { baseline, withPlan, bcr } = computed;

  const tierTone =
    inflammation.tier === "high"
      ? { text: "text-red-600 dark:text-red-400", bg: "bg-red-500/10", bar: "bg-red-500" }
      : inflammation.tier === "moderate"
        ? { text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", bar: "bg-amber-500" }
        : { text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", bar: "bg-emerald-500" };

  const maxPts = Math.max(1, ...inflammation.contributors.map((c) => c.points));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 pb-12">
      <div>
        <h2 className="text-lg font-semibold">Operative plan</h2>
        <p className="text-xs text-muted-foreground">Advisory · research use only.</p>
      </div>

      {/* ── Impact ─────────────────────────────────────────────── */}
      <section>
        <SectionTitle icon={<Activity className="h-4 w-4" />}>
          Impact vs. nerve-sparing grade alone
        </SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ImpactTile
            label="Continence"
            sub="at 12 months · 0–1 pad"
            baseline={baseline.continence12 / 100}
            withPlan={withPlan.continence12 / 100}
            accent="bg-gradient-to-r from-violet-500 to-primary"
          />
          {baseline.potency12 != null && withPlan.potency12 != null ? (
            <ImpactTile
              label="Potency"
              sub="at 12 months · SHIM ≥ 12"
              baseline={baseline.potency12 / 100}
              withPlan={withPlan.potency12 / 100}
              accent="bg-gradient-to-r from-blue-500 to-primary"
            />
          ) : (
            <Card className="relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-blue-500 to-primary" />
              <CardContent className="p-3.5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Potency
                </div>
                <div className="mt-1 text-2xl font-bold text-muted-foreground/50">N/A</div>
                <div className="mt-1 text-[10px] text-muted-foreground">SHIM &lt; 12 at baseline</div>
              </CardContent>
            </Card>
          )}
          <ImpactTile
            label="BCR 1 year"
            sub="cumulative incidence"
            baseline={bcr.baseline.y1}
            withPlan={bcr.withPlan.y1}
            accent="bg-gradient-to-r from-red-500 to-orange-500"
            invert
          />
          <ImpactTile
            label="BCR 2–3 years"
            sub="cumulative incidence"
            baseline={bcr.baseline.y23}
            withPlan={bcr.withPlan.y23}
            accent="bg-gradient-to-r from-red-500 to-orange-500"
            invert
          />
        </div>
      </section>

      {/* ── Per-side plan ──────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SideCard
          plan={plan.left}
          hydroOverride={S.plan_hydrodissection_l}
          svOverride={S.plan_sv_preservation_l}
          onOverride={(g) => updateClinicalForm({ plan_ns_override_l: g })}
          onHydro={(v) => updateClinicalForm({ plan_hydrodissection_l: v })}
          onSv={(v) => updateClinicalForm({ plan_sv_preservation_l: v })}
        />
        <SideCard
          plan={plan.right}
          hydroOverride={S.plan_hydrodissection_r}
          svOverride={S.plan_sv_preservation_r}
          onOverride={(g) => updateClinicalForm({ plan_ns_override_r: g })}
          onHydro={(v) => updateClinicalForm({ plan_hydrodissection_r: v })}
          onSv={(v) => updateClinicalForm({ plan_sv_preservation_r: v })}
        />
      </div>

      {/* ── Anterior approach ──────────────────────────────────── */}
      <Card>
        <CardContent className="space-y-4 p-4">
          <SectionTitle icon={<ShieldCheck className="h-4 w-4" />}>Anterior approach</SectionTitle>
          <div>
            <div className="mb-1.5 text-xs font-semibold text-foreground">
              Retzius-sparing / anterior hood
            </div>
            <Segmented
              value={S.plan_hood}
              onChange={(v) => updateClinicalForm({ plan_hood: v })}
              options={[
                { value: "auto", label: "Auto", hint: plan.hood.value },
                { value: "none", label: "None" },
                { value: "unilateral", label: "Uni" },
                { value: "bilateral", label: "Bilat" },
              ]}
            />
            <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{plan.hood.rationale}</p>
          </div>
          <TriToggle
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Bladder-neck preservation"
            detail={plan.bladderNeckPreservation.rationale}
            resolved={plan.bladderNeckPreservation.value}
            value={S.plan_bnp}
            onChange={(v) => updateClinicalForm({ plan_bnp: v })}
          />
        </CardContent>
      </Card>

      {/* ── Inflammation risk ──────────────────────────────────── */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <SectionTitle icon={<TriangleAlert className="h-4 w-4" />}>
              Periprostatic inflammation risk
            </SectionTitle>
            <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold uppercase", tierTone.bg, tierTone.text)}>
              {inflammation.tier} · {pct(inflammation.score)}
            </span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full rounded-full", tierTone.bar)} style={{ width: `${inflammation.score * 100}%` }} />
          </div>

          {inflammation.reviewMri && (
            <div className="flex gap-2 rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Review the MRI for tell-tale signs of periprostatic inflammation or fatty change
              (reticular fat stranding, effaced fat planes, dilated venous plexus) before finalising
              the plan.
            </div>
          )}
          {inflammation.intraopObserved && (
            <p className="text-xs text-muted-foreground">
              Estimate driven by the recorded intra-operative inflammation grade.
            </p>
          )}

          {inflammation.contributors.length === 0 ? (
            <p className="text-xs text-muted-foreground">No risk factors recorded.</p>
          ) : (
            <div className="space-y-1.5">
              {inflammation.contributors.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="w-52 shrink-0 truncate text-muted-foreground" title={c.label}>
                    {c.label}
                  </span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className={cn("block h-full rounded-full", tierTone.bar)}
                      style={{ width: `${(c.points / maxPts) * 100}%` }}
                    />
                  </span>
                  <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">
                    +{c.points.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-4 border-t border-border pt-3 text-xs">
            {(["l", "r"] as const).map((sd) => (
              <label key={sd} className="flex items-center gap-1.5 font-medium">
                Intra-op grade {sd.toUpperCase()}
                <select
                  value={sd === "l" ? S.intraop_inflammation_l : S.intraop_inflammation_r}
                  onChange={(e) =>
                    updateClinicalForm(
                      sd === "l"
                        ? { intraop_inflammation_l: Number(e.target.value) }
                        : { intraop_inflammation_r: Number(e.target.value) },
                    )
                  }
                  className="rounded border border-border bg-background px-1.5 py-0.5"
                >
                  {[0, 1, 2, 3].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
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
