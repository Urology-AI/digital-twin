# COMPASS Model Card

**Model name:** COMPASS (Comprehensive Multi-Modal Prostate Analysis & Surgical Strategy)
**Version:** 2.5.1 (production deployment), Model build v22, verified 2026-05-03
**Date:** May 2026
**Maintainers:** Department of Urology, Icahn School of Medicine at Mount Sinai
**Repository:** https://github.com/Urology-AI/digital-twin
**Web tool:** https://urology-ai.github.io/digital-twin/

---

## 1. Intended use

COMPASS is a preoperative decision-support tool for patients with biopsy-proven prostate adenocarcinoma being considered for robot-assisted radical prostatectomy (RARP). It produces patient-specific predictions for adverse pathology, biochemical recurrence, and side-specific nerve-sparing recommendations.

**Intended users:** Urologic surgeons, multidisciplinary tumor boards, urology trainees under attending supervision.

**Intended setting:** Preoperative surgical planning at the time of RARP candidacy assessment, typically in the 1–8 weeks before scheduled surgery.

**NOT intended for:** Screening or initial cancer detection; treatment selection between surgery and radiation; post-prostatectomy salvage decisions; patients with prior pelvic radiation, prior prostate surgery, or completed androgen deprivation therapy.

**Regulatory status:** Research Use Only. Not FDA cleared. IRB STUDY-14-00050 (Mount Sinai).

---

## 2. What the model predicts

All performance values are independently verified from raw data on 2026-05-03. BC AUC = bootstrap-corrected AUC via Harrell optimism method (500 iterations). BSS = Brier Skill Score vs null (intercept-only) model. Independent external validation with the 2026-05-03 updated models is in progress.

| Outcome | Description | N (events) | CV AUC | BC AUC | 95% CI | BSS |
|---|---|---|---|---|---|---|
| ECE (patient-level) | Extracapsular extension on final pathology | 3,454 (882 / 25.5%) | 0.797 | 0.795 | 0.790–0.825 | +25.4% |
| ECE (side-specific) | Lateralized ECE per side; patient-level model applied to lobes | 228 lobes | 0.765 | 0.785 | 0.692–0.838 | — |
| Focal vs Extensive ECE | If ECE present, classifies focal (<2 HPF) vs extensive | ECE+ subset | 0.70 | — | — | — |
| SVI (patient-level) | Seminal vesicle invasion | 3,454 (301 / 8.7%) | 0.842 | 0.848 | 0.839–0.884 | +23.5% |
| SVI (side-specific) | No dedicated side-specific model fitted (EPV insufficient: 24 events / 227 lobes); patient-level model applied to lobes (AUC 0.853, 95% CI 0.766–0.929) | 227 lobes | — | — | 0.766–0.929 | — |
| Grade Upgrade | Pathologic grade group higher than biopsy GG | 3,137 (422 / 13.5%) | 0.807 | 0.810 | 0.802–0.853 | +27.2% |
| LNI (4-feature parsimonious) | Lymph node invasion at extended PLND; features: log(PSAD), GG4–5 binary, positive cores, PSMA LN+ | 663 (35 / 5.3%) | 0.842 | 0.836 | 0.797–0.901 | +5.2% |
| BCR | Biochemical recurrence (PSA ≥0.2 ng/mL on two consecutive measures) | 2,399 (297 / 12.4%) | 0.743 | — | 0.738–0.800 | +12.8% |
| PSM | Positive surgical margin | 3,454 (556 / 16.1%) | 0.651 | 0.651 | 0.658–0.706 | +5.3% |

PSM AUC of 0.651 reflects irreducible intraoperative variability (surgeon technique, frozen section decisions, tissue handling) not capturable preoperatively — consistent with the published literature range of 0.58–0.68. PSM is therefore reframed in COMPASS as a consequence within the nerve-sparing decision rather than an independent prediction endpoint.

In addition to the 9 prediction models above, COMPASS produces:
- 5-zone lateralized ECE risk distribution (posterolateral, base, apex, anterior, bladder neck) per side; zone model CV AUC 0.745
- Side-specific nerve-sparing grade recommendation (Grade 1 / 2 / 3)
- PLND decision recommendation based on a 4-scenario asymmetric rule
- Surgical alerts triggered by zone-specific risk thresholds

---

## 3. Training data

**Primary cohort:** 5,352 consecutive patients undergoing RARP at Mount Sinai Health System (New York, NY) between January 2015 and January 2026.

**Model-level Ns:** ECE, SVI, PSM models: N=3,454; Grade Upgrade: N=3,137; BCR: N=2,399; LNI: N=663 (PSMA-imaged patients with extended PLND).

**Trimodal validation cohort:** 815 patients (663 with complete data) with preoperative MRI, micro-ultrasound (ExactVu), and PSMA PET/CT all performed within 90 days of surgery. Independent validation: base models trained on 4,537 patients without trimodal imaging; tested on 815 trimodal patients with zero training overlap. Independent validation with updated 2026-05-03 model coefficients is in progress.

**Data sources:**
- Preoperative: clinical demographics, PSA, prostate volume, biopsy pathology, MRI (PI-RADS, lesion size, capsular abutment grade, ADC), micro-ultrasound (PRI-MUS, ECE call), PSMA PET (SUVmax, EPE call, LN call, SVI call), Decipher genomic classifier when available (N=1,845)
- Outcomes: final pathology from radical prostatectomy specimen, evaluated by dedicated genitourinary pathologists; biochemical recurrence from postoperative PSA surveillance

**Demographics:** Median age 69 (IQR 64–74); median PSA 6.4 ng/mL (IQR 4.6–9.6); biopsy GG distribution GG1 15.9%, GG2 41.4%, GG3 21.6%, GG4 12.6%, GG5 8.6%.

---

## 4. Inputs

**Required (minimum input):**
- Age (years)
- PSA (ng/mL)
- Prostate volume (cc) [enables PSAD auto-calculation]
- Biopsy grade group (1–5)
- Number of positive cores
- Maximum core involvement (%)

**Strongly recommended:**
- PI-RADS score (highest across lesions)
- MRI EPE call (binary)
- MRI SVI call (binary)
- Lesion size (mm)
- Capsular abutment grade (0–4)

**Optional (improves prediction when available):**
- Micro-ultrasound: PRI-MUS score, ECE call
- PSMA PET: SUVmax, EPE call, SVI call, LN call
- Decipher genomic score
- Biopsy detail: cribriform pattern, intraductal carcinoma, perineural invasion, bilateral disease

The model uses a mean-imputation + availability-flag architecture: when an input is missing, the model substitutes the cohort mean and sets a binary flag, allowing the model to operate on incomplete data without exclusion. See `DATA_DICTIONARY.md` for full variable definitions, units, and valid ranges.

---

## 5. Outputs

For each patient, COMPASS returns:

1. **Six numeric risk predictions** (ECE, SVI, Upgrade, PSM, BCR, LNI) with 95% confidence intervals
2. **Side-specific lateralized predictions** (left/right ECE and SVI)
3. **Zone-level ECE distribution** across five anatomical zones per side
4. **Nerve-sparing grade recommendation** (Grade 1, 2, or 3) per side
5. **Surgical consequence chain**: predicted PSM rate at recommended NS grade, and BCR risk if PSM− vs PSM+, by margin location
6. **PLND decision** (Omit / Limited / ePLND) with rationale
7. **Surgical alerts** (PSMA+ at base, apical ECE, NVB threatened, etc.)

---

## 6. Validation

**Internal validation:**
- 5-fold grouped cross-validation with L2 regularization (C=1.0); StandardScaler applied within each fold to prevent data leakage
- Bootstrap optimism correction (Harrell method, 500 iterations) — model refit from scratch in each resample
- All AUCs, bootstrap-corrected AUCs, and 95% CIs independently verified from raw data 2026-05-03
- Brier Skill Scores positive across all six endpoints: ECE +25.4%, SVI +23.5%, Upgrade +27.2%, LNI +5.2%, BCR +12.8%, PSM +5.3%
- Decision curve analysis: net clinical benefit across thresholds 5–40%; COMPASS exceeds treat-all from threshold ≥20% (ECE)
- Head-to-head comparators (all statistically significant, p<0.001): ECE vs Martini 2018 (ΔAUC +0.081), ECE vs Pedraza 2022 (ΔAUC +0.091), SVI vs MSKCC (ΔAUC +0.097), LNI vs Gandaglia 2019 (ΔAUC +0.076)

**Independent validation (pre-2026-05-03 model):**
- Strict temporal split: development on 4,537 non-trimodal patients; held-out validation on 815 trimodal patients with zero training overlap
- Independent validation with the updated 2026-05-03 model coefficients is in progress; prior independent results should not be applied to the current model version

**External validation:** Not yet performed. In progress.

**Prospective validation:** Not yet performed. Protocol in development.

---

## 7. Limitations

1. **Single institution.** Developed and validated entirely at Mount Sinai. External and prospective validation are necessary before clinical implementation outside Mount Sinai.
2. **Single surgeon influence.** PSM and BCR endpoints are influenced by surgical technique, which cannot be fully captured preoperatively. PSM AUC of 0.651 reflects this limitation.
3. **BCR follow-up is maturing.** Median follow-up 14 months in the development cohort; full BCR maturation is approximately 60% complete. BCR AUC will be re-estimated with longer follow-up. Salvage-censoring bias affects BCR coefficient signs for several imaging features.
4. **Decipher availability.** Only 34% of the cohort (N=1,845) has Decipher genomic data (mean score 0.521). The imputation-flag architecture preserves cohort power but reduces model precision in patients without Decipher.
5. **LNI model cohort.** The LNI model is fitted on N=663 PSMA-imaged patients with extended PLND (35 events, 5.3%). EPV=8.75 for 4 features; parsimonious feature selection was required to avoid overfitting.
6. **No SVI side-specific model.** Only 24 SVI+ events across 227 lobes (10.6% lobe-level prevalence) — insufficient EPV to fit a dedicated lateralized model. The patient-level SVI model is applied per lobe as a surrogate.
7. **Selection bias.** This is a surgical cohort. Estimates apply to patients referred for RARP, not to a screening-stage or biopsy-stage population.
8. **Retrospective design** for development. Prospective validation is required before clinical use beyond research.
9. **Race data limitation.** A substantial proportion of records are coded as "Other/Unknown," limiting subgroup analysis by race or ethnicity.
10. **Not a substitute for clinical judgment.** COMPASS predictions are decision support, not a replacement for surgeon expertise, multidisciplinary review, or shared decision-making with the patient.

---

## 8. Ethical considerations

- The model was developed under IRB-approved protocol STUDY-14-00050 with consent waiver appropriate to retrospective de-identified data.
- All training data were de-identified prior to model development.
- The web tool stores patient data only in the user's local browser (`localStorage`). No patient data is transmitted to external servers by the web tool.
- Race and ethnicity data are limited. Performance in racial and ethnic subgroups is not yet established.
- The tool has not been evaluated for performance in low-resource settings, in patients without access to all three imaging modalities, or in populations outside the demographic distribution of the Mount Sinai catchment area.

---

## 9. How to cite

Citation information is provided in `CITATION.cff` in the repository root. The peer-reviewed manuscript describing COMPASS is in preparation; this card will be updated with the published citation upon acceptance.

---

## 10. Contact

**Corresponding author:** Ashutosh K. Tewari, MD — ash.tewari@mountsinai.org
**First author / repository contact:** Daniel Ajabshir — daniel.ajabshir@mountsinai.org
**Department of Urology**, Icahn School of Medicine at Mount Sinai, 1 Gustave L. Levy Place, New York, NY 10029

---

*This model card follows the structure proposed by Mitchell et al. 2019 (Model Cards for Model Reporting) and the reporting standards of the TRIPOD statement for prediction model studies.*
