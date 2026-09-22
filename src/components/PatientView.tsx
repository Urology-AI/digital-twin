import { useEffect, useRef, useState, type ComponentProps } from "react";
import { ArrowRight, ClipboardList, Languages, FileText, Maximize2, Loader2, RotateCcw, SlidersHorizontal, Sparkles, Stethoscope, TrendingUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePatientStore } from "@/store/patientStore";
import { useUiStore, type PatientTab } from "@/store/uiStore";
import { parseClinicalText, type ParsedClinicalFields } from "@/lib/api";
import { ModifiableFactorsPanel } from "@/components/ModifiableFactorsPanel";
import { CaseReviewBanner, PreopCounselingPanel } from "@/components/PreopCounselingPanel";
import { deriveClinicalFromLesions, lesionsFromRows } from "@/lib/utils/normalization";
import { clinicalStateFromRecord } from "@/lib/compass/clinicalFromRecord";
import { likelyOutcomes, recoveryOpportunities } from "@/lib/compass/preopCounseling";
import { usePatientT } from "@/hooks/usePatientT";

/**
 * Simplified patient-facing screen — own layout, no clinical tabs, no
 * research tooling or coefficients, and one plain-language risk figure
 * (recurrence) rather than the six numeric predictions. Reads and writes the
 * same `patientStore` as the clinical views so it always stays in sync with
 * the active case; it just shows/edits far less of it.
 *
 * Patient mode has four tabs (uiStore.patientTab): My case, My surgery,
 * What I can change, Getting ready. The 3D model is the same always-mounted
 * `ThreeCanvas` singleton: App.tsx places it beside the "My surgery" tab, or
 * as a full-screen overlay when `patientView3DOpen` is on.
 */

const PATIENT_TABS: { id: PatientTab; label: string; short: string; Icon: typeof FileText }[] = [
  { id: "case", label: "My case", short: "Case", Icon: FileText },
  { id: "surgery", label: "My surgery", short: "Surgery", Icon: Stethoscope },
  { id: "factors", label: "What I can change", short: "Habits", Icon: SlidersHorizontal },
  { id: "prep", label: "Getting ready", short: "Prep", Icon: ClipboardList },
];

export function PatientViewHeader() {
  const setPatientView = useUiStore((s) => s.setPatientView);
  const patientViewLocked = useUiStore((s) => s.patientViewLocked);
  const patientTab = useUiStore((s) => s.patientTab);
  const setPatientTab = useUiStore((s) => s.setPatientTab);
  const setPatientLang = useUiStore((s) => s.setPatientLang);
  const { t, lang } = usePatientT();
  return (
    <div lang={lang} className="patient-contrast shrink-0 border-b border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
        <div className="flex min-w-0 items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}logo_light.png`} alt="Mount Sinai" className="block h-8 w-auto dark:hidden" />
          <img src={`${import.meta.env.BASE_URL}logo_dark.png`} alt="Mount Sinai" className="hidden h-8 w-auto dark:block" />
          <div className="min-w-0">
          <div className="truncate text-lg font-bold text-foreground">{t("Your prostate surgery guide")}</div>
          <div className="hidden text-xs text-muted-foreground sm:block">{t("Your case, explained. Talk to your care team about any of this.")}</div>
          {lang === "es" && <div className="text-[11px] text-amber-800 dark:text-amber-300">{t("Translation pending review by a medical translator.")}</div>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setPatientLang(lang === "en" ? "es" : "en")}
            aria-label={lang === "en" ? "Ver en español" : "View in English"}>
            <Languages aria-hidden className="h-4 w-4" /> <span lang={lang === "en" ? "es" : "en"}>{lang === "en" ? "Español" : "English"}</span>
          </Button>
          {/* Patients arriving via a patient link stay in patient mode — only a
              clinician who switched in from their own session can switch back. */}
          {!patientViewLocked && (
            <Button variant="outline" size="sm" onClick={() => setPatientView(false)} className="gap-1.5">
              <X className="h-4 w-4" /> Back to clinical mode
            </Button>
          )}
        </div>
      </div>
      <nav aria-label={t("Sections")} className="mt-2 flex overflow-x-auto px-1 sm:gap-1 sm:px-3">
        {PATIENT_TABS.map(({ id, label, short, Icon }) => {
          const on = patientTab === id;
          return (
            <button key={id} type="button" onClick={() => setPatientTab(id)} aria-current={on ? "page" : undefined}
              className={`flex min-w-0 flex-1 items-center justify-center gap-1 border-b-2 px-1 py-2.5 sm:flex-none sm:shrink-0 sm:justify-start sm:gap-2 sm:px-3.5 text-[15px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${on ? "border-sky-600 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <Icon aria-hidden className="h-4 w-4" />
              <span className="whitespace-nowrap sm:hidden">{t(short)}</span>
              <span className="hidden sm:inline">{t(label)}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function ReportImport() {
  const updateClinicalForm = usePatientStore((s) => s.updateClinicalForm);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedClinicalFields | null>(null);
  const [applied, setApplied] = useState(false);

  async function handleExtract() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    setParsed(null);
    setApplied(false);
    try {
      const fields = await parseClinicalText(text);
      if (Object.keys(fields).length === 0) setError("No clinical values found in that text.");
      else setParsed(fields);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function handleApply() {
    if (!parsed) return;
    updateClinicalForm(parsed as Parameters<typeof updateClinicalForm>[0]);
    setApplied(true);
    setParsed(null);
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">Have a report or after-visit summary?</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste the text below and we'll pull out the values automatically. Review before applying.
        </p>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste your biopsy report, MRI report, or clinic note here…"
        className="h-32 w-full resize-y rounded-lg border border-input bg-background p-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40"
      />
      <Button onClick={handleExtract} disabled={busy || !text.trim()} className="gap-1.5">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        Extract details
      </Button>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {parsed && (
        <div className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2.5 text-sm">
          <div className="mb-1.5 font-semibold text-sky-400">We found these values</div>
          <div className="mb-2 flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
            {Object.entries(parsed).map(([k, v]) => (
              <span key={k}>
                <span className="text-foreground">{k}</span>: {String(v)}
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleApply}>Looks right — use these</Button>
            <Button size="sm" variant="ghost" onClick={() => setParsed(null)}>Discard</Button>
          </div>
        </div>
      )}

      {applied && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-500">
          Applied — your details below have been updated.
        </div>
      )}
    </div>
  );
}

function BasicsField({ label, hint, value, locked, onChange, ...inputProps }: {
  label: string;
  hint?: string;
  value: string;
  locked: boolean;
  onChange: (v: string) => void;
} & Omit<ComponentProps<typeof Input>, "value" | "onChange">) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">
        {label} {hint && <span className="text-muted-foreground">{hint}</span>}
      </label>
      {locked ? (
        <div className="flex h-9 items-center rounded-md border border-border bg-muted/40 px-3 text-sm text-foreground">
          {value || "—"}
        </div>
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} {...inputProps} />
      )}
    </div>
  );
}

function Basics() {
  const patients = usePatientStore((s) => s.patients);
  const activeId = usePatientStore((s) => s.activeId);
  const updateClinicalForm = usePatientStore((s) => s.updateClinicalForm);
  const patientViewLocked = useUiStore((s) => s.patientViewLocked);
  const entry = patients.find((p) => p.id === activeId);

  const [age, setAge] = useState("");
  const [psa, setPsa] = useState("");
  const [vol, setVol] = useState("");

  useEffect(() => {
    if (!entry) return;
    const rec = entry.record;
    setAge(rec.patient.age != null && rec.patient.age > 0 ? String(rec.patient.age) : "");
    setPsa(rec.patient.psa != null && rec.patient.psa > 0 ? String(rec.patient.psa) : "");
    setVol(rec.prostate.volume_cc != null && rec.prostate.volume_cc > 0 ? String(rec.prostate.volume_cc) : "");
  }, [entry?.id, entry?.record.patient.age, entry?.record.patient.psa, entry?.record.prostate.volume_cc]);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 text-base font-semibold text-foreground">Your basics</h3>
      <div className="grid grid-cols-3 gap-3">
        <BasicsField
          label="Age" locked={patientViewLocked} value={age}
          type="number" min={18} max={120} inputMode="numeric" placeholder="65"
          onChange={(v) => { setAge(v); updateClinicalForm({ age: parseInt(v) || undefined }); }}
        />
        <BasicsField
          label="PSA" hint="(ng/mL)" locked={patientViewLocked} value={psa}
          type="number" step="0.1" inputMode="decimal" placeholder="6.5"
          onChange={(v) => { setPsa(v); updateClinicalForm({ psa: parseFloat(v) || 0 }); }}
        />
        <BasicsField
          label="Prostate volume" hint="(cc)" locked={patientViewLocked} value={vol}
          type="number" step="0.1" inputMode="decimal" placeholder="45"
          onChange={(v) => { setVol(v); updateClinicalForm({ vol: parseFloat(v) || 45 }); }}
        />
      </div>
    </div>
  );
}

/**
 * Warns when the active case has drifted from the pristine snapshot the
 * patient link originally carried (e.g. from exploring Modifiable Factors),
 * and offers a one-click reset. Only shown for locked (patient-link)
 * sessions — a clinician previewing their own case doesn't need this, it's
 * already their live data either way.
 */
function useResetToOriginal() {
  const patients = usePatientStore((s) => s.patients);
  const activeId = usePatientStore((s) => s.activeId);
  const restorePatientRecord = usePatientStore((s) => s.restorePatientRecord);
  const entry = patients.find((p) => p.id === activeId);

  const snapshotRef = useRef<{ id: string; record: string; lesionRows: string } | null>(null);
  if (entry && snapshotRef.current?.id !== entry.id) {
    snapshotRef.current = {
      id: entry.id,
      record: JSON.stringify(entry.record),
      lesionRows: JSON.stringify(entry.lesionRows),
    };
  }

  const isDirty =
    !!entry &&
    !!snapshotRef.current &&
    (JSON.stringify(entry.record) !== snapshotRef.current.record ||
      JSON.stringify(entry.lesionRows) !== snapshotRef.current.lesionRows);

  const reset = () => {
    if (!snapshotRef.current) return;
    restorePatientRecord(
      snapshotRef.current.id,
      JSON.parse(snapshotRef.current.record),
      JSON.parse(snapshotRef.current.lesionRows),
    );
  };

  return { isDirty, reset };
}

function ResetBanner({ isDirty, onReset }: { isDirty: boolean; onReset: () => void }) {
  const { t } = usePatientT();
  if (!isDirty) return null;
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-800 dark:text-amber-300">
      <span>{t("You've changed some values below — this won't be saved to your care team's original case.")}</span>
      <Button size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={onReset}>
        <RotateCcw className="h-3.5 w-3.5" /> {t("Reset to original")}
      </Button>
    </div>
  );
}


/**
 * Chance the cancer comes back after surgery (biochemical recurrence — PSA
 * rising again). The one numeric risk this screen shows: patients ask it first,
 * and leaving it out sent them looking for the number elsewhere. Framed in
 * plain words, with the flip side stated, and no other prediction alongside it.
 */
function RecurrenceOutlook() {
  const predictions = usePatientStore((s) => s.predictions);
  const { t } = usePatientT();
  if (!predictions) return null;
  const risk = Math.round(predictions.bcr * 100);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-1 text-base font-semibold text-foreground">
        {t("Chance of the cancer coming back")}
      </h3>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums text-foreground">{risk}%</span>
        <span className="text-sm text-muted-foreground">
          {t("— so about {n} in 100 men like you would not see it return", { n: 100 - risk })}
        </span>
      </div>
      <p className="mt-2 text-xs leading-snug text-muted-foreground">
        {t("This is the estimated chance that PSA rises again in the years after surgery, based on your PSA, biopsy grade and scans before the operation. It is an estimate for a group of men with a similar picture, not a prediction about you, and it does not account for any treatment given after surgery. Your surgeon is the person to talk this through with.")}
      </p>
    </div>
  );
}

const GG_WORDS: Record<number, string> = {
  1: "Grade Group 1 (Gleason 3+3): slow-growing cancer.",
  2: "Grade Group 2 (Gleason 3+4): mostly slow-growing, with a small amount of faster-growing cells.",
  3: "Grade Group 3 (Gleason 4+3): a moderate amount of faster-growing cells.",
  4: "Grade Group 4 (Gleason 8): faster-growing cancer.",
  5: "Grade Group 5 (Gleason 9–10): the fastest-growing type.",
};
const PIRADS_WORDS: Record<number, string> = {
  1: "very unlikely to be significant cancer", 2: "unlikely to be significant cancer", 3: "uncertain",
  4: "likely to be significant cancer", 5: "very likely to be significant cancer",
};

function useActiveClinical() {
  const patients = usePatientStore((s) => s.patients);
  const activeId = usePatientStore((s) => s.activeId);
  const entry = patients.find((p) => p.id === activeId);
  if (!entry) return null;
  const S = deriveClinicalFromLesions(clinicalStateFromRecord({ ...entry.record, lesions: entry.lesionRows }), lesionsFromRows(entry.lesionRows));
  // PI-RADS falls back to a default when no MRI lesion is recorded — only describe the MRI when one is.
  return { S, hasMri: entry.lesionRows.length > 0 };
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  const { t } = usePatientT();
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 text-base font-semibold text-foreground">{t(title)}</h3>
      {children}
    </section>
  );
}

function DiagnosisSummary() {
  const { t } = usePatientT();
  const active = useActiveClinical();
  if (!active) return null;
  const { S, hasMri } = active;
  const none = t("Not recorded yet.");
  const side = t(S.laterality === "bilateral" ? "both sides" : S.laterality === "left" ? "the left side" : "the right side");
  const rows: [string, string][] = [
    ["Type of cancer", GG_WORDS[S.gg] ? t(GG_WORDS[S.gg]!) : none],
    ["Biopsy", S.cores > 0 ? t(S.cores === 1 ? "1 biopsy sample showed cancer, on {side} of the prostate." : "{n} biopsy samples showed cancer, on {side} of the prostate.", { n: S.cores, side }) : none],
    ["PSA", S.psa > 0 ? t("{n} ng/mL. PSA is a blood marker; after surgery the goal is for it to become undetectable.", { n: S.psa }) : none],
    ["MRI", hasMri && S.pirads > 0
      ? [t("The most suspicious area scored PI-RADS {n} out of 5 ({meaning}).", { n: S.pirads, meaning: t(PIRADS_WORDS[S.pirads] ?? "") }),
         t(S.mri_epe ? "The MRI suggests the cancer may reach the edge of the prostate." : "The MRI does not show cancer outside the prostate."),
         ...(S.mri_svi ? [t("It may involve the seminal vesicles.")] : [])].join(" ")
      : none],
    ["Prostate size", S.vol > 0 ? t("About {n} cc.", { n: S.vol }) : none],
  ];
  return (
    <Card title="Your diagnosis in plain words">
      <dl className="divide-y divide-border">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[9rem_1fr] sm:gap-4">
            <dt className="text-sm font-semibold text-muted-foreground">{t(k)}</dt>
            <dd className="text-[15px] leading-relaxed text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

const NEXT_STEPS: { tab: PatientTab; title: string; text: string }[] = [
  { tab: "surgery", title: "Understand your operation", text: "See your 3D prostate and what your surgeon plans to do." },
  { tab: "factors", title: "Boost your recovery", text: "See which changes could help your bladder control and erections." },
  { tab: "prep", title: "Get ready for surgery", text: "Your checklist, recovery dates and when to call us." },
];

function NextSteps() {
  const setPatientTab = useUiStore((s) => s.setPatientTab);
  const { t } = usePatientT();
  return (
    <Card title="What to look at next">
      <div className="grid gap-2.5 sm:grid-cols-3">
        {NEXT_STEPS.map((n, i) => (
          <button key={n.tab} type="button" onClick={() => setPatientTab(n.tab)}
            className="group flex flex-col rounded-xl border border-border bg-background/60 p-3.5 text-left transition-colors hover:border-sky-500/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/15 text-sm font-bold text-sky-700 dark:text-sky-300">{i + 1}</span>
            <span className="mt-2 font-semibold text-foreground">{t(n.title)}</span>
            <span className="mt-0.5 flex-1 text-sm text-muted-foreground">{t(n.text)}</span>
            <span className="mt-2 flex items-center gap-1 text-sm font-medium text-sky-700 group-hover:underline dark:text-sky-300">{t("Open")} <ArrowRight aria-hidden className="h-3.5 w-3.5" /></span>
          </button>
        ))}
      </div>
    </Card>
  );
}

/** Patient-facing recovery outlook: plain numbers + what could still improve them. */
function PatientRecovery() {
  const predictions = usePatientStore((s) => s.predictions);
  const { t } = usePatientT();
  const active = useActiveClinical();
  if (!active) return null;
  const o = likelyOutcomes(active.S, predictions);
  const opps = recoveryOpportunities(active.S);
  if (!o) return null;
  const at12 = (v: number[]) => v[3]!;
  return (
    <div className="space-y-4">
      <Card title="Your recovery at 12 months">
        <p className="mb-3 text-sm text-muted-foreground">{t("Out of 100 men with a health picture like yours. These update as you change things on the left.")}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-sky-500/10 p-4 text-center">
            <div className="text-4xl font-bold tabular-nums text-sky-700 dark:text-sky-300">{at12(o.continence)}</div>
            <div className="mt-1 text-sm text-foreground">{t("have good bladder control")}</div>
          </div>
          <div className="rounded-xl bg-violet-500/10 p-4 text-center">
            {o.potency ? (
              <>
                <div className="text-4xl font-bold tabular-nums text-violet-700 dark:text-violet-300">{at12(o.potency)}</div>
                <div className="mt-1 text-sm text-foreground">{t("have erections firm enough for sex")}</div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">{t("Erection recovery isn't estimated because erections were already weak before surgery.")}</div>
            )}
          </div>
        </div>
      </Card>
      <Card title="What could help most">
        {opps.length ? (
          <ul className="space-y-2">
            {opps.map((op) => (
              <li key={op.label} className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
                <TrendingUp aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <div className="text-[15px] font-medium text-foreground">{t(op.text)}</div>
                  <div className="text-sm text-muted-foreground">
                    {[op.bladder > 0 && t("bladder control +{n}", { n: op.bladder }), op.erections > 0 && t("erections +{n}", { n: op.erections })].filter(Boolean).join(" · ")}
                    {" "}{t("(out of 100 men)")}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[15px] text-foreground">{t("You're already doing everything we track that can help. Keep it up!")}</p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">{t("Estimates for groups of men, not a promise for you. Talk to your care team before changing medicines.")}</p>
      </Card>
    </div>
  );
}

const NS_WORDS: Record<number, string> = {
  1: "Your surgeon plans to save as much of the nerve tissue on this side as possible.",
  2: "Your surgeon plans to save part of the nerve tissue on this side, leaving a little more margin around the cancer.",
  3: "Your surgeon plans to take more tissue on this side to remove the cancer safely, so less nerve tissue can be saved.",
};

function SurgeryExplainer() {
  const predictions = usePatientStore((s) => s.predictions);
  const setPatientView3DOpen = useUiStore((s) => s.setPatientView3DOpen);
  const { t } = usePatientT();
  if (!predictions) return null;
  const { plan } = predictions;
  const grade = (g: number) => Math.min(3, Math.max(1, Math.round(g)));
  const lymph = predictions.lni >= 0.05;
  return (
    <div className="space-y-4">
      <Card title="Your 3D prostate">
        <p className="text-[15px] text-foreground">
          {t("This model is built from your own scan measurements. Colors show where cancer is more likely: green is lower, red is higher. Drag it to turn it around.")}
        </p>
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <span aria-hidden className="h-2.5 w-10 rounded-full" style={{ background: "linear-gradient(to right,#22c55e,#eab308,#ef4444)" }} />
          {t("Lower risk → Higher risk")}
        </div>
        <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => setPatientView3DOpen(true)}>
          <Maximize2 className="h-4 w-4" /> {t("Full screen")}
        </Button>
      </Card>
      <Card title="What the operation involves">
        <p className="text-[15px] text-foreground">
          {t("A robotic prostatectomy removes the whole prostate and the seminal vesicles through 5–6 small cuts in the belly. The bladder is then reconnected to the urethra, and a catheter lets it heal.")}
        </p>
      </Card>
      <Card title="Saving the nerves for erections">
        <p className="mb-3 text-sm text-muted-foreground">
          {t("Nerves that control erections run right beside the prostate. How much of them can be saved depends on where the cancer is.")}
        </p>
        {(["left", "right"] as const).map((side) => (
          <div key={side} className="mb-2 rounded-lg bg-muted/50 p-3">
            <div className="text-sm font-semibold text-foreground">{t(side === "left" ? "Left side" : "Right side")}</div>
            <div className="text-[15px] text-foreground">{t(NS_WORDS[grade(plan[side].nsGrade)]!)}</div>
          </div>
        ))}
        <p className="mt-2 text-xs text-muted-foreground">{t("The final decision is made during surgery, based on what your surgeon sees.")}</p>
      </Card>
      <Card title="Lymph nodes">
        <p className="text-[15px] text-foreground">
          {t(lymph
            ? "Your surgeon will likely also remove lymph nodes near the prostate to check whether the cancer has spread. This adds a little time and a small risk of fluid collecting in the pelvis."
            : "Your estimated chance of cancer in the lymph nodes is low, so your surgeon may not need to remove them. Ask about this at your visit.")}
        </p>
      </Card>
      {plan.bladderNeckPreservation.value && (
        <Card title="Bladder control">
          <p className="text-[15px] text-foreground">
            {t("Your surgeon plans to preserve the bladder neck (the muscle where the bladder meets the urethra), which may help you regain bladder control sooner.")}
          </p>
        </Card>
      )}
    </div>
  );
}

export function PatientView() {
  const heatmapVisible = useUiStore((s) => s.heatmapVisible);
  const toggleHeatmap = useUiStore((s) => s.toggleHeatmap);
  const overlay = useUiStore((s) => s.overlay);
  const setOverlay = useUiStore((s) => s.setOverlay);
  const patientViewLocked = useUiStore((s) => s.patientViewLocked);
  const patientTab = useUiStore((s) => s.patientTab);
  const sharedLinkStatus = usePatientStore((s) => s.sharedLinkStatus);
  const { t } = usePatientT();
  const { isDirty, reset } = useResetToOriginal();

  // Patients get a simplified cancer-risk heatmap on the 3D model (plain
  // Low/Moderate/High colouring, no ECE/SVI/PSM jargon or numeric legend —
  // those clinical overlay controls aren't rendered in patient view at all).
  // Force the overlay on and pinned to "cancer" for the duration of patient
  // view; restore whatever it was set to when leaving.
  useEffect(() => {
    const wasVisible = heatmapVisible;
    const prevOverlay = overlay;
    setOverlay("cancer");
    if (!wasVisible) toggleHeatmap();
    return () => {
      setOverlay(prevOverlay);
      if (!wasVisible) toggleHeatmap();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A patient link must only ever show the case it points to — never the
  // default blank case a failed or slow fetch would otherwise leave on screen.
  if (patientViewLocked && sharedLinkStatus !== "loaded") {
    const missing = sharedLinkStatus === "missing";
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div role={missing ? "alert" : "status"} className="max-w-md rounded-2xl border border-border bg-card p-6 text-center">
          {missing ? (
            <>
              <h2 className="text-lg font-semibold text-foreground">{t("We couldn't open this link")}</h2>
              <p className="mt-2 text-[15px] text-muted-foreground">
                {t("It may have been mistyped or may no longer be active. Please ask your care team to send it again.")}
              </p>
            </>
          ) : (
            <p className="flex items-center justify-center gap-2 text-[15px] text-muted-foreground">
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> {t("Opening your case…")}
            </p>
          )}
        </div>
      </div>
    );
  }

  const scroll = "min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain app-scroll px-4 py-4 lg:px-6 lg:py-6";
  const banner = patientViewLocked && <ResetBanner isDirty={isDirty} onReset={reset} />;

  if (patientTab === "prep") {
    return <div className={`h-full ${scroll}`}>{banner}<PreopCounselingPanel /></div>;
  }

  if (patientTab === "surgery") {
    // The 3D canvas sits in the other half of the screen (placed by App.tsx).
    return <div className={`h-full ${scroll}`}>{banner}<SurgeryExplainer /></div>;
  }

  if (patientTab === "factors") {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden lg:flex-row">
        <div className={`${scroll} border-b border-border lg:border-b-0 lg:border-r`}>
          {banner}
          <ModifiableFactorsPanel />
        </div>
        <div className={scroll}>
          <PatientRecovery />
        </div>
      </div>
    );
  }

  // "My case" — one centered column; clinicians previewing also get the inputs.
  return (
    <div className={`h-full ${scroll}`}>
      <div className="mx-auto max-w-3xl space-y-4">
        {banner}
        <CaseReviewBanner />
        <DiagnosisSummary />
        <RecurrenceOutlook />
        <NextSteps />
        {/* Editing inputs is a clinician-preview affordance — patient links are view-only. */}
        {!patientViewLocked && (
          <details className="rounded-xl border border-dashed border-border p-4">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground">Clinician: edit basics or import a report</summary>
            <div className="mt-4 space-y-4">
              <ReportImport />
              <Basics />
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
