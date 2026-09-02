import { Card, CardContent } from "@/components/ui/card";
import { usePatientStore } from "@/store/patientStore";
import { useUiStore, type DesktopTab } from "@/store/uiStore";
import { deriveClinicalFromLesions, lesionsFromRows } from "@/lib/utils/normalization";
import { clinicalStateFromRecord } from "@/lib/compass/clinicalFromRecord";
import {
  computeFunctionalOutcomes,
  type AlcoholLevel,
  type ExerciseLevel,
  type Pde5Regimen,
  type PfmtLevel,
  type SmokingStatus,
} from "@/lib/compass/functionalOutcomes";
import { computeBiologicalAge } from "@/lib/compass/biologicalAge";
import { cn } from "@/lib/utils";

/**
 * Overview mode: each tab collapsed to the handful of numbers and decisions a
 * clinician would say out loud, with the full tab one toggle away. Reads the
 * same store as the full panels — nothing is recomputed differently here, so
 * an overview line can never disagree with the tab behind it.
 */

const PLANE: Record<number, string> = { 1: "intrafascial", 2: "interfascial", 3: "wide excision" };

function Row({ label, value, tone, note }: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "bad";
  note?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/40 py-2 last:border-0">
      <div className="min-w-0">
        <div className="text-sm text-foreground">{label}</div>
        {note && <div className="text-[11px] leading-snug text-muted-foreground">{note}</div>}
      </div>
      <div
        className={cn(
          "shrink-0 text-sm font-semibold tabular-nums",
          tone === "good" ? "text-emerald-600 dark:text-emerald-400"
            : tone === "warn" ? "text-amber-600 dark:text-amber-400"
              : tone === "bad" ? "text-red-500"
                : "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}

/** Risk tone thresholds match the prediction panel's colour bands. */
const riskTone = (p: number): "good" | "warn" | "bad" =>
  p < 0.15 ? "good" : p < 0.3 ? "warn" : "bad";
const pct = (p: number) => `${Math.round(p * 100)}%`;

const toSmoking = (v: string): SmokingStatus =>
  (["never", "former", "current"] as string[]).includes(v) ? (v as SmokingStatus) : "never";
const toExercise = (v: string): ExerciseLevel =>
  (["sedentary", "light", "moderate", "active"] as string[]).includes(v) ? (v as ExerciseLevel) : "moderate";
const toPfmt = (v: string): PfmtLevel =>
  (["none", "basic", "moderate", "intensive"] as string[]).includes(v) ? (v as PfmtLevel) : "basic";
const toPde5 = (v: string): Pde5Regimen =>
  (["none", "prn", "daily"] as string[]).includes(v) ? (v as Pde5Regimen) : "prn";

export function OverviewPanel({ tab }: { tab: DesktopTab }) {
  const predictions = usePatientStore((s) => s.predictions);
  const patients = usePatientStore((s) => s.patients);
  const activeId = usePatientStore((s) => s.activeId);
  const setOverview = useUiStore((s) => s.setOverview);

  const entry = patients.find((p) => p.id === activeId) ?? null;
  const S = entry
    ? deriveClinicalFromLesions(
        clinicalStateFromRecord({ ...entry.record, lesions: entry.lesionRows }),
        lesionsFromRows(entry.lesionRows),
      )
    : null;

  if (!entry || !S || !predictions) {
    return (
      <div className="mx-auto w-full max-w-2xl p-6 text-center text-sm text-muted-foreground">
        No case loaded.
      </div>
    );
  }

  const { plan, inflammation } = predictions;
  const nsL = Math.min(3, Math.max(1, Math.round(plan.left.nsGrade)));
  const nsR = Math.min(3, Math.max(1, Math.round(plan.right.nsGrade)));

  const fn = computeFunctionalOutcomes({
    nsL: nsL as 1 | 2 | 3,
    nsR: nsR as 1 | 2 | 3,
    age: S.age, shim: S.shim, ipss: S.ipss, bmi: S.bmi,
    pfmt: toPfmt(S.pfmt),
    exercise: toExercise(S.exercise),
    smoking: toSmoking(S.smoking),
    pde5: toPde5(S.pde5),
    alcohol: (S.alcohol || "moderate") as AlcoholLevel,
    dm: S.dm, htn: S.htn, cad: S.cad,
    plan: {
      hood: plan.hood.value,
      bnPreservation: plan.bladderNeckPreservation.value,
      svPreservationL: plan.left.svPreservation.value,
      svPreservationR: plan.right.svPreservation.value,
      hydrodissectionL: plan.left.hydrodissection.value,
      hydrodissectionR: plan.right.hydrodissection.value,
      inflammationTier: inflammation.tier,
    },
  });

  const bio = S.age > 0
    ? computeBiologicalAge({
        age: S.age, bmi: S.bmi,
        smoking: toSmoking(S.smoking),
        exercise: toExercise(S.exercise),
        alcohol: (S.alcohol || "moderate") as AlcoholLevel,
        dm: S.dm, htn: S.htn, cad: S.cad,
      })
    : null;

  const psad = S.vol > 0 ? S.psa / S.vol : null;

  const body =
    tab === "input" ? (
      <>
        <Row label="Age" value={S.age > 0 ? `${S.age}` : "—"} />
        <Row label="PSA" value={S.psa > 0 ? `${S.psa} ng/mL` : "—"}
             note={psad ? `PSAD ${psad.toFixed(3)} ng/mL/cc · ${S.vol} cc gland` : undefined} />
        <Row label="Grade group" value={S.gg > 0 ? `GG ${S.gg}` : "—"}
             note={S.cores > 0 ? `${S.cores} positive core${S.cores === 1 ? "" : "s"}` : undefined} />
        <Row label="PI-RADS" value={S.pirads > 0 ? `${S.pirads}` : "—"} />
        <Row label="Lesions mapped" value={`${entry.lesionRows.length}`} />
        <Row label="Baseline function" value={`SHIM ${S.shim} · IPSS ${S.ipss}`} />
      </>
    ) : tab === "predictions" ? (
      <>
        <Row label="Extracapsular extension" value={pct(predictions.ece)} tone={riskTone(predictions.ece)}
             note={`left ${pct(predictions.eceL)} · right ${pct(predictions.eceR)}`} />
        <Row label="Seminal-vesicle invasion" value={pct(predictions.svi)} tone={riskTone(predictions.svi)} />
        <Row label="Lymph-node involvement" value={pct(predictions.lni)} tone={riskTone(predictions.lni)} />
        <Row label="Grade upgrade at surgery" value={pct(predictions.upgrade)} tone={riskTone(predictions.upgrade)} />
        <Row label="Positive surgical margin" value={pct(predictions.psm)} tone={riskTone(predictions.psm)} />
        <Row label="Biochemical recurrence" value={pct(predictions.bcr)} tone={riskTone(predictions.bcr)} />
      </>
    ) : tab === "outcomes" ? (
      <>
        <Row label="Potency at 12 months"
             value={fn.shimValid ? `${fn.potency12}%` : "n/a"}
             tone={fn.shimValid ? (fn.potency12! >= 70 ? "good" : fn.potency12! >= 40 ? "warn" : "bad") : undefined}
             note={fn.shimValid ? "SHIM ≥ 12 at baseline" : "baseline SHIM < 12 — not modelled"} />
        <Row label="Continence at 12 months" value={`${fn.continence12}%`}
             tone={fn.continence12 >= 90 ? "good" : fn.continence12 >= 75 ? "warn" : "bad"}
             note="0–1 pad" />
        {fn.healerTier && (
          <Row label="Recovery phenotype" value={fn.healerTier.replace("-", " ")} />
        )}
        {bio && (
          <Row label="Biological age" value={`${bio.biological}`}
               tone={bio.offset > 0 ? "warn" : bio.offset < 0 ? "good" : undefined}
               note={`vs. ${bio.chronological} chronological${bio.potentialGain > 0 ? ` · best achievable ${bio.bestAchievable}` : ""}`} />
        )}
      </>
    ) : (
      <>
        <Row label="Nerve sparing — left" value={`Grade ${nsL}`} note={PLANE[nsL]} />
        <Row label="Nerve sparing — right" value={`Grade ${nsR}`} note={PLANE[nsR]} />
        <Row label="Anterior hood" value={plan.hood.value} />
        <Row label="Bladder-neck preservation" value={plan.bladderNeckPreservation.value ? "yes" : "no"} />
        <Row label="Inflammation risk" value={inflammation.tier}
             tone={inflammation.tier === "low" ? "good" : inflammation.tier === "moderate" ? "warn" : "bad"}
             note={inflammation.reviewMri ? "review MRI before the plane decision" : undefined} />
        {(plan.left.overridden || plan.right.overridden) && (
          <Row label="Surgeon override" value="in effect" tone="warn"
               note="the planned grade differs from what the model recommends" />
        )}
      </>
    );

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Card>
        <CardContent className="p-4">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold">Key points</h2>
            <button
              type="button"
              onClick={() => setOverview(false)}
              className="text-[11px] font-medium text-primary hover:underline"
            >
              Show full detail
            </button>
          </div>
          <div>{body}</div>
        </CardContent>
      </Card>
    </div>
  );
}
