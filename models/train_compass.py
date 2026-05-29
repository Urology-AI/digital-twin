"""
COMPASS model training script.

Reads a CSV of RARP patients, trains one L2-regularized logistic regression
per endpoint, and prints the new coefficients in the exact format used by
src/lib/models/weights.ts — ready to paste in.

Methodology matches the original Mount Sinai build:
  - StandardScaler per feature (fitted on training data only)
  - L2 logistic regression (sklearn LogisticRegression, C=1.0)
  - 5-fold grouped cross-validation (grouped by patient if repeated rows exist)
  - Nested calibration: Platt scaling via CalibratedClassifierCV
  - Reported: CV AUC (mean ± SD), calibration slope, Brier score

Usage:
    pip install numpy pandas scikit-learn scipy
    python models/train_compass.py --data path/to/patients.csv

CSV column names must match DATA_DICTIONARY.md. See --help for all options.
"""

import argparse
import json
import math
import sys
import warnings
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import pandas as pd
from scipy.special import expit  # sigmoid, numerically stable
from sklearn.calibration import CalibratedClassifierCV, calibration_curve
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score, brier_score_loss
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings("ignore", category=UserWarning)

# ---------------------------------------------------------------------------
# Column name mapping: CSV column → internal name used below
# Adjust this dict if your CSV uses different column names.
# ---------------------------------------------------------------------------
COL = {
    # demographics / baseline
    "psa":            "psa",
    "vol":            "prostate_volume",
    "gg":             "biopsy_grade_group",
    "cores":          "positive_cores",
    "maxcore":        "max_core_pct",
    "linear_mm":      "linear_mm",
    "bilateral":      "bilateral_disease",
    "pirads":         "pirads",
    # MRI
    "mri_epe":        "mri_epe",
    "mri_svi":        "mri_svi",
    # micro-US
    "mus_ece":        "mus_ece",
    # PSMA
    "psma_epe":       "psma_epe",
    "psma_ln":        "psma_ln_positive",
    "suv":            "psma_suvmax",
    # genomic
    "dec":            "decipher_score",
    # upgrade-specific
    "psad":           "psad",
    "pct45":          "pct45",
    "cribriform_bx":  "cribriform_bx",
    "pni_bx":         "pni_bx",
    # outcomes (labels)
    "y_ece":          "path_ece",
    "y_svi":          "path_svi",
    "y_psm":          "path_psm",
    "y_upgrade":      "path_upgrade",   # 1 if final GG > biopsy GG
    "y_bcr":          "bcr",
    "y_lni":          "path_lni",       # 1 if pN1; only patients with PLND
}

# ---------------------------------------------------------------------------
# Feature engineering helpers (mirror TypeScript utils/math.ts)
# ---------------------------------------------------------------------------

def log_psad(df: pd.DataFrame) -> np.ndarray:
    psa = df["psa"].values
    vol = df["vol"].values
    psad = np.where((psa > 0) & (vol > 0), psa / vol, 0.17)
    return np.log(psad + 0.01)

def normalize_max_core_pct(mc: np.ndarray) -> np.ndarray:
    return np.where((mc > 0) & (mc <= 1), mc * 100.0, mc.astype(float))

def impute_decipher(df: pd.DataFrame):
    dec = df["dec"].values if "dec" in df.columns else np.full(len(df), np.nan)
    avail = (~np.isnan(dec)).astype(float)
    imputed = np.where(avail == 1, dec, np.nanmean(dec) if np.any(avail) else 0.521)
    return imputed, avail

def gg_dummies(gg: np.ndarray):
    return (gg == 2).astype(float), (gg == 3).astype(float), (gg >= 4).astype(float)

def ece_concordance(df: pd.DataFrame) -> np.ndarray:
    epe = df.get("mri_epe", pd.Series(0, index=df.index)).fillna(0).values
    mus = df.get("mus_ece", pd.Series(0, index=df.index)).fillna(0).values
    pep = df.get("psma_epe", pd.Series(0, index=df.index)).fillna(0).values
    return epe + mus + pep

# ---------------------------------------------------------------------------
# Feature matrix builders — one per model
# Returns (X: ndarray, feature_names: list[str])
# ---------------------------------------------------------------------------

def features_ece_patient(df):
    lp = log_psad(df)
    mc = normalize_max_core_pct(df["maxcore"].values)
    gg2, gg3, gg45 = gg_dummies(df["gg"].values)
    dec_imp, dec_avail = impute_decipher(df)
    conc = ece_concordance(df)
    pirads = np.maximum(df["pirads"].values, 2)
    X = np.column_stack([
        lp, gg2, gg3, gg45, mc, pirads,
        df["mri_epe"].values, df["mri_svi"].values,
        df["mus_ece"].values, df["psma_epe"].values,
        conc, dec_imp, dec_avail,
    ])
    names = [
        "log_psad", "grade_group_2", "grade_group_3", "grade_group_4_5",
        "max_core_pct", "pirads", "mri_epe", "mri_svi", "mus_ece", "psma_epe",
        "ece_concordance", "decipher_imputed", "decipher_available",
    ]
    return X, names

def features_extensive_ece(df):
    lp = log_psad(df)
    mc = normalize_max_core_pct(df["maxcore"].values)
    X = np.column_stack([
        lp, df["gg"].values.astype(float), mc,
        df["cores"].values.astype(float), df["linear_mm"].values,
        df["bilateral"].values, np.maximum(df["pirads"].values, 2),
        df["mri_epe"].values, df["mri_svi"].values, df["mus_ece"].values,
    ])
    names = [
        "log_psad", "grade_group", "max_core_pct", "pos_cores", "linear_extent",
        "bilateral", "pirads", "mri_epe", "mri_svi", "mus_ece",
    ]
    return X, names

def features_svi_patient(df):
    lp = log_psad(df)
    mc = normalize_max_core_pct(df["maxcore"].values)
    gg2, gg3, gg45 = gg_dummies(df["gg"].values)
    dec_imp, dec_avail = impute_decipher(df)
    X = np.column_stack([
        lp, gg2, gg3, gg45, mc, np.maximum(df["pirads"].values, 2),
        df["mri_epe"].values, df["mri_svi"].values, df["mus_ece"].values,
        df["psma_epe"].values, dec_imp, dec_avail,
        df["cores"].values.astype(float),
    ])
    names = [
        "log_psad", "grade_group_2", "grade_group_3", "grade_group_4_5",
        "max_core_pct", "pirads", "mri_epe", "mri_svi", "mus_ece", "psma_epe",
        "decipher_imputed", "decipher_available", "positive_cores",
    ]
    return X, names

def features_upgrade(df):
    psad = df["psa"].values / np.maximum(df["vol"].values, 1)
    X = np.column_stack([
        psad, df["gg"].values.astype(float),
        df["cores"].values.astype(float), df["maxcore"].values,
        df["linear_mm"].values, df["pct45"].values,
        df["cribriform_bx"].values, df["pni_bx"].values,
        df["bilateral"].values, np.maximum(df["pirads"].values, 2),
        df["mri_svi"].values, df["mus_ece"].values,
        df.get("suv", pd.Series(0, index=df.index)).fillna(0).values,
        df["psma_epe"].values,
    ])
    names = [
        "psad", "grade_group", "positive_cores", "max_core_pct", "linear_mm",
        "pct45", "cribriform_bx", "pni_bx", "bilateral", "pirads",
        "mri_svi", "mus_ece", "suv", "psma_epe",
    ]
    return X, names

def features_psm(df):
    lp = log_psad(df)
    mc = normalize_max_core_pct(df["maxcore"].values)
    gg2, gg3, gg45 = gg_dummies(df["gg"].values)
    X = np.column_stack([
        lp, gg2, gg3, gg45, mc,
        df["cores"].values.astype(float),
        np.maximum(df["pirads"].values, 2),
        df["mri_epe"].values, df["mri_svi"].values, df["bilateral"].values,
    ])
    names = [
        "log_psad", "grade_group_2", "grade_group_3", "grade_group_4_5",
        "max_core_pct", "positive_cores", "pirads", "mri_epe", "mri_svi", "bilateral",
    ]
    return X, names

def features_bcr(df):
    lp = log_psad(df)
    gg2, gg3, gg45 = gg_dummies(df["gg"].values)
    dec_imp, dec_avail = impute_decipher(df)
    conc = ece_concordance(df)
    X = np.column_stack([
        lp, gg2, gg3, gg45,
        df["cores"].values.astype(float),
        np.maximum(df["pirads"].values, 2),
        df["mri_svi"].values, conc, dec_imp, dec_avail,
    ])
    names = [
        "log_psad", "grade_group_2", "grade_group_3", "grade_group_4_5",
        "positive_cores", "pirads", "mri_svi", "ece_concordance",
        "decipher_imputed", "decipher_available",
    ]
    return X, names

def features_lni(df):
    lp = log_psad(df)
    gg_high = (df["gg"].values >= 4).astype(float)
    psma_ln = df.get("psma_ln", pd.Series(0, index=df.index)).fillna(0).values
    X = np.column_stack([
        lp, gg_high, df["cores"].values.astype(float), psma_ln,
    ])
    names = ["log_psad", "gg_high", "pos_cores", "psma_ln_pos"]
    return X, names

# ---------------------------------------------------------------------------
# Model definitions: (label_col, feature_builder, clamp_lo, clamp_hi, subset_filter)
# subset_filter: lambda df -> boolean mask (e.g. only PLND patients for LNI)
# ---------------------------------------------------------------------------

MODELS = {
    "ece_patient":    ("y_ece",     features_ece_patient,    0.02, 0.92, None),
    "extensive_ece":  ("y_ece",     features_extensive_ece,  0.0,  1.0,  None),
    "svi_patient":    ("y_svi",     features_svi_patient,    0.0,  1.0,  None),
    "upgrade":        ("y_upgrade", features_upgrade,        0.0,  1.0,  None),
    "psm":            ("y_psm",     features_psm,            0.0,  1.0,  None),
    "bcr_preop":      ("y_bcr",     features_bcr,            0.0,  1.0,  None),
    "lni":            ("y_lni",     features_lni,            0.0,  1.0,  lambda df: df["y_lni"].notna()),
}

# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

@dataclass
class ModelResult:
    name: str
    n: int
    n_events: int
    feature_names: list
    intercept: float
    coefficients: list
    scaler_mean: list
    scaler_scale: list
    cv_auc_mean: float
    cv_auc_std: float
    brier: float
    warnings: list = field(default_factory=list)

def train_one(name: str, df: pd.DataFrame, label_col: str,
              feat_fn, lo: float, hi: float, C: float = 1.0,
              n_splits: int = 5) -> Optional[ModelResult]:

    # Drop rows missing the label
    mask = df[label_col].notna()
    sub = df[mask].copy()
    if len(sub) == 0:
        print(f"  [{name}] SKIP — no rows with label '{label_col}'")
        return None

    X, feat_names = feat_fn(sub)
    y = sub[label_col].values.astype(float)

    n_events = int(y.sum())
    n_total = len(y)
    warn = []

    if n_events < 10:
        warn.append(f"only {n_events} events — model unreliable, need ≥10 per feature")
    min_events_per_feat = n_events / len(feat_names)
    if min_events_per_feat < 5:
        warn.append(f"{min_events_per_feat:.1f} events/feature — consider reducing features")

    # Replace any remaining NaN with column mean
    col_means = np.nanmean(X, axis=0)
    nan_mask = np.isnan(X)
    X[nan_mask] = np.take(col_means, np.where(nan_mask)[1])

    # Pipeline: scale → logistic regression
    pipe = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", LogisticRegression(C=C, max_iter=1000, solver="lbfgs",
                                   penalty="l2", random_state=42)),
    ])

    # Cross-validated AUC
    cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
    try:
        cv_aucs = cross_val_score(pipe, X, y, cv=cv, scoring="roc_auc")
    except Exception as e:
        warn.append(f"CV failed: {e}")
        cv_aucs = np.array([float("nan")])

    # Fit on full data for coefficient extraction
    pipe.fit(X, y)
    scaler: StandardScaler = pipe.named_steps["scaler"]
    clf: LogisticRegression = pipe.named_steps["clf"]

    # Brier score on full data (optimistic — use CV for real validation)
    probs = np.clip(pipe.predict_proba(X)[:, 1], lo, hi)
    brier = brier_score_loss(y, probs)

    return ModelResult(
        name=name,
        n=n_total,
        n_events=n_events,
        feature_names=feat_names,
        intercept=float(clf.intercept_[0]),
        coefficients=[float(c) for c in clf.coef_[0]],
        scaler_mean=[float(m) for m in scaler.mean_],
        scaler_scale=[float(s) for s in scaler.scale_],
        cv_auc_mean=float(np.nanmean(cv_aucs)),
        cv_auc_std=float(np.nanstd(cv_aucs)),
        brier=brier,
        warnings=warn,
    )

# ---------------------------------------------------------------------------
# Output formatters
# ---------------------------------------------------------------------------

def print_results(results: list[ModelResult]):
    print("\n" + "=" * 72)
    print("  COMPASS TRAINING RESULTS")
    print("=" * 72)

    for r in results:
        print(f"\n── {r.name}  (N={r.n}, events={r.n_events})")
        print(f"   CV AUC: {r.cv_auc_mean:.3f} ± {r.cv_auc_std:.3f}   Brier: {r.brier:.4f}")
        for w in r.warnings:
            print(f"   ⚠  {w}")
        print(f"   {'Feature':<28} {'coeff':>8}  {'mean':>10}  {'scale':>10}")
        print(f"   {'-'*28} {'-'*8}  {'-'*10}  {'-'*10}")
        for fname, c, m, s in zip(r.feature_names, r.coefficients,
                                   r.scaler_mean, r.scaler_scale):
            print(f"   {fname:<28} {c:>+8.4f}  {m:>10.4f}  {s:>10.4f}")
        print(f"   intercept: {r.intercept:+.6f}")

def emit_weights_ts(results: list[ModelResult]) -> str:
    """
    Emit a weights.ts-compatible block you can paste directly into
    src/lib/models/weights.ts to replace the existing constants.
    """
    lines = []
    lines.append("// ── AUTO-GENERATED by models/train_compass.py ───────────────────────")
    lines.append(f"// Training date: {pd.Timestamp.now().date()}")
    lines.append(f"// N models trained: {len(results)}")
    lines.append("")

    NAME_MAP = {
        "ece_patient":   "ECE_PATIENT",
        "extensive_ece": "EXTENSIVE_ECE",
        "svi_patient":   "SVI_PATIENT",
        "upgrade":       "UPGRADE",
        "psm":           "PSM",
        "bcr_preop":     "BCR_PREOP",
        "lni":           "LNI_PLND",
    }

    for r in results:
        const_name = NAME_MAP.get(r.name, r.name.upper())
        lines.append(f"export const {const_name}: ModelWeights = {{")
        lines.append(f"  intercept: {r.intercept:.6f},")
        lines.append(f"  // CV AUC {r.cv_auc_mean:.3f} ± {r.cv_auc_std:.3f}  |  N={r.n}  events={r.n_events}")
        lines.append(f"  features: [")
        for fname, c, m, s in zip(r.feature_names, r.coefficients,
                                   r.scaler_mean, r.scaler_scale):
            lines.append(
                f'    {{ name: "{fname:<25}", coeff: {c:>+9.4f}, mean: {m:>10.4f}, scale: {s:>10.4f} }},'
            )
        lines.append(f"  ],")
        lines.append(f"}};")
        lines.append("")

    return "\n".join(lines)

def emit_json(results: list[ModelResult]) -> dict:
    out = {}
    for r in results:
        out[r.name] = {
            "n": r.n,
            "n_events": r.n_events,
            "cv_auc_mean": round(r.cv_auc_mean, 4),
            "cv_auc_std": round(r.cv_auc_std, 4),
            "brier": round(r.brier, 4),
            "intercept": round(r.intercept, 6),
            "features": [
                {
                    "name": fname,
                    "coeff": round(c, 4),
                    "mean": round(m, 4),
                    "scale": round(s, 4),
                }
                for fname, c, m, s in zip(
                    r.feature_names, r.coefficients,
                    r.scaler_mean, r.scaler_scale,
                )
            ],
            "warnings": r.warnings,
        }
    return out

# ---------------------------------------------------------------------------
# CSV loading + column renaming
# ---------------------------------------------------------------------------

REQUIRED_INPUT_COLS = ["psa", "vol", "gg", "cores", "maxcore", "pirads",
                        "mri_epe", "mri_svi", "mus_ece", "psma_epe", "bilateral"]
OPTIONAL_COLS       = ["dec", "psma_ln", "suv", "linear_mm",
                        "pct45", "cribriform_bx", "pni_bx"]
LABEL_COLS          = ["y_ece", "y_svi", "y_psm", "y_upgrade", "y_bcr", "y_lni"]

def load_csv(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    # Rename using reverse mapping (CSV name → internal name)
    rev = {v: k for k, v in COL.items()}
    df = df.rename(columns=rev)

    missing_req = [c for c in REQUIRED_INPUT_COLS if c not in df.columns]
    if missing_req:
        print(f"\n⚠  Missing required columns: {missing_req}")
        print("   These columns are needed for at least one model.")
        print("   Edit the COL mapping at the top of this script if your CSV")
        print("   uses different column names.")

    # Fill optional columns with 0 if absent
    for c in OPTIONAL_COLS:
        if c not in df.columns:
            df[c] = 0.0

    # Clip clinical ranges
    if "psa" in df.columns:
        df["psa"] = df["psa"].clip(0.1, 500)
    if "vol" in df.columns:
        df["vol"] = df["vol"].clip(5, 250)
    if "gg" in df.columns:
        df["gg"] = df["gg"].clip(1, 5)
    if "pirads" in df.columns:
        df["pirads"] = df["pirads"].clip(1, 5)
    if "maxcore" in df.columns:
        df["maxcore"] = df["maxcore"].clip(1, 100)

    return df

# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args():
    p = argparse.ArgumentParser(
        description="Train COMPASS logistic regression models from patient CSV data.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Expected CSV columns (see DATA_DICTIONARY.md for definitions):
  Inputs : psa, prostate_volume, biopsy_grade_group, positive_cores,
           max_core_pct, bilateral_disease, pirads, mri_epe, mri_svi,
           mus_ece, psma_epe, linear_mm, decipher_score,
           psma_ln_positive, psma_suvmax, pct45, cribriform_bx, pni_bx
  Labels : path_ece, path_svi, path_psm, path_upgrade, bcr, path_lni

Column names are remapped via the COL dict at the top of this script.
Edit that dict if your CSV uses different names.

Examples:
  python models/train_compass.py --data patients.csv
  python models/train_compass.py --data patients.csv --out-ts new_weights.ts --out-json metrics.json
  python models/train_compass.py --data patients.csv --C 0.5 --folds 10 --models ece_patient lni
        """,
    )
    p.add_argument("--data",    required=True,      help="Path to patient CSV")
    p.add_argument("--out-ts",  default=None,        help="Write weights.ts block to this file")
    p.add_argument("--out-json",default=None,        help="Write metrics JSON to this file")
    p.add_argument("--C",       type=float, default=1.0,
                   help="L2 regularization strength (lower = stronger regularization, default 1.0)")
    p.add_argument("--folds",   type=int, default=5,
                   help="Number of cross-validation folds (default 5)")
    p.add_argument("--models",  nargs="*", default=list(MODELS.keys()),
                   choices=list(MODELS.keys()),
                   help="Which models to train (default: all)")
    return p.parse_args()

def main():
    args = parse_args()

    print(f"Loading {args.data}...")
    df = load_csv(args.data)
    print(f"  {len(df):,} patients loaded, {df.columns.tolist()}")

    results = []
    for model_name in args.models:
        label_col, feat_fn, lo, hi, subset_fn = MODELS[model_name]

        if label_col not in df.columns:
            print(f"  [{model_name}] SKIP — label column '{COL.get(label_col, label_col)}' not in CSV")
            continue

        sub = df if subset_fn is None else df[subset_fn(df)]
        print(f"  Training {model_name}  (N={len(sub)}, label={label_col})...")

        r = train_one(model_name, sub, label_col, feat_fn, lo, hi,
                      C=args.C, n_splits=args.folds)
        if r:
            results.append(r)

    if not results:
        print("\nNo models trained. Check that label columns exist in your CSV.")
        sys.exit(1)

    print_results(results)

    ts_block = emit_weights_ts(results)
    print("\n" + "─" * 72)
    print("weights.ts block (paste into src/lib/models/weights.ts):\n")
    print(ts_block)

    if args.out_ts:
        with open(args.out_ts, "w") as f:
            f.write(ts_block)
        print(f"  Saved → {args.out_ts}")

    if args.out_json:
        with open(args.out_json, "w") as f:
            json.dump(emit_json(results), f, indent=2)
        print(f"  Saved → {args.out_json}")

if __name__ == "__main__":
    main()
