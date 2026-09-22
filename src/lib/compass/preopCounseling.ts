/**
 * Pre-operative counseling for robot-assisted radical prostatectomy (RARP).
 *
 * Everything here is patient-education content, NOT a validated model. Ranges
 * are LITERATURE PLACEHOLDERS drawn from the RARP literature (see
 * PREOP_REFERENCES — citations checked against PubMed) and should be
 * replaced with the Mount Sinai / Tewari-group institutional protocol before
 * any clinical use. The per-patient adjustment is a simple heuristic that
 * widens the upper end of each range for known risk factors — it is not a
 * fitted model.
 */
import type { ClinicalState, Prostate3DInputV1 } from "@/types/patient";
import type { CompassPredictions } from "@/types/prediction";
import { computeFunctionalOutcomes, modifiableFactorBreakdown } from "@/lib/compass/functionalOutcomes";

export type Level = "info" | "moderate" | "high";

export interface CounselingFlag {
  id: string;
  title: string;
  level: Level;
  /** plain-language explanation for the patient, one sentence per entry (translated per sentence) */
  detail: string[];
  /** what the patient can do / what the team will do */
  actions: string[];
  refs: string[];
  /** the clinical term, shown small for the care team */
  clinicalTerm?: string;
  /** one-line takeaway shown before "Tell me more" */
  summary: string;
}

export interface Milestone {
  id: string;
  label: string;
  /** days after surgery (0 = day of surgery) */
  minDay: number;
  maxDay: number;
  note?: string;
  refs: string[];
}

export interface PreopReference {
  key: string;
  citation: string;
  /** PubMed ID, when the reference is indexed there */
  pmid?: string;
  /**
   * true once the citation (authors, title, journal, year, pages) was matched
   * against PubMed. It does NOT mean a clinician has checked that the source
   * supports every number on the page — that review is still outstanding.
   */
  verified: boolean;
}

// Citations matched against PubMed on 2026-09-22.
export const PREOP_REFERENCES: PreopReference[] = [
  { key: "tewari2012", pmid: "22405509", verified: true, citation: "Tewari A, et al. Positive surgical margin and perioperative complication rates of primary surgical treatments for prostate cancer: a systematic review and meta-analysis comparing retropubic, laparoscopic, and robotic prostatectomy. Eur Urol. 2012;62(1):1-15." },
  { key: "novara2012", pmid: "22749853", verified: true, citation: "Novara G, et al. Systematic review and meta-analysis of perioperative outcomes and complications after robot-assisted radical prostatectomy. Eur Urol. 2012;62(3):431-52." },
  { key: "eras_rp", pmid: "32389010", verified: true, citation: "Ye Z, et al. Enhanced recovery after surgery (ERAS) might be a standard care in radical prostatectomy: a systematic review and meta-analysis. Ann Palliat Med. 2020;9(3):746-758." },
  { key: "asa", verified: true, citation: "American Society of Anesthesiologists. ASA Physical Status Classification System (last amended 2020)." },
  { key: "tollefson2014", pmid: "24140843", verified: true, citation: "Tollefson MK, et al. Blood type, lymphadenectomy and blood transfusion predict venous thromboembolic events following radical prostatectomy with pelvic lymphadenectomy. J Urol. 2014;191(3):646-51." },
  { key: "caprini", pmid: "20592595", verified: true, citation: "Caprini JA. Risk assessment as a guide to thrombosis prophylaxis. Curr Opin Pulm Med. 2010;16(5):448-52." },
  { key: "obesity_rarp", pmid: "18952266", verified: true, citation: "Wiltz AL, et al. Robotic radical prostatectomy in overweight and obese patients: oncological and validated-functional outcomes. Urology. 2009;73(2):316-22." },
  { key: "metsyn", pmid: "28220805", verified: true, citation: "Gacci M, et al. Meta-analysis of metabolic syndrome and prostate cancer. Prostate Cancer Prostatic Dis. 2017;20(2):146-155." },
  { key: "smoking_periop", pmid: "21295194", verified: true, citation: "Mills E, et al. Smoking cessation reduces postoperative complications: a systematic review and meta-analysis. Am J Med. 2011;124(2):144-154.e8." },
  { key: "osa_stopbang", pmid: "26378880", verified: true, citation: "Chung F, et al. STOP-Bang Questionnaire: a practical approach to screen for obstructive sleep apnea. Chest. 2016;149(3):631-8." },
  { key: "anticoag_periop", pmid: "35964704", verified: true, citation: "Douketis JD, et al. Perioperative management of antithrombotic therapy: an American College of Chest Physicians clinical practice guideline. Chest. 2022;162(5):e207-e243." },
  { key: "hostile_abdomen", pmid: "19896178", verified: true, citation: "Siddiqui SA, et al. The impact of previous inguinal or abdominal surgery on outcomes after robotic radical prostatectomy. Urology. 2010;75(5):1079-82." },
  { key: "pfmt", pmid: "20227168", verified: true, citation: "Centemero A, et al. Preoperative pelvic floor muscle exercise for early continence after radical prostatectomy: a randomised controlled study. Eur Urol. 2010;57(6):1039-43." },
  { key: "penile_rehab", pmid: "28262099", verified: true, citation: "Salonia A, et al. Sexual rehabilitation after treatment for prostate cancer — part 1: recommendations from the Fourth International Consultation for Sexual Medicine (ICSM 2015). J Sex Med. 2017;14(3):285-296." },
  { key: "prehab", pmid: "29937184", verified: true, citation: "Santa Mina D, et al. Prehabilitation for radical prostatectomy: a multicentre randomized controlled trial. Surg Oncol. 2018;27(2):289-298." },
  { key: "immunonutrition", pmid: "26654125", verified: true, citation: "Hamilton-Reeves JM, et al. Effects of immunonutrition for cystectomy on immune response and infection rates: a pilot randomized controlled clinical trial. Eur Urol. 2016;69(3):389-92. (Cystectomy data; extrapolation to prostatectomy is unproven.)" },
  { key: "psma_proPSMA", pmid: "32209449", verified: true, citation: "Hofman MS, et al. Prostate-specific membrane antigen PET-CT in patients with high-risk prostate cancer before curative-intent surgery or radiotherapy (proPSMA): a prospective, randomised, multicentre study. Lancet. 2020;395(10231):1208-1216." },
  { key: "catheter", pmid: "30413390", verified: true, citation: "Lista G, et al. Early catheter removal after robot-assisted radical prostatectomy: results from a prospective single-institutional randomized trial (Ripreca Study). Eur Urol Focus. 2020;6(2):259-266." },
];

/** Heuristic stretch applied to the upper bound of recovery ranges. */
export function recoveryStretch(S: ClinicalState): { factor: number; reasons: string[] } {
  const reasons: string[] = [];
  let f = 1;
  const add = (cond: boolean, w: number, why: string) => {
    if (cond) { f += w; reasons.push(why); }
  };
  add(S.bmi >= 30, 0.15, "BMI ≥ 30");
  add(S.bmi >= 35, 0.15, "BMI ≥ 35");
  add(S.asa_class >= 3, 0.25, `ASA class ${S.asa_class}`);
  add(S.age >= 70, 0.2, "age ≥ 70");
  add(S.prior_abdominal_surgery || S.hernia_mesh || S.crohns || S.ulcerative_colitis || S.diverticulitis, 0.15, "prior abdominal surgery / bowel disease");
  add(S.dm, 0.1, "diabetes");
  add(S.smoking === "current", 0.1, "current smoker");
  return { factor: Math.round(f * 100) / 100, reasons };
}

export function metabolicSyndromeCount(S: ClinicalState): number {
  // Proxy using what COMPASS records: obesity, diabetes, hypertension, statin use (≈ dyslipidaemia).
  return [S.bmi >= 30, S.dm, S.htn, S.statin].filter(Boolean).length;
}

export function counselingFlags(S: ClinicalState, P: CompassPredictions | null): CounselingFlag[] {
  const flags: CounselingFlag[] = [];
  const hostile = S.prior_abdominal_surgery || S.hernia_mesh || S.crohns || S.ulcerative_colitis
    || S.diverticulitis || S.pelvic_abscess || S.prior_pelvic_surgery || S.prior_pelvic_radiation;
  const plndLikely = !!P && P.lni >= 0.05;

  flags.push({
    id: "anesthesia",
    title: "Going to sleep for surgery",
    clinicalTerm: `Anesthesia · ASA ${S.asa_class}`,
    summary: S.asa_class >= 3 ? "Your anesthesia team will want to see you before surgery." : S.osa ? "Bring your CPAP; you'll be watched closely after surgery." : "Standard general anesthesia for about 2–4 hours.",
    level: S.asa_class >= 3 || S.osa ? "high" : S.asa_class === 2 ? "moderate" : "info",
    detail: [
      "Robotic prostatectomy is done under general anesthesia with you tilted head-down for 2–4 hours.",
      S.asa_class >= 3
        ? "Your other health conditions put you in a higher anesthesia-risk group, so the anesthesia team will likely want a pre-operative evaluation and may order heart or lung tests."
        : "Your anesthesia risk group is typical for this operation.",
      ...(S.osa ? ["Because you have sleep apnea, you'll be watched with continuous oxygen monitoring after surgery."] : []),
    ],
    actions: [
      "Bring a full list of your medications and supplements to pre-admission testing.",
      ...(S.osa ? ["Bring your CPAP machine to the hospital and use it every time you sleep."] : []),
      ...(S.cad ? ["Your cardiologist may need to clear you for surgery."] : []),
    ],
    refs: ["asa", ...(S.osa ? ["osa_stopbang"] : [])],
  });

  const ms = metabolicSyndromeCount(S);
  if (ms >= 2 || S.bmi >= 30) {
    flags.push({
      id: "metabolic",
      title: "Weight, blood sugar and blood pressure",
      clinicalTerm: "Metabolic syndrome",
      summary: "Losing a little weight and getting more active before surgery may help you recover faster.",
      level: ms >= 3 || S.bmi >= 35 ? "high" : "moderate",
      detail: [
        `You have ${ms} of the 4 metabolic-health warning signs we track (a BMI of 30 or more, diabetes, high blood pressure, high cholesterol).`,
        "These are linked to longer surgery, more wound and clot problems, and slower return of continence and erections.",
        "Losing even 5–10% of your body weight before surgery, together with regular exercise, may help your recovery.",
      ],
      actions: [
        "Aim for gradual weight loss (0.5–1 kg a week) if your surgery date allows.",
        ...(S.dm ? ["Get your blood sugar under good control. Your team may check HbA1c; a common target is below 8%."] : []),
        "Walk 30 minutes a day, most days of the week.",
      ],
      refs: ["metsyn", "obesity_rarp", "prehab"],
    });
  }

  if (hostile) {
    flags.push({
      id: "hostile",
      title: "Scar tissue from past operations",
      clinicalTerm: "Hostile abdomen / adhesions",
      summary: "Surgery may take a little longer. Tell your surgeon about every past operation.",
      level: S.prior_pelvic_radiation || S.pelvic_abscess ? "high" : "moderate",
      detail: [
        "Scar tissue (adhesions) from earlier operations, mesh, bowel inflammation or radiation can make it harder to reach the prostate.",
        "Your surgeon may need extra time to free up this scar tissue.",
        "The risk of bowel injury or switching to open surgery is low but higher than usual.",
      ],
      actions: ["Tell your surgeon about every previous operation, especially hernia repairs with mesh."],
      refs: ["hostile_abdomen"],
    });
  }

  const vteRisk = [S.age >= 60, S.bmi >= 30, plndLikely, S.smoking === "current", S.cad].filter(Boolean).length;
  flags.push({
    id: "dvt",
    title: "Preventing blood clots",
    clinicalTerm: "VTE / DVT / PE prophylaxis",
    summary: "Walking early and often is the best thing you can do.",
    level: vteRisk >= 3 ? "high" : vteRisk >= 1 ? "moderate" : "info",
    detail: [
      "Symptomatic blood clots after robotic prostatectomy are uncommon (about 0.5–1.5%).",
      "The risk is higher with older age and obesity.",
      ...(plndLikely ? ["Removing lymph nodes also raises the risk, and your predicted lymph-node risk suggests this may be part of your operation."] : []),
      "Compression boots are used during surgery.",
      "Walking early is the best prevention you can do yourself.",
    ],
    actions: [
      "Walk the evening of surgery and at least 4–5 times a day after that.",
      "Your team will decide whether you need blood-thinner injections after surgery.",
      "Go to the ER if you get calf swelling or pain, chest pain, or sudden shortness of breath.",
    ],
    refs: ["tollefson2014", "caprini"],
  });

  flags.push({
    id: "pneumonia",
    title: "Keeping your lungs healthy",
    clinicalTerm: "Postoperative pneumonia",
    summary: S.smoking === "current" ? "Stopping smoking now makes a real difference." : "Deep breaths and walking keep your lungs clear.",
    level: S.smoking === "current" || S.osa || S.age >= 75 ? "moderate" : "info",
    detail: [
      "Pneumonia after this operation is rare (under 1%).",
      "Smoking, sleep apnea and staying in bed raise the risk.",
      "Deep breathing and walking keep your lungs open.",
    ],
    actions: [
      "Use the incentive spirometer 10 times an hour while you're awake in hospital.",
      ...(S.smoking === "current" ? ["Stop smoking now. Quitting at least 4 weeks before surgery lowers complication rates."] : []),
    ],
    refs: ["smoking_periop", "novara2012"],
  });

  flags.push({
    id: "bleeding",
    title: "Bleeding",
    clinicalTerm: "Blood loss / transfusion",
    summary: S.anticoagulant ? "You'll get a written plan for when to stop and restart your blood thinner." : "Bleeding is usually small. Stop some pills and supplements 7 days before.",
    level: S.anticoagulant ? "high" : "info",
    detail: [
      "Blood loss is usually small with the robot (often 100–300 mL), and needing a transfusion is uncommon (about 1–2%).",
      ...(S.anticoagulant
        ? ["Because you take a blood thinner, your team will give you an exact plan for when to stop it and restart it (and whether you need a 'bridge' medication in between)."]
        : []),
    ],
    actions: [
      "Stop aspirin, NSAIDs (ibuprofen, naproxen), fish oil, vitamin E, garlic and ginkgo about 7 days before surgery unless your doctor tells you otherwise.",
      ...(S.anticoagulant ? ["Don't stop or restart your blood thinner on your own. Follow the written plan from your care team."] : []),
    ],
    refs: ["novara2012", ...(S.anticoagulant ? ["anticoag_periop"] : [])],
  });

  return flags;
}

/** PSMA-PET staging summary (interpretive, not a new model). */
export function psmaSummary(S: ClinicalState): { available: boolean; lines: string[] } {
  if (!S.psma_avail) return { available: false, lines: [] };
  const lines: string[] = [];
  lines.push(
    S.psma_epe ? "PSMA PET suggests the tumor may reach the edge of the prostate. This can affect nerve-sparing on that side."
      : "PSMA PET does not show tumor outside the prostate.",
  );
  lines.push(S.psma_svi ? "PSMA uptake in the seminal vesicles suggests they may be involved." : "No PSMA uptake in the seminal vesicles.");
  lines.push(
    S.psma_ln ? "PSMA PET shows lymph nodes that may be involved, so lymph-node removal is likely and additional treatment may be discussed."
      : "No suspicious lymph nodes on PSMA PET. PSMA can still miss very small deposits.",
  );
  if (S.suv) lines.push(`Highest PSMA uptake in the prostate (SUVmax) ≈ ${S.suv}. Higher values tend to go with more aggressive tumors.`);
  return { available: true, lines };
}

export function expectedCourse(S: ClinicalState, P: CompassPredictions | null) {
  const { factor } = recoveryStretch(S);
  const hi = (n: number) => Math.round(n * factor);
  return {
    stay: `Most men go home the next day (range 1–${hi(2)} nights)`,
    operation: `About 2–${Math.max(4, hi(3))} hours in the operating room`,
    catheter: `Urinary catheter for about 5–${hi(10)} days`,
    drain: "A small drain may be placed and is usually removed before you go home",
    pain: [
      "Pain is usually mild to moderate: gas pain in the shoulders and soreness at the incisions.",
      "The plan relies on acetaminophen (Tylenol) given on a schedule. Anti-inflammatories are used if your kidneys allow. Opioids are used rarely and in small amounts.",
      "Bladder spasms around the catheter are common and can be treated with medication.",
    ],
    meds: [
      "Stool softener while you are on pain medication and until your bowels are regular.",
      "Short antibiotic course when the catheter is removed, if your surgeon uses one.",
      ...(S.anticoagulant ? ["Restart your blood thinner according to the written plan."] : []),
      ...(S.pde5 !== "none" ? ["Erection-rehabilitation pill (for example tadalafil), usually started soon after catheter removal."] : []),
    ],
    special: [
      ...(P && P.lni >= 0.05 ? ["If lymph nodes are removed, a fluid collection (lymphocele) can form. Tell your team about new pelvic pain, leg swelling or fever."] : []),
      "Blood-tinged urine and scrotal or penile swelling are common in the first week.",
    ],
  };
}

export function recoveryMilestones(S: ClinicalState): Milestone[] {
  const { factor } = recoveryStretch(S);
  const m = (id: string, label: string, minDay: number, maxDay: number, note?: string, refs: string[] = ["eras_rp"]): Milestone =>
    ({ id, label, minDay, maxDay: Math.max(minDay, Math.round(maxDay * factor)), note, refs });
  return [
    m("npo", "Nothing to eat or drink", -1, 0, "Nothing from midnight before surgery, or as the anesthesia team tells you. Clear drinks may be allowed until 2 hours before."),
    m("clears", "Clear drinks (water, broth, juice)", 0, 0, "Evening of surgery"),
    m("soft", "Soft food (soup, yogurt, eggs)", 1, 1),
    m("regular", "Regular food, coffee", 1, 3, "Start with small meals. Coffee is fine once you're eating."),
    m("walk", "First walk", 0, 1, "The evening of surgery"),
    m("home", "Go home", 1, 2, undefined, ["novara2012", "eras_rp"]),
    m("shower", "Shower", 2, 3, "No baths or swimming until your incisions have healed (about 4 weeks)."),
    m("catheter", "Urine tube (catheter) comes out", 5, 10, undefined, ["catheter"]),
    m("dog", "Dog walking / longer walks", 3, 7, "Avoid dogs that pull hard on the leash for 4 weeks"),
    m("drive", "Driving", 7, 14, "Once the catheter is out, you're off opioids and you can brake hard without pain."),
    m("office", "Return to office / desk work", 7, 21),
    m("pfmt", "Pelvic-floor (Kegel) exercises again", 7, 12, "Once the catheter is out. You should start them BEFORE surgery.", ["pfmt"]),
    m("sex", "Sex and erection recovery", 21, 42, "Erections usually recover over 6–24 months.", ["penile_rehab"]),
    m("golf", "Golf (chipping/putting → full swing)", 21, 42),
    m("gym", "Gym and lifting more than 10–15 lb (4.5–7 kg)", 28, 42),
    m("sports", "Running, tennis and other sports", 35, 56),
    m("bike", "Cycling", 42, 56, "Saddle pressure on the perineum. A split or noseless saddle may help."),
    m("manual", "Heavy physical work", 42, 70),
  ];
}

export interface PrepSection { id: string; title: string; items: string[]; refs: string[] }

export function preparationPlan(S: ClinicalState): PrepSection[] {
  return [
    { id: "physical", title: "Physical training", refs: ["prehab"], items: [
      "Aerobic exercise 150 minutes a week (brisk walking, cycling, swimming).",
      "Strength training 2–3 times a week: legs, core and upper body.",
      "Build up gradually. Aim for 7,000–10,000 steps a day before surgery.",
    ] },
    { id: "urinary", title: "Urinary rehab (pelvic floor)", refs: ["pfmt"], items: [
      "Start pelvic-floor (Kegel) training at least 2–4 weeks before surgery, ideally taught by a pelvic-floor physiotherapist.",
      "A typical routine is 3 sets of 10 squeezes a day, holding each for 5–10 seconds, lying, sitting and standing.",
      `Your current training level: ${S.pfmt}. Starting early is linked to regaining continence sooner.`,
    ] },
    { id: "sexual", title: "Sexual rehab", refs: ["penile_rehab"], items: [
      "Talk about your goals and an erection-rehabilitation plan (PDE5 pills, vacuum device, injections) before surgery.",
      "Expect no ejaculation after surgery, and orgasm may feel different. Partners are welcome at this counseling visit.",
      "Consider sperm banking if you still plan to have children.",
    ] },
    { id: "metabolic", title: "Metabolic", refs: ["metsyn", "smoking_periop"], items: [
      ...(S.bmi >= 27 ? ["Losing 5–10% of your body weight before surgery may lower wound, clot and continence problems."] : ["Keep your weight stable."]),
      ...(S.dm ? ["Get good blood-sugar control. Bring your glucose log to pre-admission testing."] : []),
      ...(S.smoking === "current" ? ["Stop smoking now. At least 4 weeks smoke-free before surgery is best."] : []),
      "Limit alcohol to 7 or fewer drinks a week, and none in the 48 hours before surgery.",
    ] },
    { id: "nutrition", title: "Nutrition & supplements for healing", refs: ["immunonutrition"], items: [
      "Protein at every meal, about 1.2–1.5 g for every kg of body weight a day, from lean meat, fish, eggs, legumes and dairy or soy.",
      "Mediterranean-style diet: vegetables, fruit, whole grains, olive oil, nuts.",
      "Fiber and plenty of fluids to avoid constipation and straining after surgery.",
      "Ask your team before taking immunonutrition drinks (arginine or omega-3 shakes). The evidence for prostatectomy is limited.",
      "Stop herbal supplements that thin the blood 7 days before surgery: fish oil, vitamin E, garlic, ginkgo, turmeric.",
      "A daily vitamin D or multivitamin is fine unless you're told otherwise.",
    ] },
    { id: "oncological", title: "Oncological", refs: ["psma_proPSMA"], items: [
      "Make sure your staging is complete: MRI, PSMA PET if indicated, and genomic testing if it was done.",
      "Your first PSA check is usually 6–8 weeks after surgery. An undetectable level is the goal.",
      "Ask how your final pathology might lead to additional treatment (radiation or hormone therapy).",
    ] },
    { id: "emotional", title: "Emotional", refs: [], items: [
      "It's normal to feel anxious. Write down your questions and bring a support person to visits.",
      "Peer support groups (for example Us TOO or ZERO) and counseling services are available.",
      "Plan help at home for the first week, and time off work.",
    ] },
  ];
}

/** Compact, identifier-free summary for the AI narrative. */
export function counselingContext(S: ClinicalState, P: CompassPredictions | null) {
  return {
    age: S.age, bmi: S.bmi, asa_class: S.asa_class, diabetes: S.dm, hypertension: S.htn, cad: S.cad,
    osa: S.osa, anticoagulant: S.anticoagulant, smoking: S.smoking,
    prior_abdominal_surgery: S.prior_abdominal_surgery, hernia_mesh: S.hernia_mesh,
    prior_pelvic_radiation: S.prior_pelvic_radiation,
    grade_group: S.gg, psa: S.psa, psma: psmaSummary(S).lines,
    predicted_lni: P ? Math.round(P.lni * 100) : null,
    predicted_bcr: P ? Math.round(P.bcr * 100) : null,
    recovery_stretch: recoveryStretch(S),
    flags: counselingFlags(S, P).map((f) => ({ title: f.title, level: f.level })),
  };
}

/* ── Patient checklist, red flags, questions ─────────────────────────────── */

export interface ChecklistItem {
  id: string;
  text: string;
  /** days relative to surgery when this should be done by (negative = before) */
  byDay: number;
}

export function preopChecklist(S: ClinicalState): ChecklistItem[] {
  const items: ChecklistItem[] = [
    { id: "kegel", text: "Start daily pelvic-floor (Kegel) exercises", byDay: -28 },
    { id: "walk", text: "Walk 30 minutes a day", byDay: -28 },
    ...(S.smoking === "current" ? [{ id: "smoke", text: "Stop smoking (4 or more weeks before is best)", byDay: -28 }] : []),
    ...(S.bmi >= 30 ? [{ id: "weight", text: "Start gradual weight loss with your care team", byDay: -28 }] : []),
    ...(S.dm ? [{ id: "sugar", text: "Check your blood sugar daily and bring your log", byDay: -14 }] : []),
    { id: "time_off", text: "Arrange 1–3 weeks off work", byDay: -14 },
    { id: "helper", text: "Arrange someone to drive you home and help for the first week", byDay: -14 },
    { id: "supplements", text: "Stop aspirin, ibuprofen, fish oil, vitamin E, garlic and ginkgo (unless told otherwise)", byDay: -7 },
    ...(S.anticoagulant ? [{ id: "anticoag", text: "Follow your written plan for stopping your blood thinner", byDay: -7 }] : []),
    { id: "meds_list", text: "Write down all your medicines and supplements", byDay: -7 },
    { id: "groceries", text: "Stock up on high-fiber food, fluids and a stool softener", byDay: -3 },
    { id: "clothes", text: "Pack loose trousers and a button shirt", byDay: -1 },
    ...(S.osa ? [{ id: "cpap", text: "Pack your CPAP machine", byDay: -1 }] : []),
    { id: "npo", text: "Nothing to eat after midnight (follow the anesthesia team's instructions)", byDay: -1 },
  ];
  return items;
}

export const RED_FLAGS: string[] = [
  "Fever of 101°F (38.3°C) or higher, or shaking chills",
  "Swelling, pain or redness in one calf or leg",
  "Chest pain or sudden shortness of breath (call 911)",
  "No urine draining from the catheter for 2 hours, or the catheter falls out",
  "Heavy bleeding, or urine thick like ketchup with clots",
  "Pain not controlled by your medicines, or a swollen, hard belly",
  "Vomiting and unable to keep fluids down",
  "Redness, pus or opening at an incision",
];

export const QUESTION_BANK: string[] = [
  "Will you try to save the nerves on both sides?",
  "Do I need my lymph nodes removed?",
  "How long will I have the catheter?",
  "When can I go back to work?",
  "What can I do now to help my continence recover?",
  "What is the plan for erection recovery?",
  "When will I get my pathology results, and what happens next?",
  "Which of my medicines should I stop, and when?",
  "Who do I call at night or on the weekend?",
];

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/* ── Likely functional / oncological outcomes ────────────────────────────── */

const pick = <T extends string>(v: string, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

export interface LikelyOutcomes {
  /** % of men dry (0–1 pad) at [6 wk, 3 mo, 6 mo, 12 mo, 18 mo] */
  continence: number[];
  /** % with erections firm enough for sex at the same timepoints; null if baseline SHIM < 12 */
  potency: number[] | null;
  /** % chance PSA rises again (biochemical recurrence) */
  recurrence: number | null;
}

export const OUTCOME_TIMEPOINTS = ["6 weeks", "3 months", "6 months", "12 months", "18 months"];

function lifestyleInputs(S: ClinicalState) {
  return {
    age: S.age, shim: S.shim, ipss: S.ipss, bmi: S.bmi,
    pfmt: pick(S.pfmt, ["none", "basic", "moderate", "intensive"] as const, "basic"),
    exercise: pick(S.exercise, ["sedentary", "light", "moderate", "active"] as const, "moderate"),
    smoking: pick(S.smoking, ["never", "former", "current"] as const, "never"),
    pde5: pick(S.pde5, ["none", "prn", "daily"] as const, "prn"),
    alcohol: pick(S.alcohol, ["none", "moderate", "heavy"] as const, "moderate"),
    diet: pick(S.diet ?? "average", ["favorable", "average", "high_saturated_fat"] as const, "average"),
    dm: S.dm, htn: S.htn, cad: S.cad,
  };
}

/** Same inputs the Functional Outcomes panel uses, scored at the planned NS grade. */
export function likelyOutcomes(S: ClinicalState, P: CompassPredictions | null): LikelyOutcomes | null {
  if (!P) return null;
  const grade = (g: number) => Math.min(3, Math.max(1, Math.round(g)));
  const r = computeFunctionalOutcomes({
    nsL: grade(P.plan.left.nsGrade),
    nsR: grade(P.plan.right.nsGrade),
    ...lifestyleInputs(S),
    plan: {
      hood: P.plan.hood.value,
      bnPreservation: P.plan.bladderNeckPreservation.value,
      svPreservationL: P.plan.left.svPreservation.value,
      svPreservationR: P.plan.right.svPreservation.value,
      hydrodissectionL: P.plan.left.hydrodissection.value,
      hydrodissectionR: P.plan.right.hydrodissection.value,
      inflammationTier: P.inflammation.tier,
    },
  });
  const pct = (v: number) => Math.round(Math.min(99, Math.max(1, v)));
  return {
    continence: r.continenceTimeline.map(pct),
    potency: r.shimValid ? r.potencyTimeline.map((v) => pct(v ?? 0)) : null,
    recurrence: Math.round(P.bcr * 100),
  };
}

/* ── Clinician review stamp ──────────────────────────────────────────────── */

/**
 * Fingerprint of everything that personalizes the counseling page. Stored
 * with the sign-off so the page can say "changed since review".
 */
export function counselingFingerprint(S: ClinicalState, P: CompassPredictions | null): string {
  const s = JSON.stringify(counselingContext(S, P));
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/* ── Dates, language and the printable sheet ─────────────────────────────── */

export type Lang = "en" | "es";

const locale = (lang: Lang) => (lang === "es" ? "es-US" : "en-US");
export const fmtLong = (d: Date, lang: Lang = "en") =>
  d.toLocaleDateString(locale(lang), { weekday: "short", month: "short", day: "numeric" });
export const fmtShort = (d: Date, lang: Lang = "en") =>
  d.toLocaleDateString(locale(lang), { month: "short", day: "numeric" });

/** Relative label for a day offset, in English (translate with `tr`). */
export function relDay(d: number): string {
  if (d < 0) return "Night before";
  if (d === 0) return "Surgery day";
  if (d < 14) return `Day ${d}`;
  return `Week ${Math.round(d / 7)}`;
}

export function parseSurgeryDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}

/** Days since surgery (negative = before). Null without a date. */
export function daysFromSurgery(surgery: Date | null, today = new Date()): number | null {
  if (!surgery) return null;
  const t = new Date(today); t.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - surgery.getTime()) / 86_400_000);
}

export function whenText(m: Milestone, surgery: Date | null, lang: Lang, tr: (s: string) => string): string {
  if (surgery) {
    const a = fmtShort(addDays(surgery, m.minDay), lang), b = fmtShort(addDays(surgery, m.maxDay), lang);
    return m.minDay === m.maxDay ? a : `${a} – ${b}`;
  }
  return m.minDay === m.maxDay ? tr(relDay(m.minDay)) : `${tr(relDay(m.minDay))} – ${tr(relDay(m.maxDay))}`;
}

export interface PrintInput {
  S: ClinicalState;
  surgery: Date | null;
  done: string[];
  questions: string[];
  review: Prostate3DInputV1["preop_review"];
  reviewCurrent: boolean;
  clinicPhone: string;
  lang: Lang;
  tr: (s: string) => string;
}

export function buildPrintHtml({ S, surgery, done, questions, review, reviewCurrent, clinicPhone, lang, tr }: PrintInput): string {
  const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const T = (s: string) => esc(tr(s));
  const reviewLine = review && reviewCurrent
    ? `${T("Reviewed by")} ${esc(review.reviewer)} · ${esc(fmtLong(new Date(review.date), lang))}`
    : T("Not yet reviewed by your care team");
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${T("My surgery plan")}</title><style>
    body{font:14px/1.45 system-ui,sans-serif;color:#111;max-width:720px;margin:24px auto;padding:0 16px}
    h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:18px 0 6px;border-bottom:1px solid #999;padding-bottom:3px}
    table{width:100%;border-collapse:collapse}td{padding:3px 0;vertical-align:top}td:last-child{text-align:right;font-weight:600;white-space:nowrap;padding-left:12px}
    .flags{border:2px solid #b3261e;padding:8px 12px;border-radius:8px}.small{font-size:11px;color:#444}ul{margin:4px 0;padding-left:20px}
    .box{display:inline-block;width:12px;height:12px;border:1px solid #333;margin-right:6px;vertical-align:-1px;text-align:center;line-height:12px;font-size:11px}
    .review{font-size:12px;padding:4px 8px;border:1px solid #999;border-radius:6px;display:inline-block;margin-top:6px}
  </style></head><body>
  <h1>${T("My surgery plan")}</h1>
  <div>${T("Surgery date")}: ${surgery ? `<b>${esc(fmtLong(surgery, lang))}</b>` : "______________"}</div>
  <div class="review">${reviewLine}</div>
  <h2>${T("Before surgery")}</h2>
  ${preopChecklist(S).map((i) => `<div><span class="box">${done.includes(i.id) ? "✓" : ""}</span>${T(i.text)}${surgery ? ` <span class="small">(${T("by")} ${esc(fmtShort(addDays(surgery, i.byDay), lang))})</span>` : ""}</div>`).join("\n")}
  <h2>${T("When can I…?")}</h2>
  <table>${recoveryMilestones(S).map((m) => `<tr><td>${T(m.label)}</td><td>${esc(whenText(m, surgery, lang, tr))}</td></tr>`).join("")}</table>
  <h2>${T("When to call us right away")}</h2>
  <div class="flags"><div>${clinicPhone ? `${T("Call")} <b>${esc(clinicPhone)}</b>` : `${T("Call your surgeon's office")}: ______________`}</div>
  <ul>${RED_FLAGS.map((f) => `<li>${T(f)}</li>`).join("")}</ul><b>${T("For chest pain or trouble breathing, call 911.")}</b></div>
  ${questions.length ? `<h2>${T("My questions")}</h2><ul>${questions.map((q) => `<li>${T(q)}</li>`).join("")}</ul>` : ""}
  <p class="small">${T("Research use only (IRB STUDY-14-00050). These are typical ranges from published studies, not a promise. Always follow your surgical team's instructions.")}</p>
  </body></html>`;
}

/* ── What the patient can still improve ──────────────────────────────────── */

export const OPPORTUNITY_TEXT: Record<string, string> = {
  "BMI": "Reach a healthier weight (BMI under 25)",
  "Pelvic floor training": "Do pelvic-floor (Kegel) exercises every day",
  "Exercise": "Be active most days",
  "PDE5 inhibitor": "Take a daily erection-rehab pill, if your doctor agrees",
  "Smoking": "Quit smoking",
  "Diet": "Eat lean protein and healthy fats",
  "Alcohol": "Cut out alcohol",
  "Voiding symptoms (IPSS)": "Get bothersome urinary symptoms treated before surgery (ask your doctor)",
};

export interface Opportunity { label: string; text: string; erections: number; bladder: number }

/** Modifiable levers with room left, biggest combined gain first (points at 12 months). */
export function recoveryOpportunities(S: ClinicalState): Opportunity[] {
  return modifiableFactorBreakdown(lifestyleInputs(S))
    .filter((r) => r.modifiable && r.potGain + r.contGain > 0)
    .map((r) => ({ label: r.label, text: OPPORTUNITY_TEXT[r.label] ?? r.label, erections: Math.round(r.potGain), bladder: Math.round(r.contGain) }))
    .sort((a, b) => b.erections + b.bladder - (a.erections + a.bladder));
}
