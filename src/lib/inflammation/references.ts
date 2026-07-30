/**
 * Literature backing for the side-specific ECE / periprostatic-inflammation
 * instrument (`src/lib/inflammation/model.ts`). Ported from the reference
 * list assembled in "Side-specific periprostatic inflammation score" (PPI
 * research note) and the R01 draft research plan.
 *
 * Every coefficient in `DEFAULT_INFLAMMATION_CONFIG` is still an expert
 * prior, not a fitted regression weight — these citations establish
 * direction of effect and, where available, an approximate published
 * threshold or effect size, not the coefficient's exact magnitude. Field
 * mappings use the body-text citations from the source note (which trace
 * consistently to this bibliography); the note's summary table used a
 * separately-restarted bracket numbering that does not match this list and
 * is not reproduced here.
 */
export interface LiteratureReference {
  n: number;
  title: string;
  journal: string;
  year: number;
  authors: string;
  tag?: string;
}

export const REFERENCES: LiteratureReference[] = [
  { n: 1, title: "Prostate Cancer: The European Society of Urogenital Radiology Prostate Imaging Reporting and Data System Criteria for Predicting Extraprostatic Extension by Using 3-T Multiparametric MR Imaging", journal: "Radiology", year: 2015, authors: "Kayat Bittencourt L, Litjens G, Hulsbergen-van de Kaa CA, et al." },
  { n: 2, title: "Clinically Localized Prostate Cancer: AUA/ASTRO Guideline (2022; Amended 2026)", journal: "The Journal of Urology", year: 2026, authors: "American Urological Association", tag: "Guideline" },
  { n: 3, title: "Impact of the Prostate Imaging Reporting and Data System, Version 2, on MRI Diagnosis for Extracapsular Extension of Prostate Cancer", journal: "AJR American Journal of Roentgenology", year: 2017, authors: "Matsuoka Y, Ishioka J, Tanaka H, et al." },
  { n: 4, title: "Analysis of Inflammatory Features in Suspicious Lesions for Significant Prostate Cancer on Magnetic Resonance Imaging — Are They Mimickers of Prostate Cancer?", journal: "Cancers", year: 2024, authors: "Morote J, Celma A, Semidey ME, et al." },
  { n: 5, title: "Benign Conditions That Mimic Prostate Carcinoma: MR Imaging Features With Histopathologic Correlation", journal: "RadioGraphics", year: 2015, authors: "Kitzing YX, Prando A, Varol C, et al.", tag: "Review" },
  { n: 6, title: "Granulomatous Prostatitis as a Cause of Elevated PI-RADS Scores on Multiparametric MRI: Insights From a Single Institution Cohort", journal: "Virchows Archiv", year: 2026, authors: "Colef RG, Froemming AT, Takahashi N, et al." },
  { n: 7, title: "Preoperative Multiparametric MRI-Based Tumour–Periprostatic Adipose Tissue Interface Characterisation for Extraprostatic Extension Prediction in Prostate Cancer", journal: "Cancer Medicine", year: 2026, authors: "Zhang S, Huo L, Zhu Z, et al." },
  { n: 8, title: "Development and Internal Validation of a Side-Specific Nomogram Integrating mpMRI and Biopsy Features to Guide Nerve-Sparing Decision Making in Prostate Cancer With Capsular Contact", journal: "Cancers", year: 2026, authors: "Ahmed Y, Diahovets K, Schnitzler T, et al." },
  { n: 9, title: "A Grading System for the Assessment of Risk of Extraprostatic Extension of Prostate Cancer at Multiparametric MRI", journal: "Radiology", year: 2019, authors: "Mehralivand S, Shih JH, Harmon S, et al." },
  { n: 10, title: "International Multi-Site Initiative to Develop an MRI-Inclusive Nomogram for Side-Specific Prediction of Extraprostatic Extension of Prostate Cancer", journal: "Cancers", year: 2021, authors: "Wibmer AG, Kattan MW, Alessandrino F, et al." },
  { n: 11, title: "External Validation of Nomograms Including MRI Features for the Prediction of Side-Specific Extraprostatic Extension", journal: "Prostate Cancer and Prostatic Diseases", year: 2024, authors: "Heetman JG, van der Hoeven EJRJ, Rajwa P, et al." },
  { n: 12, title: "Differentiation of Prostatitis and Prostate Cancer Using the Prostate Imaging-Reporting and Data System (PI-RADS)", journal: "European Journal of Radiology", year: 2016, authors: "Meier-Schroers M, Kukuk G, Wolter K, et al." },
  { n: 13, title: "PI-RADS® v2.1 — Prostate Imaging Reporting and Data System, 2019, Version 2.1", journal: "American College of Radiology", year: 2019, authors: "American College of Radiology", tag: "Guideline" },
  { n: 14, title: "Multiparametric MRI for Localized Prostate Cancer: Lesion Detection and Staging", journal: "BioMed Research International", year: 2014, authors: "Margolis DJ", tag: "Review" },
  { n: 15, title: "Prostatitis, the Great Mimicker of Prostate Cancer: Can We Differentiate Them Quantitatively With Multiparametric MRI?", journal: "AJR American Journal of Roentgenology", year: 2020, authors: "Uysal A, Karaosmanoğlu AD, Karcaaltıncaba M, et al." },
  { n: 16, title: "A Novel Approach to Differentiate Prostate Cancer From Prostatitis in the Peripheral Zone", journal: "The British Journal of Radiology", year: 2025, authors: "He CL, Yang T, Zhang MN, Yao J, Yang L." },
  { n: 17, title: "Fibrosis of Periprostatic Adipose Tissue: A Potential Marker of Prostate Cancer Aggressiveness", journal: "Cancers", year: 2026, authors: "Jin Y, Hu J, Wang G, et al." },
  { n: 18, title: "Remodeling of the Periprostatic Adipose Microenvironment in Aggressive Prostate Cancer: Insights From a Multi-Institutional Atlas-Based Geometric Analysis", journal: "Journal of Clinical Oncology", year: 2026, authors: "Azamat S, Kunhiraman H, Singh A, et al." },
  { n: 19, title: "Integrating Magnetic Resonance Chemical Shift Imaging for Localized Prostate Cancer Risk Stratification on the Basis of the Impact of Periprostatic Brown Adipocytes Within Tumor Microenvironment", journal: "Annals of Surgical Oncology", year: 2025, authors: "Shen CY, Pan JK, Lin WD, et al." },
  { n: 20, title: "The Combination of Prostate Imaging Reporting and Data System Version 2 (PI-RADS V2) and Periprostatic Fat Thickness on Multi-Parametric MRI to Predict the Presence of Prostate Cancer", journal: "Oncotarget", year: 2017, authors: "Cao Y, Cao M, Chen Y, et al." },
  { n: 21, title: "Periprostatic Adipose Tissue Displays a Chronic Hypoxic State That Limits Its Expandability", journal: "The American Journal of Pathology", year: 2022, authors: "Roumiguié M, Estève D, Manceau C, et al." },
  { n: 22, title: "Comparing Magnetic Resonance Imaging and Prostate-Specific Membrane Antigen-Positron Emission Tomography for Prediction of Extraprostatic Extension of Prostate Cancer and Surgical Guidance: A Prospective Nonrandomized Clinical Trial", journal: "The Journal of Urology", year: 2024, authors: "Bahler CD, Tachibana I, Tann M, et al.", tag: "Clinical Trial" },
  { n: 23, title: "Predicting Side-Specific Extraprostatic Extension in Prostate Cancer Using an 18F-DCFPyL PSMA-PET/CT-based Nomogram", journal: "Prostate Cancer and Prostatic Diseases", year: 2025, authors: "Tillu N, Maheshwari A, Kolanukuduru K, et al." },
  { n: 24, title: "Evaluating Extraprostatic Extension of Prostate Cancer: Pragmatic Integration of MRI and PSMA-PET/CT", journal: "Abdominal Radiology", year: 2025, authors: "Woo S, Freedman D, Becker AS, et al." },
  { n: 25, title: "Phenotypic Appearances of Prostate Utilizing PET-MRI and PET-CT With 68Ga-PSMA, Radiolabelled Choline and 68Ga-DOTATATE", journal: "Nuclear Medicine Communications", year: 2018, authors: "Haroon A, Afaq A, Nuthakki S, et al." },
  { n: 26, title: "Head-to-Head Comparison of Micro-Ultrasound, mpMRI, and PSMA PET/CT With Wholemount Histopathology as Gold Standard in the Detection and T Staging of Prostate Cancer", journal: "Journal of Clinical Oncology", year: 2025, authors: "Brisbane W, Miao Q, Sonni I, et al." },
  { n: 27, title: "Use of High-Resolution Micro-Ultrasound to Predict Extraprostatic Extension of Prostate Cancer Prior to Surgery: A Prospective Single-Institutional Study", journal: "World Journal of Urology", year: 2022, authors: "Fasulo V, Buffi NM, Regis F, et al." },
  { n: 28, title: "Indications for Nerve-Sparing Surgery for Radical Prostatectomy: Results From a Single-Center Study", journal: "Frontiers in Oncology", year: 2022, authors: "Zhu Z, Zhu Y, Xiao Y, Hu S." },
  { n: 29, title: "An Updated Approach to Incremental Nerve Sparing for Robot-Assisted Radical Prostatectomy", journal: "BJU International", year: 2019, authors: "Martini A, Cumarasamy S, Haines KG, Tewari AK." },
  { n: 30, title: "Development and Internal Validation of a Side-Specific, Multiparametric Magnetic Resonance Imaging-Based Nomogram for the Prediction of Extracapsular Extension of Prostate Cancer", journal: "BJU International", year: 2018, authors: "Martini A, Gupta A, Lewis SC, et al." },
  { n: 31, title: "Biopsy Prostate Cancer Perineural Invasion and Tumour Load Are Associated With Positive Posterolateral Margins at Radical Prostatectomy: Implications for Planning of Nerve-Sparing Surgery", journal: "Histopathology", year: 2023, authors: "van der Slot MA, Remmers S, Kweldam CF, et al." },
  { n: 32, title: "Repeat Prostate Biopsies Prior to Radical Prostatectomy Do Not Impact Erectile Function Recovery and Mid- to Long-Term Continence", journal: "The Prostate", year: 2018, authors: "Furrer MA, Vilaseca A, Corradi RB, et al." },
  { n: 33, title: "The Impact of Multiple Prostate Biopsies on Risk for Major Complications Following Radical Prostatectomy: A Population-Based Cohort Study", journal: "Urology", year: 2017, authors: "Olvera-Posada D, Welk B, McClure JA, et al." },
  { n: 34, title: "The Impact of Repeat Prostate Biopsies on Oncologic, Pathological and Perioperative Outcomes After Radical Prostatectomy", journal: "The Journal of Urology", year: 2017, authors: "Rosenbaum CM, Mandel P, Tennstedt P, et al." },
  { n: 35, title: "Short Interval of Biopsy to Robotic-Assisted Laparoscopic Radical Prostatectomy Does Not Render Any Adverse Effects on the Perioperative Outcomes", journal: "Medicine", year: 2018, authors: "He M, Li Y, Xiang Z, et al." },
  { n: 36, title: "Clinical Association of Metabolic Syndrome, C-Reactive Protein and Testosterone Levels With Clinically Significant Prostate Cancer", journal: "Journal of Cellular and Molecular Medicine", year: 2019, authors: "Gómez-Gómez E, Carrasco-Valiente J, Campos-Hernández JP, et al." },
  { n: 37, title: "Study of the Interaction Between Cardiometabolic Index and Inflammatory Index on the Risk of Prostate Cancer Development", journal: "Frontiers in Immunology", year: 2025, authors: "Xiao Y, Tang B, Wang J, et al." },
  { n: 38, title: "Bicenter Validation of a Risk Model for the Preoperative Prediction of Extraprostatic Extension of Localized Prostate Cancer Combining Clinical and Multiparametric MRI Parameters", journal: "World Journal of Urology", year: 2024, authors: "Ostau NEV, Handke AE, Wiesenfarth M, et al." },
  { n: 39, title: "Incorporating Tumor Pathological Subtype Into a Multiparameter Model: Improved Accuracy in Predicting Prostate Cancer Extraprostatic Extension", journal: "Journal of Clinical Oncology", year: 2026, authors: "Liang Q, Wen S." },
  { n: 40, title: "Chronic Prostatitis and Prostatodynia: Ultrasonographic Alterations of the Prostate, Bladder Neck, Seminal Vesicles and Periprostatic Venous Plexus", journal: "European Urology", year: 1988, authors: "Di Trapani D, Pavone C, Serretta V, et al." },
  { n: 41, title: "Prostate Cancer and Its Mimics — A Pictorial Review", journal: "Cancers", year: 2023, authors: "Żurowska A, Pęksa R, Bieńkowski M, et al.", tag: "Review" },
  { n: 42, title: "Prostate MR: Pitfalls and Benign Lesions", journal: "Abdominal Radiology", year: 2020, authors: "Chatterjee A, Thomas S, Oto A.", tag: "Review" },
  { n: 43, title: "Obesity, Metabolic Syndrome, and Prostate Cancer", journal: "The American Journal of Clinical Nutrition", year: 2007, authors: "Hsing AW, Sakoda LC, Chua S.", tag: "Review" },
  { n: 44, title: "Periprostatic Adipose Tissue MRI Radiomics-Derived Features Associated With Clinically Significant Prostate Cancer", journal: "Journal of Endourology", year: 2023, authors: "Shahait M, Usamentiaga R, Tong Y, et al." },
  { n: 45, title: "A Multiparametric MRI-Based Model for Decoding Extraprostatic Extension in Prostate Cancer via Habitat-Guided Radiomics and Clinical Integration", journal: "Academic Radiology", year: 2025, authors: "Xiang Y, Yao H, Lin P, et al." },
  { n: 46, title: "A Side-Specific Nomogram for Extraprostatic Extension May Reduce the Positive Surgical Margin Rate in Radical Prostatectomy", journal: "World Journal of Urology", year: 2022, authors: "Heetman JG, Soeterik TFW, Wever L, et al." },
];

export const REFERENCES_BY_N = new Map(REFERENCES.map((r) => [r.n, r]));

/**
 * Field → reference-number mapping, keyed by domain (matching the field
 * groups in `InflammationWorkspace.tsx`) and then by field id (or a
 * synthetic key for a derived quantity, e.g. `psad`, `nsGrade`).
 *
 * Traced to the body-text citations in section II of the source note, not
 * its summary table (see module docstring). Fields with no entry here
 * (raw `psa`/`vol`/`route`, PSA-kinetics fields, `mriIntervalChange`) were
 * added to the model without a specific literature citation in the source
 * material and are labeled as such in the UI; whole-mount outcome-capture
 * fields (`outEce`, `outInflGrade`, `outPlaneCall`) are ground truth being
 * recorded, not a literature-derived claim, so they intentionally have no
 * entry either.
 */
export const FIELD_REFERENCES: Record<string, number[]> = {
  ccl: [7, 8, 9, 10, 11],
  angle: [7],
  caps: [7],
  epeGr: [9],
  morph: [13, 16],
  anch: [4, 5, 13, 16],
  adcI: [7, 12],
  adcL: [7, 12],
  t2Ratio: [7, 13, 14],
  dce: [15, 16],
  t1hi: [5, 40, 41, 42],
  vein: [5, 40, 41, 42],
  fatPl: [5, 20, 41, 42],
  pdff: [19, 21],
  sym: [40, 41, 42],
  rwo: [19],
  ppatFibrosis: [17],
  ppatGeom: [18],
  suvL: [22, 23, 24, 25],
  suvP: [22, 23, 24, 25],
  psmaFocalUptake: [25],
  mus1: [26, 27],
  mus2: [26, 27],
  mus3: [26, 27],
  mus4: [26, 27],
  gg: [8, 10, 28, 29, 30],
  posC: [8, 10, 28, 29, 30],
  maxI: [8, 29],
  pni: [31],
  iraniG: [4, 32],
  iraniA: [4, 32],
  gran: [4, 6],
  nCores: [32, 33, 34],
  priorBx: [32, 33, 34],
  bxMri: [32, 33, 34, 35],
  bxSurg: [32, 33, 34, 35],
  priorIntv: [4, 32],
  bmi: [7, 35],
  mets: [36, 37],
  crp: [36, 37],
  nlr: [36, 37],
  psad: [10, 38, 39],
  nsGrade: [29],
};
