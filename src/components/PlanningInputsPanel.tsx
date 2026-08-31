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

/** Segmented picker — matches the Modifiable Factors panel style. */
function Seg<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-md border border-border divide-x divide-border">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 px-2 py-2 text-xs font-semibold transition-colors",
            value === o.value
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:bg-muted/60",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

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

  /** Big toggle button for a boolean risk factor. */
  const Toggle = ({ k, label }: { k: BoolKey; label: string }) => {
    const on = S[k];
    return (
      <button
        type="button"
        onClick={() => updateClinicalForm({ [k]: !on } as Partial<ClinicalState>)}
        className={cn(
          "flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs font-semibold transition-all",
          on
            ? "border-primary bg-primary/10 text-primary"
            : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-muted/60",
        )}
      >
        <span
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
            on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
          )}
        >
          {on && <Check className="h-3 w-3" strokeWidth={3} />}
        </span>
        {label}
      </button>
    );
  };

  const Group = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="space-y-2 border-t border-border/60 pt-3.5 first:border-t-0 first:pt-0">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );

  const activeCount =
    (
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

  const bmiCat =
    S.bmi >= 30 ? "Obese" : S.bmi >= 25 ? "Overweight" : S.bmi > 0 ? "Normal" : null;

  const NUM: [keyof ClinicalState, string, string, number, number][] = [
    ["age", "Age", "yrs", 40, 95],
    ["vol", "Volume", "cc", 10, 250],
    ["bmi", "BMI", "kg/m²", 15, 60],
    ["ipss", "IPSS", "0–35", 0, 35],
  ];

  return (
    <Card className="border-border/70">
      <CardHeader className="border-b border-border/50 bg-gradient-to-br from-muted/40 to-transparent px-4 py-3 dark:from-muted/25">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-foreground">
            Surgical history &amp; anatomy
          </CardTitle>
          {activeCount > 0 && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
              {activeCount} risk factor{activeCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Feeds the inflammation risk and the operative plan.
        </p>
      </CardHeader>

      <CardContent className="space-y-4 px-4 py-4">
        <Group title="Patient">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
            {NUM.map(([k, lbl, unit, min, max]) => (
              <div key={k} className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  {lbl} <span className="font-normal text-muted-foreground">({unit})</span>
                </label>
                <div className="flex items-center gap-2">
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
                    className="h-8 w-20 text-sm"
                  />
                  {k === "bmi" && bmiCat && (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        S.bmi >= 30
                          ? "bg-red-500/10 text-red-500"
                          : S.bmi >= 25
                            ? "bg-amber-500/10 text-amber-500"
                            : "bg-emerald-500/10 text-emerald-500",
                      )}
                    >
                      {bmiCat}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Group>

        <Group title="Median lobe">
          <Seg<number>
            value={S.median_lobe_grade}
            onChange={(v) => updateClinicalForm({ median_lobe_grade: v })}
            options={[
              { label: "None", value: 0 },
              { label: "1", value: 1 },
              { label: "2", value: 2 },
              { label: "3", value: 3 },
            ]}
          />
        </Group>

        <Group title="Prior BPH surgery">
          <div className="grid grid-cols-2 gap-2">
            <Toggle k="prior_turp" label="TURP" />
            <Toggle k="prior_urolift" label="Urolift" />
            <Toggle k="prior_greenlight" label="GreenLight" />
            <Toggle k="prior_holep" label="HoLEP" />
            <Toggle k="prior_rezum" label="Rezūm" />
          </div>
        </Group>

        <Group title="Urinary / prostatic history">
          <div className="grid grid-cols-2 gap-2">
            <Toggle k="urinary_retention" label="Retention" />
            <Toggle k="recurrent_uti" label="Recurrent UTI" />
            <Toggle k="treated_prostatitis" label="Prostatitis Rx" />
            <Toggle k="biopsy_shows_inflammation" label="Biopsy inflammation" />
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-semibold text-foreground">Biopsy sessions</span>
            <Input
              type="number"
              min={1}
              max={10}
              value={S.biopsy_sessions}
              onChange={(e) =>
                updateClinicalForm({ biopsy_sessions: Math.max(1, Number(e.target.value) || 1) })
              }
              className="h-8 w-16 text-sm"
            />
          </div>
        </Group>

        <Group title="Pelvic conditions">
          <div className="grid grid-cols-2 gap-2">
            <Toggle k="prior_pelvic_radiation" label="Pelvic radiation" />
            <Toggle k="radiation_proctitis" label="Radiation proctitis" />
            <Toggle k="crohns" label="Crohn's" />
            <Toggle k="ulcerative_colitis" label="Ulcerative colitis" />
            <Toggle k="diverticulitis" label="Diverticulitis" />
            <Toggle k="pelvic_abscess" label="Pelvic abscess" />
            <Toggle k="hernia_mesh" label="Hernia mesh" />
            <Toggle k="rectal_fistula" label="Rectal fistula" />
          </div>
        </Group>

        <Group title="MRI — periprostatic tissue">
          <Seg
            value={S.mri_periprostatic_inflammation}
            onChange={(v) => updateClinicalForm({ mri_periprostatic_inflammation: v })}
            options={[
              { label: "None", value: "none" },
              { label: "Equivocal", value: "equivocal" },
              { label: "Present", value: "present" },
            ]}
          />
          <div className="grid grid-cols-2 gap-2">
            <Toggle k="mri_periprostatic_fat_stranding" label="Fat stranding" />
          </div>
        </Group>
      </CardContent>
    </Card>
  );
}
