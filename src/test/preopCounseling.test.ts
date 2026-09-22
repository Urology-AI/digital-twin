import { describe, expect, it } from "vitest";
import { defaultClinicalState } from "@/types/patient";
import { buildProstateRecord } from "@/lib/compass/recordFactory";
import { clinicalStateFromRecord } from "@/lib/compass/clinicalFromRecord";
import {
  PREOP_REFERENCES, counselingFlags, recoveryMilestones, recoveryStretch,
} from "@/lib/compass/preopCounseling";

describe("pre-op counseling", () => {
  it("round-trips the new pre-op inputs through the record", () => {
    const S = { ...defaultClinicalState(), asa_class: 3, prior_abdominal_surgery: true, anticoagulant: true, osa: true };
    const back = clinicalStateFromRecord(buildProstateRecord(S, []));
    expect(back.asa_class).toBe(3);
    expect(back.prior_abdominal_surgery).toBe(true);
    expect(back.anticoagulant).toBe(true);
    expect(back.osa).toBe(true);
  });

  it("healthy patient gets no stretch; risk factors widen upper bounds only", () => {
    const base = { ...defaultClinicalState(), bmi: 24, age: 60, asa_class: 1 };
    expect(recoveryStretch(base).factor).toBe(1);
    const risky = { ...base, bmi: 36, asa_class: 3, age: 72 };
    const a = recoveryMilestones(base), b = recoveryMilestones(risky);
    const cath = (m: typeof a) => m.find((x) => x.id === "catheter")!;
    expect(cath(b).minDay).toBe(cath(a).minDay);
    expect(cath(b).maxDay).toBeGreaterThan(cath(a).maxDay);
  });

  it("flags hostile abdomen, anticoagulation and high ASA", () => {
    const S = { ...defaultClinicalState(), asa_class: 3, prior_abdominal_surgery: true, anticoagulant: true };
    const f = counselingFlags(S, null);
    expect(f.find((x) => x.id === "hostile")).toBeTruthy();
    expect(f.find((x) => x.id === "bleeding")!.level).toBe("high");
    expect(f.find((x) => x.id === "anesthesia")!.level).toBe("high");
  });

  it("every cited reference key exists", () => {
    const keys = new Set(PREOP_REFERENCES.map((r) => r.key));
    const S = { ...defaultClinicalState(), osa: true, anticoagulant: true };
    for (const f of counselingFlags(S, null)) for (const r of f.refs) expect(keys.has(r)).toBe(true);
    for (const m of recoveryMilestones(S)) for (const r of m.refs) expect(keys.has(r)).toBe(true);
  });
});

import {
  addDays, buildPrintHtml, counselingFingerprint, daysFromSurgery, expectedCourse, parseSurgeryDate,
  preopChecklist, preparationPlan, psmaSummary, whenText, RED_FLAGS, QUESTION_BANK, OUTCOME_TIMEPOINTS,
} from "@/lib/compass/preopCounseling";
import { hasSpanish, tr } from "@/lib/compass/preopI18n";

const risky = () => ({
  ...defaultClinicalState(), asa_class: 3, osa: true, anticoagulant: true, prior_abdominal_surgery: true,
  bmi: 36, dm: true, htn: true, statin: true, smoking: "current", cad: true, age: 76,
  psma_avail: 1, psma_epe: 1, psma_svi: 1, psma_ln: 1, suv: 9.4, prior_pelvic_radiation: true, pde5: "none",
});

describe("pre-op checklist and dates", () => {
  it("tailors checklist items to the patient", () => {
    const base = preopChecklist({ ...defaultClinicalState(), smoking: "never", anticoagulant: false, osa: false }).map((i) => i.id);
    const r = preopChecklist(risky()).map((i) => i.id);
    expect(base).not.toContain("smoke");
    expect(r).toEqual(expect.arrayContaining(["smoke", "anticoag", "cpap", "weight", "sugar"]));
    for (const i of preopChecklist(risky())) expect(i.byDay).toBeLessThan(0);
  });

  it("parses surgery dates strictly and counts days from surgery", () => {
    expect(parseSurgeryDate("")).toBeNull();
    expect(parseSurgeryDate("2026-13-40")).toBeNull();
    const d = parseSurgeryDate("2026-10-01")!;
    expect(d.getFullYear()).toBe(2026);
    expect(daysFromSurgery(d, new Date(2026, 9, 8, 15))).toBe(7);
    expect(daysFromSurgery(d, new Date(2026, 8, 30))).toBe(-1);
    expect(daysFromSurgery(null)).toBeNull();
  });

  it("formats milestone windows as relative days or real dates", () => {
    const m = { id: "x", label: "x", minDay: 5, maxDay: 10, refs: [] };
    const id = (s: string) => s;
    expect(whenText(m, null, "en", id)).toBe("Day 5 – Day 10");
    expect(whenText({ ...m, minDay: 21, maxDay: 42 }, null, "en", id)).toBe("Week 3 – Week 6");
    const surgery = new Date(2026, 9, 1);
    expect(whenText(m, surgery, "en", id)).toBe("Oct 6 – Oct 11");
    expect(addDays(surgery, -7).getDate()).toBe(24);
  });
});

describe("clinician review fingerprint", () => {
  it("is stable for the same inputs and changes when a counseling input changes", () => {
    const S = defaultClinicalState();
    expect(counselingFingerprint(S, null)).toBe(counselingFingerprint({ ...S }, null));
    expect(counselingFingerprint({ ...S, anticoagulant: true }, null)).not.toBe(counselingFingerprint(S, null));
  });
});

describe("printable plan", () => {
  const base = {
    S: risky(), surgery: new Date(2026, 9, 1), done: ["kegel"], questions: ["<script>x</script>"],
    review: { reviewer: "Dr. Test", date: "2026-09-20T12:00:00Z", fingerprint: "f" }, reviewCurrent: true,
    clinicPhone: "", lang: "en" as const, tr: (s: string) => s,
  };
  it("includes date, checklist, red flags, review and escapes user text", () => {
    const html = buildPrintHtml(base);
    expect(html).toContain("Thu, Oct 1");
    expect(html).toContain("✓");
    for (const f of RED_FLAGS) expect(html).toContain(f.replace(/&/g, "&amp;"));
    expect(html).toContain("Reviewed by Dr. Test");
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
  });
  it("says not reviewed when the stamp is stale", () => {
    expect(buildPrintHtml({ ...base, reviewCurrent: false })).toContain("Not yet reviewed by your care team");
  });
  it("renders in Spanish", () => {
    const html = buildPrintHtml({ ...base, lang: "es", tr: (s) => tr(s, "es") });
    expect(html).toContain("Mi plan de cirugía");
    expect(html).toContain('lang="es"');
  });
});

describe("Spanish coverage", () => {
  it("every patient-facing string from the counseling logic has a translation", () => {
    const missing = new Set<string>();
    const check = (s: string) => { if (!hasSpanish(s)) missing.add(s); };
    const profiles = [defaultClinicalState(), risky(), { ...defaultClinicalState(), pfmt: "intensive", psma_avail: 1 }];
    for (const S of profiles) {
      const P = { lni: 0.2, bcr: 0.1 } as never;
      for (const f of counselingFlags(S, P)) {
        [f.title, f.summary, ...f.detail, ...f.actions].forEach(check);
        if (f.clinicalTerm) check(f.clinicalTerm);
      }
      const c = expectedCourse(S, P);
      [c.operation, c.stay, c.catheter, c.drain, ...c.pain, ...c.meds, ...c.special].forEach(check);
      recoveryMilestones(S).forEach((m) => { check(m.label); if (m.note) check(m.note); });
      recoveryStretch(S).reasons.forEach(check);
      preparationPlan(S).forEach((s) => s.items.forEach(check));
      psmaSummary(S).lines.forEach(check);
      preopChecklist(S).forEach((i) => check(i.text));
    }
    [...RED_FLAGS, ...QUESTION_BANK, ...OUTCOME_TIMEPOINTS].forEach(check);
    expect([...missing]).toEqual([]);
  });

  it("every literal UI string in the counseling page has a translation", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync("src/components/PreopCounselingPanel.tsx", "utf8");
    const literals = [
      ...src.matchAll(/\bt\("((?:[^"\\]|\\.)*)"/g),
      ...src.matchAll(/(?:label|title|sub): "([^"]+)"/g),
      ...src.matchAll(/chip\("\w+", "([^"]+)"\)/g),
      ...src.matchAll(/label="([^"]+)"/g),
    ].map((m) => m[1]!).filter((s) => !/^[\d·\s]+$/.test(s));
    const missing = [...new Set(literals)].filter((s) => !hasSpanish(s));
    expect(missing).toEqual([]);
  });

  it("fills placeholders and falls back to English", () => {
    expect(tr("{n} of {total} done", "es", { n: 2, total: 9 })).toBe("2 de 9 hechas");
    expect(tr("Day 5", "es")).toBe("Día 5");
    expect(tr("not in the table", "es")).toBe("not in the table");
    expect(tr("Tell me more", "en")).toBe("Tell me more");
  });
});

describe("recovery opportunities", () => {
  it("every modifiable lever has patient wording, and optimal habits leave nothing to suggest", async () => {
    const { recoveryOpportunities, OPPORTUNITY_TEXT } = await import("@/lib/compass/preopCounseling");
    const worst = { ...defaultClinicalState(), bmi: 38, pfmt: "none", exercise: "sedentary", pde5: "none", smoking: "current", alcohol: "heavy", diet: "high_saturated_fat", ipss: 25 };
    const opps = recoveryOpportunities(worst);
    expect(opps.length).toBeGreaterThan(5);
    for (const o of opps) expect(OPPORTUNITY_TEXT[o.label]).toBe(o.text);
    const best = { ...defaultClinicalState(), bmi: 23, pfmt: "intensive", exercise: "active", pde5: "daily", smoking: "never", alcohol: "none", diet: "favorable", ipss: 3 };
    expect(recoveryOpportunities(best)).toEqual([]);
  });
});

describe("Spanish coverage — rest of patient mode", () => {
  it("every patient-facing literal in patient mode has a translation", async () => {
    const { readFileSync } = await import("fs");
    const { OPPORTUNITY_TEXT } = await import("@/lib/compass/preopCounseling");
    const read = (f: string) => readFileSync(f, "utf8");
    const pv = read("src/components/PatientView.tsx");
    const mf = read("src/components/ModifiableFactorsPanel.tsx");
    const app = read("src/App.tsx");
    // Clinician-only strings in PatientView (report import, basics) stay English.
    const patientPv = pv.slice(pv.indexOf("function ResetBanner"));
    const header = pv.slice(pv.indexOf("const PATIENT_TABS"), pv.indexOf("function ReportImport"));
    const strings = [
      ...[header, patientPv].flatMap((src) => [
        ...[...src.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]!),
        ...[...src.matchAll(/(?:label|short|title|text): "([^"]+)"/g)].map((m) => m[1]!),
        ...[...src.matchAll(/^\s+\d: "([^"]+)"/gm)].map((m) => m[1]!),
        ...[...src.matchAll(/\["([A-Z][^"]+)", /g)].map((m) => m[1]!),
      ]),
      ...[...patientPv.matchAll(/\? "((?:[^"\\]|\\.)*)"\s*\n\s*: "((?:[^"\\]|\\.)*)"/g)].flatMap((m) => [m[1]!, m[2]!]),
      ...[...patientPv.matchAll(/t\(S\.laterality[^)]*\)/g)].flatMap((m) => [...m[0].matchAll(/"([^"]+)"/g)].map((x) => x[1]!).filter((x) => x.includes("side"))),
      ...[...mf.matchAll(/L\("[^"]*", "([^"]+)"\)/g)].map((m) => m[1]!),
      ...[...mf.matchAll(/\{ label: (?:L\("[^"]*", )?"([^"]+)"\)?, value: "[^"]+"(?:, hint: "([^"]+)")? \}/g)].flatMap((m) => [m[1]!, m[2]].filter(Boolean) as string[]),
      ...[...mf.matchAll(/tp\("([^"]+)"\)/g)].map((m) => m[1]!),
      "Underweight", "Normal", "Overweight", "Obese",
      ...[...app.matchAll(/tp\("([^"]+)"\)/g)].map((m) => m[1]!),
      ...Object.values(OPPORTUNITY_TEXT),
    ].map((x) => x.replace(/\\"/g, '"'));
    const missing = [...new Set(strings)].filter((x) => !hasSpanish(x));
    expect(missing).toEqual([]);
  });
});
