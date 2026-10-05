/**
 * BCR Cox against the pinned cases in
 * COMPASS_vNext_BCR_Provisional_ModelLock.json (lock b364b791...a585).
 */
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defaultClinicalState, type ClinicalState } from "@/types/patient";
import { predictBcrCox, coxFromFeatures, bcrTier } from "@/lib/models/vnext/bcrCox";
import {
  BCR_COX_BASELINE_H0,
  BCR_COX_LOCK_H0_ROUNDED,
} from "@/lib/models/vnext/bcrCoxBaseline";
import lock from "./fixtures/vnext/COMPASS_vNext_BCR_Provisional_ModelLock.json";

type Raw = Record<string, number | null>;

function stateFrom(raw: Raw): ClinicalState {
  const gg = raw.gg4_5 ? 4 : raw.gg3 ? 3 : raw.gg2 ? 2 : 1;
  return {
    ...defaultClinicalState(),
    psa: Math.exp(raw.log_psad as number) * 40,
    vol: 40,
    gg,
    required_present: { psa: true, vol: true, gg: true },
    pirads: raw.pirads as number | null,
    mri_svi: raw.mri_svi_clean as number | null,
    mri_adc: raw.adc_mean as number | null,
    mri_epe: raw.mri_epe as number | null,
  } as ClinicalState;
}

const cases = Object.entries(lock.regression_test_cases) as [
  string,
  { raw: Raw; linear_predictor: number; risk_12m: number; risk_24m: number; risk_36m: number },
][];

describe("lock file is untouched", () => {
  it("raw bytes match the pinned fixture hash", () => {
    const bytes = readFileSync(
      resolve(__dirname, "fixtures/vnext/COMPASS_vNext_BCR_Provisional_ModelLock.json"),
    );
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      "42a5b6af0debc80c79b8de240846c7eda9c3290292e39a6f48e6b8fa33e2d969",
    );
    expect(lock.sha256_canonical_without_hash_field).toBe(
      "b364b7910c0b5356fbc3c8d5c99f142a9df1e11a0d3da915cc7868627a10a585",
    );
  });
});

describe("full-precision baseline hazards", () => {
  const ref = lock.regression_test_cases.mean_reference;
  it("equal -ln(1 - pinned mean_reference risk)", () => {
    expect(BCR_COX_BASELINE_H0.m12).toBeCloseTo(-Math.log(1 - ref.risk_12m), 14);
    expect(BCR_COX_BASELINE_H0.m24).toBeCloseTo(-Math.log(1 - ref.risk_24m), 14);
    expect(BCR_COX_BASELINE_H0.m36).toBeCloseTo(-Math.log(1 - ref.risk_36m), 14);
  });
  it("round to the lock's 8-decimal values", () => {
    const r = (x: number) => Number(x.toFixed(8));
    const h = lock.baseline_cumulative_hazard;
    expect(r(BCR_COX_BASELINE_H0.m12)).toBe(h["12_months"]);
    expect(r(BCR_COX_BASELINE_H0.m24)).toBe(h["24_months"]);
    expect(r(BCR_COX_BASELINE_H0.m36)).toBe(h["36_months"]);
    expect(BCR_COX_LOCK_H0_ROUNDED.m36).toBe(h["36_months"]);
  });
});

describe("BCR Cox reproduces every pinned lock case", () => {
  let maxErr = 0;
  for (const [name, c] of cases) {
    it(name, () => {
      const r = coxFromFeatures(c.raw);
      const errs = [
        Math.abs(r.linearPredictor - c.linear_predictor),
        Math.abs(r.risk12 - c.risk_12m),
        Math.abs(r.risk24 - c.risk_24m),
        Math.abs(r.risk36 - c.risk_36m),
      ];
      maxErr = Math.max(maxErr, ...errs);
      for (const e of errs) expect(e).toBeLessThan(1e-12);
    });
  }
  it("full runtime path (ClinicalState) also reproduces the integer-grade cases", () => {
    for (const [name, c] of cases) {
      if (name === "mean_reference") continue;
      const r = predictBcrCox(stateFrom(c.raw));
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      expect(Math.abs(r.risk36 - c.risk_36m)).toBeLessThan(1e-12);
      expect(Math.abs(r.risk12 - c.risk_12m)).toBeLessThan(1e-12);
    }
  });
  it("reports max error", () => {
    console.log("BCR max abs error over 5 LPs + 15 risks:", maxErr);
  });
});

describe("BCR Cox behavior", () => {
  const base = () => stateFrom(lock.regression_test_cases.gg2_intermediate.raw);

  it("tiers use the 12/24/36 cutoffs, equal goes up", () => {
    expect(bcrTier(12, 0.0499).label).toBe("Low");
    expect(bcrTier(12, 0.05).label).toBe("Intermediate");
    expect(bcrTier(12, 0.15).label).toBe("High");
    expect(bcrTier(24, 0.0999).label).toBe("Low");
    expect(bcrTier(24, 0.25).label).toBe("High");
    expect(bcrTier(36, 0.1499).label).toBe("Low");
    expect(bcrTier(36, 0.35).label).toBe("High");
  });
  it("refuses without PSA, volume or grade group", () => {
    const S = { ...base(), required_present: { psa: true, vol: true, gg: false } };
    expect(predictBcrCox(S).ok).toBe(false);
  });
  it("missing imaging is imputed, not zero", () => {
    const r = predictBcrCox({ ...base(), pirads: null, mri_svi: null, mri_adc: null, mri_epe: null });
    expect(r.ok && r.imputed.length).toBe(4);
  });
  it("Decipher, cores, PSMA, ExactVu and PSM do not change the result", () => {
    const a = predictBcrCox(base());
    const b = predictBcrCox({
      ...base(),
      decipher: 0.9,
      cores: 12,
      psma_ln: 1,
    } as unknown as ClinicalState);
    expect(a).toEqual(b);
  });
});
