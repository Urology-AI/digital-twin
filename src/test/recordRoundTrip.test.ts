/**
 * Regression test for the save -> load round trip through
 * `buildProstateRecord` (write) / `clinicalStateFromRecord` (read). A field
 * that's on ClinicalState but missing from one side of this pair saves fine
 * into the working store but silently reverts to the default the moment a
 * case is saved as JSON and reloaded — exactly what happened to `alcohol`,
 * `pfmt`, and the PDE5 regimen string before this test existed.
 */
import { describe, expect, it } from "vitest";
import { defaultClinicalState } from "@/types/patient";
import { buildProstateRecord } from "@/lib/compass/recordFactory";
import { clinicalStateFromRecord } from "@/lib/compass/clinicalFromRecord";

describe("ClinicalState <-> Prostate3DInputV1 round trip", () => {
  it("preserves lifestyle/modifiable-factor fields across save and reload", () => {
    const S = defaultClinicalState();
    S.alcohol = "heavy";
    S.pfmt = "intensive";
    S.smoking = "current";
    S.exercise = "sedentary";
    S.diet = "high_saturated_fat";
    S.pde5 = "prn"; // a non-boolean-representable regimen — the case that broke before

    const record = buildProstateRecord(S, []);
    const reloaded = clinicalStateFromRecord(record);

    expect(reloaded.alcohol).toBe("heavy");
    expect(reloaded.pfmt).toBe("intensive");
    expect(reloaded.smoking).toBe("current");
    expect(reloaded.exercise).toBe("sedentary");
    expect(reloaded.diet).toBe("high_saturated_fat");
    expect(reloaded.pde5).toBe("prn");
  });

  it("preserves the PIPS-H plane-evidence fields and Plane Difficulty Index across save and reload", () => {
    const S = defaultClinicalState();
    S.mri_post_biopsy_hemorrhage = true;
    S.radiation_brachytherapy = true;
    S.bph_procedure_complicated = true;
    S.mri_denonvilliers = 2;
    S.five_ari_long_term = true;
    S.neoadjuvant_adt = true;
    S.pelvic_visceral_fat_cm3 = 1550;
    S.plane_difficulty_l[0] = 3;
    S.plane_difficulty_l[11] = 1;
    S.plane_difficulty_r[4] = 2;

    const reloaded = clinicalStateFromRecord(buildProstateRecord(S, []));
    expect(reloaded.mri_post_biopsy_hemorrhage).toBe(true);
    expect(reloaded.radiation_brachytherapy).toBe(true);
    expect(reloaded.bph_procedure_complicated).toBe(true);
    expect(reloaded.mri_denonvilliers).toBe(2);
    expect(reloaded.five_ari_long_term).toBe(true);
    expect(reloaded.neoadjuvant_adt).toBe(true);
    expect(reloaded.pelvic_visceral_fat_cm3).toBe(1550);
    expect(reloaded.plane_difficulty_l).toEqual(S.plane_difficulty_l);
    expect(reloaded.plane_difficulty_r).toEqual(S.plane_difficulty_r);
  });

  it("round-trips a daily PDE5 regimen too", () => {
    const S = defaultClinicalState();
    S.pde5 = "daily";
    const reloaded = clinicalStateFromRecord(buildProstateRecord(S, []));
    expect(reloaded.pde5).toBe("daily");
  });
});
