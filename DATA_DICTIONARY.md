# COMPASS Data Dictionary

This document defines every variable used as input to or output from the COMPASS model. Anyone wishing to apply COMPASS to their own data, externally validate the model, or audit its inputs should refer to this dictionary.

**Schema version:** `prostate-3d-input-v1`

---

## How variables are categorized

- **Required**: Model will not run without this variable.
- **Recommended**: Model runs but loses meaningful discrimination without it. Imputed if missing, with availability flag set to 0.
- **Optional**: Adds incremental discrimination when present.

---

## 1. Demographics & baseline clinical

| Variable | Type | Units | Valid range | Required? | Notes |
|---|---|---|---|---|---|
| `age` | numeric | years | 18–95 | Required | Age at PSMA PET / surgical planning |
| `psa` | numeric | ng/mL | 0.1–500 | Required | Most recent pre-treatment PSA |
| `prostate_volume` | numeric | cc | 5–250 | Required | Measured on MRI or TRUS, whichever closest to surgery |
| `psad` | numeric | ng/mL/cc | calculated | Auto | PSA / Prostate volume; auto-calculated if both above present |
| `psa_doubling_time` | numeric | months | optional | Optional | PSA kinetics indicator if available |
| `bmi` | numeric | kg/m² | 15–60 | Optional | Not in current model; collected for cohort description |

---

## 2. Biopsy pathology

| Variable | Type | Units | Valid range | Required? | Notes |
|---|---|---|---|---|---|
| `biopsy_grade_group` | integer | — | 1–5 | Required | Highest GG across all positive cores |
| `positive_cores` | integer | count | 0–30 | Required | Total positive cores at biopsy |
| `total_cores` | integer | count | 6–30 | Required | Total cores sampled (denominator for percent positive) |
| `max_core_pct` | numeric | % | 1–100 | Required | Maximum percent involvement of any single core |
| `bilateral_disease` | binary | 0/1 | — | Recommended | 1 if positive cores in both lobes |
| `pni` | binary | 0/1 | — | Recommended | Perineural invasion at biopsy (1 = yes, 0 = no) |
| `cribriform` | binary | 0/1 | — | Recommended | Cribriform pattern present at biopsy |
| `idc` | binary | 0/1 | — | Recommended | Intraductal carcinoma at biopsy |

---

## 3. MRI variables

| Variable | Type | Units | Valid range | Required? | Notes |
|---|---|---|---|---|---|
| `pirads` | integer | — | 1–5 | Recommended | Highest PI-RADS score across all lesions; PI-RADS v2.1 |
| `mri_epe` | binary | 0/1 | — | Recommended | Radiologist's binary call for extraprostatic extension |
| `mri_svi` | binary | 0/1 | — | Recommended | Radiologist's binary call for seminal vesicle invasion |
| `mri_lesion_size` | numeric | mm | 1–80 | Optional | Largest dimension of dominant lesion |
| `mri_capsular_abutment` | integer | — | 0–4 | Optional | 0=no contact, 1=abuts, 2=broad abutment, 3=irregular, 4=bulge beyond capsule |
| `mri_adc_mean` | numeric | ×10⁻⁶ mm²/s | 200–2000 | Optional | ADC mean of index lesion on diffusion-weighted MRI |
| `mri_lesion_side` | categorical | L/R/B | — | Recommended | Side of dominant lesion (Left, Right, Bilateral) |
| `mri_lesion_zone` | categorical | — | apex/mid/base/anterior/posterior | Optional | Zone of dominant lesion for heatmap localization |

**Acquisition standard:** 3.0 Tesla MRI; interpreted by genitourinary radiologist using PI-RADS v2.1.

---

## 4. Micro-ultrasound (ExactVu) variables

| Variable | Type | Units | Valid range | Required? | Notes |
|---|---|---|---|---|---|
| `mus_primus` | integer | — | 1–5 | Optional | PRI-MUS score (highest across lesions) |
| `mus_ece` | binary | 0/1 | — | Recommended (when MUS performed) | Operator's binary call for ECE |
| `mus_svi` | binary | 0/1 | — | Optional | Operator's binary call for SVI |
| `mus_lesion_side` | categorical | L/R/B | — | Optional | Side of dominant MUS lesion |

**Acquisition standard:** ExactVu high-resolution micro-ultrasound system (Exact Imaging, Markham, Ontario, Canada) operating at 29 MHz.

---

## 5. PSMA PET variables

| Variable | Type | Units | Valid range | Required? | Notes |
|---|---|---|---|---|---|
| `psma_suvmax` | numeric | — | 0.1–100 | Recommended (when PSMA performed) | SUVmax of dominant intraprostatic lesion |
| `psma_epe` | binary | 0/1 | — | Recommended | Reader's binary call for extraprostatic extension on PSMA |
| `psma_svi` | binary | 0/1 | — | Optional | Reader's binary call for seminal vesicle invasion on PSMA |
| `psma_ln_positive` | binary | 0/1 | — | Recommended | Any PSMA-avid lymph node consistent with metastasis |
| `psma_ln_suvmax` | numeric | — | 0.1–50 | Optional | SUVmax of most suspicious PSMA-positive node |
| `psma_ln_station` | categorical | — | external_iliac/inguinal/common_iliac/presacral/obturator/internal_iliac/perirectal | Optional | Anatomic station of dominant suspicious node (informs station-specific FP rate) |
| `psma_tracer` | categorical | — | 68Ga-PSMA-11 / 18F-PSMA-1007 / 18F-piflufolastat / other | Optional | For cohort description and subgroup analysis |

---

## 6. Decipher genomic classifier

| Variable | Type | Units | Valid range | Required? | Notes |
|---|---|---|---|---|---|
| `decipher_score` | numeric | — | 0–1 | Optional | Continuous Decipher score; manufacturer GenomeDx Biosciences |
| `decipher_available` | binary | 0/1 | — | Auto | Set to 0 if `decipher_score` missing; 1 if present |
| `decipher_category` | categorical | — | low / intermediate / high | Auto | Low <0.45, Intermediate 0.45–0.60, High ≥0.60 |

**Imputation:** When `decipher_score` is missing, the model substitutes the cohort mean (0.521) and sets `decipher_available = 0`. This preserves cohort power without penalizing patients without genomic testing.

---

## 7. Pathology outcomes (training labels; not user inputs)

| Variable | Type | Units | Valid range | Notes |
|---|---|---|---|---|
| `path_ece` | binary | 0/1 | — | Pathologic extracapsular extension on RP specimen |
| `path_svi` | binary | 0/1 | — | Pathologic seminal vesicle invasion |
| `path_psm` | binary | 0/1 | — | Positive surgical margin (tumor at inked margin) |
| `path_grade_group` | integer | — | 1–5 | Final pathology grade group |
| `path_t_stage` | categorical | — | pT2/pT3a/pT3b/pT4 | Pathologic T stage |
| `path_n_stage` | categorical | — | pN0/pN1 | Pathologic N stage at PLND |
| `bcr` | binary | 0/1 | — | Biochemical recurrence: PSA ≥0.2 ng/mL on two consecutive measurements ≥6 weeks apart |

**Pathology standard:** All pathologic endpoints evaluated by dedicated genitourinary pathologists at Mount Sinai using whole-mount RP specimens.

---

## 8. Model outputs

| Output | Type | Units | Notes |
|---|---|---|---|
| `prob_ece` | numeric | 0–1 | Predicted probability of ECE |
| `prob_ece_left` | numeric | 0–1 | Side-specific ECE probability, left side |
| `prob_ece_right` | numeric | 0–1 | Side-specific ECE probability, right side |
| `prob_svi` | numeric | 0–1 | Predicted probability of SVI (patient-level) |
| `prob_svi_left` | numeric | 0–1 | Side-specific SVI probability, left side (patient-level model applied to lobe) |
| `prob_svi_right` | numeric | 0–1 | Side-specific SVI probability, right side (patient-level model applied to lobe) |
| `prob_upgrade` | numeric | 0–1 | Predicted probability of grade group upgrade |
| `prob_lni` | numeric | 0–1 | Predicted probability of LNI; 4-feature parsimonious model (log PSAD, GG4–5 binary, positive cores, PSMA LN+) |
| `prob_bcr` | numeric | 0–1 | Predicted probability of biochemical recurrence |
| `prob_psm` | numeric | 0–1 | Predicted probability of positive surgical margin |
| `ns_grade_left` | integer | 1/2/3 | Recommended nerve-sparing grade, left side |
| `ns_grade_right` | integer | 1/2/3 | Recommended nerve-sparing grade, right side |
| `plnd_recommendation` | categorical | omit/limited/eplnd | PLND decision |
| `zone_ece_*` | numeric | 0–1 | Per-zone ECE risk for each of the 5 zones × 2 sides |
| `surgical_alerts` | array | — | List of triggered surgical alerts |

---

## 9. Notes on input file format

The web tool accepts patient records as JSON conforming to schema `prostate-3d-input-v1`. The structure mirrors the field names in this dictionary. For batch programmatic use, see `examples/predict_batch.py` and `examples/example_patients.csv`.

---

*Last updated: May 2026. Variable list reflects COMPASS Model build v22, verified 2026-05-03, production deployment v2.5.1.*
