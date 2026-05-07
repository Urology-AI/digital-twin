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
    <div className="space-y-2">
      <div className="text-sm font-semibold text-foreground">{label}</div>
      <div className="flex overflow-hidden rounded-lg border border-border divide-x divide-border">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex-1 px-2 py-2.5 text-sm font-medium transition-colors",
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

export function ModifiableFactorsPanel() {
  const patients = usePatientStore((s) => s.patients);
  const activeId = usePatientStore((s) => s.activeId);
  const updateClinicalForm = usePatientStore((s) => s.updateClinicalForm);
  const pushHistory = usePatientStore((s) => s.pushHistory);

  const entry = patients.find((p) => p.id === activeId);

  const [bmi, setBmi] = useState("");
  const [pfmt, setPfmt] = useState<PfmtLevel>("basic");
  const [exercise, setExercise] = useState<ExerciseLevel>("moderate");
  const [smoking, setSmoking] = useState<SmokingStatus>("never");
  const [pde5, setPde5] = useState<Pde5Regimen>("prn");
  const [alcohol, setAlcohol] = useState<AlcoholLevel>("moderate");
  const [dm, setDm] = useState(false);
  const [htn, setHtn] = useState(false);
  const [cad, setCad] = useState(false);

  useEffect(() => {
    if (!entry) return;
    const rec = entry.record;
    setBmi(rec.patient.bmi != null && rec.patient.bmi > 0 ? String(rec.patient.bmi) : "");
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
  }, [entry?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBmi = (v: string) => {
    setBmi(v);
    const n = parseFloat(v);
    updateClinicalForm({ bmi: n > 0 && !isNaN(n) ? n : undefined });
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
      <CardHeader className="border-b border-border/50 bg-gradient-to-br from-muted/40 to-transparent pb-4 dark:from-muted/25">
        <CardTitle className="text-xl font-semibold text-foreground">
          Modifiable Factors
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Lifestyle and medical inputs that drive functional-outcome predictions
        </p>
      </CardHeader>
      <CardContent className="space-y-6 pt-5">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Body & Lifestyle</h3>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground" htmlFor="mf-bmi">
            BMI <span className="font-normal text-muted-foreground">(kg/m²)</span>
          </label>
          <div className="flex items-center gap-3">
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
              className="h-11 w-36 text-base"
            />
            {bmiCat && (
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-semibold",
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

        <div className="border-t border-border/60 pt-5">
          <h3 className="mb-5 text-sm font-bold uppercase tracking-wider text-muted-foreground">Medical Factors</h3>

          <div className="space-y-6">
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

            <div className="space-y-2.5">
              <div className="text-sm font-semibold text-foreground">Comorbidities</div>
              <div className="flex gap-3">
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
                      "flex-1 rounded-lg border-2 px-3 py-3 text-sm font-bold transition-all",
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
        </div>

        <div className="space-y-2 pt-2">
          <Button type="button" size="lg" onClick={() => pushHistory()} className="w-full">
            Save Checkpoint
          </Button>
          <p className="text-xs text-muted-foreground/70">
            Inputs update predictions live. Save Checkpoint records an undo point.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
