/** Short clinical explanations for the "Explain" drawer (decision support context). */
export const PREDICTION_EXPLANATIONS: Record<string, string> = {
  overview:
    "COMPASS combines biopsy, MRI (PI-RADS, EPE, SVI, lesion detail), micro-US, PSMA PET, and optional Decipher to estimate capsular extension, SVI, upgrading, margins, BCR, and node risk — with lateralized models and a five-zone nerve-sparing framework calibrated to institutional outcomes.",
  ECE: "Extracapsular extension (pT3a) at radical prostatectomy — probability that tumor penetrates beyond the prostatic capsule on final pathology. Combines biopsy grade group, PSA density, PI-RADS, trimodal imaging concordance (MRI EPE + micro-US ECE + PSMA), lesion size, abutment score (0–4), ADC, and Decipher when available.",
  SVI: "Seminal vesicle invasion (pT3b) at radical prostatectomy — risk of pathological SV involvement confirmed on final specimen. Primarily driven by MRI SVI signal, biopsy grade group, core burden, and PI-RADS. Note: MUS ECE contributes via an estimated delta (not formally calibrated).",
  Upgrade: "Pathological grade upgrade — probability that the final surgical specimen shows a higher grade group than the biopsy. e.g., GG2 biopsy upgraded to GG3+ on pathology. Higher risk with low biopsy GG (more upgrade headroom), fewer cores sampled, cribriform/IDC features, and high PI-RADS.",
  PSM: "Positive surgical margin at radical prostatectomy — preoperative probability that at least one resection margin will be involved with cancer on final pathology. Bilateral disease and PSA density are the strongest drivers. Note: intraoperative surgeon technique also significantly influences this outcome.",
  BCR: "Biochemical recurrence within 5 years of radical prostatectomy — probability of PSA ≥ 0.2 ng/mL confirmed on repeat testing (AUA definition). Integrates PSA density, grade pattern (GG dummies), MRI SVI, imaging ECE concordance across modalities, and Decipher score when present.",
  LNI: "Lymph node invasion — probability of pathological metastasis found at extended pelvic lymph node dissection (ePLND). Validated on ePLND template (obturator + external + internal iliac + common iliac). PSMA nodal positivity is the strongest single predictor; larger prostate volume is protective via the PSA density effect.",
  L: "Left nerve-sparing grade from zone-aware distribution of lateralized ECE/SVI risk and MRI flags.",
  R: "Right nerve-sparing grade — symmetric logic to the left side.",
};
