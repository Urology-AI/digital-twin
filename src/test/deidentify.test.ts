import { describe, expect, it } from "vitest";
import { ageRange, deidentify, deidentifyBundle, deidentifyClinical, deidentifyJson } from "@/lib/deidentify";

describe("deidentify", () => {
  it("removes email, phone, SSN", () => {
    const { text, redactions } = deidentify(
      "Contact john.doe@hospital.org or (212) 555-0198. SSN 123-45-6789.",
    );
    expect(text).not.toMatch(/john\.doe@/);
    expect(text).not.toMatch(/555-0198/);
    expect(text).not.toMatch(/123-45-6789/);
    expect(redactions).toBeGreaterThanOrEqual(3);
  });

  it("removes MRN / account numbers and long id runs", () => {
    const { text } = deidentify("MRN: 00847213\nAccount # 553120987\nAccession 12345678");
    expect(text).not.toMatch(/00847213/);
    expect(text).not.toMatch(/553120987/);
    expect(text).not.toMatch(/12345678/);
  });

  it("redacts labelled name / DOB lines but keeps the label", () => {
    const { text } = deidentify("Patient Name: Jane Q. Public\nDOB: 04/11/1962");
    expect(text).toMatch(/Patient Name: \[redacted\]/);
    expect(text).not.toMatch(/Jane/);
    expect(text).not.toMatch(/1962/);
  });

  it("removes numeric and written dates", () => {
    const { text } = deidentify("MRI dated 3/14/2024; biopsy Jan 7, 2024.");
    expect(text).not.toMatch(/2024/);
    expect(text).toMatch(/\[date\]/);
  });

  it("preserves the clinical numbers the models need", () => {
    const src = "PSA 6.5 ng/mL, age 63, GG 3+4, PI-RADS 4, 12 mm lesion, ADC 850, volume 48 cc";
    const { text, redactions } = deidentify(src);
    expect(text).toBe(src);
    expect(redactions).toBe(0);
  });
});

describe("deidentifyClinical", () => {
  it("drops identifier keys, keeps clinical fields", () => {
    const out = deidentifyClinical({
      patient_name: "Jane Public",
      mrn: "0084721",
      dob: "1962-04-11",
      psa: 6.5,
      gg: 3,
    });
    expect(out).toEqual({ psa: 6.5, gg: 3 });
  });
});

describe("deidentifyJson", () => {
  it("bands ages on the model's knots and caps at 85-89", () => {
    expect(ageRange(48)).toBe("<50");
    expect(ageRange(64)).toBe("60-64");
    expect(ageRange(70)).toBe("70-74");
    expect(ageRange(97)).toBe("85-89");
  });

  it("drops dates and identifiers, replaces age, scrubs free text", () => {
    const out = deidentifyJson({
      exportedAt: "2026-09-02T00:00:00Z",
      name: "Jane Q. Public",
      cases: [{ id: "c1", date: "2026-01-04", psa: 6.2, notes: "call (212) 555-0198" }],
      patient: { age: 67, mrn: "00847213", psa: 6.2 },
    }) as Record<string, any>;
    expect(out.exportedAt).toBeUndefined();
    expect(out.name).toBeUndefined();
    expect(out.cases[0].date).toBeUndefined();
    expect(out.cases[0].psa).toBe(6.2);
    expect(out.cases[0].notes).not.toMatch(/555-0198/);
    expect(out.patient.mrn).toBeUndefined();
    expect(out.patient.age).toBeUndefined();
    expect(out.patient.age_range).toBe("65-69");
  });

  it("marks the bundle as PHI-removed", () => {
    expect(deidentifyBundle({ cases: [] })._phi_removed).toBe(true);
  });
});
