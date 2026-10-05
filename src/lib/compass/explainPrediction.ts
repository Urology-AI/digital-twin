/** Short clinical explanations for the "Explain" drawer (decision support context). */
export const PREDICTION_EXPLANATIONS: Record<string, string> = {
  overview:
    "COMPASS combines biopsy, MRI (PI-RADS, EPE, SVI, lesion detail), micro-US, PSMA PET, and optional Decipher to estimate capsular extension, SVI, upgrading, margins, BCR, and node risk — with lateralized models and a five-zone nerve-sparing framework calibrated to institutional outcomes.",
  ECE: "Extracapsular extension (pT3a) at radical prostatectomy — probability that tumor penetrates beyond the prostatic capsule on final pathology. Combines biopsy grade group, PSA density, PI-RADS, trimodal imaging concordance (MRI EPE + micro-US ECE + PSMA), lesion size, abutment score (0–4), ADC, and Decipher when available.",
  SVI: "Seminal vesicle invasion (pT3b) at radical prostatectomy — risk of pathological SV involvement confirmed on final specimen. Primarily driven by MRI SVI signal, biopsy grade group, core burden, and PI-RADS. Note: MUS ECE contributes via an estimated delta (not formally calibrated).",
  Upgrade: "Pathological grade upgrade — probability that the final surgical specimen shows a higher grade group than the biopsy. e.g., GG2 biopsy upgraded to GG3+ on pathology. Higher risk with low biopsy GG (more upgrade headroom), fewer cores sampled, cribriform/IDC features, and high PI-RADS.",
  PSM: "Positive surgical margin at radical prostatectomy, predicted separately for the left and right side. Drivers are PSA density, number of positive biopsy cores and the PI-RADS of the MRI index lesion on that side. Surgeon technique also influences this outcome.",
  BCR: "Biochemical recurrence after radical prostatectomy (PSA rise), shown as the estimated risk at 12, 24 and 36 months with a Low / Intermediate / High tier for each. Uses grade group, PSA density, PI-RADS, MRI SVI, MRI EPE and ADC. Provisional Cox model. Internal C-index 0.722; 2024-25 temporal C-index 0.698.",
  LNI: "Lymph node invasion — probability of pathological metastasis found at extended pelvic lymph node dissection (ePLND). Validated on ePLND template (obturator + external + internal iliac + common iliac). PSMA nodal positivity is the strongest single predictor; larger prostate volume is protective via the PSA density effect.",
  L: "Left nerve-sparing grade from zone-aware distribution of lateralized ECE/SVI risk and MRI flags.",
  R: "Right nerve-sparing grade — symmetric logic to the left side.",
};
