# COMPASS Digital Twin

A production-style React + TypeScript port of the COMPASS 3D decision-support viewer for preoperative surgical planning in prostate cancer. All models run in the browser; patient data loads from `src/data/patients.json` with optional `localStorage` persistence.

**Web tool:** https://urology-ai.github.io/digital-twin/
**Repository:** https://github.com/Urology-AI/digital-twin

> ⚠️ **Research Use Only.** Not FDA cleared. IRB STUDY-14-00050 (Mount Sinai). Predictions are decision support, not a substitute for clinical judgment.

---

## What is COMPASS?

COMPASS predicts surgical outcomes for prostate cancer patients undergoing robot-assisted radical prostatectomy by combining clinical data with three imaging modalities (MRI, micro-ultrasound, PSMA PET/CT) and the optional Decipher genomic classifier. It generates side-specific nerve-sparing recommendations and zone-level risk visualizations on a 3D anatomical model.

**Cohort:** 5,352 consecutive RARP patients (Mount Sinai, 2015–2026) with independent validation on 815 trimodal imaging patients.

**Models:** 9 prediction models — patient-level and side-specific ECE, focal vs extensive ECE, patient-level and side-specific SVI, grade upgrade, LNI, BCR, and PSM — plus a 5-zone nerve-sparing algorithm and PLND decision module.

For full details on intended use, performance, training data, and limitations, see [`MODEL_CARD.md`](./MODEL_CARD.md).

---

## Quick start

### Run locally

```bash
git clone git@github.com:Urology-AI/digital-twin.git
cd digital-twin
npm install
npm run dev
```

Open the URL Vite prints (typically `http://localhost:5173`).

### Build

```bash
npm run build
npm run preview
```

### Tests

```bash
npm test
```

### Data

- Primary catalog: `src/data/patients.json` — array of `{ id, name, record }` where `record` matches schema `prostate-3d-input-v1`.
- Import additional cases via **Import JSON** in the case workspace (same schema).
- For variable definitions and valid ranges, see [`DATA_DICTIONARY.md`](./DATA_DICTIONARY.md).

---

## For researchers — replicating, validating, or extending COMPASS

If you are evaluating COMPASS for external validation, secondary research, or integration into your own clinical workflow, start here:

| Resource | What it contains |
|---|---|
| [`MODEL_CARD.md`](./MODEL_CARD.md) | Intended use, performance metrics, training data, limitations, ethical considerations |
| [`DATA_DICTIONARY.md`](./DATA_DICTIONARY.md) | Every input and output variable with type, units, valid range, and clinical definition |
| [`CITATION.cff`](./CITATION.cff) | How to cite COMPASS in your publications |
| `models/coefficients.json` *(forthcoming)* | All model coefficients in machine-readable form for direct external implementation |
| `examples/predict_batch.py` *(forthcoming)* | Standalone script to generate predictions for a CSV of patients |
| `examples/example_patients.csv` *(forthcoming)* | Synthetic patients showing exact input format |

### External validation

We welcome external validation collaborations. If your institution has a comparable RARP cohort with preoperative imaging and final pathology, please contact the corresponding author (`ash.tewari@mountsinai.org`). We can provide model coefficients, a batch prediction script, and analysis support.

### Reporting issues

For bugs, prediction errors, or documentation gaps, please open an issue at https://github.com/Urology-AI/digital-twin/issues.

---

## Stack

Vite, React 18, TypeScript (strict), Tailwind CSS, Radix-based UI primitives, Zustand, React Hook Form + Zod, Three.js (r170).

## License

MIT — see [`LICENSE`](./LICENSE). Research use only; the additional notice in the LICENSE file applies.

## Contributing

Work on a branch and open a pull request against `main`.

## Citation

See [`CITATION.cff`](./CITATION.cff). Manuscript in preparation; this README will be updated with the published citation upon acceptance.
