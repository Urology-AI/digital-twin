/**
 * Side-specific PSM against the pinned cases in COMPASS_vNext_PSM_ModelLock.json
 * (lock bdcfd183...4666) plus the side PI-RADS rule.
 */
import { describe, it, expect } from "vitest";
import { defaultClinicalState } from "@/types/patient";
import type { Prostate3DInputV1 } from "@/types/patient";
import type { LesionRow } from "@/types/lesion";
import {
  psmSideFromInputs,
  psmIndexPiradsBySide,
  predictPsmSideVNext,
} from "@/lib/models/vnext/psmSide";
import lock from "./fixtures/vnext/COMPASS_vNext_PSM_ModelLock.json";

const tierName: Record<string, string> = { "<3%": "Very low", "3–<8%": "Low", "8–<15%": "Intermediate", "≥15%": "High" };

describe("side PSM reproduces every pinned lock case", () => {
  for (const c of lock.synthetic_regression_cases) {
    it(c.case_id, () => {
      const r = psmSideFromInputs({
        logPsad: c.input.log_psad,
        posCores: c.input.pos_cores,
        piradsIndexSide: c.input.pirads_index_side,
      });
      expect(Math.abs(r.probability - c.expected_probability)).toBeLessThan(1e-12);
      expect(r.tier.label).toBe(tierName[c.expected_tier]);
    });
  }
});

const row = (side: "L" | "R" | "", pirads: number, source: LesionRow["source"] = "MRI"): LesionRow => ({
  id: `${side}${pirads}`, source, side, zone: "Posterior", score: String(pirads), epe: false, svi: false,
  corePct: 0, linear: 0, mriSize: 0, mriAbutment: -1, mriAdc: 0, level: "", pirads,
});
const P = { lesions: [] } as unknown as Prostate3DInputV1;

describe("side PI-RADS rule", () => {
  it("index on one side: score there, 0 on the other", () => {
    expect(psmIndexPiradsBySide(P, [row("L", 4), row("R", 3)])).toEqual({ left: 4, right: 0 });
    expect(psmIndexPiradsBySide(P, [row("R", 5)])).toEqual({ left: 0, right: 5 });
  });
  it("index lesions on both sides: score on both", () => {
    expect(psmIndexPiradsBySide(P, [row("L", 4), row("R", 4)])).toEqual({ left: 4, right: 4 });
  });
  it("unknown side or no scored MRI lesion stays missing", () => {
    expect(psmIndexPiradsBySide(P, [row("", 4)])).toEqual({ left: null, right: null });
    expect(psmIndexPiradsBySide(P, [])).toEqual({ left: null, right: null });
    expect(psmIndexPiradsBySide(P, [row("L", 4, "MUS")])).toEqual({ left: null, right: null });
  });
});

describe("side PSM behavior", () => {
  const S = () => ({
    ...defaultClinicalState(), psa: 8, vol: 40, gg: 3, cores: 5,
    required_present: { psa: true, vol: true, gg: true },
  });
  it("refuses without required inputs", () => {
    expect(predictPsmSideVNext({ ...S(), required_present: { psa: false, vol: true, gg: true } }, 3).ok).toBe(false);
  });
  it("missing cores and PI-RADS are mean-imputed and reported", () => {
    const r = predictPsmSideVNext({ ...S(), cores: null }, null);
    expect(r.ok && r.imputed.sort()).toEqual(["pirads_index_side", "pos_cores"]);
  });
  it("grade group, ECE and other inputs do not change the result", () => {
    const a = predictPsmSideVNext(S(), 4);
    const b = predictPsmSideVNext({ ...S(), gg: 5, mri_epe: 1, mri_svi: 1, maxcore: 100, bilateral: 1 }, 4);
    expect(a.ok && b.ok && a.probability).toBe(b.ok && b.probability);
  });
});
