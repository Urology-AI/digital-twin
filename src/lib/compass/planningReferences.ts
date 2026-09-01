/**
 * Bibliography for the surgical-planning and functional-outcome evidence
 * (`planningEvidence.ts`).
 *
 * Mount Sinai / Tewari-group work is listed first. Author/year handles were
 * compiled from working knowledge; `verified` stays `false` until each entry is
 * checked against PubMed / the DOI. Do not present any of this as clinically
 * validated until that pass is done.
 */

export interface PlanningReference {
  key: string;
  authors: string;
  title: string;
  source: string; // journal, year, volume:pages
  group: "tewari" | "external";
  /** which evidence groups in planningEvidence.ts lean on this reference */
  usedFor: string[];
  /** true once checked against PubMed / DOI by a human */
  verified: boolean;
}

export const PLANNING_REFERENCES: PlanningReference[] = [
  // ── Mount Sinai / Tewari group ──────────────────────────────────────────
  {
    key: "tewari2011",
    authors: "Tewari AK, Srivastava A, Huang MW, et al.",
    title:
      "Anatomical grades of nerve sparing: a risk-stratified approach to neural-hammock sparing during robot-assisted radical prostatectomy.",
    source: "BJU Int. 2011;108(6 Pt 2):984-92.",
    group: "tewari",
    usedFor: ["NS grade model", "Fascial-plane nomenclature", "Minimal-disease eligibility", "NVB anatomy alerts"],
    verified: false,
  },
  {
    key: "srivastava2013",
    authors: "Srivastava A, Chopra S, Pham A, et al.",
    title:
      "Effect of a risk-stratified grade of nerve-sparing technique on early return of continence after robot-assisted laparoscopic radical prostatectomy.",
    source: "Eur Urol. 2013;63(3):438-44.",
    group: "tewari",
    usedFor: ["Minimal-disease eligibility", "Inflammation → grade escalation", "Functional-outcome nomogram", "Plan functional deltas"],
    verified: false,
  },
  {
    key: "tewari2013athermal",
    authors: "Tewari AK, Ali A, Metgud S, et al.",
    title:
      "Functional outcomes following robotic prostatectomy using athermal, traction-free risk-stratified grades of nerve sparing.",
    source: "World J Urol. 2013;31(3):471-80.",
    group: "tewari",
    usedFor: ["Fascial-plane nomenclature & athermal technique", "Functional-outcome nomogram"],
    verified: false,
  },
  {
    key: "pedraza2026saline",
    authors: "Pedraza AM, Fatterpekar M, Joshi H, Choudhary M, Kacagan C, Mandel A, et al., Tewari AK.",
    title:
      "Saline-assisted Fascial Exposure Microultrasound-guided Nerve Preservation During Robotic Prostatectomy: Interim Analysis of a Randomized Controlled Trial.",
    source: "European Urology Oncology, 2026 (in press).",
    group: "tewari",
    usedFor: ["Hydrodissection"],
    verified: false,
  },
  {
    key: "tewari2008competing",
    authors: "Tewari A, Rao S, Martinez-Salamanca JI, et al.",
    title:
      "Cancer control and the preservation of neurovascular tissue: how to meet competing goals during robotic radical prostatectomy.",
    source: "BJU Int. 2008;101(8):1013-8.",
    group: "tewari",
    usedFor: ["Inflammation → grade escalation", "Inflammation-risk framing", "Hydrodissection"],
    verified: false,
  },
  {
    key: "tewari2007anatomic",
    authors: "Tewari A, Bigelow K, Rao S, et al.",
    title:
      "Anatomic restoration technique of continence mechanism and preservation of puboprostatic collar: a novel modification to achieve early urinary continence in men undergoing robotic prostatectomy.",
    source: "Urology. 2007;69(4):726-31.",
    group: "tewari",
    usedFor: ["Anterior hood candidacy", "Bladder-neck preservation candidacy", "Plan functional deltas"],
    verified: false,
  },
  {
    key: "tewari2003anatomy",
    authors: "Tewari A, Peabody JO, Fischer M, et al.",
    title:
      "An operative and anatomic study to help in nerve sparing during laparoscopic and robotic radical prostatectomy.",
    source: "Eur Urol. 2003;43(5):444-54.",
    group: "tewari",
    usedFor: ["Zone dissection-alert thresholds (NVB course)"],
    verified: false,
  },
  {
    key: "martini2018",
    authors: "Martini A, Gupta A, Lewis SC, et al.",
    title:
      "Development and internal validation of a side-specific, multiparametric MRI-based nomogram for the prediction of extracapsular extension of prostate cancer.",
    source: "BJU Int. 2018;122(6):1025-1033.",
    group: "tewari",
    usedFor: ["Per-zone NS-grade ECE thresholds", "Zonal ECE distribution"],
    verified: false,
  },
  {
    key: "sooriakumaran2014",
    authors: "Sooriakumaran P, Srivastava A, Shariat SF, et al.",
    title:
      "A multinational, multi-institutional study comparing positive surgical margin rates among 22393 open, laparoscopic, and robot-assisted radical prostatectomy patients.",
    source: "Eur Urol. 2014;66(3):450-6.",
    group: "tewari",
    usedFor: ["Plan effect on positive-margin rate"],
    verified: false,
  },

  // ── External landmark references ────────────────────────────────────────
  {
    key: "rosenberg2020",
    authors: "Rosenberg JE, Jung JH, Edgerton Z, et al.",
    title:
      "Retzius-sparing versus standard robot-assisted radical prostatectomy for clinically localised prostate cancer.",
    source: "Cochrane Database Syst Rev. 2020;8(8):CD013641.",
    group: "external",
    usedFor: ["Anterior hood candidacy", "Plan functional deltas"],
    verified: false,
  },
  {
    key: "dalela2017",
    authors: "Dalela D, Jeong W, Prasad MA, et al.",
    title:
      "A pragmatic randomized controlled trial examining the impact of the Retzius-sparing approach on early urinary continence recovery after robot-assisted radical prostatectomy.",
    source: "Eur Urol. 2017;72(5):677-685.",
    group: "external",
    usedFor: ["Anterior hood candidacy"],
    verified: false,
  },
  {
    key: "galfano2013",
    authors: "Galfano A, Di Trapani D, Sozzi F, et al.",
    title:
      "Beyond the learning curve of the Retzius-sparing approach for robot-assisted radical prostatectomy: oncologic and functional results of the first 200 patients with ≥1 year of follow-up.",
    source: "Eur Urol. 2013;64(6):974-80.",
    group: "external",
    usedFor: ["Anterior hood candidacy"],
    verified: false,
  },
  {
    key: "ma2016",
    authors: "Ma X, Tang K, Yang C, et al.",
    title:
      "Bladder neck preservation improves time to continence after radical prostatectomy: a systematic review and meta-analysis.",
    source: "Oncotarget. 2016;7(41):67463-67475.",
    group: "external",
    usedFor: ["Bladder-neck preservation candidacy", "Plan functional deltas"],
    verified: false,
  },
  {
    key: "nyarangidix2013",
    authors: "Nyarangi-Dix JN, Radtke JP, Hadaschik B, et al.",
    title:
      "Impact of complete bladder neck preservation on urinary continence, quality of life and surgical margins after radical prostatectomy: a randomized, controlled, single blind trial.",
    source: "J Urol. 2013;189(3):891-8.",
    group: "external",
    usedFor: ["Bladder-neck preservation candidacy"],
    verified: false,
  },
  {
    key: "kowalczyk2011",
    authors: "Kowalczyk KJ, Huang AC, Hevelone ND, et al.",
    title:
      "Stepwise approach for nerve sparing without countertraction during robot-assisted radical prostatectomy: technique and outcomes.",
    source: "Eur Urol. 2011;60(3):536-47.",
    group: "external",
    usedFor: ["Hydrodissection"],
    verified: false,
  },
  {
    key: "john2000",
    authors: "John H, Hauri D.",
    title:
      "Seminal vesicle-sparing radical prostatectomy: a novel concept to restore early urinary continence.",
    source: "Urology. 2000;55(6):820-4.",
    group: "external",
    usedFor: ["Seminal-vesicle tip-sparing candidacy"],
    verified: false,
  },
  {
    key: "zlotta2004",
    authors:
      "Zlotta AR, Roumeguère T, Ravery V, Hoffmann P, Montorsi F, Türkeri L, et al.; European Society for Urological Oncology.",
    title:
      "Is seminal vesicle ablation mandatory for all patients undergoing radical prostatectomy? A multivariate analysis on 1283 patients.",
    source: "Eur Urol. 2004;46(1):42-49.",
    group: "external",
    usedFor: ["Seminal-vesicle tip-sparing candidacy"],
    verified: true,
  },
  {
    key: "han2003",
    authors: "Han M, Partin AW, Zahurak M, et al.",
    title:
      "Biochemical (prostate specific antigen) recurrence probability following radical prostatectomy for clinically localized prostate cancer.",
    source: "J Urol. 2003;169(2):517-23.",
    group: "external",
    usedFor: ["BCR event-timing fractions"],
    verified: false,
  },
  {
    key: "freedland2005",
    authors: "Freedland SJ, Humphreys EB, Mangold LA, et al.",
    title:
      "Risk of prostate cancer-specific mortality following biochemical recurrence after radical prostatectomy.",
    source: "JAMA. 2005;294(4):433-9.",
    group: "external",
    usedFor: ["BCR event-timing fractions"],
    verified: false,
  },
  {
    key: "cao2011",
    authors: "Cao Y, Ma J.",
    title:
      "Body mass index, prostate cancer-specific mortality, and biochemical recurrence: a systematic review and meta-analysis.",
    source: "Cancer Prev Res (Phila). 2011;4(4):486-501.",
    group: "external",
    usedFor: ["Obesity → BCR risk"],
    verified: false,
  },
  {
    key: "hofman2020",
    authors: "Hofman MS, Lawrentschuk N, Francis RJ, et al.",
    title:
      "Prostate-specific membrane antigen PET-CT in patients with high-risk prostate cancer before curative-intent surgery or radiotherapy (proPSMA): a prospective, randomised, multicentre study.",
    source: "Lancet. 2020;395(10231):1208-1216.",
    group: "external",
    usedFor: ["Zone dissection-alert thresholds (PSMA-at-base ECE rate)"],
    verified: false,
  },
  {
    key: "preisser2019",
    authors: "Preisser F, et al.",
    title: "Positive surgical margin length and grade at the margin and biochemical recurrence after radical prostatectomy.",
    source: "Prostate / Eur Urol Focus, 2019 (verify).",
    group: "external",
    usedFor: ["Per-zone NS-grade ECE thresholds", "Zone dissection-alert thresholds"],
    verified: false,
  },
  {
    key: "mandel2016",
    authors: "Mandel P, Steuber T, Ahyai S, et al.",
    title:
      "Salvage radical prostatectomy for recurrent prostate cancer: verification of EAU guideline criteria.",
    source: "BJU Int. 2016;117(1):55-61.",
    group: "external",
    usedFor: ["Inflammation-risk weights (prior pelvic radiation)"],
    verified: false,
  },
  {
    key: "ball2015",
    authors: "Ball MW, et al.",
    title: "Extent of extraprostatic extension and biochemical recurrence after radical prostatectomy.",
    source: "Urology, 2015 (verify).",
    group: "external",
    usedFor: ["Zonal ECE distribution"],
    verified: false,
  },
  {
    key: "ficarra2012",
    authors: "Ficarra V, Novara G, Ahlering TE, et al.",
    title:
      "Systematic review and meta-analysis of studies reporting potency rates after robot-assisted radical prostatectomy.",
    source: "Eur Urol. 2012;62(3):418-30.",
    group: "external",
    usedFor: ["Functional-outcome nomogram (recovery trajectory)"],
    verified: false,
  },
];

export const REFERENCES_VERIFIED = PLANNING_REFERENCES.every((r) => r.verified);

/**
 * Link for a reference. We deliberately do not hard-code DOIs/PMIDs (the
 * citations above are compiled from working knowledge and unverified), so every
 * link is an exact-title search — deterministic and lands on the paper without
 * risking a wrong identifier. Europe PMC (not PubMed) because PubMed's result
 * page requires first-party cookies and refuses to render inside our preview
 * modal's iframe.
 */
export function refLink(r: PlanningReference): string {
  const title = r.title.replace(/\.$/, "");
  return `https://europepmc.org/search?query=${encodeURIComponent(title)}`;
}

/** References whose `usedFor` intersects any of the given feature tags. */
export function referencesFor(...tags: string[]): PlanningReference[] {
  const want = new Set(tags);
  return PLANNING_REFERENCES.filter((r) => r.usedFor.some((u) => want.has(u)));
}
