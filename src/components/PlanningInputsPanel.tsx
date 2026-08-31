import { useMemo } from "react";
import { Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePatientStore } from "@/store/patientStore";
import { clinicalStateFromRecord } from "@/lib/compass/clinicalFromRecord";
import type { ClinicalState } from "@/types/patient";
import { cn } from "@/lib/utils";

type BoolKey = {
  [K in keyof ClinicalState]: ClinicalState[K] extends boolean ? K : never;
}[keyof ClinicalState];

export function PlanningInputsPanel() {
  const patients = usePatientStore((s) => s.patients);
  const activeId = usePatientStore((s) => s.activeId);
  const updateClinicalForm = usePatientStore((s) => s.updateClinicalForm);

  const entry = patients.find((p) => p.id === activeId);
  const S = useMemo(
    () =>
      entry ? clinicalStateFromRecord({ ...entry.record, lesions: entry.lesionRows }) : null,
    [entry],
  );

  if (!entry || !S) return null;

  const Chip = ({ k, label }: { k: BoolKey; label: string }) => {
    const on = S[k];
    return (
      <button
        type="button"
        onClick={() => updateClinicalForm({ [k]: !on } as Partial<ClinicalState>)}
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
          on
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-muted/60",
        )}
      >
        <span
          className={cn(
            "flex h-3.5 w-3.5 items-center justify-center rounded-full border",
            on ? "border-primary-foreground/60 bg-primary-foreground/20" : "border-muted-foreground/40",
          )}
        >
          {on && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
        </span>
        {label}
      </button>
    );
  };

  const Group = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="space-y-2 border-t border-border/60 pt-3.5 first:border-t-0 first:pt-0">
      <h3 className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/80">
        {title}
      </h3>
      {children}
    </div>
  );

  const activeCount = (
    [
      "prior_turp", "prior_urolift", "prior_greenlight", "prior_holep", "prior_rezum",
      "prior_pelvic_radiation", "radiation_proctitis", "urinary_retention", "recurrent_uti",
      "treated_prostatitis", "biopsy_shows_inflammation", "crohns", "ulcerative_colitis",
      "diverticulitis", "pelvic_abscess", "hernia_mesh", "rectal_fistula",
      "mri_periprostatic_fat_stranding",
    ] as BoolKey[]
  ).filter((k) => S[k]).length +
    (S.mri_periprostatic_inflammation !== "none" ? 1 : 0) +
    (S.biopsy_sessions >= 2 ? 1 : 0) +
    (S.age > 70 ? 1 : 0) +
    (S.vol > 80 ? 1 : 0) +
    (S.bmi > 30 ? 1 : 0) +
    (S.ipss > 19 ? 1 : 0);

  return (
    <Card className="border-border/70">
      <CardHeader className="border-b border-border/50 bg-gradient-to-br from-muted/40 to-transparent px-4 py-3 dark:from-muted/25">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-foreground">
            Surgical history &amp; anatomy
          </CardTitle>
          {activeCount > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
              {activeCount} factor{activeCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Drives the periprostatic-inflammation risk and the operative plan. Lifestyle / modifiable
          factors live on the Outcomes tab.
        </p>
      </CardHeader>

      <CardContent className="space-y-3.5 px-4 py-3.5">
        <Group title="Patient">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["age", "Age", "yrs", 40, 90],
                ["vol", "Volume", "cc", 10, 250],
                ["bmi", "BMI", "kg/m²", 15, 60],
                ["ipss", "IPSS", "0–35", 0, 35],
              ] as [keyof ClinicalState, string, string, number, number][]
            ).map(([k, lbl, unit, min, max]) => (
              <label key={k} className="flex items-center justify-between gap-1.5 text-xs font-medium text-foreground">
                <span>
                  {lbl} <span className="font-normal text-muted-foreground">({unit})</span>
                </span>
                <Input
                  type="number"
                  min={min}
                  max={max}
                  step={k === "bmi" ? 0.5 : 1}
                  value={Number(S[k]) || ""}
                  onChange={(e) => {
                    const n = parseFloat(e.target.value);
                    updateClinicalForm({ [k]: isNaN(n) ? undefined : n } as Partial<ClinicalState>);
                  }}
                  className="h-7 w-16 text-sm"
                />
              </label>
            ))}
          </div>
          <p className="text-[10px] leading-snug text-muted-foreground/70">
            Age &gt; 70, volume &gt; 80 cc, BMI &gt; 30 and IPSS &gt; 19 each add to the inflammation
            risk.
          </p>
        </Group>

        <Group title="Anatomy">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">Median lobe grade</span>
            <div className="flex overflow-hidden rounded-md border border-border">
              {[0, 1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => updateClinicalForm({ median_lobe_grade: n })}
                  className={cn(
                    "w-8 py-1 text-xs font-semibold transition-colors",
                    S.median_lobe_grade === n
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:bg-muted/60",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </Group>

        <Group title="Prior BPH / outlet procedures">
          <div className="flex flex-wrap gap-1.5">
            <Chip k="prior_turp" label="TURP" />
            <Chip k="prior_urolift" label="Urolift" />
            <Chip k="prior_greenlight" label="GreenLight" />
            <Chip k="prior_holep" label="HoLEP" />
            <Chip k="prior_rezum" label="Rezūm" />
          </div>
        </Group>

        <Group title="Urinary / prostatic history">
          <div className="flex flex-wrap gap-1.5">
            <Chip k="urinary_retention" label="Urinary retention" />
            <Chip k="recurrent_uti" label="Recurrent UTI / cystoscopy" />
            <Chip k="treated_prostatitis" label="Treated prostatitis" />
            <Chip k="biopsy_shows_inflammation" label="Biopsy inflammation" />
          </div>
          <div className="flex items-center justify-between pt-0.5">
            <span className="text-xs font-medium text-foreground">Biopsy sessions (incl. current)</span>
            <Input
              type="number"
              min={1}
              max={10}
              value={S.biopsy_sessions}
              onChange={(e) =>
                updateClinicalForm({ biopsy_sessions: Math.max(1, Number(e.target.value) || 1) })
              }
              className="h-7 w-14 text-sm"
            />
          </div>
        </Group>

        <Group title="Pelvic radiation / inflammation">
          <div className="flex flex-wrap gap-1.5">
            <Chip k="prior_pelvic_radiation" label="Pelvic radiation" />
            <Chip k="radiation_proctitis" label="Radiation proctitis" />
            <Chip k="crohns" label="Crohn's" />
            <Chip k="ulcerative_colitis" label="Ulcerative colitis" />
            <Chip k="diverticulitis" label="Diverticulitis" />
            <Chip k="pelvic_abscess" label="Pelvic abscess" />
            <Chip k="hernia_mesh" label="Hernia mesh" />
            <Chip k="rectal_fistula" label="Rectal fistula" />
          </div>
        </Group>

        <Group title="MRI re-read — periprostatic tissue">
          <div className="flex overflow-hidden rounded-md border border-border">
            {(["none", "equivocal", "present"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => updateClinicalForm({ mri_periprostatic_inflammation: v })}
                className={cn(
                  "flex-1 px-2 py-1.5 text-xs font-medium capitalize transition-colors",
                  S.mri_periprostatic_inflammation === v
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-muted/60",
                )}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Chip k="mri_periprostatic_fat_stranding" label="Fat stranding / effaced planes" />
          </div>
        </Group>
      </CardContent>
    </Card>
  );
}
