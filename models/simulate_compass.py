"""
COMPASS model simulation script.
Mirrors the exact TypeScript model math from src/lib/models/ using the
same coefficients, means, and scales from weights.ts.

Since you don't have real patient data this generates a synthetic cohort
with realistic clinical distributions (based on published RARP literature)
and runs every COMPASS model on it.

Usage:
    pip install numpy pandas matplotlib scipy
    python models/simulate_compass.py

Outputs:
    - Console: per-model statistics and feature contribution table
    - Plots:   probability distributions and risk stratification (if matplotlib available)
"""

import math
import numpy as np
import pandas as pd

try:
    import matplotlib.pyplot as plt
    import matplotlib.gridspec as gridspec
    HAS_PLOT = True
except ImportError:
    HAS_PLOT = False
    print("matplotlib not installed — skipping plots. pip install matplotlib to enable.\n")

np.random.seed(42)
N = 1000  # synthetic cohort size

# ---------------------------------------------------------------------------
# Exact model math (mirrors src/lib/utils/math.ts + linearPredict in model files)
# ---------------------------------------------------------------------------

def sigmoid(x):
    return 1.0 / (1.0 + math.exp(-x))

def sigmoid_arr(x):
    return 1.0 / (1.0 + np.exp(-x))

def log_psad(psa, vol):
    psad = np.where((psa > 0) & (vol > 0), psa / vol, 0.17)
    return np.log(psad + 0.01)

def normalize_max_core_pct(mc):
    return np.where((mc > 0) & (mc <= 1), mc * 100, mc)

def linear_predict(intercept, features, vals_dict):
    """
    features: list of dicts with keys name/coeff/mean/scale
    vals_dict: {feature_name: array}
    Returns logit array.
    """
    L = np.full(N, float(intercept))
    for f in features:
        v = vals_dict.get(f["name"])
        if v is None:
            continue
        sk = f["scale"]
        if sk > 0:
            L += f["coeff"] * ((v - f["mean"]) / sk)
    return L

def feature_contributions(intercept, features, vals_dict):
    """Return per-feature mean absolute contribution for a single patient or array."""
    rows = []
    for f in features:
        v = vals_dict.get(f["name"])
        if v is None:
            continue
        sk = f["scale"]
        if sk > 0:
            contrib = f["coeff"] * ((v - f["mean"]) / sk)
            rows.append({
                "feature": f["name"],
                "coeff": f["coeff"],
                "mean_value": float(np.mean(v)),
                "mean_contribution": float(np.mean(contrib)),
                "abs_contribution": float(np.mean(np.abs(contrib))),
            })
    return sorted(rows, key=lambda r: abs(r["coeff"]), reverse=True)

# ---------------------------------------------------------------------------
# Weights — exact copy of src/lib/models/weights.ts
# ---------------------------------------------------------------------------

ECE_PATIENT = {
    "intercept": -0.7423,
    "features": [
        {"name": "log_psad",           "coeff": 0.3285, "mean": -1.6174, "scale": 0.7068},
        {"name": "grade_group_2",      "coeff": 0.4091, "mean":  0.3970, "scale": 0.4893},
        {"name": "grade_group_3",      "coeff": 0.4912, "mean":  0.2603, "scale": 0.4388},
        {"name": "grade_group_4_5",    "coeff": 0.5948, "mean":  0.2389, "scale": 0.4264},
        {"name": "max_core_pct",       "coeff": 0.2019, "mean": 51.1131, "scale": 32.2602},
        {"name": "pirads",             "coeff": 0.3922, "mean":  4.0824, "scale":  0.8493},
        {"name": "mri_epe",            "coeff": 0.1399, "mean":  0.1499, "scale":  0.3570},
        {"name": "mri_svi",            "coeff": 0.2352, "mean":  0.0428, "scale":  0.2025},
        {"name": "mus_ece",            "coeff": 0.0435, "mean":  0.1071, "scale":  0.3092},
        {"name": "psma_epe",           "coeff": 0.0062, "mean":  0.0264, "scale":  0.1602},
        {"name": "ece_concordance",    "coeff": 0.0400, "mean":  0.2834, "scale":  0.5672},
        {"name": "decipher_imputed",   "coeff": 0.2133, "mean":  0.6446, "scale":  0.1175},
        {"name": "decipher_available", "coeff": 0.4180, "mean":  0.2372, "scale":  0.4254},
    ],
}

EXTENSIVE_ECE = {
    "intercept": -0.1975,
    "features": [
        {"name": "log_psad",      "coeff":  0.3742, "mean": -1.3727, "scale":  0.7027},
        {"name": "grade_group",   "coeff":  0.0940, "mean":  3.0220, "scale":  1.1124},
        {"name": "max_core_pct",  "coeff":  0.1132, "mean": 66.4566, "scale": 27.6234},
        {"name": "pos_cores",     "coeff":  0.0391, "mean":  7.2467, "scale":  4.9687},
        {"name": "linear_extent", "coeff": -0.3013, "mean": 14.1211, "scale": 14.6296},
        {"name": "bilateral",     "coeff":  0.2486, "mean":  0.2775, "scale":  0.4478},
        {"name": "pirads",        "coeff":  0.0412, "mean":  4.3128, "scale":  1.0213},
        {"name": "mri_epe",       "coeff": -0.0677, "mean":  0.2379, "scale":  0.4258},
        {"name": "mri_svi",       "coeff":  0.2421, "mean":  0.1013, "scale":  0.3018},
        {"name": "mus_ece",       "coeff":  0.3411, "mean":  0.1806, "scale":  0.3847},
    ],
}

SVI_PATIENT = {
    "intercept": -3.189665,
    "features": [
        {"name": "log_psad",           "coeff": 0.3139, "mean": -1.6174, "scale": 0.7068},
        {"name": "grade_group_2",      "coeff": 0.7981, "mean":  0.3970, "scale": 0.4893},
        {"name": "grade_group_3",      "coeff": 0.7700, "mean":  0.2603, "scale": 0.4388},
        {"name": "grade_group_4_5",    "coeff": 0.9954, "mean":  0.2389, "scale": 0.4264},
        {"name": "max_core_pct",       "coeff": 0.3156, "mean": 51.1131, "scale": 32.2602},
        {"name": "pirads",             "coeff": 0.2892, "mean":  4.0824, "scale":  0.8493},
        {"name": "mri_epe",            "coeff": 0.0614, "mean":  0.1499, "scale":  0.3570},
        {"name": "mri_svi",            "coeff": 0.4573, "mean":  0.0428, "scale":  0.2025},
        {"name": "mus_ece",            "coeff": 0.0924, "mean":  0.1071, "scale":  0.3092},
        {"name": "psma_epe",           "coeff": 0.0492, "mean":  0.0264, "scale":  0.1602},
        {"name": "decipher_imputed",   "coeff": 0.2707, "mean":  0.6446, "scale":  0.1175},
        {"name": "decipher_available", "coeff": 0.3033, "mean":  0.2372, "scale":  0.4254},
        {"name": "positive_cores",     "coeff": 0.0324, "mean":  6.1908, "scale":  4.2325},
    ],
}

UPGRADE = {
    "intercept": -3.2302,
    "features": [
        {"name": "psad",           "coeff":  0.1976, "mean":  0.3149, "scale":  1.7167},
        {"name": "grade_group",    "coeff": -1.4920, "mean":  2.7446, "scale":  1.1419},
        {"name": "positive_cores", "coeff": -0.1070, "mean":  6.1862, "scale":  4.2345},
        {"name": "max_core_pct",   "coeff": -0.0032, "mean": 15.5193, "scale": 27.8063},
        {"name": "linear_mm",      "coeff":  0.0151, "mean":  8.5496, "scale": 11.6250},
        {"name": "pct45",          "coeff":  0.0272, "mean":  0.2437, "scale":  0.3310},
        {"name": "cribriform_bx",  "coeff":  0.0418, "mean":  0.0132, "scale":  0.1140},
        {"name": "pni_bx",         "coeff": -0.0814, "mean":  0.0362, "scale":  0.1869},
        {"name": "bilateral",      "coeff":  0.0223, "mean":  0.4679, "scale":  0.4990},
        {"name": "pirads",         "coeff":  0.2587, "mean":  4.0791, "scale":  0.8516},
        {"name": "mri_svi",        "coeff":  0.1484, "mean":  0.0428, "scale":  0.2025},
        {"name": "mus_ece",        "coeff": -0.2267, "mean":  0.1087, "scale":  0.3113},
        {"name": "suv",            "coeff":  0.0272, "mean": 16.6291, "scale": 36.1101},
        {"name": "psma_epe",       "coeff":  0.0504, "mean":  0.0264, "scale":  0.1602},
    ],
}

PSM = {
    "intercept": -1.2510,
    "features": [
        {"name": "log_psad",        "coeff":  0.2844, "mean": -1.6137, "scale": 0.7090},
        {"name": "grade_group_2",   "coeff":  0.1812, "mean":  0.3980, "scale": 0.4895},
        {"name": "grade_group_3",   "coeff":  0.1188, "mean":  0.2566, "scale": 0.4367},
        {"name": "grade_group_4_5", "coeff":  0.0400, "mean":  0.2418, "scale": 0.4282},
        {"name": "max_core_pct",    "coeff":  0.0109, "mean": 50.7988, "scale": 32.3931},
        {"name": "positive_cores",  "coeff":  0.0521, "mean":  6.1908, "scale":  4.2325},
        {"name": "pirads",          "coeff":  0.0099, "mean":  4.0773, "scale":  0.8520},
        {"name": "mri_epe",         "coeff": -0.0287, "mean":  0.1497, "scale":  0.3567},
        {"name": "mri_svi",         "coeff":  0.0542, "mean":  0.0428, "scale":  0.2023},
        {"name": "bilateral",       "coeff":  0.1002, "mean":  0.4671, "scale":  0.4989},
    ],
}

BCR_PREOP = {
    "intercept": -2.182256,
    "features": [
        {"name": "log_psad",           "coeff": 0.2346, "mean": -1.7865, "scale": 0.7740},
        {"name": "grade_group_2",      "coeff": 0.2256, "mean":  0.4328, "scale": 0.4955},
        {"name": "grade_group_3",      "coeff": 0.3019, "mean":  0.2451, "scale": 0.4302},
        {"name": "grade_group_4_5",    "coeff": 0.4495, "mean":  0.2171, "scale": 0.4123},
        {"name": "positive_cores",     "coeff": 0.0341, "mean":  6.3653, "scale": 3.7894},
        {"name": "pirads",             "coeff": 0.1757, "mean":  4.1834, "scale": 0.6965},
        {"name": "mri_svi",            "coeff": 0.1222, "mean":  0.0447, "scale": 0.2065},
        {"name": "ece_concordance",    "coeff": 0.0843, "mean":  0.1463, "scale": 0.3868},
        {"name": "decipher_imputed",   "coeff": 0.2157, "mean":  0.5528, "scale": 0.1681},
        {"name": "decipher_available", "coeff": 0.4597, "mean":  0.4185, "scale": 0.4933},
    ],
}

LNI_PLND = {
    "intercept": -3.2892,
    "features": [
        {"name": "log_psad",    "coeff": 0.5623, "mean": -1.6174, "scale": 0.7068},
        {"name": "gg_high",     "coeff": 0.4162, "mean":  0.2800, "scale": 0.4500},
        {"name": "pos_cores",   "coeff": 0.1260, "mean":  5.3000, "scale": 4.2000},
        {"name": "psma_ln_pos", "coeff": 0.5437, "mean":  0.1500, "scale": 0.3600},
    ],
}

# ---------------------------------------------------------------------------
# Synthetic cohort generation
# Distributions calibrated to published RARP series
# (Sjoberg et al. BJU Int 2018, Gandaglia et al. Eur Urol 2021)
# ---------------------------------------------------------------------------

def generate_cohort(n=N):
    rng = np.random.default_rng(42)

    # Grade group — multinomial: GG1 30%, GG2 35%, GG3 15%, GG4 12%, GG5 8%
    gg = rng.choice([1, 2, 3, 4, 5], size=n, p=[0.30, 0.35, 0.15, 0.12, 0.08])

    # PSA (ng/mL) — log-normal, median ~8
    psa = np.exp(rng.normal(2.1, 0.6, n))
    psa = np.clip(psa, 0.5, 100.0)

    # Prostate volume (mL) — log-normal, median ~45
    vol = np.exp(rng.normal(3.8, 0.5, n))
    vol = np.clip(vol, 10.0, 200.0)

    # Positive cores (1–12)
    cores = rng.integers(1, 13, size=n)

    # Max core % positive (5–100%)
    max_core_pct = rng.uniform(5, 100, n)

    # Linear extent of cancer (mm)
    linear_mm = rng.uniform(2, 40, n)

    # PI-RADS (2–5)
    pirads = rng.choice([2, 3, 4, 5], size=n, p=[0.10, 0.20, 0.40, 0.30])

    # Binary imaging flags — correlated with grade/PSA
    high_risk = ((gg >= 3) | (psa > 15)).astype(float)
    mri_epe  = (rng.random(n) < 0.10 + 0.15 * high_risk).astype(float)
    mri_svi  = (rng.random(n) < 0.03 + 0.08 * high_risk).astype(float)
    mus_ece  = (rng.random(n) < 0.08 + 0.12 * high_risk).astype(float)
    psma_epe = (rng.random(n) < 0.04 + 0.08 * high_risk).astype(float)
    psma_ln  = (rng.random(n) < 0.02 + 0.07 * high_risk).astype(float)
    bilateral = (rng.random(n) < 0.35 + 0.15 * high_risk).astype(float)

    # Decipher score (0–1) — only available for ~25% of cohort
    dec_avail = (rng.random(n) < 0.25).astype(float)
    dec_score = np.clip(rng.normal(0.45, 0.20, n), 0, 1)
    dec_imp   = np.where(dec_avail, dec_score, 0.521)  # mean-imputed when missing

    # PSMA SUV (0 = not done)
    psma_done = (rng.random(n) < 0.15).astype(float)
    suv = np.where(psma_done, np.clip(rng.normal(8, 4, n), 0, 40), 0.0)

    # Upgrade-specific features
    psad  = psa / vol
    pct45 = np.clip(rng.beta(2, 5, n), 0, 1)
    cribriform_bx = (rng.random(n) < 0.05 + 0.08 * (gg >= 4)).astype(float)
    pni_bx        = (rng.random(n) < 0.03 + 0.05 * (gg >= 3)).astype(float)

    return pd.DataFrame({
        "psa": psa, "vol": vol, "gg": gg, "cores": cores,
        "max_core_pct": max_core_pct, "linear_mm": linear_mm,
        "pirads": pirads, "mri_epe": mri_epe, "mri_svi": mri_svi,
        "mus_ece": mus_ece, "psma_epe": psma_epe, "psma_ln": psma_ln,
        "bilateral": bilateral, "dec_avail": dec_avail, "dec_imp": dec_imp,
        "suv": suv, "psad": psad, "pct45": pct45,
        "cribriform_bx": cribriform_bx, "pni_bx": pni_bx,
    })

# ---------------------------------------------------------------------------
# Feature-vector builders (mirror each model's vals[] in TypeScript)
# ---------------------------------------------------------------------------

def build_ece_patient(df):
    lp    = log_psad(df.psa.values, df.vol.values)
    mc    = normalize_max_core_pct(df.max_core_pct.values)
    gg2   = (df.gg == 2).astype(float).values
    gg3   = (df.gg == 3).astype(float).values
    gg45  = (df.gg >= 4).astype(float).values
    conc  = df.mri_epe.values + df.mus_ece.values + df.psma_epe.values
    return {
        "log_psad": lp, "grade_group_2": gg2, "grade_group_3": gg3,
        "grade_group_4_5": gg45, "max_core_pct": mc,
        "pirads": np.maximum(df.pirads.values, 2),
        "mri_epe": df.mri_epe.values, "mri_svi": df.mri_svi.values,
        "mus_ece": df.mus_ece.values, "psma_epe": df.psma_epe.values,
        "ece_concordance": conc, "decipher_imputed": df.dec_imp.values,
        "decipher_available": df.dec_avail.values,
    }

def build_extensive_ece(df):
    lp = log_psad(df.psa.values, df.vol.values)
    mc = normalize_max_core_pct(df.max_core_pct.values)
    return {
        "log_psad": lp, "grade_group": df.gg.values.astype(float),
        "max_core_pct": mc, "pos_cores": df.cores.values.astype(float),
        "linear_extent": df.linear_mm.values,
        "bilateral": df.bilateral.values,
        "pirads": np.maximum(df.pirads.values, 2),
        "mri_epe": df.mri_epe.values, "mri_svi": df.mri_svi.values,
        "mus_ece": df.mus_ece.values,
    }

def build_svi_patient(df):
    lp   = log_psad(df.psa.values, df.vol.values)
    mc   = normalize_max_core_pct(df.max_core_pct.values)
    gg2  = (df.gg == 2).astype(float).values
    gg3  = (df.gg == 3).astype(float).values
    gg45 = (df.gg >= 4).astype(float).values
    return {
        "log_psad": lp, "grade_group_2": gg2, "grade_group_3": gg3,
        "grade_group_4_5": gg45, "max_core_pct": mc,
        "pirads": np.maximum(df.pirads.values, 2),
        "mri_epe": df.mri_epe.values, "mri_svi": df.mri_svi.values,
        "mus_ece": df.mus_ece.values, "psma_epe": df.psma_epe.values,
        "decipher_imputed": df.dec_imp.values,
        "decipher_available": df.dec_avail.values,
        "positive_cores": df.cores.values.astype(float),
    }

def build_upgrade(df):
    return {
        "psad": df.psad.values, "grade_group": df.gg.values.astype(float),
        "positive_cores": df.cores.values.astype(float),
        "max_core_pct": df.max_core_pct.values,
        "linear_mm": df.linear_mm.values, "pct45": df.pct45.values,
        "cribriform_bx": df.cribriform_bx.values, "pni_bx": df.pni_bx.values,
        "bilateral": df.bilateral.values,
        "pirads": np.maximum(df.pirads.values, 2),
        "mri_svi": df.mri_svi.values, "mus_ece": df.mus_ece.values,
        "suv": df.suv.values, "psma_epe": df.psma_epe.values,
    }

def build_psm(df):
    lp   = log_psad(df.psa.values, df.vol.values)
    mc   = normalize_max_core_pct(df.max_core_pct.values)
    gg2  = (df.gg == 2).astype(float).values
    gg3  = (df.gg == 3).astype(float).values
    gg45 = (df.gg >= 4).astype(float).values
    return {
        "log_psad": lp, "grade_group_2": gg2, "grade_group_3": gg3,
        "grade_group_4_5": gg45, "max_core_pct": mc,
        "positive_cores": df.cores.values.astype(float),
        "pirads": np.maximum(df.pirads.values, 2),
        "mri_epe": df.mri_epe.values, "mri_svi": df.mri_svi.values,
        "bilateral": df.bilateral.values,
    }

def build_bcr(df):
    lp   = log_psad(df.psa.values, df.vol.values)
    gg2  = (df.gg == 2).astype(float).values
    gg3  = (df.gg == 3).astype(float).values
    gg45 = (df.gg >= 4).astype(float).values
    conc = df.mri_epe.values + df.mus_ece.values + df.psma_epe.values
    return {
        "log_psad": lp, "grade_group_2": gg2, "grade_group_3": gg3,
        "grade_group_4_5": gg45,
        "positive_cores": df.cores.values.astype(float),
        "pirads": np.maximum(df.pirads.values, 2),
        "mri_svi": df.mri_svi.values, "ece_concordance": conc,
        "decipher_imputed": df.dec_imp.values,
        "decipher_available": df.dec_avail.values,
    }

def build_lni(df):
    lp = log_psad(df.psa.values, df.vol.values)
    return {
        "log_psad": lp,
        "gg_high": (df.gg >= 4).astype(float).values,
        "pos_cores": df.cores.values.astype(float),
        "psma_ln_pos": df.psma_ln.values,
    }

# ---------------------------------------------------------------------------
# Run all models
# ---------------------------------------------------------------------------

MODELS = [
    ("ECE (patient)",    ECE_PATIENT,    build_ece_patient,    (0.02, 0.92)),
    ("Extensive ECE",    EXTENSIVE_ECE,  build_extensive_ece,  (0.0,  1.0 )),
    ("SVI (patient)",    SVI_PATIENT,    build_svi_patient,    (0.0,  1.0 )),
    ("Grade Upgrade",    UPGRADE,        build_upgrade,        (0.0,  1.0 )),
    ("PSM",              PSM,            build_psm,            (0.0,  1.0 )),
    ("BCR (preop)",      BCR_PREOP,      build_bcr,            (0.0,  1.0 )),
    ("LNI",              LNI_PLND,       build_lni,            (0.0,  1.0 )),
]

def run_models(df):
    results = {}
    for name, weights, builder, (lo, hi) in MODELS:
        vals = builder(df)
        # upgrade: GG < 1 returns 0.05 (mirror TypeScript guard)
        if name == "Grade Upgrade":
            L = linear_predict(weights["intercept"], weights["features"], vals)
            probs = sigmoid_arr(L)
            probs = np.where(df.gg.values < 1, 0.05, probs)
        else:
            L = linear_predict(weights["intercept"], weights["features"], vals)
            probs = sigmoid_arr(L)
        probs = np.clip(probs, lo, hi)
        results[name] = probs
    return pd.DataFrame(results)

def print_summary(preds, df):
    print("\n" + "=" * 72)
    print(f"  COMPASS MODEL SIMULATION — synthetic cohort N={N}")
    print("=" * 72)

    print("\n── Cohort characteristics ──────────────────────────────────────────")
    print(f"  PSA (ng/mL)       median {df.psa.median():.1f}  IQR {df.psa.quantile(0.25):.1f}–{df.psa.quantile(0.75):.1f}")
    print(f"  Volume (mL)       median {df.vol.median():.0f}  IQR {df.vol.quantile(0.25):.0f}–{df.vol.quantile(0.75):.0f}")
    gg_counts = df.gg.value_counts().sort_index()
    print(f"  Grade group dist  {dict(gg_counts.items())}")
    print(f"  PI-RADS 4–5       {(df.pirads >= 4).mean()*100:.0f}%")
    print(f"  MRI EPE pos       {df.mri_epe.mean()*100:.0f}%   MRI SVI pos {df.mri_svi.mean()*100:.0f}%")
    print(f"  Decipher avail    {df.dec_avail.mean()*100:.0f}%")

    print("\n── Model output distributions ──────────────────────────────────────")
    print(f"  {'Model':<20} {'Mean':>6} {'Median':>8} {'p25':>6} {'p75':>6}  {'<10%':>5} {'10-30%':>7} {'>30%':>5}")
    print(f"  {'-'*20} {'-'*6} {'-'*8} {'-'*6} {'-'*6}  {'-'*5} {'-'*7} {'-'*5}")
    for col in preds.columns:
        v = preds[col].values
        lo_pct = (v < 0.10).mean() * 100
        mid_pct = ((v >= 0.10) & (v < 0.30)).mean() * 100
        hi_pct = (v >= 0.30).mean() * 100
        print(f"  {col:<20} {v.mean():6.1%} {np.median(v):8.1%} {np.percentile(v,25):6.1%} {np.percentile(v,75):6.1%}  {lo_pct:4.0f}% {mid_pct:6.0f}%  {hi_pct:4.0f}%")

    print("\n── Feature contributions (|coeff × (x-mean)/scale|) ───────────────")
    model_builders = {
        "ECE (patient)": (ECE_PATIENT, build_ece_patient),
        "SVI (patient)": (SVI_PATIENT, build_svi_patient),
        "Grade Upgrade": (UPGRADE,     build_upgrade),
        "BCR (preop)":   (BCR_PREOP,   build_bcr),
        "LNI":           (LNI_PLND,    build_lni),
    }
    for mname, (weights, builder) in model_builders.items():
        vals = builder(df)
        contribs = feature_contributions(weights["intercept"], weights["features"], vals)
        print(f"\n  {mname}  (intercept {weights['intercept']:+.4f})")
        print(f"    {'Feature':<25} {'coeff':>7} {'mean_val':>10} {'mean_contrib':>13} {'|contrib|':>10}")
        for r in contribs:
            print(f"    {r['feature']:<25} {r['coeff']:>+7.4f} {r['mean_value']:>10.3f} {r['mean_contribution']:>+13.4f} {r['abs_contribution']:>10.4f}")

    # Risk stratification by grade group
    print("\n── ECE risk by grade group (mean predicted probability) ────────────")
    df2 = df.copy()
    df2["ece"] = preds["ECE (patient)"].values
    df2["svi"] = preds["SVI (patient)"].values
    df2["lni"] = preds["LNI"].values
    grp = df2.groupby("gg")[["ece", "svi", "lni"]].mean()
    grp.index.name = "GG"
    print(grp.to_string(float_format=lambda x: f"{x:.1%}"))

# ---------------------------------------------------------------------------
# Plots
# ---------------------------------------------------------------------------

def make_plots(preds, df):
    fig = plt.figure(figsize=(16, 10))
    fig.suptitle(f"COMPASS model output distributions — synthetic cohort N={N}", fontsize=13, y=0.98)
    gs = gridspec.GridSpec(3, 3, figure=fig, hspace=0.45, wspace=0.35)

    colors = plt.cm.tab10.colors
    model_names = list(preds.columns)

    for idx, col in enumerate(model_names):
        ax = fig.add_subplot(gs[idx // 3, idx % 3])
        v = preds[col].values
        ax.hist(v, bins=40, color=colors[idx % 10], alpha=0.75, edgecolor="white", linewidth=0.4)
        ax.axvline(np.median(v), color="black", linestyle="--", linewidth=1.2, label=f"median {np.median(v):.1%}")
        ax.set_title(col, fontsize=9, fontweight="bold")
        ax.set_xlabel("Predicted probability", fontsize=8)
        ax.set_ylabel("Count", fontsize=8)
        ax.tick_params(labelsize=7)
        ax.legend(fontsize=7)
        ax.xaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f"{x:.0%}"))

    # Last panel: ECE by grade group box
    ax = fig.add_subplot(gs[2, 2])
    df2 = df.copy()
    df2["ece"] = preds["ECE (patient)"].values
    groups = [df2.loc[df2.gg == g, "ece"].values for g in [1, 2, 3, 4, 5]]
    bp = ax.boxplot(groups, patch_artist=True, labels=["GG1", "GG2", "GG3", "GG4", "GG5"])
    for patch, color in zip(bp["boxes"], colors):
        patch.set_facecolor(color)
        patch.set_alpha(0.7)
    ax.set_title("ECE by grade group", fontsize=9, fontweight="bold")
    ax.set_ylabel("P(ECE)", fontsize=8)
    ax.tick_params(labelsize=7)
    ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f"{x:.0%}"))

    plt.savefig("models/compass_simulation.png", dpi=150, bbox_inches="tight")
    print("\n  Plot saved → models/compass_simulation.png")
    plt.show()

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("Generating synthetic cohort...")
    df = generate_cohort(N)

    print("Running COMPASS models...")
    preds = run_models(df)

    print_summary(preds, df)

    if HAS_PLOT:
        make_plots(preds, df)
    else:
        print("\nInstall matplotlib to generate plots:  pip install matplotlib")
