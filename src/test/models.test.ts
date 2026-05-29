import { describe, expect, it } from "vitest";
import { defaultClinicalState } from "@/types/patient";
import { predictEcePatient, clampEcePatient } from "@/lib/models/ece";
import { predictLni } from "@/lib/models/lni";
import { predictSviPatient } from "@/lib/models/svi";

describe("COMPASS models", () => {
  it("predictEcePatient returns probability in (0,1)", () => {
    const S = defaultClinicalState();
    const p = predictEcePatient(S);
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(1);
    const c = clampEcePatient(p);
    expect(c).toBeGreaterThanOrEqual(0.02);
    expect(c).toBeLessThanOrEqual(0.92);
  });

  it("predictLni is stable for sample clinical state", () => {
    const S = defaultClinicalState();
    const p = predictLni(S);
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(1);
  });

  it("predictSviPatient matches deterministic re-run", () => {
    const S = defaultClinicalState();
    expect(predictSviPatient(S)).toBe(predictSviPatient(S));
  });
});

import { parseClinicNote } from "@/lib/parseClinicNote";

describe("parseClinicNote fixes", () => {
  it("parses mriSize from multi-dim notation inside PIRADS segment", () => {
    const r = parseClinicNote("MRI 45cc PIRADS 4 left PZ 17x16mm EPE");
    const mri = r.lesions.filter((l) => l.source === "MRI");
    expect(mri.length).toBeGreaterThan(0);
    expect(mri[0]!.mriSize).toBe(17);
  });

  it("parses mriSize from single mm notation", () => {
    const r = parseClinicNote("MRI PIRADS 4 right PZ 15mm");
    const mri = r.lesions.filter((l) => l.source === "MRI");
    expect(mri[0]!.mriSize).toBe(15);
  });

  it("parses mriSize from cm notation", () => {
    const r = parseClinicNote("MRI PIRADS 4 left PZ 1.5cm");
    const mri = r.lesions.filter((l) => l.source === "MRI");
    expect(mri[0]!.mriSize).toBe(15);
  });

  it("parses svi flag from MRI segment", () => {
    const r = parseClinicNote("MRI PIRADS 5 left SVI EPE");
    const mri = r.lesions.filter((l) => l.source === "MRI");
    expect(mri[0]!.svi).toBe(true);
  });

  it("does not set svi when text says no SVI", () => {
    const r = parseClinicNote("MRI PIRADS 4 left no SVI");
    const mri = r.lesions.filter((l) => l.source === "MRI");
    expect(mri[0]!.svi).toBe(false);
  });

  it("extracts PSA from MRI header line when no PSA section present", () => {
    const r = parseClinicNote(
      "MRI 14.5cc PSA 7.3\nPIRADS 5 Right PZ base to mid 17x16mm Abut yes No EPE Possible SVI",
    );
    expect(r.psa).toBe(7.3);
    expect(r.prostateVolumeCc).toBe(14.5);
    expect(r.lesions.filter((l) => l.source === "MRI")[0]?.mriSize).toBe(17);
  });

  it("parses biopsy linear extent in mm", () => {
    const r = parseClinicNote("Biopsy Gleason 7 (4+3) 60% right 8mm");
    const bx = r.lesions.filter((l) => l.source === "Bx");
    expect(bx.length).toBeGreaterThan(0);
    expect(bx[0]!.linear).toBe(8);
  });

  it("does not confuse prostate volume cc with lesion size", () => {
    // 45cc is volume, 17mm is lesion — mriSize should be 17, not derived from cc
    const r = parseClinicNote("MRI 45cc PIRADS 4 left PZ 17mm");
    const mri = r.lesions.filter((l) => l.source === "MRI");
    expect(mri[0]!.mriSize).toBe(17);
    expect(r.prostateVolumeCc).toBe(45);
  });
});
