# COMPASS Model Card

**Model name:** COMPASS (Comprehensive Multi-Modal Prostate Analysis & Surgical Strategy)
**Version:** 2.5.1 (production deployment), Model build v22 (March 2026)
**Date:** April 2026
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

| Outcome | Description | Cross-Validation AUC | Independent AUC |
|---|---|---|---|
| ECE (patient-level) | Extracapsular extension on final pathology | 0.800 | 0.761 |
| ECE (side-specific) | Lateralized ECE per side | 0.80 | L 0.71 / R 0.77 |
| Focal vs Extensive ECE | If ECE present, classifies focal (<2 HPF) vs extensive | 0.70 | — |
| SVI (patient-level) | Seminal vesicle invasion | 0.863 | 0.874 |
| SVI (side-specific) | Lateralized SVI per side | 0.81 | — |
| Grade Upgrade | Pathologic grade group higher than biopsy | 0.804 | 0.830 |
| LNI (PLND-validated) | Lymph node invasion at extended PLND | 0.879 | 0.794 |
| BCR | Biochemical recurrence (PSA ≥0.2 ng/mL on two consecutive measures) | 0.733 | 0.733 |
| PSM | Positive surgical margin | 0.62 | 0.586 |

PSM AUC is intentionally modest as PSM is heavily influenced by intraoperative factors not captured preoperatively. PSM is therefore reframed in COMPASS as a *consequence within the nerve-sparing decision* rather than an independent prediction endpoint.

In addition to the 9 prediction models above, COMPASS produces:
- 5-zone lateralized ECE risk distribution (posterolateral, base, apex, anterior, bladder neck) per side
- Side-specific nerve-sparing grade recommendation (Grade 1 / 2 / 3)
- PLND decision recommendation based on a 4-scenario asymmetric rule
- Surgical alerts triggered by zone-specific risk thresholds

---

## 3. Training data

**Primary cohort:** 5,352 consecutive patients undergoing RARP at Mount Sinai Health System (New York, NY) between January 2015 and January 2026.

**Trimodal validation cohort:** 815 patients (663 with complete data) with preoperative MRI, micro-ultrasound (ExactVu), and PSMA PET/CT all performed within 90 days of surgery. Independent validation: base models trained on 4,537 patients without trimodal imaging; tested on 815 trimodal patients with zero training overlap.

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

The model uses a mean-imputation + availability-flag architecture: when an input is missing, the model substitutes the cohort mean and sets a binary flag, allowing the model to operate on incomplete data without exclusion. See `docs/DATA_DICTIONARY.md` for full variable definitions, units, and valid ranges.

---

## 5. Outputs

For each patient, COMPASS returns:

1. **Six numeric risk predictions** (ECE, SVI, Upgrade, PSM, BCR, LNI) with 90% confidence intervals
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
- Bootstrap optimism correction (Harrell method, 2,000 iterations) — model refit from scratch in each resample
- Calibration assessed by quintile analysis: ECE calibration slope 0.97, intercept 0.02
- Brier Skill Scores positive across all six endpoints (ECE +6%, SVI +10%, Upgrade +15%, LNI +13%, BCR +15%, PSM +8%)
- Decision curve analysis: net clinical benefit across thresholds 5–40%; COMPASS exceeds treat-all from threshold ≥20% (ECE)

**Independent validation:**
- Strict temporal split: development on 4,537 non-trimodal patients; held-out validation on 815 trimodal patients with zero training overlap
- All independent AUCs reported in Section 2 reflect true out-of-sample performance

**External validation:** Not yet performed. In progress.

**Prospective validation:** Not yet performed. Protocol in development.

---

## 7. Limitations

1. **Single institution.** Developed and validated entirely at Mount Sinai. External and prospective validation are necessary before clinical implementation outside Mount Sinai.
2. **Single surgeon influence.** PSM and BCR endpoints are influenced by surgical technique, which cannot be fully captured preoperatively. PSM AUC of 0.586 reflects this limitation.
3. **BCR follow-up is maturing.** Median follow-up 14 months in the development cohort; full BCR maturation is approximately 60% complete. BCR AUC will be re-estimated with longer follow-up.
4. **Decipher availability.** Only 34% of the cohort has Decipher genomic data. The imputation-flag architecture preserves cohort power but reduces model precision in patients without Decipher.
5. **Selection bias.** This is a surgical cohort. Estimates apply to patients referred for RARP, not to a screening-stage or biopsy-stage population.
6. **Retrospective design** for development. Prospective validation is required before clinical use beyond research.
7. **Race data limitation.** A substantial proportion of records are coded as "Other/Unknown," limiting subgroup analysis by race or ethnicity.
8. **Not a substitute for clinical judgment.** COMPASS predictions are decision support, not a replacement for surgeon expertise, multidisciplinary review, or shared decision-making with the patient.

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
