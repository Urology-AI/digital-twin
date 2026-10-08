import { useMemo } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePatientStore } from "@/store/patientStore";
import { clinicalStateFromRecord } from "@/lib/compass/clinicalFromRecord";
import type { ClinicalState } from "@/types/patient";
import { cn } from "@/lib/utils";
import { INFLAMMATION_WEIGHTS } from "@/lib/compass/planningEvidence";

type BoolKey = {
  [K in keyof ClinicalState]: ClinicalState[K] extends boolean ? K : never;
}[keyof ClinicalState];

/**
 * Which score weight each boolean toggle feeds. A toggle whose weight is 0 is
 * recorded but not scored (no radical-prostatectomy plane evidence, or a
 * validated null), and is badged "context" so the clinician is not misled
 * into thinking it moves the plan.
 */
const TOGGLE_WEIGHT: Partial<Record<BoolKey, keyof typeof INFLAMMATION_WEIGHTS.value>> = {
  prior_urolift: "prior_urolift",
  prior_rezum: "prior_rezum",
  urinary_retention: "urinary_retention",
  recurrent_uti: "recurrent_uti",
  treated_prostatitis: "treated_prostatitis",
  biopsy_shows_inflammation: "biopsy_inflammation",
  diverticulitis: "diverticulitis",
  pelvic_abscess: "pelvic_abscess",
  catheter_prolonged_or_traumatic: "catheter_prolonged",
  biopsy_recent_or_complicated: "biopsy_recent_or_complicated",
  five_ari_long_term: "five_ari_long_term",
};

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
            "min-w-0 flex-1 px-2 py-2 text-xs font-semibold leading-tight transition-colors",
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
  const Toggle = ({ k, label, hint, wide }: { k: BoolKey; label: string; hint?: string; wide?: boolean }) => {
    const on = S[k];
    const weightKey = TOGGLE_WEIGHT[k];
    const contextOnly = weightKey !== undefined && INFLAMMATION_WEIGHTS.value[weightKey] === 0;
    return (
      <button
        type="button"
        aria-pressed={on}
        onClick={() => updateClinicalForm({ [k]: !on } as Partial<ClinicalState>)}
        className={cn(
          "flex items-start gap-2 rounded-md border px-2.5 py-2 text-left text-xs font-semibold transition-all",
          wide && "col-span-2",
          on
            ? "border-primary bg-primary/10 text-primary"
            : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-muted/60",
        )}
      >
        <span
          className={cn(
            "mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded border",
            on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
          )}
        >
          {on && <Check className="h-3 w-3" strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            {label}
            {contextOnly && (
              <span
                className="rounded bg-muted px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-muted-foreground"
                title="Recorded for the case, but not scored: no radical-prostatectomy plane evidence, or a validated null"
              >
                context
              </span>
            )}
          </span>
          {hint && <span className="mt-0.5 block text-[10px] font-normal leading-snug text-muted-foreground">{hint}</span>}
        </span>
      </button>
    );
  };

  const Group = ({
    title,
    children,
    count = 0,
    defaultOpen = true,
  }: {
    title: string;
    children: React.ReactNode;
    /** number of items recorded in this group, shown beside the title */
    count?: number;
    defaultOpen?: boolean;
  }) => (
    <details open={defaultOpen} className="group space-y-2 border-t border-border/60 pt-3.5 first:border-t-0 first:pt-0">
      <summary className="flex cursor-pointer list-none items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <h3>{title}</h3>
          {count > 0 && (
            <span className="rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-bold normal-case tracking-normal text-primary">
              {count}
            </span>
          )}
        </span>
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="space-y-2 pt-2">{children}</div>
    </details>
  );

  const on = (...keys: BoolKey[]) => keys.filter((k) => S[k]).length;

  // Count only factors that actually move the score; context-only toggles
  // (zero weight) are recorded but must not inflate the headline number.
  const scoredToggle = (k: BoolKey) => {
    const wk = TOGGLE_WEIGHT[k];
    return wk === undefined || INFLAMMATION_WEIGHTS.value[wk] !== 0;
  };
  const pvfMeasured = S.pelvic_visceral_fat_cm3 !== null;
  const activeCount =
    (
      [
        "prior_turp", "prior_urolift", "prior_greenlight", "prior_holep", "prior_rezum",
        "prior_pelvic_radiation", "radiation_proctitis", "urinary_retention", "recurrent_uti",
        "treated_prostatitis", "biopsy_shows_inflammation", "crohns", "ulcerative_colitis",
        "diverticulitis", "pelvic_abscess", "hernia_mesh", "rectal_fistula",
        "mri_periprostatic_fat_stranding", "catheter_prolonged_or_traumatic",
        "biopsy_recent_or_complicated",
        "mri_post_biopsy_hemorrhage", "radiation_brachytherapy", "bph_procedure_complicated",
        "five_ari_long_term", "neoadjuvant_adt",
      ] as BoolKey[]
    ).filter((k) => S[k] && scoredToggle(k)).length +
    (S.mri_periprostatic_inflammation !== "none" ? 1 : 0) +
    (S.vol > 80 ? 1 : 0) +
    (S.bmi > 30 && !pvfMeasured ? 1 : 0) +
    (pvfMeasured && (S.pelvic_visceral_fat_cm3 ?? 0) >= 1400 ? 1 : 0) +
    (S.prior_pelvic_surgery === "rectal_denonvilliers" ? 1 : 0) +
    (S.penile_prosthesis_reservoir !== "none" ? 1 : 0) +
    (S.mri_denonvilliers > 0 ? 1 : 0);

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
      <CardHeader className="sticky -top-5 z-10 rounded-t-xl border-b border-border/50 bg-card/95 px-4 pb-3 pt-8 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <CardTitle className="text-base font-semibold text-foreground">
            Surgical history &amp; anatomy
          </CardTitle>
          {activeCount > 0 && (
            <span
              className="whitespace-nowrap rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400"
              title="Factors that change the score. Context-only items are recorded but not counted."
            >
              {activeCount} scored factor{activeCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Feeds plane risk, bladder-neck and apical difficulty, and the operative plan.
        </p>
      </CardHeader>

      <CardContent className="space-y-4 px-4 py-4">
        <Group title="Patient">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
            {NUM.map(([k, lbl, unit, min, max]) => (
              <div key={k} className="space-y-1">
                <label className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-semibold text-foreground">
                  <span>
                    {lbl} <span className="font-normal text-muted-foreground">({unit})</span>
                  </span>
                  {k === "bmi" && bmiCat && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-px text-[10px] font-semibold",
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
                </div>
              </div>
            ))}
          </div>
        </Group>

        <Group title="Gates — checked before the plan is scored" count={on("flag_active_infection","flag_imaging_discordant","flag_mri_artifact","flag_key_data_missing")} defaultOpen={on("flag_active_infection","flag_imaging_discordant","flag_mri_artifact","flag_key_data_missing") > 0}>
          <div className="grid grid-cols-1 gap-2">
            <Toggle k="flag_active_infection" label="Active infection (prostatitis, abscess, fistula, sepsis, or positive culture with symptoms) — defers surgery" />
            <Toggle k="flag_imaging_discordant" label="Imaging discordant (MRI/PSMA/biopsy/micro-US disagree) — forces review" />
            <Toggle k="flag_mri_artifact" label="MRI degraded by hip hardware or motion — downgrades confidence" />
            <Toggle k="flag_key_data_missing" label="Key data missing (no MRI plane read, no baseline IIEF, or prior operative reports unavailable)" />
          </div>
        </Group>

        <Group title="Median lobe" count={S.median_lobe_grade > 0 ? 1 : 0}>
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
          <p className="text-[11px] text-muted-foreground">Feeds the bladder-neck tier.</p>
        </Group>

        <Group title="Prior BPH surgery" count={on("prior_turp","prior_urolift","prior_greenlight","prior_holep","prior_rezum","bph_procedure_complicated")}>
          <div className="grid grid-cols-2 gap-2">
            <Toggle k="prior_turp" label="TURP" />
            <Toggle k="prior_urolift" label="Urolift" />
            <Toggle k="prior_greenlight" label="GreenLight" />
            <Toggle k="prior_holep" label="HoLEP" />
            <Toggle k="prior_rezum" label="Rezūm" />
            <Toggle k="bph_procedure_complicated" label="Complicated TURP / HoLEP / laser" hint="Capsular perforation, extravasation, infection or reoperation" wide />
          </div>
        </Group>

        <Group title="Hormonal therapy" count={on("five_ari_long_term", "neoadjuvant_adt")}>
          <div className="grid grid-cols-2 gap-2">
            <Toggle k="five_ari_long_term" label="5-ARI ≥ 12 months" hint="Effect on the plane is uncertain in direction" wide />
            <Toggle k="neoadjuvant_adt" label="Neoadjuvant ADT" hint="Weak evidence; not added on top of prior radiation" wide />
          </div>
        </Group>

        <Group title="Pelvic conditions" count={on("prior_pelvic_radiation","radiation_brachytherapy","radiation_proctitis","crohns","ulcerative_colitis","diverticulitis","pelvic_abscess","hernia_mesh","rectal_fistula","catheter_prolonged_or_traumatic") + (S.prior_pelvic_surgery !== "none" ? 1 : 0) + (S.penile_prosthesis_reservoir !== "none" ? 1 : 0)}>
          <div className="grid grid-cols-2 gap-2">
            <Toggle k="prior_pelvic_radiation" label="Pelvic radiation" />
            <Toggle k="radiation_brachytherapy" label="Brachytherapy / combined" hint="Radiation modality (expert prior)" />
            <Toggle k="radiation_proctitis" label="Radiation proctitis" />
            <Toggle k="crohns" label="Crohn's" />
            <Toggle k="ulcerative_colitis" label="Ulcerative colitis" />
            <Toggle k="diverticulitis" label="Diverticulitis" />
            <Toggle k="pelvic_abscess" label="Pelvic abscess" />
            <Toggle k="hernia_mesh" label="Hernia mesh" />
            <Toggle k="rectal_fistula" label="Rectal fistula" />
            <Toggle k="catheter_prolonged_or_traumatic" label="Prolonged or traumatic catheter" />
          </div>
          <div className="space-y-1 pt-1">
            <span className="text-xs font-semibold text-foreground">Prior pelvic surgery</span>
            <Seg
              value={S.prior_pelvic_surgery}
              onChange={(v) => updateClinicalForm({ prior_pelvic_surgery: v })}
              options={[
                { label: "None", value: "none" },
                { label: "Bladder, fracture, urethroplasty", value: "bladder_fracture_urethroplasty" },
                { label: "Rectal @ Denonvilliers", value: "rectal_denonvilliers" },
              ]}
            />
          </div>
          <div className="space-y-1 pt-1">
            <span className="text-xs font-semibold text-foreground">Penile prosthesis reservoir</span>
            <Seg
              value={S.penile_prosthesis_reservoir}
              onChange={(v) => updateClinicalForm({ penile_prosthesis_reservoir: v })}
              options={[
                { label: "None", value: "none" },
                { label: "Present", value: "present" },
                { label: "Prior infection/revision", value: "prior_infection_or_revision" },
              ]}
            />
          </div>
        </Group>

        <Group title="Pelvic fat (imaging)" count={S.pelvic_visceral_fat_cm3 !== null ? 1 : 0}>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">
              Pelvic visceral fat <span className="font-normal text-muted-foreground">(cm³; ≥ 1400 prolongs surgery, replaces BMI term)</span>
            </label>
            <Input
              type="number"
              min={0}
              max={5000}
              step={10}
              value={S.pelvic_visceral_fat_cm3 ?? ""}
              onChange={(e) => {
                const n = parseFloat(e.target.value);
                updateClinicalForm({ pelvic_visceral_fat_cm3: isNaN(n) ? null : n });
              }}
              className="h-8 w-24 text-sm"
            />
          </div>
        </Group>

        <Group title="MRI — periprostatic tissue" count={on("mri_periprostatic_fat_stranding","mri_post_biopsy_hemorrhage") + (S.mri_periprostatic_inflammation !== "none" ? 1 : 0) + (S.mri_denonvilliers > 0 ? 1 : 0)}>
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
            <Toggle k="mri_post_biopsy_hemorrhage" label="Post-biopsy hemorrhage" hint="T1 MRI" />
          </div>
          <div className="space-y-1 pt-1">
            <span className="text-xs font-semibold text-foreground">Denonvilliers fascia / rectoprostatic angle</span>
            <Seg<number>
              value={S.mri_denonvilliers}
              onChange={(v) => updateClinicalForm({ mri_denonvilliers: v })}
              options={[
                { label: "Normal", value: 0 },
                { label: "Thickened", value: 1 },
                { label: "Obliterated", value: 2 },
              ]}
            />
          </div>
        </Group>

        <Group title="MRI — plane phenotype, per side (PIPS-H)">
          <p className="text-[11px] text-muted-foreground">
            Side-specific — feeds the plane-hostility axis independently of the whole-gland read above.
          </p>
          <SidePhenotypeRow
            label="Capsule–fat interface"
            leftKey="mri_capsule_interface_l"
            rightKey="mri_capsule_interface_r"
            S={S}
            onChange={updateClinicalForm}
            options={[
              { label: "Sharp", value: 0 },
              { label: "Focal blur", value: 1 },
              { label: "Blurred most", value: 2 },
              { label: "Effaced", value: 3 },
            ]}
          />
          <SidePhenotypeRow
            label="NVB corridor plane"
            leftKey="mri_nvb_plane_l"
            rightKey="mri_nvb_plane_r"
            S={S}
            onChange={updateClinicalForm}
            options={[
              { label: "Visible", value: 0 },
              { label: "Partial", value: 1 },
              { label: "Obliterated", value: 2 },
            ]}
          />
          <SidePhenotypeRow
            label="Post-treatment distortion"
            leftKey="mri_post_treatment_distortion_l"
            rightKey="mri_post_treatment_distortion_r"
            S={S}
            onChange={updateClinicalForm}
            options={[
              { label: "None", value: 0 },
              { label: "Remote", value: 1 },
              { label: "Reaches NVB", value: 2 },
            ]}
          />
          <SidePhenotypeRow
            label="Non-mass inflammatory signal"
            leftKey="mri_nonmass_inflammatory_signal_l"
            rightKey="mri_nonmass_inflammatory_signal_r"
            S={S}
            onChange={updateClinicalForm}
            options={[
              { label: "None", value: 0 },
              { label: "Focal", value: 1 },
              { label: "Diffuse", value: 2 },
            ]}
          />
          <SidePhenotypeRow
            label="Fat stranding / fibrotic bands"
            leftKey="mri_fat_stranding_l"
            rightKey="mri_fat_stranding_r"
            S={S}
            onChange={updateClinicalForm}
            options={[
              { label: "None", value: 0 },
              { label: "Mild", value: 1 },
              { label: "Marked", value: 2 },
            ]}
          />
          <SidePhenotypeRow
            label="Prior focal/whole-gland ablation"
            leftKey="prior_focal_ablation_l"
            rightKey="prior_focal_ablation_r"
            S={S}
            onChange={updateClinicalForm}
            options={[
              { label: "None", value: 0 },
              { label: "Focal (IRE/laser/PDT)", value: 1 },
              { label: "Whole-gland (HIFU/cryo)", value: 2 },
            ]}
          />
        </Group>

        <Group title="Urinary / prostatic history" defaultOpen={false} count={on("urinary_retention","recurrent_uti","treated_prostatitis","biopsy_shows_inflammation","biopsy_recent_or_complicated")}>
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
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Toggle k="biopsy_recent_or_complicated" label="Recent or complicated biopsy" hint="Transrectal complication, or less than 6 weeks before surgery" wide />
          </div>
        </Group>

        <Group title="Systemic inflammatory markers" defaultOpen={false} count={(S.crp !== null ? 1 : 0) + (S.nlr !== null ? 1 : 0)}>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                hs-CRP <span className="font-normal text-muted-foreground">(mg/L)</span>
              </label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={S.crp ?? ""}
                onChange={(e) => {
                  const n = parseFloat(e.target.value);
                  updateClinicalForm({ crp: isNaN(n) ? null : n });
                }}
                className="h-8 w-20 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">NLR</label>
              <Input
                type="number"
                min={0}
                max={20}
                step={0.1}
                value={S.nlr ?? ""}
                onChange={(e) => {
                  const n = parseFloat(e.target.value);
                  updateClinicalForm({ nlr: isNaN(n) ? null : n });
                }}
                className="h-8 w-20 text-sm"
              />
            </div>
          </div>
        </Group>

      </CardContent>
    </Card>
  );
}

/** One MRI plane-phenotype item, entered independently for the left and right side. */
function SidePhenotypeRow({
  label,
  leftKey,
  rightKey,
  S,
  onChange,
  options,
}: {
  label: string;
  leftKey: keyof ClinicalState;
  rightKey: keyof ClinicalState;
  S: ClinicalState;
  onChange: (patch: Partial<ClinicalState>) => void;
  options: { label: string; value: number }[];
}) {
  return (
    <div className="space-y-1 pt-1">
      <span className="text-xs font-semibold text-foreground">{label}</span>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Left</span>
          <Seg<number>
            value={Number(S[leftKey]) || 0}
            onChange={(v) => onChange({ [leftKey]: v } as Partial<ClinicalState>)}
            options={options}
          />
        </div>
        <div className="space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Right</span>
          <Seg<number>
            value={Number(S[rightKey]) || 0}
            onChange={(v) => onChange({ [rightKey]: v } as Partial<ClinicalState>)}
            options={options}
          />
        </div>
      </div>
    </div>
  );
}
