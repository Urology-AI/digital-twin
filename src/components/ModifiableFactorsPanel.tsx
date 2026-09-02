import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePatientStore } from "@/store/patientStore";
import type {
  AlcoholLevel,
  ExerciseLevel,
  Pde5Regimen,
  PfmtLevel,
  SmokingStatus,
} from "@/lib/compass/functionalOutcomes";
import { computeBiologicalAge } from "@/lib/compass/biologicalAge";
import { ageAdjustment } from "@/lib/compass/functionalOutcomes";
import { BIOLOGICAL_AGE } from "@/lib/compass/planningEvidence";
import { cn } from "@/lib/utils";

function SegPicker<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-semibold text-foreground">{label}</div>
      <div className="flex overflow-hidden rounded-md border border-border divide-x divide-border">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex-1 px-2 py-1.5 text-xs font-medium transition-colors",
              value === opt.value
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted/60",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Modifiable-factor burden re-expressed in years. Display only — every
 * prediction model still runs on chronological age (see BIOLOGICAL_AGE).
 */
function BiologicalAgeReadout({
  ageText,
  onAge,
  ...factors
}: Parameters<typeof computeBiologicalAge>[0] & {
  ageText: string;
  onAge: (v: string) => void;
}) {
  const ageInput = (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-foreground" htmlFor="mf-age">
        Age <span className="font-normal text-muted-foreground">(years)</span>
      </label>
      <Input
        id="mf-age"
        type="number"
        min={30}
        max={95}
        inputMode="numeric"
        placeholder="62"
        value={ageText}
        onChange={(e) => onAge(e.target.value)}
        className="h-8 w-20 text-sm"
      />
      <p className="text-[10px] leading-snug text-muted-foreground">
        Not modifiable, but it sets the baseline every other factor moves from —
        the models read this number.
      </p>
    </div>
  );

  if (!(factors.age > 0)) {
    return (
      <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5">
        {ageInput}
        <p className="mt-2 text-[11px] text-muted-foreground">
          Enter an age to see biological age.
        </p>
      </div>
    );
  }

  const bio = computeBiologicalAge(factors);
  const chronoFactor = ageAdjustment(bio.chronological);
  const bioFactor = ageAdjustment(bio.biological);
  const older = bio.offset > 0;
  const younger = bio.offset < 0;

  return (
    <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        {ageInput}
        <div className="text-right">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Biological age
          </div>
          <div className="flex items-baseline justify-end gap-2">
            <span
              className={cn(
                "text-2xl font-bold tabular-nums",
                older ? "text-amber-400" : younger ? "text-emerald-400" : "text-foreground",
              )}
            >
              {bio.biological}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                older
                  ? "bg-amber-500/10 text-amber-400"
                  : younger
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {older ? "+" : ""}
              {bio.offset} yr
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground">
            vs. {bio.chronological} chronological
          </div>
        </div>
      </div>

      {bio.potentialGain > 0 && (
        <div className="mt-2 text-[11px] text-muted-foreground">
          Optimising the levers below reaches{" "}
          <span className="font-semibold text-emerald-400">{bio.bestAchievable}</span> — a{" "}
          <span className="font-semibold text-emerald-400">{bio.potentialGain}-year</span> gain.
        </div>
      )}

      {bio.contributions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {bio.contributions.map((c) => (
            <span
              key={c.label}
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-medium",
                c.years > 0 ? "bg-amber-500/10 text-amber-400" : "bg-emerald-500/10 text-emerald-400",
              )}
            >
              {c.label} {c.years > 0 ? "+" : ""}
              {c.years}
            </span>
          ))}
        </div>
      )}

      <div className="mt-2 rounded border border-border/60 bg-background/40 px-2 py-1.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Effect in the model
        </div>
        <p className="mt-0.5 text-[11px] leading-snug text-foreground">
          The potency curve&rsquo;s age factor is{" "}
          <span className="font-semibold tabular-nums">{chronoFactor.toFixed(2)}</span> at{" "}
          {bio.chronological}; at a biological age of {bio.biological} the same factor
          would be{" "}
          <span
            className={cn(
              "font-semibold tabular-nums",
              bioFactor < chronoFactor ? "text-amber-400" : "text-emerald-400",
            )}
          >
            {bioFactor.toFixed(2)}
          </span>
          .
        </p>
        <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
          Shown for counselling, not applied: the nomogram already charges BMI,
          smoking, exercise, alcohol and comorbidity as direct recovery deltas, so
          adding them again through age would double-count them.
        </p>
      </div>
      <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
        {BIOLOGICAL_AGE.label} — provisional, counselling aid only.
      </p>
    </div>
  );
}

export function ModifiableFactorsPanel() {
  const patients = usePatientStore((s) => s.patients);
  const activeId = usePatientStore((s) => s.activeId);
  const updateClinicalForm = usePatientStore((s) => s.updateClinicalForm);
  const pushHistory = usePatientStore((s) => s.pushHistory);

  const entry = patients.find((p) => p.id === activeId);

  const [age, setAge] = useState("");
  const [bmi, setBmi] = useState("");
  const [shim, setShim] = useState("");
  const [ipss, setIpss] = useState("");
  const [pfmt, setPfmt] = useState<PfmtLevel>("basic");
  const [exercise, setExercise] = useState<ExerciseLevel>("moderate");
  const [smoking, setSmoking] = useState<SmokingStatus>("never");
  const [pde5, setPde5] = useState<Pde5Regimen>("prn");
  const [alcohol, setAlcohol] = useState<AlcoholLevel>("moderate");
  const [dm, setDm] = useState(false);
  const [htn, setHtn] = useState(false);
  const [cad, setCad] = useState(false);

  // Sync local state from the record whenever the active patient changes or
  // any mirrored field changes externally (e.g. report import, reset, or the
  // height+weight helper in the Input wizard).
  useEffect(() => {
    if (!entry) return;
    const rec = entry.record;
    setAge(rec.patient.age != null && rec.patient.age > 0 ? String(rec.patient.age) : "");
    setBmi(rec.patient.bmi != null && rec.patient.bmi > 0 ? String(rec.patient.bmi) : "");
    setShim(rec.patient.shim != null ? String(rec.patient.shim) : "");
    setIpss(rec.patient.ipss != null ? String(rec.patient.ipss) : "");
    setSmoking((rec.patient.smoking as SmokingStatus | undefined) ?? "never");
    setExercise((rec.patient.exercise as ExerciseLevel | undefined) ?? "moderate");
    setPfmt((rec.patient.pfmt as PfmtLevel | undefined) ?? "basic");
    setAlcohol((rec.patient.alcohol as AlcoholLevel | undefined) ?? "moderate");
    if (rec.patient.pde5_plan) setPde5(rec.patient.pde5_plan as Pde5Regimen);
    else if (rec.patient.pde5 === true) setPde5("daily");
    else setPde5("prn");
    setDm(rec.patient.dm ?? false);
    setHtn(rec.patient.htn ?? false);
    setCad(rec.patient.cad ?? false);
  }, [
    entry?.id,
    entry?.record.patient.age,
    entry?.record.patient.bmi,
    entry?.record.patient.shim,
    entry?.record.patient.ipss,
    entry?.record.patient.smoking,
    entry?.record.patient.exercise,
    entry?.record.patient.pfmt,
    entry?.record.patient.alcohol,
    entry?.record.patient.pde5_plan,
    entry?.record.patient.pde5,
    entry?.record.patient.dm,
    entry?.record.patient.htn,
    entry?.record.patient.cad,
  ]);

  const handleAge = (v: string) => {
    setAge(v);
    const n = parseInt(v);
    updateClinicalForm({ age: n > 0 && !isNaN(n) ? n : undefined });
  };
  const handleBmi = (v: string) => {
    setBmi(v);
    const n = parseFloat(v);
    updateClinicalForm({ bmi: n > 0 && !isNaN(n) ? n : undefined });
  };
  const handleShim = (v: string) => {
    setShim(v);
    const n = parseInt(v);
    updateClinicalForm({ shim: !isNaN(n) ? n : undefined });
  };
  const handleIpss = (v: string) => {
    setIpss(v);
    const n = parseInt(v);
    updateClinicalForm({ ipss: !isNaN(n) ? n : undefined });
  };
  const handlePfmt = (v: PfmtLevel) => { setPfmt(v); updateClinicalForm({ pfmt: v }); };
  const handleExercise = (v: ExerciseLevel) => { setExercise(v); updateClinicalForm({ exercise: v }); };
  const handleSmoking = (v: SmokingStatus) => { setSmoking(v); updateClinicalForm({ smoking: v }); };
  const handlePde5 = (v: Pde5Regimen) => { setPde5(v); updateClinicalForm({ pde5: v }); };
  const handleAlcohol = (v: AlcoholLevel) => { setAlcohol(v); updateClinicalForm({ alcohol: v }); };
  const handleDm = (v: boolean) => { setDm(v); updateClinicalForm({ dm: v }); };
  const handleHtn = (v: boolean) => { setHtn(v); updateClinicalForm({ htn: v }); };
  const handleCad = (v: boolean) => { setCad(v); updateClinicalForm({ cad: v }); };

  if (!entry) return null;

  const bmiNum = parseFloat(bmi);
  const bmiCat =
    isNaN(bmiNum) || bmiNum <= 0
      ? null
      : bmiNum < 18.5
        ? "Underweight"
        : bmiNum < 25
          ? "Normal"
          : bmiNum < 30
            ? "Overweight"
            : "Obese";

  return (
    <Card className="border-border/70">
      <CardHeader className="border-b border-border/50 bg-gradient-to-br from-muted/40 to-transparent px-4 py-3 dark:from-muted/25">
        <CardTitle className="text-base font-semibold text-foreground">
          Modifiable Factors
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">
          Lifestyle and medical inputs that drive functional-outcome predictions
        </p>
      </CardHeader>
      <CardContent className="space-y-3 px-4 py-3">
        <BiologicalAgeReadout
          ageText={age}
          onAge={handleAge}
          age={parseInt(age) || 0}
          bmi={bmiNum}
          smoking={smoking}
          exercise={exercise}
          alcohol={alcohol}
          dm={dm}
          htn={htn}
          cad={cad}
        />

        <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Body & Lifestyle</h3>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground" htmlFor="mf-bmi">
              BMI <span className="font-normal text-muted-foreground">(kg/m²)</span>
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="mf-bmi"
                type="number"
                step="0.5"
                min={10}
                max={60}
                inputMode="decimal"
                placeholder="27.0"
                value={bmi}
                onChange={(e) => handleBmi(e.target.value)}
                className="h-8 w-20 text-sm"
              />
              {bmiCat && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    bmiNum < 18.5
                      ? "bg-blue-500/10 text-blue-500"
                      : bmiNum < 25
                        ? "bg-emerald-500/10 text-emerald-400"
                        : bmiNum < 30
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-red-500/10 text-red-500",
                  )}
                >
                  {bmiCat}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground" htmlFor="mf-shim">
              SHIM <span className="font-normal text-muted-foreground">(0–25)</span>
            </label>
            <Input
              id="mf-shim"
              type="number"
              min={0}
              max={25}
              inputMode="numeric"
              placeholder="21"
              value={shim}
              onChange={(e) => handleShim(e.target.value)}
              className="h-8 w-20 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground" htmlFor="mf-ipss">
              IPSS <span className="font-normal text-muted-foreground">(0–35)</span>
            </label>
            <Input
              id="mf-ipss"
              type="number"
              min={0}
              max={35}
              inputMode="numeric"
              placeholder="8"
              value={ipss}
              onChange={(e) => handleIpss(e.target.value)}
              className="h-8 w-20 text-sm"
            />
          </div>
        </div>

        <SegPicker<PfmtLevel>
          label="Pelvic Floor Training (PFMT)"
          options={[
            { label: "None", value: "none" },
            { label: "Basic", value: "basic" },
            { label: "Moderate", value: "moderate" },
            { label: "Intensive", value: "intensive" },
          ]}
          value={pfmt}
          onChange={handlePfmt}
        />
        <SegPicker<ExerciseLevel>
          label="Exercise Level"
          options={[
            { label: "Sedentary", value: "sedentary" },
            { label: "Light", value: "light" },
            { label: "Moderate", value: "moderate" },
            { label: "Active", value: "active" },
          ]}
          value={exercise}
          onChange={handleExercise}
        />
        <SegPicker<SmokingStatus>
          label="Smoking Status"
          options={[
            { label: "Never", value: "never" },
            { label: "Former", value: "former" },
            { label: "Current", value: "current" },
          ]}
          value={smoking}
          onChange={handleSmoking}
        />

        <div className="space-y-3 border-t border-border/60 pt-3">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Medical Factors</h3>

          <SegPicker<Pde5Regimen>
            label="PDE5 Inhibitor Plan"
            options={[
              { label: "None", value: "none" },
              { label: "PRN", value: "prn" },
              { label: "Daily", value: "daily" },
            ]}
            value={pde5}
            onChange={handlePde5}
          />
          <SegPicker<AlcoholLevel>
            label="Alcohol Usage"
            options={[
              { label: "None", value: "none" },
              { label: "Moderate", value: "moderate" },
              { label: "Heavy", value: "heavy" },
            ]}
            value={alcohol}
            onChange={handleAlcohol}
          />

          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-foreground">Comorbidities</div>
            <div className="flex gap-2">
              {(
                [
                  ["Diabetes", dm, handleDm],
                  ["HTN", htn, handleHtn],
                  ["CAD", cad, handleCad],
                ] as [string, boolean, (v: boolean) => void][]
              ).map(([label, val, setter]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setter(!val)}
                  className={cn(
                    "flex-1 rounded-md border px-2 py-1.5 text-xs font-bold transition-all",
                    val
                      ? "border-red-500 bg-red-500/10 text-red-400"
                      : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:bg-muted/60",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-border/60 pt-3">
          <Button type="button" size="sm" onClick={() => pushHistory()} className="w-full">
            Save Checkpoint
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
