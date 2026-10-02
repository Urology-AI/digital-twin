/**
 * A new case starts blank: no predictions until PSA, volume and grade group
 * are entered, and then predictions come from what was entered, not defaults.
 */
import { describe, it, expect } from "vitest";
import { usePatientStore } from "@/store/patientStore";

describe("new case", () => {
  it("starts blank and shows no predictions", () => {
    usePatientStore.getState().newCase();
    const st = usePatientStore.getState();
    expect(st.predictions).toBeNull();
    expect(st.missingRequired).toEqual(
      expect.arrayContaining(["psa_missing", "volume_missing", "grade_group_missing"]),
    );
    const rec = st.patients.find((p) => p.id === st.activeId)!.record;
    expect(rec.patient.psa).toBeNull();
    expect(rec.staging.max_pirads).toBeNull();
    expect(rec.staging.epe).toBeNull();
  });

  it("calculates once PSA, volume and grade group are entered", () => {
    const { updateClinicalForm } = usePatientStore.getState();
    updateClinicalForm({ psa: 8 });
    expect(usePatientStore.getState().predictions).toBeNull();
    updateClinicalForm({ vol: 40, gg: 2 });
    const st = usePatientStore.getState();
    expect(st.missingRequired).toEqual([]);
    expect(st.predictions).not.toBeNull();
    expect(Number.isFinite(st.predictions!.ece)).toBe(true);
    expect(Number.isFinite(st.predictions!.eceL)).toBe(true);
  });

  it("with only the three required inputs, every MRI predictor is imputed, not read as negative", () => {
    // GG2, PSA 8, 40 cc, nothing else: matches the 'GG2, no MRI' row in the
    // earlier before/after table except max core and cores are missing too.
    const p = usePatientStore.getState().predictions!;
    expect(p.ece).toBeGreaterThan(0.1);
  });
});
