/**
 * Phase 1A — vNext input contract.
 *
 * Three obligations:
 *   1. null (not performed) survives every input, serialization and display path
 *      and never becomes 0.
 *   2. An observed 0 (performed, negative) survives and never becomes null.
 *   3. Missing required PSA / volume / grade group blocks vNext execution.
 *
 * Plus a regression guard: Phase 1A must not move any v22 model output, so the
 * models are exercised with absent optional predictors and compared against the
 * pre-Phase-1A pinned values.
 */
import { describe, it, expect } from "vitest";
import {
  defaultClinicalState,
  type ClinicalState,
  type Prostate3DInputV1,
} from "@/types/patient";
import {
  isObserved,
  v22Absent,
  validateVNextRequiredInputs,
} from "@/lib/models/inputContract";
import { clinicalStateFromRecord } from "@/lib/compass/clinicalFromRecord";
import { buildProstateRecord } from "@/lib/compass/recordFactory";
import { clinicalFormSchema } from "@/schemas/clinicalForm";
import { predictEcePatient } from "@/lib/models/ece";
import { predictSviPatient } from "@/lib/models/svi";
import { predictUpgrade } from "@/lib/models/upgrade";
import { predictPsm } from "@/lib/models/psm";
import { predictBcrPreop } from "@/lib/models/bcr";
import { predictLni } from "@/lib/models/lni";

/** Minimal valid record. Optional predictors deliberately absent. */
function bareRecord(
  over: {
    psa?: number | null;
    volume_cc?: number | null;
    gg?: number | null;
  } = {},
): Prostate3DInputV1 {
  return {
    _schema: "prostate-3d-input-v1",
    patient: {
      age: 64,
      psa: over.psa === undefined ? 7 : over.psa,
      psa_density: null,
      bmi: null,
      shim: null,
      ipss: null,
      dm: false,
      htn: false,
      cad: false,
      statin: false,
      smoking: "never",
      exercise: "moderate",
      pde5: false,
    },
    prostate: {
      volume_cc: over.volume_cc === undefined ? 45 : over.volume_cc,
      dimensions_cm: null,
      median_lobe_grade: null,
    },
    biopsy: {
      max_grade_group: over.gg === undefined ? 3 : over.gg,
      total_positive_cores: null,
      total_cores: null,
      max_core_involvement_pct: null,
      max_linear_extent_mm: null,
      max_pct_pattern45: null,
      has_cribriform: null,
      has_idc: null,
      has_pni: null,
      laterality: "bilateral",
      gg_left: null,
      gg_right: null,
      cores_left: null,
      cores_right: null,
      mc_left: null,
      mc_right: null,
      linear_left: null,
      linear_right: null,
      decipher_score: null,
    },
    staging: { epe: null, svi: null },
    zones: {} as Prostate3DInputV1["zones"],
    lesions: [],
  };
}

describe("1. null means not performed and never becomes 0", () => {
  const S = clinicalStateFromRecord(bareRecord());

  it("a record with no MRI yields null, not 0, for every MRI predictor", () => {
    expect(S.pirads).toBeNull();
    expect(S.mri_epe).toBeNull();
    expect(S.mri_svi).toBeNull();
    expect(S.mri_adc).toBeNull();
    expect(S.mri_abutment).toBeNull();
  });

  it("a record with no biopsy detail yields null for cores and max core %", () => {
    expect(S.cores).toBeNull();
    expect(S.maxcore).toBeNull();
  });

  it("a record with no PSMA nodal assessment yields null, not 0", () => {
    expect(S.psma_ln).toBeNull();
  });

  it("null survives a record round trip", () => {
    const rec = buildProstateRecord(S, []);
    expect(rec.staging.epe).toBeNull();
    expect(rec.staging.svi).toBeNull();
    expect(rec.staging.max_pirads).toBeNull();
    expect(rec.staging.adc_mean).toBeNull();
    expect(rec.staging.abutment).toBeNull();
    expect(rec.biopsy.total_positive_cores).toBeNull();
    expect(rec.biopsy.max_core_involvement_pct).toBeNull();

    const back = clinicalStateFromRecord(rec);
    expect(back.mri_epe).toBeNull();
    expect(back.mri_svi).toBeNull();
    expect(back.pirads).toBeNull();
    expect(back.mri_adc).toBeNull();
    expect(back.mri_abutment).toBeNull();
    expect(back.cores).toBeNull();
    expect(back.maxcore).toBeNull();
    expect(back.psma_ln).toBeNull();
  });

  it("blank form input parses to null rather than false or 0", () => {
    const parsed = clinicalFormSchema.parse({
      psa: 7,
      vol: 45,
      gg: 3,
      cores: "",
      maxcore: "",
      pirads: "",
      mri_epe: "",
      mri_svi: "",
      mri_abutment: "",
      mri_adc: "",
      psma_ln: "",
    });
    expect(parsed.cores).toBeNull();
    expect(parsed.maxcore).toBeNull();
    expect(parsed.pirads).toBeNull();
    expect(parsed.mri_epe).toBeNull();
    expect(parsed.mri_svi).toBeNull();
    expect(parsed.mri_abutment).toBeNull();
    expect(parsed.mri_adc).toBeNull();
    expect(parsed.psma_ln).toBeNull();
  });
});

describe("2. an observed 0 means performed and negative, and survives", () => {
  const rec = bareRecord();
  rec.staging = {
    epe: false,
    svi: false,
    max_pirads: 2,
    adc_mean: null,
    abutment: 0,
    lymph_nodes_psma: "negative",
  };
  rec.biopsy.total_positive_cores = 0;
  rec.biopsy.max_core_involvement_pct = 0;
  const S = clinicalStateFromRecord(rec);

  it("an assessed-negative MRI is 0, not null", () => {
    expect(S.mri_epe).toBe(0);
    expect(S.mri_svi).toBe(0);
    expect(isObserved(S.mri_epe)).toBe(true);
  });

  it("an assessed capsular abutment of 0 is 0, not null", () => {
    expect(S.mri_abutment).toBe(0);
  });

  it("a PSMA scan with negative nodes is 0, not null", () => {
    expect(S.psma_ln).toBe(0);
  });

  it("zero positive cores and zero max core % are 0, not null", () => {
    expect(S.cores).toBe(0);
    expect(S.maxcore).toBe(0);
  });

  it("observed 0 survives a record round trip and stays distinct from null", () => {
    const back = clinicalStateFromRecord(
      buildProstateRecord(S, []),
    );
    expect(back.mri_epe).toBe(0);
    expect(back.mri_svi).toBe(0);
    expect(back.mri_abutment).toBe(0);
    expect(back.psma_ln).toBe(0);
    expect(back.cores).toBe(0);
    expect(back.maxcore).toBe(0);
  });

  it("an explicit false form flag is 0, not null", () => {
    const parsed = clinicalFormSchema.parse({
      psa: 7,
      vol: 45,
      gg: 3,
      mri_epe: false,
      mri_svi: false,
      psma_ln: false,
    });
    expect(parsed.mri_epe).toBe(0);
    expect(parsed.mri_svi).toBe(0);
    expect(parsed.psma_ln).toBe(0);
  });
});

describe("3. missing required inputs block vNext execution", () => {
  it("a fully specified case passes", () => {
    expect(validateVNextRequiredInputs(defaultClinicalState())).toEqual({
      ok: true,
    });
  });

  it("an omitted PSA blocks execution even though v22 still holds a default", () => {
    const S = clinicalStateFromRecord(bareRecord({ psa: null }));
    // v22 keeps its historical default so its arithmetic is unchanged...
    expect(S.psa).toBe(6.5);
    // ...but vNext refuses to run.
    expect(S.required_present.psa).toBe(false);
    const v = validateVNextRequiredInputs(S);
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.problems).toContain("psa_missing");
  });

  it("an omitted prostate volume blocks execution", () => {
    const S = clinicalStateFromRecord(bareRecord({ volume_cc: null }));
    expect(S.vol).toBe(45);
    expect(S.required_present.vol).toBe(false);
    const v = validateVNextRequiredInputs(S);
    expect(v.ok === false && v.problems).toContain("volume_missing");
  });

  it("an omitted grade group blocks execution", () => {
    const S = clinicalStateFromRecord(bareRecord({ gg: null }));
    expect(S.required_present.gg).toBe(false);
    const v = validateVNextRequiredInputs(S);
    expect(v.ok === false && v.problems).toContain("grade_group_missing");
  });

  it("PSA or volume of 0 blocks execution, because ln(PSA/volume) is undefined", () => {
    const zeroPsa = validateVNextRequiredInputs({
      ...defaultClinicalState(),
      psa: 0,
    });
    expect(zeroPsa.ok === false && zeroPsa.problems).toContain(
      "psa_not_positive",
    );
    const zeroVol = validateVNextRequiredInputs({
      ...defaultClinicalState(),
      vol: 0,
    });
    expect(zeroVol.ok === false && zeroVol.problems).toContain(
      "volume_not_positive",
    );
  });

  it("grade group 0 or 6 is out of range", () => {
    for (const gg of [0, 6, 2.5]) {
      const v = validateVNextRequiredInputs({
        ...defaultClinicalState(),
        gg,
      });
      expect(v.ok).toBe(false);
    }
  });

  it("all three missing are reported together, not one at a time", () => {
    const v = validateVNextRequiredInputs(
      clinicalStateFromRecord(
        bareRecord({ psa: null, volume_cc: null, gg: null }),
      ),
    );
    expect(v.ok === false && v.problems.length).toBe(3);
  });

  it("the form rejects a non-positive PSA and a grade group outside 1-5", () => {
    expect(() => clinicalFormSchema.parse({ psa: 0, vol: 45, gg: 3 })).toThrow();
    expect(() => clinicalFormSchema.parse({ psa: 7, vol: 0, gg: 3 })).toThrow();
    expect(() => clinicalFormSchema.parse({ psa: 7, vol: 45, gg: 0 })).toThrow();
  });
});

describe("4. Phase 1A moved no v22 model output", () => {
  // Pre-Phase-1A ClinicalState for a record with every optional predictor
  // absent: the old parser seeded these in-band numbers. Running the current
  // models against the tri-state version must give identical probabilities.
  const legacyAbsent: ClinicalState = {
    ...defaultClinicalState(),
    psa: 6.5,
    vol: 45,
    psad: 6.5 / 45,
    gg: 1,
    cores: 0,
    maxcore: 0,
    pirads: 2,
    mri_epe: 0,
    mri_svi: 0,
    mri_abutment: -1,
    mri_adc: 0,
    psma_ln: 0,
    linear_mm: 0,
    primus: 0,
    mus_ece: 0,
    suv: 0,
    psma_epe: 0,
    psma_avail: 0,
    mri_size: 0,
  };
  const trueAbsent: ClinicalState = {
    ...legacyAbsent,
    cores: null,
    maxcore: null,
    pirads: null,
    mri_epe: null,
    mri_svi: null,
    mri_abutment: null,
    mri_adc: null,
    psma_ln: null,
  };

  const models: [string, (S: ClinicalState) => number][] = [
    ["ECE", predictEcePatient],
    ["SVI", predictSviPatient],
    ["Upgrade", predictUpgrade],
    ["PSM", predictPsm],
    ["BCR", predictBcrPreop],
    ["LNI", predictLni],
  ];

  for (const [name, fn] of models) {
    it(`${name} is bit-identical with absent predictors as null vs the old in-band values`, () => {
      expect(fn(trueAbsent)).toBe(fn(legacyAbsent));
    });
  }
});

describe("5. shim helpers", () => {
  it("isObserved treats an observed 0 as present and null as absent", () => {
    expect(isObserved(0)).toBe(true);
    expect(isObserved(1)).toBe(true);
    expect(isObserved(null)).toBe(false);
    expect(isObserved(NaN)).toBe(false);
  });

  it("v22Absent restores the historical in-band value only when absent", () => {
    expect(v22Absent(null, -1)).toBe(-1);
    expect(v22Absent(0, -1)).toBe(0);
    expect(v22Absent(4, 2)).toBe(4);
    expect(v22Absent(null, 2)).toBe(2);
  });
});

describe("6. study-level imaging status (MRI / ExactVu / PSMA)", () => {
  it("a legacy record with epe:false, svi:false, PI-RADS 2 and no MRI data is MRI 'unknown', not a negative MRI", () => {
    const rec = bareRecord();
    rec.staging = { epe: false, svi: false, max_pirads: 2 };
    const S = clinicalStateFromRecord(rec);
    expect(S.imaging_availability.mri).toBe("unknown");
    expect(S.mri_epe).toBeNull();
    expect(S.mri_svi).toBeNull();
    expect(S.pirads).toBeNull();
  });

  it("legacy false is trusted as a negative once MRI data shows the study was done", () => {
    const rec = bareRecord();
    rec.staging = { epe: false, svi: false, max_pirads: 4 };
    const S = clinicalStateFromRecord(rec);
    expect(S.imaging_availability.mri).toBe("performed");
    expect(S.mri_epe).toBe(0);
    expect(S.pirads).toBe(4);
  });

  it("an explicitly performed MRI with no findings keeps its negatives", () => {
    const rec = bareRecord();
    rec.staging = { epe: false, svi: false, availability: { mri: "performed" } };
    const S = clinicalStateFromRecord(rec);
    expect(S.mri_epe).toBe(0);
    expect(S.mri_svi).toBe(0);
  });

  it("no PSMA read means PSMA 'unknown' and nodal status null", () => {
    const S = clinicalStateFromRecord(bareRecord());
    expect(S.imaging_availability.psma).toBe("unknown");
    expect(S.psma_ln).toBeNull();
  });

  it("'not performed' plus recorded findings is a conflict and blocks vNext", () => {
    const rec = bareRecord();
    rec.staging = { epe: true, svi: false, availability: { mri: "not_performed" } };
    const S = clinicalStateFromRecord(rec);
    expect(S.imaging_conflicts).toEqual(["mri"]);
    const v = validateVNextRequiredInputs(S);
    expect(v.ok === false && v.problems).toContain("imaging_status_conflict");
  });

  it("explicit status survives a save and reload", () => {
    const rec = bareRecord();
    rec.staging = { epe: false, svi: false, availability: { mri: "performed", exactvu: "not_performed", psma: "unknown" } };
    const back = clinicalStateFromRecord(buildProstateRecord(clinicalStateFromRecord(rec), []));
    expect(back.imaging_availability).toEqual({ mri: "performed", exactvu: "not_performed", psma: "unknown" });
    expect(back.mri_epe).toBe(0);
  });
});
