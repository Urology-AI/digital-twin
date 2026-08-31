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

## 9. How predictions are calculated

This section documents the exact math so that any clinician, auditor, or developer can reproduce a prediction from scratch without reading code.

### 9.1 Formula

Every COMPASS model is a **standardized logistic regression**:

```
logit  =  intercept  +  Σ [ coeff_k × (value_k − mean_k) / scale_k ]

probability  =  1 / (1 + e^(−logit))
```

The `intercept`, `coeff`, `mean`, and `scale` for every feature of every model are stored in one place: `src/lib/models/weights.ts`. That file is the single source of truth — changing a number there changes the model.

### 9.2 Feature engineering

Raw clinical inputs are transformed before entering the formula:

| Input | Transformation | Reason |
|---|---|---|
| PSA + prostate volume | `log(PSA/volume + 0.01)` | PSA density is right-skewed; log makes it approximately normal. `+0.01` prevents log(0). |
| Max core % | If value ≤ 1 → multiply by 100 | Normalises fractional (0.60) and percentage (60) encodings to the same 0–100 scale. |
| PI-RADS | `max(pirads, 2)` | PI-RADS 1 is clinically equivalent to 2 for EPE risk; floors the value to stay within training range. |
| Grade group | Split into three binary flags: `gg2` (GG=2), `gg3` (GG=3), `gg45` (GG≥4) | One-hot encoding with GG1 as the reference. Allows each grade group to have an independent effect rather than assuming linearity. |
| Decipher score | If missing → substitute 0.521 (training cohort mean) and set `decipher_available = 0` | Mean imputation so patients without genomic testing still receive a prediction. The `available` flag lets the model discount the imputed value. |
| ECE concordance | `mri_epe + mus_ece + psma_epe` | Counts how many imaging modalities independently call EPE (0–3). Multi-modal agreement carries more weight than any single modality. |

### 9.3 Standardisation (z-scoring)

Every transformed value is z-scored using the **training cohort** mean and SD:

```
z_k  =  (value_k − mean_k) / scale_k
```

The `mean_k` and `scale_k` in `weights.ts` are the values from the Mount Sinai training cohort (N = 5,352). When applying COMPASS to an external cohort you use these same numbers — do not re-standardise on your own data, or the coefficients will no longer be on the same scale.

### 9.4 ECE-only adjustments (delta terms)

After the main logit is computed, three optional adjustments are added to the ECE patient and side models before the sigmoid is applied. These capture continuous detail that binary flags cannot:

| Adjustment | Inputs required | Effect |
|---|---|---|
| MRI detail delta | `mri_lesion_size`, `mri_capsular_abutment`, `mri_adc` | Adds/subtracts from logit based on lesion size (mm), capsular contact grade (0–4), and ADC value (µm²/s). Abutment grade ≥ 3 without a positive EPE call adds +0.35. |
| ExactVu abutment delta | `ev_abutment = 1` | Adds +0.30 logit when micro-ultrasound shows capsular abutment. Coefficient is estimated (not formally calibrated); flagged as such in the code. |
| PSMA SUV delta | PSMA performed, `suv > 4.5`, `psma_epe` not already flagged | Adds `0.038 × (SUV − 4.5)`, capped at +0.60 (~SUV 20+). Prevents double-counting when the binary `psma_epe` flag is already set. |

### 9.5 Output clamping

To prevent the model from returning probabilities outside its validated range:

| Model | Clamp range |
|---|---|
| ECE patient-level | 2% – 92% |
| ECE side-specific | 2% – 90% |
| All others | None (sigmoid output used directly) |

### 9.6 Worked example — ECE patient

**Inputs:** PSA 12, volume 30 cc, GG3, max core 60%, PI-RADS 4, MRI EPE positive, no Decipher

| Feature | Raw → Transformed | z = (v − mean) / scale | × coeff | Contribution |
|---|---|---|---|---|
| log_psad | log(12/30 + 0.01) = −1.304 | (−1.304 − (−1.617)) / 0.707 | × 0.3285 | **+0.146** |
| grade_group_2 | 0 | (0 − 0.397) / 0.489 | × 0.4091 | **−0.332** |
| grade_group_3 | 1 | (1 − 0.260) / 0.439 | × 0.4912 | **+0.829** |
| grade_group_4_5 | 0 | (0 − 0.239) / 0.426 | × 0.5948 | **−0.334** |
| max_core_pct | 60% | (60 − 51.11) / 32.26 | × 0.2019 | **+0.056** |
| pirads | max(4,2) = 4 | (4 − 4.082) / 0.849 | × 0.3922 | **−0.038** |
| mri_epe | 1 | (1 − 0.150) / 0.357 | × 0.1399 | **+0.333** |
| mri_svi | 0 | (0 − 0.043) / 0.203 | × 0.2352 | **−0.050** |
| mus_ece | 0 | ≈ 0 | × 0.0435 | **0** |
| psma_epe | 0 | ≈ 0 | × 0.0062 | **0** |
| ece_concordance | 0+0+0 = 1 (mri_epe only) | (1 − 0.283) / 0.567 | × 0.0400 | **+0.051** |
| decipher_imputed | missing → 0.521 | (0.521 − 0.645) / 0.118 | × 0.2133 | **−0.226** |
| decipher_available | 0 (missing) | (0 − 0.237) / 0.425 | × 0.4180 | **−0.233** |

```
logit  =  −0.7423  +  0.146 − 0.332 + 0.829 − 0.334 + 0.056 − 0.038 + 0.333 − 0.050 + 0.051 − 0.226 − 0.233
       =  −0.540

probability  =  1 / (1 + e^0.540)  ≈  38%
```

This matches the pinned regression test value of **38.006%** in `src/test/modelOutputs.test.ts`.

### 9.6 Surgical-plan, inflammation-risk and healer-tier modules

These modules turn the model outputs into an advisory operative plan (nerve-sparing
plane and per-zone grade, Retzius-sparing / anterior "hood", bladder-neck
preservation, seminal-vesicle tip-sparing, hydrodissection candidacy), a
periprostatic-inflammation / "obliterated planes" risk tier, and an
erectile-recovery phenotype ("super / healer / delayed healer", from the time the
modeled potency probability first reaches 50%). They also project BCR to 1 year
and 2–3 years under the chosen plan.

**Every number and decision rule** used by these modules is declared in
`src/lib/compass/planningEvidence.ts` (runtime source of truth, mirrored in
`models/surgicalPlanning.json`) with a `source` tag:

| tag | meaning |
|---|---|
| `institutional` | derived from the Mount Sinai RARP cohort / an existing fitted COMPASS model (side ECE/SVI models, the 5,003-side NS-grade→PSM→BCR database) |
| `literature` | a published estimate, paper cited (NS-plane thresholds, hood/BNP/SV/hydrodissection rules, functional-choice deltas, BCR event-timing) |
| `provisional` | an expert-prior default not yet calibrated on COMPASS data — surfaced in the UI as "provisional" (inflammation-risk weights + cutpoints, GG→zone prior, healer threshold, PSM plan-modulation, the functional-outcome nomogram) |

The app renders an **"Evidence & sources"** panel (Planning and Outcomes tabs)
listing every group by tag with its citation. Nothing here changes the six core
COMPASS predictions.

| Artefact | Location |
|---|---|
| Effect sizes + citations | `src/lib/compass/planningEvidence.ts`, `models/surgicalPlanning.json` |
| Inflammation risk | `src/lib/compass/inflammationRisk.ts` |
| Surgical plan | `src/lib/compass/surgicalPlan.ts` |
| BCR-by-plan projection | `src/lib/compass/bcrByPlan.ts` |
| Healer tiers + plan deltas | `src/lib/compass/functionalOutcomes.ts` |
| Tests | `src/test/surgicalPlanning.test.ts` |

### 9.7 Where to find everything

| Artefact | Location |
|---|---|
| All model weights (intercepts, coefficients, means, scales) | `src/lib/models/weights.ts` |
| Model prediction functions | `src/lib/models/ece.ts`, `svi.ts`, `upgrade.ts`, `psm.ts`, `bcr.ts`, `lni.ts` |
| Regression tests (pinned output values) | `src/test/modelOutputs.test.ts` |
| Training script (for retraining on new data) | `models/train_compass.py` |
| Simulation script (synthetic cohort, no data needed) | `models/simulate_compass.py` |
| Input variable definitions | `DATA_DICTIONARY.md` |

---

## 10. How to cite

Citation information is provided in `CITATION.cff` in the repository root. The peer-reviewed manuscript describing COMPASS is in preparation; this card will be updated with the published citation upon acceptance.

---

## 10. Contact

**Corresponding author:** Ashutosh K. Tewari, MD — ash.tewari@mountsinai.org
**First author / repository contact:** Daniel Ajabshir — daniel.ajabshir@mountsinai.org
**Department of Urology**, Icahn School of Medicine at Mount Sinai, 1 Gustave L. Levy Place, New York, NY 10029

---

*This model card follows the structure proposed by Mitchell et al. 2019 (Model Cards for Model Reporting) and the reporting standards of the TRIPOD statement for prediction model studies.*
