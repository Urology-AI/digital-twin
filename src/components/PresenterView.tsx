import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePatientStore } from "@/store/patientStore";
import { useUiStore } from "@/store/uiStore";
import { deriveClinicalFromLesions, lesionsFromRows } from "@/lib/utils/normalization";
import { clinicalStateFromRecord } from "@/lib/compass/clinicalFromRecord";
import { computeFunctionalOutcomes } from "@/lib/compass/functionalOutcomes";
import { cn } from "@/lib/utils";

function toSmokingStatus(v: string) {
  return (["never", "former", "current"].includes(v) ? v : "never") as "never" | "former" | "current";
}
function toExerciseLevel(v: string) {
  return (["sedentary", "light", "moderate", "active"].includes(v) ? v : "moderate") as
    | "sedentary" | "light" | "moderate" | "active";
}
function toPfmtLevel(v: string) {
  return (["none", "basic", "moderate", "intensive"].includes(v) ? v : "basic") as
    | "none" | "basic" | "moderate" | "intensive";
}
function toPde5Regimen(v: string) {
  return (["none", "prn", "daily"].includes(v) ? v : "prn") as "none" | "prn" | "daily";
}

function riskTone(v: number): { label: string; text: string; bg: string; ring: string } {
  if (v < 0.15) return { label: "Lower risk", text: "text-emerald-500", bg: "bg-emerald-500/10", ring: "ring-emerald-500/30" };
  if (v < 0.3) return { label: "Moderate risk", text: "text-amber-500", bg: "bg-amber-500/10", ring: "ring-amber-500/30" };
  return { label: "Higher risk", text: "text-red-500", bg: "bg-red-500/10", ring: "ring-red-500/30" };
}

function RiskTile({ title, value }: { title: string; value: number }) {
  const tone = riskTone(value);
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 rounded-2xl p-8 text-center ring-1", tone.bg, tone.ring)}>
      <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{title}</span>
      <span className={cn("text-6xl font-bold tabular-nums", tone.text)}>{Math.round(value * 100)}%</span>
      <span className={cn("text-sm font-semibold", tone.text)}>{tone.label}</span>
    </div>
  );
}

function RecoveryTile({ title, value }: { title: string; value: number | null }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-blue-500/10 p-8 text-center ring-1 ring-blue-500/30">
      <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{title}</span>
      <span className="text-6xl font-bold tabular-nums text-blue-400">
        {value === null ? "—" : `${Math.round(value)}%`}
      </span>
      <span className="text-sm font-semibold text-blue-400">
        {value === null ? "Not estimable" : "Predicted recovery at 12 months"}
      </span>
    </div>
  );
}

export function PresenterView() {
  const setPresenterView = useUiStore((s) => s.setPresenterView);
  const predictions = usePatientStore((s) => s.predictions);
  const patients = usePatientStore((s) => s.patients);
  const activeId = usePatientStore((s) => s.activeId);

  const entry = patients.find((p) => p.id === activeId) ?? null;
  const S = entry
    ? deriveClinicalFromLesions(
        clinicalStateFromRecord({ ...entry.record, lesions: entry.lesionRows }),
        lesionsFromRows(entry.lesionRows),
      )
    : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border/50 px-6 py-4">
        <div>
          <div className="text-lg font-semibold">Presenter view</div>
          {entry && <div className="text-sm text-muted-foreground">{entry.name}</div>}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1.5"
          onClick={() => setPresenterView(false)}
        >
          <X className="h-4 w-4" /> Close
        </Button>
      </div>

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-10 px-6 py-10">
        {!predictions || !entry || !S ? (
          <div className="text-center text-muted-foreground">No patient data available.</div>
        ) : (
          <>
            <section>
              <h2 className="mb-4 text-center text-xl font-semibold text-muted-foreground">Cancer extension risk</h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <RiskTile title="Extracapsular extension (ECE)" value={predictions.ece} />
                <RiskTile title="Seminal vesicle invasion (SVI)" value={predictions.svi} />
              </div>
            </section>

            <section>
              <h2 className="mb-4 text-center text-xl font-semibold text-muted-foreground">Functional recovery</h2>
              <FunctionalTiles S={S} nsL={predictions.nsL as 1 | 2 | 3} nsR={predictions.nsR as 1 | 2 | 3} />
            </section>

            <p className="text-center text-xs text-muted-foreground">
              Research tool only — not a medical device, not FDA cleared, and no substitute for clinical judgment.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function FunctionalTiles({
  S,
  nsL,
  nsR,
}: {
  S: ReturnType<typeof deriveClinicalFromLesions>;
  nsL: 1 | 2 | 3;
  nsR: 1 | 2 | 3;
}) {
  const result = computeFunctionalOutcomes({
    nsL, nsR,
    age: S.age, shim: S.shim, ipss: S.ipss, bmi: S.bmi,
    pfmt: toPfmtLevel(S.pfmt),
    exercise: toExerciseLevel(S.exercise),
    smoking: toSmokingStatus(S.smoking),
    pde5: toPde5Regimen(S.pde5),
    alcohol: (S.alcohol || "moderate") as "none" | "moderate" | "heavy",
    dm: S.dm, htn: S.htn, cad: S.cad,
  });

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <RecoveryTile title="Sexual function (potency)" value={result.shimValid ? result.potency12 : null} />
      <RecoveryTile title="Urinary continence" value={result.continence12} />
    </div>
  );
}
