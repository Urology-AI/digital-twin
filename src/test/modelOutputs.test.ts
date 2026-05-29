/**
 * Golden-value regression tests for all COMPASS prediction models.
 *
 * Values were captured from the original model files (before the weights.ts
 * refactor) and must never change unless a model is intentionally updated.
 * Any unexpected change here means a coefficient, mean, or scale was altered.
 */
import { describe, it, expect } from "vitest";
import { defaultClinicalState } from "@/types/patient";
import {
  predictEcePatient,
  predictEceSide,
  predictExtensiveEce,
} from "@/lib/models/ece";
import { predictSviPatient, predictSviSide } from "@/lib/models/svi";
import { predictUpgrade } from "@/lib/models/upgrade";
import { predictPsm } from "@/lib/models/psm";
import { predictBcrPreop } from "@/lib/models/bcr";
import { predictLni } from "@/lib/models/lni";

const S = defaultClinicalState();
const noLesions: never[] = [];

describe("COMPASS model output regression", () => {
  // ECE — patient level
  it("ECE patient default state", () =>
    expect(predictEcePatient(S)).toBe(0.15593583608462255));
  it("ECE patient GG3 elevated", () =>
    expect(predictEcePatient({ ...S, gg: 3, psa: 12, vol: 30, pirads: 4, mri_epe: 1 }))
      .toBe(0.3800597116291029));

  // ECE — side specific
  it("ECE side left default", () =>
    expect(predictEceSide(S, "left", noLesions, noLesions)).toBe(0.05143153871763193));
  it("ECE side right default", () =>
    expect(predictEceSide(S, "right", noLesions, noLesions)).toBe(0.05143153871763193));

  // ECE — extensive submodel
  it("Extensive ECE default state", () =>
    expect(predictExtensiveEce(S)).toBe(0.31843820912077275));

  // SVI — patient level
  it("SVI patient default state", () =>
    expect(predictSviPatient(S)).toBe(0.01627363593924371));
  it("SVI patient high-risk", () =>
    expect(predictSviPatient({ ...S, gg: 4, psa: 20, vol: 25, mri_svi: 1, pirads: 5 }))
      .toBe(0.48407893087656817));

  // SVI — side specific
  it("SVI side left default", () =>
    expect(predictSviSide(S, "left", noLesions, noLesions)).toBe(0.010909718551059008));
  it("SVI side right default", () =>
    expect(predictSviSide(S, "right", noLesions, noLesions)).toBe(0.010909718551059008));

  // Grade Upgrade
  it("Upgrade default state", () =>
    expect(predictUpgrade(S)).toBe(0.09503082483428857));
  it("Upgrade GG1 low PSA", () =>
    expect(predictUpgrade({ ...S, gg: 1, psa: 5, vol: 40 })).toBe(0.27946734219129943));

  // PSM
  it("PSM default state", () =>
    expect(predictPsm(S)).toBe(0.20631890580765627));
  it("PSM high-risk", () =>
    expect(predictPsm({ ...S, gg: 4, psa: 18, vol: 20, bilateral: 1 }))
      .toBe(0.32921649472640463));

  // BCR
  it("BCR preop default state", () =>
    expect(predictBcrPreop(S)).toBe(0.05146255542584055));
  it("BCR preop high-risk", () =>
    expect(predictBcrPreop({ ...S, gg: 4, psa: 25, vol: 30, mri_svi: 1, cores: 10 }))
      .toBe(0.24622342651679394));

  // LNI
  it("LNI default state", () =>
    expect(predictLni(S)).toBe(0.017757778982682267));
  it("LNI high-risk (PSMA positive)", () =>
    expect(predictLni({ ...S, gg: 4, psa: 20, vol: 25, cores: 8, psma_ln: 1 }))
      .toBe(0.46519389415813234));
});
