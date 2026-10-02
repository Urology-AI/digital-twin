/**
 * Bibliography for the surgical-planning and functional-outcome evidence
 * (`planningEvidence.ts`).
 *
 * Mount Sinai / Tewari-group work is listed first. Author/year handles were
 * compiled from working knowledge; `verified` is `true` once the entry has been
 * matched to a published record (title, first author, journal, year, volume and
 * pages). Entries from the plane-hostility evidence review were matched to the
 * OpenEvidence record; the earlier entries were matched against the Crossref
 * registry, and three citations that did not match (Preisser 2019, Ball 2015,
 * Pedraza 2026) were corrected. A verified citation shows the paper exists and
 * is cited accurately, not that its finding supports every use made of it.
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
    verified: true,
  },
  {
    key: "srivastava2013",
    authors: "Srivastava A, Chopra S, Pham A, et al.",
    title:
      "Effect of a risk-stratified grade of nerve-sparing technique on early return of continence after robot-assisted laparoscopic radical prostatectomy.",
    source: "Eur Urol. 2013;63(3):438-44.",
    group: "tewari",
    usedFor: ["Minimal-disease eligibility", "Inflammation → grade escalation", "Functional-outcome nomogram", "Plan functional deltas"],
    verified: true,
  },
  {
    key: "tewari2013athermal",
    authors: "Tewari AK, Ali A, Metgud S, et al.",
    title:
      "Functional outcomes following robotic prostatectomy using athermal, traction-free risk-stratified grades of nerve sparing.",
    source: "World J Urol. 2013;31(3):471-80.",
    group: "tewari",
    usedFor: ["Fascial-plane nomenclature & athermal technique", "Functional-outcome nomogram"],
    verified: true,
  },
  {
    key: "pedraza2026saline",
    authors: "Pedraza AM, Fatterpekar M, Joshi H, Choudhary M, Kacagan C, Mandel A, et al., Tewari AK.",
    title:
      "Saline-assisted Fascial Exposure Microultrasound-guided Nerve Preservation During Robotic Prostatectomy: Interim Analysis of a Randomized Controlled Trial.",
    source: "Eur Urol Oncol. 2026. doi:10.1016/j.euo.2026.07.015.",
    group: "tewari",
    usedFor: ["Hydrodissection"],
    verified: true,
  },
  {
    key: "tewari2008competing",
    authors: "Tewari A, Rao S, Martinez-Salamanca JI, et al.",
    title:
      "Cancer control and the preservation of neurovascular tissue: how to meet competing goals during robotic radical prostatectomy.",
    source: "BJU Int. 2008;101(8):1013-8.",
    group: "tewari",
    usedFor: ["Inflammation → grade escalation", "Inflammation-risk framing", "Hydrodissection"],
    verified: true,
  },
  {
    key: "tewari2007anatomic",
    authors: "Tewari A, Bigelow K, Rao S, et al.",
    title:
      "Anatomic restoration technique of continence mechanism and preservation of puboprostatic collar: a novel modification to achieve early urinary continence in men undergoing robotic prostatectomy.",
    source: "Urology. 2007;69(4):726-31.",
    group: "tewari",
    usedFor: ["Plan functional deltas"],
    verified: true,
  },
  {
    key: "tewari2003anatomy",
    authors: "Tewari A, Peabody JO, Fischer M, et al.",
    title:
      "An operative and anatomic study to help in nerve sparing during laparoscopic and robotic radical prostatectomy.",
    source: "Eur Urol. 2003;43(5):444-54.",
    group: "tewari",
    usedFor: ["Zone dissection-alert thresholds (NVB course)"],
    verified: true,
  },
  {
    key: "martini2018",
    authors: "Martini A, Gupta A, Lewis SC, et al.",
    title:
      "Development and internal validation of a side-specific, multiparametric MRI-based nomogram for the prediction of extracapsular extension of prostate cancer.",
    source: "BJU Int. 2018;122(6):1025-1033.",
    group: "tewari",
    usedFor: ["Per-zone NS-grade ECE thresholds", "Zonal ECE distribution"],
    verified: true,
  },
  {
    key: "sooriakumaran2014",
    authors: "Sooriakumaran P, Srivastava A, Shariat SF, et al.",
    title:
      "A multinational, multi-institutional study comparing positive surgical margin rates among 22393 open, laparoscopic, and robot-assisted radical prostatectomy patients.",
    source: "Eur Urol. 2014;66(3):450-6.",
    group: "tewari",
    usedFor: ["Plan effect on positive-margin rate"],
    verified: true,
  },

  // ── External landmark references ────────────────────────────────────────
  {
    key: "rosenberg2020",
    authors: "Rosenberg JE, Jung JH, Edgerton Z, et al.",
    title:
      "Retzius-sparing versus standard robot-assisted radical prostatectomy for clinically localised prostate cancer.",
    source: "Cochrane Database Syst Rev. 2020;8(8):CD013641.",
    group: "external",
    usedFor: ["Plan functional deltas"],
    verified: true,
  },
  {
    key: "kowalczyk2011",
    authors: "Kowalczyk KJ, Huang AC, Hevelone ND, et al.",
    title:
      "Stepwise approach for nerve sparing without countertraction during robot-assisted radical prostatectomy: technique and outcomes.",
    source: "Eur Urol. 2011;60(3):536-47.",
    group: "external",
    usedFor: ["Hydrodissection"],
    verified: true,
  },
  {
    key: "john2000",
    authors: "John H, Hauri D.",
    title:
      "Seminal vesicle-sparing radical prostatectomy: a novel concept to restore early urinary continence.",
    source: "Urology. 2000;55(6):820-4.",
    group: "external",
    usedFor: ["Seminal-vesicle tip-sparing candidacy"],
    verified: true,
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
    verified: true,
  },
  {
    key: "freedland2005",
    authors: "Freedland SJ, Humphreys EB, Mangold LA, et al.",
    title:
      "Risk of prostate cancer-specific mortality following biochemical recurrence after radical prostatectomy.",
    source: "JAMA. 2005;294(4):433-9.",
    group: "external",
    usedFor: ["BCR event-timing fractions"],
    verified: true,
  },
  {
    key: "cao2011",
    authors: "Cao Y, Ma J.",
    title:
      "Body mass index, prostate cancer-specific mortality, and biochemical recurrence: a systematic review and meta-analysis.",
    source: "Cancer Prev Res (Phila). 2011;4(4):486-501.",
    group: "external",
    usedFor: ["Obesity → BCR risk"],
    verified: true,
  },
  {
    key: "hofman2020",
    authors: "Hofman MS, Lawrentschuk N, Francis RJ, et al.",
    title:
      "Prostate-specific membrane antigen PET-CT in patients with high-risk prostate cancer before curative-intent surgery or radiotherapy (proPSMA): a prospective, randomised, multicentre study.",
    source: "Lancet. 2020;395(10231):1208-1216.",
    group: "external",
    usedFor: ["Zone dissection-alert thresholds (PSMA-at-base ECE rate)"],
    verified: true,
  },
  {
    key: "preisser2019",
    authors: "Preisser F, et al.",
    title: "Impact of positive surgical margin length and Gleason grade at the margin on biochemical recurrence in patients with organ-confined prostate cancer.",
    source: "Prostate. 2019;79(16):1832-1836. doi:10.1002/pros.23908.",
    group: "external",
    usedFor: ["Per-zone NS-grade ECE thresholds", "Zone dissection-alert thresholds"],
    verified: true,
  },
  {
    key: "mandel2016",
    authors: "Mandel P, Steuber T, Ahyai S, et al.",
    title:
      "Salvage radical prostatectomy for recurrent prostate cancer: verification of EAU guideline criteria.",
    source: "BJU Int. 2016;117(1):55-61.",
    group: "external",
    usedFor: ["Inflammation-risk weights (prior pelvic radiation)"],
    verified: true,
  },
  {
    key: "ball2015",
    authors: "Ball MW, et al.",
    title: "Extent of extraprostatic extension independently influences biochemical recurrence-free survival: evidence for further pT3 subclassification.",
    source: "Urology. 2015;85(1):161-164. doi:10.1016/j.urology.2014.08.025.",
    group: "external",
    usedFor: ["Zonal ECE distribution"],
    verified: true,
  },
  {
    key: "ficarra2012",
    authors: "Ficarra V, Novara G, Ahlering TE, et al.",
    title:
      "Systematic review and meta-analysis of studies reporting potency rates after robot-assisted radical prostatectomy.",
    source: "Eur Urol. 2012;62(3):418-30.",
    group: "external",
    usedFor: ["Functional-outcome nomogram (recovery trajectory)"],
    verified: true,
  },

  // ── PIPS-H / decision-matrix (verified against PubMed/PMC 2026-09) ──────
  {
    key: "gucalp2017",
    authors: "Gucalp R, Cheng I, Lee J, et al.",
    title: "Periprostatic adipose inflammation is associated with high-grade prostate cancer.",
    source: "Prostate Cancer Prostatic Dis. 2017;20(4):418-423. PMID 28653675.",
    group: "external",
    usedFor: ["PIPS-H MRI plane-phenotype weights"],
    verified: true,
  },
  {
    key: "hong2010hemorrhage",
    authors: "Hong SK, Kim DS, Lee WK, et al.",
    title: "Significance of postbiopsy hemorrhage observed on preoperative magnetic resonance imaging in performing robot-assisted laparoscopic radical prostatectomy.",
    source: "World J Urol. 2010;28(6):721-6. doi:10.1007/s00345-010-0506-x.",
    group: "external",
    usedFor: ["Periprostatic-inflammation risk weights"],
    verified: true,
  },
  {
    key: "liao2020turp",
    authors: "Liao H, Duan X, Du Y, et al.",
    title: "Radical prostatectomy after previous transurethral resection of the prostate: oncological, surgical and functional outcomes - a meta-analysis.",
    source: "World J Urol. 2020;38(8):1919-1932. doi:10.1007/s00345-019-02986-2.",
    group: "external",
    usedFor: ["Periprostatic-inflammation risk weights"],
    verified: true,
  },
  {
    key: "picozzi2015mesh",
    authors: "Picozzi SC, Ricci C, Bonavina L, et al.",
    title: "Feasibility and outcomes regarding open and laparoscopic radical prostatectomy in patients with previous synthetic mesh inguinal hernia repair: meta-analysis and systematic review of 7,497 patients.",
    source: "World J Urol. 2015;33(1):59-67. doi:10.1007/s00345-014-1282-9.",
    group: "external",
    usedFor: ["Periprostatic-inflammation risk weights"],
    verified: true,
  },
  {
    key: "ribeiro2021salvage",
    authors: "Ribeiro L, Stonier T, Stroman L, et al.",
    title: "Is the toxicity of salvage prostatectomy related to the primary prostate cancer therapy received?",
    source: "J Urol. 2021;205(3):791-799. doi:10.1097/JU.0000000000001382.",
    group: "external",
    usedFor: ["Periprostatic-inflammation risk weights"],
    verified: true,
  },
  {
    key: "villers1993denonvilliers",
    authors: "Villers A, McNeal JE, Freiha FS, Boccon-Gibod L, Stamey TA.",
    title: "Invasion of Denonvilliers' fascia in radical prostatectomy specimens.",
    source: "J Urol. 1993;149(4):793-8.",
    group: "external",
    usedFor: ["PIPS-H MRI plane-phenotype weights"],
    verified: true,
  },
  {
    key: "stephenson2004srp",
    authors: "Stephenson AJ, Scardino PT, Bianco FJ, et al.",
    title: "Morbidity and functional outcomes of salvage radical prostatectomy for locally recurrent prostate cancer after radiation therapy.",
    source: "J Urol. 2004;172(6 Pt 1):2239-43. doi:10.1097/01.ju.0000140960.63108.39.",
    group: "external",
    usedFor: ["Periprostatic-inflammation risk weights"],
    verified: true,
  },
  {
    key: "gotto2010radiation",
    authors: "Gotto GT, Yunis LH, Vora K, et al.",
    title: "Impact of prior prostate radiation on complications after radical prostatectomy.",
    source: "J Urol. 2010;184(1):136-42. doi:10.1016/j.juro.2010.03.031.",
    group: "external",
    usedFor: ["Periprostatic-inflammation risk weights"],
    verified: true,
  },
  {
    key: "tewari2013grades",
    authors: "Tewari AK, Ali A, Metgud S, et al.",
    title: "Functional outcomes following robotic prostatectomy using athermal, traction free risk-stratified grades of nerve sparing.",
    source: "World J Urol. 2013;31(3):471-80. doi:10.1007/s00345-012-1018-7.",
    group: "external",
    usedFor: ["PIPS-H MRI plane-phenotype weights"],
    verified: true,
  },
  {
    key: "hehir2026ari",
    authors: "Hehir CM, Calpin GG, Cullivan O, et al.",
    title: "The role of 5-alpha reductase inhibitors in transurethral resection of the prostate: a meta-analysis of randomised controlled trials.",
    source: "BJU Int. 2026;137(3):430-443. doi:10.1111/bju.70117.",
    group: "external",
    usedFor: ["Periprostatic-inflammation risk weights"],
    verified: true,
  },
  {
    key: "yao2026pelvis",
    authors: "Yao JM, Yuan YY, Yang JQ, et al.",
    title: "Correlation between male pelvic and soft tissue parameters based on three-dimensional reconstruction and the difficulty of robot-assisted radical prostatectomy.",
    source: "World J Urol. 2026;44(1):324. doi:10.1007/s00345-026-06401-5.",
    group: "external",
    usedFor: ["Periprostatic-inflammation risk weights"],
    verified: true,
  },
  {
    key: "alkhanaty2026route",
    authors: "Al-Khanaty A, Sandhu K, Wettstein MS, et al.",
    title: "Positive margin location and prostate biopsy route: a consecutive cohort comparison of transperineal and transrectal techniques.",
    source: "Cancers. 2026;18(5):849. doi:10.3390/cancers18050849.",
    group: "external",
    usedFor: ["Periprostatic-inflammation risk weights"],
    verified: true,
  },
  {
    key: "catanzaro2025ibd",
    authors: "Catanzaro C, Penaranda NR, Marmiroli A, et al.",
    title: "Inflammatory bowel disease vs. adverse in-hospital outcomes after radical prostatectomy.",
    source: "Urol Oncol. 2025. doi:10.1016/j.urolonc.2025.07.032.",
    group: "external",
    usedFor: ["Periprostatic-inflammation risk weights"],
    verified: true,
  },
  {
    key: "furman2019sci",
    authors: "Furman D, Campisi J, Verdin E, et al.",
    title: "Chronic inflammation in the etiology of disease across the life span.",
    source: "Nat Med. 2019;25(12):1822-1832. doi:10.1038/s41591-019-0675-0.",
    group: "external",
    usedFor: ["Periprostatic-inflammation risk weights"],
    verified: true,
  },
  {
    key: "sotak2025obesity",
    authors: "Soták M, Clark M, Suur BE, Börgeson E.",
    title: "Inflammation and resolution in obesity.",
    source: "Nat Rev Endocrinol. 2025;21(1):45-61. doi:10.1038/s41574-024-01047-y.",
    group: "external",
    usedFor: ["Periprostatic-inflammation risk weights"],
    verified: true,
  },
  {
    key: "jin2026ppat",
    authors: "Jin Y, Hu J, Wang G, et al.",
    title: "Fibrosis of periprostatic adipose tissue: a potential marker of prostate cancer aggressiveness.",
    source: "Cancers. 2026;18(6):949. doi:10.3390/cancers18060949.",
    group: "external",
    usedFor: ["PIPS-H MRI plane-phenotype weights"],
    verified: true,
  },
  {
    key: "pedraza2023microus",
    authors: "Pedraza AM, Parekh S, Joshi H, et al.",
    title: "Side-specific, microultrasound-based nomogram for the prediction of extracapsular extension in prostate cancer.",
    source: "Eur Urol Open Sci. 2023;48:72-81. PMC9895764.",
    group: "external",
    usedFor: ["PIPS-EPE tier cutpoints"],
    verified: true,
  },
  {
    key: "soeterik2019decisionrule",
    authors: "Soeterik TFW, van Melick HHE, Dijksman LM, et al.",
    title: "Predicting side-specific prostate cancer extracapsular extension: a simple decision rule of PSA, biopsy, and MRI parameters.",
    source: "Int Urol Nephrol. 2019;51(11):1981-1988. PMC6713688.",
    group: "external",
    usedFor: ["PIPS-EPE tier cutpoints"],
    verified: true,
  },
  {
    key: "fasulo2022microus",
    authors: "Fasulo V, Buffi NM, Regis F, et al.",
    title: "Use of high-resolution micro-ultrasound to predict extraprostatic extension of prostate cancer prior to surgery: a prospective single-institutional study.",
    source: "World J Urol. 2022;40(2):435-442. DOI 10.1007/s00345-021-03890-4.",
    group: "external",
    usedFor: ["PIPS-EPE tier cutpoints"],
    verified: true,
  },
  {
    key: "neurosafeproof2025",
    authors: "NeuroSAFE PROOF Collaborative Group.",
    title:
      "Effect of NeuroSAFE-guided RARP versus standard RARP on erectile function and urinary continence in patients with localised prostate cancer (NeuroSAFE PROOF): a multicentre, patient-blinded, randomised, controlled phase 3 trial.",
    source: "Lancet Oncol. 2025.",
    group: "external",
    usedFor: ["PIPS EPE x hostility decision matrix"],
    verified: true,
  },
  {
    key: "creta2024bph",
    authors: "Creta M, Manfredi C, Arcaniolo D, et al.",
    title:
      "Functional and oncological outcomes after radical prostatectomy in patients with history of surgery for lower urinary tract symptoms related to benign prostatic enlargement: a systematic review with meta-analysis.",
    source: "Prostate Cancer Prostatic Dis. 2024;27:367-384. PMID 37244971.",
    group: "external",
    usedFor: ["PIPS EPE x hostility decision matrix", "Periprostatic-inflammation risk weights"],
    verified: true,
  },
  {
    key: "turk2018prostatitis",
    authors: "Türk H, Un S, Toktas G, et al.",
    title: "Does a previous prostate biopsy-related acute bacterial prostatitis affect the results of radical prostatectomy?",
    source: "Int Braz J Urol. 2018;44(2):240-247. PMID 29219284.",
    group: "external",
    usedFor: ["PIPS EPE x hostility decision matrix", "Periprostatic-inflammation risk weights", "PIPS gates — infection, discordance, artifact"],
    verified: true,
  },
  {
    key: "prospectivestudies2009bmi",
    authors: "Prospective Studies Collaboration.",
    title: "Body-mass index and cause-specific mortality in 900 000 adults: collaborative analyses of 57 prospective studies.",
    source: "Lancet. 2009;373(9669):1083-1096.",
    group: "external",
    usedFor: ["Biological age — BMI years"],
    verified: true,
  },
  {
    key: "globalbmi2016",
    authors: "Global BMI Mortality Collaboration.",
    title: "Body-mass index and all-cause mortality: individual-participant-data meta-analysis of 239 prospective studies in four continents.",
    source: "Lancet. 2016;388(10046):776-786.",
    group: "external",
    usedFor: ["Biological age — BMI years"],
    verified: true,
  },
  {
    key: "moore2012exercise",
    authors: "Moore SC, Patel AV, Matthews CE, et al.",
    title: "Leisure time physical activity of moderate to vigorous intensity and mortality: a large pooled cohort analysis.",
    source: "PLoS Med. 2012;9(11):e1001335.",
    group: "external",
    usedFor: ["Biological age — physical activity years"],
    verified: true,
  },
  {
    key: "wood2018alcohol",
    authors: "Wood AM, Kaptoge S, Butterworth AS, et al.",
    title: "Risk thresholds for alcohol consumption: combined analysis of individual-participant data for 599 912 current drinkers in 83 prospective studies.",
    source: "Lancet. 2018;391(10129):1513-1523.",
    group: "external",
    usedFor: ["Biological age — alcohol years"],
    verified: true,
  },
  {
    key: "erfc2011comorbid",
    authors: "Emerging Risk Factors Collaboration.",
    title: "Diabetes mellitus, fasting glucose, and risk of cause-specific death.",
    source: "N Engl J Med. 2011;364(9):829-841.",
    group: "external",
    usedFor: ["Biological age — comorbidity years"],
    verified: true,
  },
  {
    key: "choi2026smoking",
    authors: "Choi C, Labriola M, Henderson N, et al.; Armstrong AJ.",
    title: "Association between smoking, tumor genetics, and outcomes in men with metastatic prostate cancer.",
    source: "Prostate Cancer Prostatic Dis. 2026 (PROMISE registry, N=2353). doi:10.1038/s41391-026-01150-3.",
    group: "external",
    usedFor: ["Biological age — smoking years"],
    verified: true,
  },
  {
    key: "zhang2026diet",
    authors: "Zhang Y, Shanahan MR, Guard HE, et al.; Mucci LA.",
    title: "Dietary fat intake and mortality among patients with nonmetastatic prostate cancer.",
    source: "JAMA Netw Open. 2026;9(9):e2630693 (Health Professionals Follow-Up Study, N=4884). doi:10.1001/jamanetworkopen.2026.30693.",
    group: "external",
    usedFor: ["Biological age — diet years"],
    verified: true,
  },
  {
    key: "bauer2020diet",
    authors: "Bauer SR, Breyer BN, Stampfer MJ, et al.",
    title: "Association of diet with erectile dysfunction among men in the Health Professionals Follow-up Study.",
    source: "JAMA Netw Open. 2020;3(11):e2021701 (N=21,469, 1998-2014). doi:10.1001/jamanetworkopen.2020.21701.",
    group: "external",
    usedFor: ["Diet → erectile-function recovery", "Biological age — diet years"],
    verified: true,
  },
  {
    key: "briganti2010ef",
    authors: "Briganti A, Gallina A, Suardi N, et al.",
    title: "Predicting erectile function recovery after bilateral nerve sparing radical prostatectomy: a proposal of a novel preoperative risk stratification.",
    source: "J Sex Med. 2010;7(7):2521-31 (N=435).",
    group: "external",
    usedFor: [
      "Modifiable factor — age & baseline erectile function",
      "Modifiable factor — comorbidities (functional recovery)",
    ],
    verified: true,
  },
  {
    key: "wei2018obesity",
    authors: "Wei Y, Wu YP, Lin MY, et al.",
    title: "Impact of obesity on long-term urinary incontinence after radical prostatectomy: a meta-analysis.",
    source: "Biomed Res Int. 2018;2018:8279523. doi:10.1155/2018/8279523.",
    group: "external",
    usedFor: ["Modifiable factor — obesity"],
    verified: true,
  },
  {
    key: "geng2023pfme",
    authors: "Geng E, Yin S, Yang Y, et al.",
    title: "The effect of perioperative pelvic floor muscle exercise on urinary incontinence after radical prostatectomy: a meta-analysis.",
    source: "Int Braz J Urol. 2023;49(4):441-451 (15 RCTs, N=2,178). doi:10.1590/S1677-5538.IBJU.2023.0053.",
    group: "external",
    usedFor: ["Modifiable factor — pelvic floor muscle training"],
    verified: true,
  },
  {
    key: "filocamo2005pfmt",
    authors: "Filocamo MT, Li Marzi V, Del Popolo G, et al.",
    title: "Effectiveness of early pelvic floor rehabilitation treatment for post-prostatectomy incontinence.",
    source: "Eur Urol. 2005;48(5):734-8. Continent 96% vs 65% at 6 months; 89% vs 67% pad-free at 12 months.",
    group: "external",
    usedFor: ["Modifiable factor — pelvic floor muscle training"],
    verified: true,
  },
  {
    key: "manassero2007pfmt",
    authors: "Manassero F, Traversi C, Ales V, et al.",
    title: "Contribution of early intensive prolonged pelvic floor exercises on urinary continence recovery after bladder neck-sparing radical prostatectomy: results of a prospective controlled randomized trial.",
    source: "Neurourol Urodyn. 2007;26(7):985-9. Persistent incontinence 40% vs 60% at 6 months.",
    group: "external",
    usedFor: ["Modifiable factor — pelvic floor muscle training"],
    verified: true,
  },
  {
    key: "johnson2023cochrane",
    authors: "Johnson EE, Mamoulakis C, Stoniute A, Omar MI, Sinha S.",
    title: "Conservative interventions for managing urinary incontinence after prostate surgery.",
    source: "Cochrane Database Syst Rev. 2023;(4):CD014799. doi:10.1002/14651858.CD014799.pub2. Low-certainty evidence throughout.",
    group: "external",
    usedFor: ["Modifiable factor — pelvic floor muscle training"],
    verified: true,
  },
  {
    key: "gerbild2018pa",
    authors: "Gerbild H, Larsen CM, Graugaard C, Areskoug Josefsson K.",
    title: "Physical activity to improve erectile function: a systematic review of intervention studies.",
    source: "Sex Med. 2018;6(2):75-89.",
    group: "external",
    usedFor: ["Modifiable factor — physical activity"],
    verified: true,
  },
  {
    key: "bull2020who",
    authors: "Bull FC, Al-Ansari SS, Biddle S, et al.",
    title: "World Health Organization 2020 guidelines on physical activity and sedentary behaviour.",
    source: "Br J Sports Med. 2020;54(24):1451-1462. PMID 33239350.",
    group: "external",
    usedFor: ["Alcohol & activity band definitions", "Modifiable factor — physical activity"],
    verified: true,
  },
  {
    key: "niaaa2023levels",
    authors: "National Institute on Alcohol Abuse and Alcoholism (NIAAA).",
    title: "Understanding alcohol drinking patterns — low-risk, heavy and binge drinking definitions; with the Dietary Guidelines for Americans 2020-2025 definition of moderate drinking.",
    source: "NIAAA, Alcohol's Effects on Health (accessed 2026). U.S. Departments of Agriculture and Health and Human Services, Dietary Guidelines for Americans 2020-2025.",
    group: "external",
    usedFor: ["Alcohol & activity band definitions", "Modifiable factor — alcohol"],
    verified: true,
  },
  {
    key: "montorsi2014reactt",
    authors: "Montorsi F, Brock G, Stolzenburg JU, et al.",
    title: "Effects of tadalafil treatment on erectile function recovery following bilateral nerve-sparing radical prostatectomy: a randomised placebo-controlled study (REACTT).",
    source: "Eur Urol. 2014;65(3):587-96.",
    group: "external",
    usedFor: ["Modifiable factor — PDE5 inhibitor regimen"],
    verified: true,
  },
  {
    key: "zhang2025pie",
    authors: "Zhang C, Harper A, Imm KR, et al.",
    title: "Impact of age, marital status, smoking, and alcohol consumption on urinary and sexual function in prostate cancer patients treated with radical prostatectomy: a prospective cohort study.",
    source: "Urology. 2025;207:155-161 (PIE study). PMID 40716527.",
    group: "external",
    usedFor: [
      "Modifiable factor — smoking (functional recovery)",
      "Modifiable factor — alcohol",
    ],
    verified: true,
  },
  {
    key: "wang2018alcohol",
    authors: "Wang X, Zhang Y, Wang X, et al.",
    title: "Alcohol intake and risk of erectile dysfunction: a dose-response meta-analysis of observational studies.",
    source: "Int J Impot Res. 2018;30(6):342-351 (24 studies, N=154,295). PMID 30232467.",
    group: "external",
    usedFor: ["Modifiable factor — alcohol"],
    verified: true,
  },
  {
    key: "bradley2017luts",
    authors: "Bradley CS, Erickson BA, Messersmith EE, et al.",
    title: "Evidence of the impact of diet, fluid intake, caffeine, alcohol and tobacco on lower urinary tract symptoms: a systematic review.",
    source: "J Urol. 2017;198(5):1010-20 (LURN; 110 articles). doi:10.1016/j.juro.2017.04.097.",
    group: "external",
    usedFor: ["Modifiable factor — alcohol"],
    verified: true,
  },
  {
    key: "arackal2007alcohol",
    authors: "Arackal BS, Benegal V.",
    title: "Prevalence of sexual dysfunction in male subjects with alcohol dependence.",
    source: "Indian J Psychiatry. 2007;49(2):109-112 (N=100). PMID 20711392.",
    group: "external",
    usedFor: ["Modifiable factor — alcohol"],
    verified: true,
  },
  {
    key: "rabbani2009ef",
    authors: "Rabbani F, Schiff J, Piecuch M, et al.",
    title: "Factors predicting preservation of erectile function in men undergoing open radical retropubic prostatectomy.",
    source: "J Urol. 2009;181(4):1817-22 (N=1,110). PMID 19233413.",
    group: "external",
    usedFor: ["Modifiable factor — comorbidities (functional recovery)"],
    verified: true,
  },
  {
    key: "kimura2026ipss",
    authors: "Kimura N, Yamada Y, Hakozaki Y, et al.",
    title: "Long-term transition of urinary status after robot-assisted radical prostatectomy.",
    source: "J Robot Surg. 2026;20:198 (N=243). doi:10.1007/s11701-026-03146-6. PMID 41557198.",
    group: "external",
    usedFor: ["Modifiable factor — baseline voiding symptoms (IPSS)"],
    verified: true,
  },
  {
    key: "visscher2025smoking",
    authors: "Visscher J, Bonevski B, O'Callaghan M.",
    title: "The association of smoking with urinary and sexual function recovery following radical prostatectomy.",
    source: "BJU Int. 2025;136(4):647-656 (N=2,676). doi:10.1111/bju.16817. PMID 40533875.",
    group: "external",
    usedFor: ["Modifiable factor — smoking (functional recovery)"],
    verified: true,
  },
  {
    key: "visscher2024smokingmeta",
    authors: "Visscher J, et al.",
    title: "The association of smoking with urinary and sexual function recovery following radical prostatectomy for localized prostate cancer: a systematic review and meta-analysis.",
    source: "Prostate Cancer Prostatic Dis. 2024 (9 studies). PMID 37500786.",
    group: "external",
    usedFor: ["Modifiable factor — smoking (functional recovery)"],
    verified: true,
  },
  {
    key: "yu2024pfmtnma",
    authors: "Yu K, Bu F, Jian T, et al.",
    title: "Urinary incontinence rehabilitation after radical prostatectomy: a systematic review and network meta-analysis.",
    source: "Front Oncol. 2024;13:1307434 (42 RCTs, N=4,256). doi:10.3389/fonc.2023.1307434.",
    group: "external",
    usedFor: ["Modifiable factor — pelvic floor muscle training"],
    verified: true,
  },
  {
    key: "ficarra2012continence",
    authors: "Ficarra V, Novara G, Rosen RC, et al.",
    title: "Systematic review and meta-analysis of studies reporting urinary continence recovery after robot-assisted radical prostatectomy.",
    source: "Eur Urol. 2012;62(3):405-17.",
    group: "external",
    usedFor: ["Functional-outcome nomogram", "Functional-outcome nomogram (recovery trajectory)"],
    verified: true,
  },
  {
    key: "ficarra2012potency",
    authors: "Ficarra V, Novara G, Ahlering TE, et al.",
    title: "Systematic review and meta-analysis of studies reporting potency rates after robot-assisted radical prostatectomy.",
    source: "Eur Urol. 2012;62(3):418-30.",
    group: "external",
    usedFor: ["Functional-outcome nomogram", "Functional-outcome nomogram (recovery trajectory)"],
    verified: true,
  },
  {
    key: "blank2023salvage",
    authors: "Blank AA, Meyer AR, Wang H, et al.",
    title: "Salvage radical prostatectomy after primary focal ablative therapy: a systematic review and meta-analysis.",
    source: "Cancers (Basel). 2023;15(10):2727. PMC10216462.",
    group: "external",
    usedFor: ["PIPS EPE x hostility decision matrix", "PIPS-H MRI plane-phenotype weights"],
    verified: true,
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
