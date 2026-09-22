import { useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, BedDouble, Bike, BookOpen, Brain, Briefcase, CalendarDays, Car, ChevronDown,
  ChevronLeft, ChevronRight, CircleCheck, Circle, Coffee, Dog, Droplets, Dumbbell, Flag, Footprints,
  GlassWater, Hammer, Heart, HeartPulse, House, Info, Loader2, MessageCircleQuestion, Phone, Plus,
  Printer, Salad, ScanSearch, ShowerHead, Soup, Sparkles, Stethoscope, Timer, Trophy,
  Type, UserCheck, UtensilsCrossed, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePatientStore } from "@/store/patientStore";
import { useUiStore } from "@/store/uiStore";
import { deriveClinicalFromLesions, lesionsFromRows } from "@/lib/utils/normalization";
import { clinicalStateFromRecord } from "@/lib/compass/clinicalFromRecord";
import { generatePreopNarrative } from "@/lib/api";
import { isDemoMode } from "@/lib/demoMode";
import {
  OUTCOME_TIMEPOINTS,
  PREOP_REFERENCES,
  QUESTION_BANK,
  RED_FLAGS,
  addDays,
  buildPrintHtml,
  counselingContext,
  counselingFingerprint,
  counselingFlags,
  daysFromSurgery,
  expectedCourse,
  fmtLong,
  fmtShort,
  likelyOutcomes,
  parseSurgeryDate,
  preopChecklist,
  preparationPlan,
  psmaSummary,
  recoveryMilestones,
  recoveryStretch,
  whenText,
  type Level,
  type Milestone,
} from "@/lib/compass/preopCounseling";
import { tr } from "@/lib/compass/preopI18n";
import { usePatientT } from "@/hooks/usePatientT";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import type { ClinicalState, Prostate3DInputV1 } from "@/types/patient";

/**
 * Patient-facing pre-operative counseling (Patient View → "Preparing for
 * surgery"). All ranges are literature placeholders — see preopCounseling.ts.
 *
 * Surgery date, language, checklist ticks and questions are kept per case in
 * localStorage (never in demo mode, which promises zero persistence). The
 * clinician sign-off lives on the patient record so it travels with the case.
 */

/** Clinic contact shown on the red-flag card and printout. Left blank until the practice supplies it. */
const CLINIC_PHONE = "";

/* ── Language (patient-mode setting, see uiStore.patientLang) ────────────── */

const useT = usePatientT;

/* ── Per-case patient state ──────────────────────────────────────────────── */

interface PatientPrep { surgeryDate: string; done: string[]; questions: string[] }
const EMPTY: PatientPrep = { surgeryDate: "", done: [], questions: [] };

function usePatientPrep(caseId: string) {
  const key = `compass-preop-${caseId}`;
  const persist = !isDemoMode();
  const [state, setState] = useState<PatientPrep>(() => {
    if (!persist) return EMPTY;
    try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(key) ?? "{}") }; } catch { return EMPTY; }
  });
  useEffect(() => {
    if (!persist) return;
    try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* storage unavailable */ }
  }, [key, persist, state]);
  return [state, setState] as const;
}

/* ── Building blocks ─────────────────────────────────────────────────────── */

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const LEVEL: Record<Level, { label: string; bar: string; chip: string }> = {
  high: { label: "Plan ahead", bar: "bg-rose-500", chip: "bg-rose-500/15 text-rose-800 dark:text-rose-200" },
  moderate: { label: "Good to know", bar: "bg-amber-500", chip: "bg-amber-500/15 text-amber-900 dark:text-amber-200" },
  info: { label: "Nothing extra needed", bar: "bg-emerald-500", chip: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200" },
};
const LEVEL_ORDER: Level[] = ["high", "moderate", "info"];

function Section({ id, title, subtitle, children }: { id: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section id={`preop-${id}`} aria-labelledby={`preop-${id}-h`} className="scroll-mt-20 rounded-2xl border border-border bg-card p-5">
      <h3 id={`preop-${id}-h`} tabIndex={-1} className="text-xl font-semibold leading-tight text-foreground focus:outline-none">{title}</h3>
      {subtitle && <p className="mt-1 text-[0.95em] text-muted-foreground">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  const { t } = useT();
  return (
    <ul className="space-y-2 text-[0.95em] text-foreground">
      {items.map((i) => (
        <li key={i} className="flex gap-2.5">
          <span aria-hidden className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
          <span>{t(i)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Shows the first `n` bullets, the rest behind "Tell me more". */
function MoreBullets({ items, n = 2 }: { items: string[]; n?: number }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Bullets items={open ? items : items.slice(0, n)} />
      {items.length > n && (
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
          className={`mt-2 rounded text-sm font-medium text-sky-700 hover:underline dark:text-sky-300 ${FOCUS}`}>
          {open ? t("Show less") : t("Tell me more ({n})", { n: items.length - n })}
        </button>
      )}
    </>
  );
}

function ClinicalTerm({ term }: { term?: string }) {
  const { t } = useT();
  if (!term) return null;
  return <span className="ml-2 text-xs font-normal text-muted-foreground">({t(term)})</span>;
}

/* ── Review stamp ────────────────────────────────────────────────────────── */

function reviewState(review: Prostate3DInputV1["preop_review"], fingerprint: string) {
  if (!review) return "none" as const;
  return review.fingerprint === fingerprint ? ("current" as const) : ("stale" as const);
}

function ReviewStamp({ review, fingerprint, readOnly = false }: { review: Prostate3DInputV1["preop_review"]; fingerprint: string; readOnly?: boolean }) {
  const { t, lang } = useT();
  const locked = useUiStore((s) => s.patientViewLocked);
  const setPreopReview = usePatientStore((s) => s.setPreopReview);
  const [name, setName] = useState("");
  const state = reviewState(review, fingerprint);

  const banner =
    state === "current" ? (
      <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-900 dark:text-emerald-200">
        <UserCheck aria-hidden className="h-4 w-4 shrink-0" />
        <span>{t("Reviewed by {name} on {date}", { name: review!.reviewer, date: fmtLong(new Date(review!.date), lang) })}</span>
      </div>
    ) : (
      <div role="status" className="flex items-center gap-2 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-900 dark:text-amber-200">
        <AlertTriangle aria-hidden className="h-4 w-4 shrink-0" />
        <span>
          {state === "stale"
            ? t("Your details changed after {name} reviewed this page. Please check it with your care team.", { name: review!.reviewer })
            : t("Not yet reviewed by your care team. Please go over it with them.")}
        </span>
      </div>
    );

  if (locked || readOnly) return banner;

  // Clinician previewing their own case: can sign off or clear. English only — clinician-facing.
  return (
    <div className="space-y-2">
      {banner}
      <div lang="en" className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm">
        <span className="font-medium text-foreground">Clinician sign-off:</span>
        <label className="sr-only" htmlFor="preop-reviewer">Reviewer name</label>
        <input id="preop-reviewer" value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. name"
          className={`h-9 w-48 rounded-lg border border-input bg-background px-3 ${FOCUS}`} />
        <Button size="sm" disabled={!name.trim()}
          onClick={() => { setPreopReview({ reviewer: name.trim(), date: new Date().toISOString(), fingerprint }); setName(""); }}>
          {state === "none" ? "Sign off" : "Sign off again"}
        </Button>
        {review && <Button size="sm" variant="ghost" onClick={() => setPreopReview(null)}>Remove sign-off</Button>}
        <span className="text-xs text-muted-foreground">Only visible to clinicians. Patients see the stamp above.</span>
      </div>
    </div>
  );
}

/* ── Sections ────────────────────────────────────────────────────────────── */

function AtAGlance({ S, surgery }: { S: ClinicalState; surgery: Date | null }) {
  const { t, lang } = useT();
  const ms = recoveryMilestones(S);
  const get = (id: string) => ms.find((m) => m.id === id)!;
  const home = get("home"), cath = get("catheter");
  const tiles = [
    { Icon: BedDouble, label: "Nights in hospital", value: `${home.minDay}–${home.maxDay}`, sub: "most go home the next day" },
    { Icon: Droplets, label: "Urine tube out", value: surgery ? whenText(cath, surgery, lang, t) : t("{a}–{b} days", { a: cath.minDay, b: cath.maxDay }), sub: "done in clinic" },
    { Icon: Briefcase, label: "Back to desk work", value: whenText(get("office"), surgery, lang, t), sub: "if your job isn't physical" },
    { Icon: Car, label: "Driving again", value: whenText(get("drive"), surgery, lang, t), sub: "after the tube is out" },
  ];
  return (
    <Section id="glance" title={t("Your surgery at a glance")}
      subtitle={surgery ? t("Dates are based on your surgery on {date}.", { date: fmtLong(surgery, lang) }) : t("Add your surgery date above to see real dates.")}>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(({ Icon, label, value, sub }) => (
          <div key={label} className="rounded-xl border border-border bg-background/60 p-3.5">
            <Icon aria-hidden className="h-6 w-6 text-sky-600 dark:text-sky-400" />
            <dt className="mt-2 text-sm text-muted-foreground">{t(label)}</dt>
            <dd className="text-xl font-bold tabular-nums text-foreground">{value}</dd>
            <dd className="text-xs text-muted-foreground">{t(sub)}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

function RedFlags() {
  const { t } = useT();
  return (
    <section id="preop-redflags" aria-labelledby="preop-redflags-h" className="scroll-mt-20 rounded-2xl border-2 border-rose-500/70 bg-rose-500/10 p-5">
      <h3 id="preop-redflags-h" tabIndex={-1} className="flex items-center gap-2 text-xl font-bold text-rose-800 focus:outline-none dark:text-rose-200">
        <Phone aria-hidden className="h-5 w-5" /> {t("When to call us right away")}
      </h3>
      <p className="mt-1 text-[0.95em] text-foreground">
        {CLINIC_PHONE
          ? t("Call {phone}, day or night, if you have:", { phone: CLINIC_PHONE })
          : t("Call your surgeon's office, day or night (the number is on your discharge papers), if you have:")}
      </p>
      <ul className="mt-3 grid gap-2 text-[0.95em] text-foreground sm:grid-cols-2">
        {RED_FLAGS.map((f) => (
          <li key={f} className="flex gap-2"><AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />{t(f)}</li>
        ))}
      </ul>
      <p className="mt-3 text-sm font-semibold text-rose-800 dark:text-rose-200">{t("For chest pain or trouble breathing, call 911.")}</p>
    </section>
  );
}

function Checklist({ S, surgery, done, toggle }: { S: ClinicalState; surgery: Date | null; done: string[]; toggle: (id: string) => void }) {
  const { t, lang } = useT();
  const items = preopChecklist(S);
  const n = items.filter((i) => done.includes(i.id)).length;
  const groups = [
    { title: "4 weeks before", test: (d: number) => d <= -28 },
    { title: "2 weeks before", test: (d: number) => d > -28 && d <= -14 },
    { title: "1 week before", test: (d: number) => d > -14 && d <= -3 },
    { title: "The day before", test: (d: number) => d > -3 },
  ];
  return (
    <Section id="checklist" title={t("Your before-surgery checklist")} subtitle={t("Tick things off as you go. Your ticks are saved on this device.")}>
      <div className="mb-4">
        <div id="preop-progress" className="mb-1 text-sm font-medium text-foreground">{t("{n} of {total} done", { n, total: items.length })}</div>
        <div role="progressbar" aria-labelledby="preop-progress" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={n} className="h-2.5 rounded-full bg-muted">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(n / items.length) * 100}%` }} />
        </div>
      </div>
      <div className="space-y-4">
        {groups.map((g) => {
          const gi = items.filter((i) => g.test(i.byDay));
          if (!gi.length) return null;
          return (
            <fieldset key={g.title}>
              <legend className="mb-1.5 text-sm font-semibold text-muted-foreground">
                {t(g.title)}{surgery ? ` · ${t("by")} ${fmtShort(addDays(surgery, gi[0]!.byDay), lang)}` : ""}
              </legend>
              <div className="space-y-1.5">
                {gi.map((i) => {
                  const on = done.includes(i.id);
                  return (
                    <button key={i.id} type="button" role="checkbox" aria-checked={on} onClick={() => toggle(i.id)}
                      className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left text-[0.95em] transition-colors ${FOCUS} ${on ? "border-emerald-500/40 bg-emerald-500/10 text-muted-foreground line-through" : "border-border bg-background/60 text-foreground hover:border-sky-500/50"}`}>
                      {on ? <CircleCheck aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <Circle aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />}
                      {t(i.text)}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>
    </Section>
  );
}

function HealthInputs({ S }: { S: ClinicalState }) {
  const { t } = useT();
  const update = usePatientStore((s) => s.updateClinicalForm);
  const locked = useUiStore((s) => s.patientViewLocked);
  const chip = (k: "prior_abdominal_surgery" | "anticoagulant" | "osa" | "dm" | "htn", label: string) => {
    const on = !!S[k];
    return (
      <button type="button" disabled={locked} aria-pressed={on} onClick={() => update({ [k]: !on })}
        className={`rounded-full border px-3.5 py-2 text-sm transition-colors disabled:cursor-default ${FOCUS} ${on ? "border-sky-500 bg-sky-500/15 font-medium text-sky-800 dark:text-sky-200" : "border-border text-muted-foreground hover:border-sky-500/50 hover:text-foreground"}`}>
        {on ? "✓ " : ""}{t(label)}
      </button>
    );
  };
  const field = `h-11 w-full rounded-lg border border-input bg-background px-3 text-base disabled:opacity-70 ${FOCUS}`;
  return (
    <Section id="health" title={t("Your health")} subtitle={t("Your care team fills this in. The rest of this page adjusts to it.")}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-foreground">{t("Body-mass index (BMI)")}</span>
          <input type="number" step="0.1" disabled={locked} value={S.bmi} onChange={(e) => update({ bmi: parseFloat(e.target.value) || 27 })} className={field} />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-foreground">{t("Overall health for anesthesia")} <span className="font-normal text-muted-foreground">(ASA)</span></span>
          <select disabled={locked} value={S.asa_class} onChange={(e) => update({ asa_class: parseInt(e.target.value) })} className={field}>
            <option value={1}>1 · {t("Healthy")}</option>
            <option value={2}>2 · {t("Mild, well-controlled conditions")}</option>
            <option value={3}>3 · {t("Serious conditions")}</option>
            <option value={4}>4 · {t("Very serious conditions")}</option>
          </select>
        </label>
      </div>
      <div id="preop-conditions" className="mt-4 text-sm font-medium text-foreground">{t("Conditions")}</div>
      <div role="group" aria-labelledby="preop-conditions" className="mt-2 flex flex-wrap gap-2">
        {chip("dm", "Diabetes")}
        {chip("htn", "High blood pressure")}
        {chip("osa", "Sleep apnea")}
        {chip("anticoagulant", "Blood thinner")}
        {chip("prior_abdominal_surgery", "Past belly surgery")}
      </div>
    </Section>
  );
}

function ThingsToPlan({ S }: { S: ClinicalState }) {
  const { t } = useT();
  const predictions = usePatientStore((s) => s.predictions);
  const flags = [...counselingFlags(S, predictions)].sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level));
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  return (
    <Section id="plan" title={t("Things to plan for")} subtitle={t("Based on your health. Most important first.")}>
      <div className="space-y-2.5">
        {flags.map((f) => {
          const L = LEVEL[f.level];
          const isOpen = open.has(f.id);
          return (
            <div key={f.id} className="relative overflow-hidden rounded-xl border border-border bg-background/60">
              <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${L.bar}`} />
              <button type="button" onClick={() => toggle(f.id)} aria-expanded={isOpen} aria-controls={`preop-flag-${f.id}`}
                className={`w-full rounded-xl py-3.5 pl-5 pr-4 text-left ${FOCUS}`}>
                <div className="flex items-center gap-3">
                  <span className="flex-1 text-[1.05em] font-semibold text-foreground">{t(f.title)}<ClinicalTerm term={f.clinicalTerm} /></span>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${L.chip}`}>{t(L.label)}</span>
                  <ChevronDown aria-hidden className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </div>
                <p className="mt-1 text-[0.95em] text-muted-foreground">{t(f.summary)}</p>
                {!isOpen && <span className="mt-1 inline-block text-sm font-medium text-sky-700 dark:text-sky-300">{t("Tell me more")}</span>}
              </button>
              {isOpen && (
                <div id={`preop-flag-${f.id}`} className="space-y-3 pb-4 pl-5 pr-4">
                  <p className="text-[0.95em] leading-relaxed text-foreground">{f.detail.map((d) => t(d)).join(" ")}</p>
                  {f.actions.length > 0 && (
                    <div className="rounded-lg bg-sky-500/10 p-3">
                      <div className="mb-1.5 text-sm font-semibold text-sky-800 dark:text-sky-200">{t("What you can do")}</div>
                      <Bullets items={f.actions} />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function HospitalStay({ S }: { S: ClinicalState }) {
  const { t } = useT();
  const predictions = usePatientStore((s) => s.predictions);
  const c = expectedCourse(S, predictions);
  const blocks: { Icon: typeof Info; title: string; items: string[] }[] = [
    { Icon: Timer, title: "The basics", items: [c.operation, c.stay, c.catheter, c.drain] },
    { Icon: HeartPulse, title: "Pain", items: c.pain },
    { Icon: Stethoscope, title: "Medicines for home", items: c.meds },
    { Icon: Info, title: "Normal after surgery", items: c.special },
  ];
  return (
    <Section id="stay" title={t("Your hospital stay")} subtitle={t("What usually happens around the operation.")}>
      <div className="grid gap-3 md:grid-cols-2">
        {blocks.map(({ Icon, title, items }) => (
          <div key={title} className="rounded-xl border border-border bg-background/60 p-4">
            <h4 className="mb-2 flex items-center gap-2 text-[1.05em] font-semibold text-foreground"><Icon aria-hidden className="h-5 w-5 text-sky-600 dark:text-sky-400" />{t(title)}</h4>
            <MoreBullets items={items} />
          </div>
        ))}
      </div>
    </Section>
  );
}

function OutcomeBars({ label, values }: { label: string; values: number[] }) {
  const { t } = useT();
  return (
    <div>
      <h4 className="mb-2 font-semibold text-foreground">{t(label)}</h4>
      <ol className="grid grid-cols-5 gap-1.5">
        {values.map((v, i) => (
          <li key={i} className="text-center">
            <div aria-hidden className="relative mx-auto h-24 w-full max-w-[3rem] overflow-hidden rounded-md bg-muted">
              <div className="absolute inset-x-0 bottom-0 bg-sky-500" style={{ height: `${v}%` }} />
            </div>
            <div className="mt-1 text-sm font-bold tabular-nums text-foreground">{t("{n} in 100", { n: v })}</div>
            <div className="text-xs text-muted-foreground">{t(OUTCOME_TIMEPOINTS[i]!)}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Outcomes({ S }: { S: ClinicalState }) {
  const { t } = useT();
  const predictions = usePatientStore((s) => s.predictions);
  const o = likelyOutcomes(S, predictions);
  if (!o) return null;
  return (
    <Section id="outcomes" title={t("Your likely outcomes")} subtitle={t("Out of 100 men with a health picture like yours, about how many reach each point.")}>
      <div className="space-y-6">
        <OutcomeBars label="Bladder control (dry, or 1 safety pad a day)" values={o.continence} />
        {o.potency
          ? <OutcomeBars label="Erections firm enough for sex (with or without pills)" values={o.potency} />
          : <p className="text-[0.95em] text-muted-foreground">{t("Erection recovery isn't estimated because erections were already weak before surgery. Your surgeon can talk through options with you.")}</p>}
        {o.recurrence !== null && (
          <p className="text-[0.95em] text-foreground">
            {t("Chance the cancer comes back (PSA rises again) in the years after surgery: about {n} in 100.", { n: o.recurrence })}
          </p>
        )}
      </div>
      <div className="mt-4 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
        {t("These numbers describe groups of men, not you personally. Recovery is often slower in the first months and keeps improving for up to 2 years. They depend on the surgery actually performed and on your own effort with exercises. Talk them through with your surgeon.")}
      </div>
    </Section>
  );
}

const MILESTONE_ICON: Record<string, typeof Info> = {
  npo: UtensilsCrossed, clears: GlassWater, soft: Soup, regular: Coffee, walk: Footprints, home: House,
  shower: ShowerHead, catheter: Droplets, dog: Dog, drive: Car, office: Briefcase, pfmt: Activity,
  sex: Heart, golf: Flag, gym: Dumbbell, sports: Trophy, bike: Bike, manual: Hammer,
};

const PHASES: { title: string; test: (m: Milestone) => boolean; from: number; to: number }[] = [
  { title: "In hospital", test: (m) => m.minDay <= 1, from: -1, to: 1 },
  { title: "First 2 weeks at home", test: (m) => m.minDay > 1 && m.minDay < 14, from: 2, to: 13 },
  { title: "Weeks 3 to 6", test: (m) => m.minDay >= 14 && m.minDay < 35, from: 14, to: 34 },
  { title: "Week 6 and beyond", test: (m) => m.minDay >= 35, from: 35, to: 9999 },
];

function Recovery({ S, surgery }: { S: ClinicalState; surgery: Date | null }) {
  const { t, lang } = useT();
  const ms = recoveryMilestones(S);
  const stretch = recoveryStretch(S);
  const today = daysFromSurgery(surgery);
  return (
    <Section id="recovery" title={t("When can I…?")} subtitle={t("When most men get back to each activity. Your own pace may differ.")}>
      {stretch.reasons.length > 0 && (
        <div className={`mb-4 flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${LEVEL.moderate.chip}`}>
          <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t("Some of your dates are a little later than average because of: {reasons}.", { reasons: stretch.reasons.map((r) => t(r)).join(", ") })}</span>
        </div>
      )}
      <div className="space-y-5">
        {PHASES.map((p) => {
          const items = ms.filter(p.test);
          const here = today !== null && today >= p.from && today <= p.to;
          return (
            <div key={p.title} aria-current={here ? "step" : undefined} className={here ? "rounded-xl ring-2 ring-sky-500 ring-offset-4 ring-offset-card" : ""}>
              <h4 className="mb-2 flex items-center gap-2">
                <span className="text-[1.05em] font-semibold text-foreground">{t(p.title)}</span>
                {here && <span className="rounded-full bg-sky-700 px-2.5 py-0.5 text-xs font-bold text-white">{t("You are here")}</span>}
              </h4>
              <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {items.map((m) => {
                  const Icon = MILESTONE_ICON[m.id] ?? Info;
                  const reached = today !== null && today >= m.minDay;
                  return (
                    <li key={m.id} className={`rounded-xl border p-3 ${reached ? "border-emerald-500/40 bg-emerald-500/5" : "border-border bg-background/60"}`}>
                      <div className="flex items-center justify-between">
                        <Icon aria-hidden className="h-7 w-7 text-sky-600 dark:text-sky-400" />
                        {reached && <CircleCheck role="img" aria-label={t("Can start now")} className="h-4 w-4 text-emerald-600" />}
                      </div>
                      <div className="mt-2 text-[0.95em] font-medium leading-snug text-foreground">{t(m.label)}</div>
                      <div className="mt-0.5 text-sm font-semibold tabular-nums text-sky-800 dark:text-sky-300">{whenText(m, surgery, lang, t)}</div>
                      {m.note && <div className="mt-1 text-xs leading-snug text-muted-foreground">{t(m.note)}</div>}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

const PREP_ICON: Record<string, typeof Info> = {
  physical: Dumbbell, urinary: Activity, sexual: HeartPulse, metabolic: Timer, nutrition: Salad, oncological: ScanSearch, emotional: Brain,
};
const PREP_TITLE: Record<string, string> = {
  physical: "Get fitter", urinary: "Strengthen your bladder control", sexual: "Sexual health", metabolic: "Weight, sugar and habits",
  nutrition: "Eat to heal", oncological: "Your cancer care", emotional: "Look after your mind",
};

function GetReady({ S }: { S: ClinicalState }) {
  const { t } = useT();
  const psma = psmaSummary(S);
  return (
    <Section id="ready" title={t("Get ready")} subtitle={t("Starting 4–6 weeks before surgery makes the biggest difference.")}>
      <div className="grid gap-3 md:grid-cols-2">
        {preparationPlan(S).map((sec) => {
          const Icon = PREP_ICON[sec.id] ?? Info;
          return (
            <div key={sec.id} className="rounded-xl border border-border bg-background/60 p-4">
              <h4 className="mb-2 flex items-center gap-2.5 text-[1.05em] font-semibold text-foreground">
                <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/15"><Icon className="h-5 w-5 text-sky-700 dark:text-sky-300" /></span>
                {t(PREP_TITLE[sec.id] ?? sec.title)}
              </h4>
              <MoreBullets items={sec.items} n={1} />
            </div>
          );
        })}
      </div>
      {psma.available && (
        <div className="mt-4 rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
          <h4 className="mb-2 flex items-center gap-2 text-[1.05em] font-semibold text-foreground">
            <ScanSearch aria-hidden className="h-5 w-5 text-sky-600" /> {t("What your PSMA scan shows")} <ClinicalTerm term="PSMA PET" />
          </h4>
          <MoreBullets items={psma.lines} />
        </div>
      )}
    </Section>
  );
}

function Questions({ questions, setQuestions }: { questions: string[]; setQuestions: (q: string[]) => void }) {
  const { t } = useT();
  const [draft, setDraft] = useState("");
  const toggle = (q: string) => setQuestions(questions.includes(q) ? questions.filter((x) => x !== q) : [...questions, q]);
  const add = () => { const q = draft.trim(); if (q && !questions.includes(q)) setQuestions([...questions, q]); setDraft(""); };
  const custom = questions.filter((q) => !QUESTION_BANK.includes(q));
  return (
    <Section id="questions" title={t("Questions for my surgeon")} subtitle={t("Pick the ones you want to ask, or add your own. They go on your printout.")}>
      <div className="space-y-1.5">
        {[...QUESTION_BANK, ...custom].map((q) => {
          const on = questions.includes(q);
          const own = !QUESTION_BANK.includes(q);
          return (
            <button key={q} type="button" role="checkbox" aria-checked={on} onClick={() => toggle(q)}
              aria-label={own ? `${q} (${t("tap to remove")})` : undefined}
              className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left text-[0.95em] ${FOCUS} ${on ? "border-sky-500/50 bg-sky-500/10 text-foreground" : "border-border bg-background/60 text-muted-foreground hover:text-foreground"}`}>
              {on ? <CircleCheck aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" /> : <MessageCircleQuestion aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />}
              <span className="flex-1">{own ? q : t(q)}</span>
              {own && <X aria-hidden className="h-4 w-4 shrink-0" />}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex gap-2">
        <label htmlFor="preop-own-q" className="sr-only">{t("Type your own question…")}</label>
        <input id="preop-own-q" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={t("Type your own question…")} className={`h-11 flex-1 rounded-lg border border-input bg-background px-3 text-base ${FOCUS}`} />
        <Button onClick={add} disabled={!draft.trim()} className="h-11 gap-1"><Plus aria-hidden className="h-4 w-4" /> {t("Add")}</Button>
      </div>
    </Section>
  );
}

function AiLetter({ S }: { S: ClinicalState }) {
  const { t, lang } = useT();
  const predictions = usePatientStore((s) => s.predictions);
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function run() {
    setBusy(true); setErr(null);
    try { setText(await generatePreopNarrative(counselingContext(S, predictions), PREOP_REFERENCES.map((r) => r.key), lang)); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  return (
    <Section id="letter" title={t("Your personal letter")} subtitle={t("A plain-language letter written by AI that pulls all of this together.")}>
      <Button onClick={run} disabled={busy} className="h-11 gap-1.5">
        {busy ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Sparkles aria-hidden className="h-4 w-4" />}
        {text ? t("Write it again") : t("Write my letter")}
      </Button>
      <p className="mt-2 text-sm text-muted-foreground">{t("No name or dates are sent. AI can make mistakes, so go over it with your surgeon.")}</p>
      <div aria-live="polite">
        {err && <div role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}
        {text && <div className="mt-4 whitespace-pre-wrap rounded-xl border border-border bg-background/60 p-4 text-[0.95em] leading-relaxed text-foreground">{text}</div>}
      </div>
    </Section>
  );
}

function Sources() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-border bg-card">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className={`flex w-full items-center gap-2 rounded-2xl px-5 py-3 text-left text-sm font-semibold text-foreground ${FOCUS}`}>
        <BookOpen aria-hidden className="h-4 w-4 text-muted-foreground" /> {t("Sources for the care team ({n})", { n: PREOP_REFERENCES.length })}
        <ChevronDown aria-hidden className={`ml-auto h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ol lang="en" className="list-decimal space-y-1.5 px-5 pb-4 pl-10 text-xs text-muted-foreground">
          {PREOP_REFERENCES.map((r) => (
            <li key={r.key}>
              {r.citation}
              {r.pmid && <> <a href={`https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`} target="_blank" rel="noreferrer" className={`rounded text-sky-700 underline dark:text-sky-300 ${FOCUS}`}>PubMed {r.pmid}</a></>}
              {!r.verified && <span className="ml-1 text-amber-700 dark:text-amber-400">(not yet verified)</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

/** Read-only review stamp for the other patient-mode tabs. */
export function CaseReviewBanner() {
  const patients = usePatientStore((s) => s.patients);
  const activeId = usePatientStore((s) => s.activeId);
  const predictions = usePatientStore((s) => s.predictions);
  const entry = patients.find((p) => p.id === activeId);
  if (!entry) return null;
  const S = deriveClinicalFromLesions(clinicalStateFromRecord({ ...entry.record, lesions: entry.lesionRows }), lesionsFromRows(entry.lesionRows));
  return <ReviewStamp review={entry.record.preop_review ?? null} fingerprint={counselingFingerprint(S, predictions)} readOnly />;
}

export function PreopCounselingPanel() {
  const activeId = usePatientStore((s) => s.activeId);
  // Keyed so saved date/checklist/questions reload when the case changes.
  return <PreopCounselingPage key={activeId ?? "none"} />;
}

function PreopCounselingPage() {
  const patients = usePatientStore((s) => s.patients);
  const activeId = usePatientStore((s) => s.activeId);
  const predictions = usePatientStore((s) => s.predictions);
  const entry = patients.find((p) => p.id === activeId);
  const [prep, setPrep] = usePatientPrep(entry?.id ?? "none");
  const { lang } = usePatientT();
  const [large, setLarge] = useState(false);
  const isDesktop = useIsDesktop();
  const [step, setStep] = useState(0);

  const S = useMemo(() => entry
    ? deriveClinicalFromLesions(clinicalStateFromRecord({ ...entry.record, lesions: entry.lesionRows }), lesionsFromRows(entry.lesionRows))
    : null, [entry]);
  if (!entry || !S) return null;

  const t = (s: string, vars?: Record<string, string | number>) => tr(s, lang, vars);
  const surgery = parseSurgeryDate(prep.surgeryDate);
  const review = entry.record.preop_review ?? null;
  const fingerprint = counselingFingerprint(S, predictions);
  const toggleDone = (id: string) => setPrep((p) => ({ ...p, done: p.done.includes(id) ? p.done.filter((x) => x !== id) : [...p.done, id] }));

  const print = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(buildPrintHtml({
      S, surgery, done: prep.done, questions: prep.questions, review,
      reviewCurrent: reviewState(review, fingerprint) === "current", clinicPhone: CLINIC_PHONE, lang, tr: (s) => tr(s, lang),
    }));
    w.document.close();
    w.focus();
    w.print();
  };

  const sections: { id: string; label: string; node: React.ReactNode }[] = [
    { id: "glance", label: "Overview", node: <AtAGlance S={S} surgery={surgery} /> },
    { id: "checklist", label: "Checklist", node: <Checklist S={S} surgery={surgery} done={prep.done} toggle={toggleDone} /> },
    { id: "plan", label: "Plan for", node: <ThingsToPlan S={S} /> },
    { id: "stay", label: "Hospital", node: <HospitalStay S={S} /> },
    { id: "recovery", label: "When can I…", node: <Recovery S={S} surgery={surgery} /> },
    { id: "outcomes", label: "Outcomes", node: <Outcomes S={S} /> },
    { id: "ready", label: "Get ready", node: <GetReady S={S} /> },
    { id: "questions", label: "Questions", node: <Questions questions={prep.questions} setQuestions={(q) => setPrep((p) => ({ ...p, questions: q }))} /> },
    { id: "redflags", label: "Call us if", node: <RedFlags /> },
    { id: "health", label: "Your health", node: <HealthInputs S={S} /> },
    { id: "letter", label: "AI letter", node: <AiLetter S={S} /> },
  ];
  const cur = Math.min(step, sections.length - 1);
  const go = (i: number) => {
    if (isDesktop) {
      const el = document.getElementById(`preop-${sections[i]!.id}`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      el?.querySelector<HTMLElement>("h3")?.focus({ preventScroll: true });
    } else {
      setStep(i);
      document.getElementById("preop-top")?.scrollIntoView({ block: "start" });
    }
  };

  return (
    <div id="preop-top" lang={lang} className="mx-auto max-w-4xl space-y-4 pb-10" style={large ? { zoom: 1.2 } : undefined}>
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4">
        <label className="min-w-[12rem] flex-1 space-y-1 text-sm">
          <span className="flex items-center gap-1.5 font-medium text-foreground"><CalendarDays aria-hidden className="h-4 w-4 text-sky-600" /> {t("My surgery date")}</span>
          <input type="date" value={prep.surgeryDate} onChange={(e) => setPrep((p) => ({ ...p, surgeryDate: e.target.value }))}
            className={`h-11 w-full max-w-xs rounded-lg border border-input bg-background px-3 text-base ${FOCUS}`} />
        </label>
        <Button variant="outline" onClick={() => setLarge(!large)} aria-pressed={large} className="h-11 gap-1.5">
          <Type aria-hidden className="h-4 w-4" /> {large ? t("Normal text") : t("Larger text")}
        </Button>
        <Button onClick={print} className="h-11 gap-1.5">
          <Printer aria-hidden className="h-4 w-4" /> {t("Print my plan")}
        </Button>
      </div>

      <ReviewStamp review={review} fingerprint={fingerprint} />

      <p className="px-1 text-xs text-muted-foreground">
        {t("Research use only (IRB STUDY-14-00050). These are typical ranges from published studies, not a promise, and your care team's instructions always come first.")}
        {lang === "es" && ` ${t("Translation pending review by a medical translator.")}`}
      </p>

      <nav aria-label={t("Sections")} className="sticky -top-4 z-10 -mx-1 flex gap-1.5 overflow-x-auto bg-background/90 px-1 py-2 backdrop-blur lg:-top-6">
        {sections.map((s, i) => (
          <button key={s.id} type="button" onClick={() => go(i)} aria-current={!isDesktop && i === cur ? "step" : undefined}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium ${FOCUS} ${!isDesktop && i === cur ? "border-sky-600 bg-sky-600 text-white" : s.id === "redflags" ? "border-rose-500/60 text-rose-800 dark:text-rose-200" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}>
            {t(s.label)}
          </button>
        ))}
      </nav>

      {isDesktop ? (
        <>
          {sections.map((s) => <div key={s.id}>{s.node}</div>)}
          <Sources />
        </>
      ) : (
        <>
          <div aria-live="polite" className="text-sm text-muted-foreground">{t("Step {n} of {total}", { n: cur + 1, total: sections.length })}</div>
          {sections[cur]!.node}
          <div className="flex gap-3">
            <Button variant="outline" className="h-12 flex-1 gap-1" disabled={cur === 0} onClick={() => go(cur - 1)}>
              <ChevronLeft aria-hidden className="h-5 w-5" /> {t("Back")}
            </Button>
            <Button className="h-12 flex-1 gap-1" disabled={cur === sections.length - 1} onClick={() => go(cur + 1)}>
              {t("Next")} <ChevronRight aria-hidden className="h-5 w-5" />
            </Button>
          </div>
          {cur === sections.length - 1 && <Sources />}
        </>
      )}
    </div>
  );
}
