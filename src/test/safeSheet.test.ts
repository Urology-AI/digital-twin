import { describe, it, expect } from "vitest";
import { parseSafeSheet, parseSheetFields, sheetToNote, stripSheetPhi } from "@/lib/safeSheet";

/** The real pre-operative safe sheet layout, as pasted out of Word. */
const SHEET = `Patient\tBMI: 29.1\tSMITH, JOHN  64\tMRN 4471829\tDOB 03/14/1961\tDATE OF SURGERY 02/02/2025
Biopsy   01/08/2025\t7/14\tGleason 4+3 (GG3) right base posterolateral 65%. Cribriform present. No IDC.
MRI   12/20/2024\tPI-RADS 5 right posterolateral PZ mid to base, 1.8cm, ADC 620, suspected EPE. No SVI.
MUS  01/05/2025\tPRI-MUS 5 right mid posterolateral
PSMA\tSUVmax 14.2 right mid gland
PSA\t11.4\tSHIM  18\tLeft: 2\tRight: 3
ASA\t2`;

describe("stripSheetPhi", () => {
  const r = stripSheetPhi(SHEET);

  it("removes every identifier on the sheet", () => {
    for (const leak of ["SMITH", "JOHN", "4471829", "03/14/1961", "02/02/2025", "01/08/2025"]) {
      expect(r.text, `${leak} survived the scrub`).not.toContain(leak);
    }
  });

  it("keeps the clinical values the models need", () => {
    for (const keep of ["11.4", "29.1", "14.2", "620", "1.8", "7/14", "18"]) {
      expect(r.text, `${keep} was scrubbed but is clinical`).toContain(keep);
    }
  });

  it("reports what it removed so the user can see it ran", () => {
    expect(r.count).toBeGreaterThan(0);
    expect(r.removed).toContain("name");
    expect(r.removed).toContain("MRN");
  });

  it("is idempotent — re-scrubbing finds nothing new", () => {
    expect(stripSheetPhi(r.text).count).toBe(0);
  });
});

describe("parseSheetFields", () => {
  const f = parseSheetFields(stripSheetPhi(SHEET).text);

  it("reads age off the Patient row, where it carries no label", () => {
    expect(f.age).toBe(64);
  });

  it("scopes values by row label", () => {
    expect(f.psa).toBeCloseTo(11.4);
    expect(f.bmi).toBeCloseTo(29.1);
    expect(f.shim).toBe(18);
  });

  it("reads a bare cores fraction on the Biopsy row", () => {
    expect(f.positiveCores).toBe(7);
    expect(f.totalCores).toBe(14);
  });

  it("does not invent an age when the row is ambiguous", () => {
    // Two bare two-digit candidates and no way to tell which is the age.
    expect(parseSheetFields("Patient\t64 72").age).toBeUndefined();
  });

  it("does not mistake an MRN or DOB for an age", () => {
    const scrubbed = stripSheetPhi("Patient\tMRN 4471829\tDOB 03/14/1961").text;
    expect(parseSheetFields(scrubbed).age).toBeUndefined();
  });
});

describe("sheetToNote", () => {
  const r = parseSafeSheet(SHEET);

  it("extracts findings from grid cells, which the note parser alone cannot", () => {
    // Every finding sits inside one tab-separated cell behind a row label, so
    // without normalisation parseClinicNote sees only unparseable headers.
    expect(r.lesions.length).toBeGreaterThanOrEqual(4);
    const kinds = new Set(r.lesions.map((l) => l.source));
    expect(kinds).toContain("Bx");
    expect(kinds).toContain("MRI");
    expect(kinds).toContain("MUS");
    expect(kinds).toContain("PSMA");
  });

  it("converts the sheet's Gleason spelling into a grade group", () => {
    // Sheet writes "Gleason 4+3"; the parser matches "Gleason 7 (4+3)".
    const bx = r.lesions.find((l) => l.source === "Bx" && l.side === "R");
    expect(bx?.score).toBe("3");
  });

  it("maps spelled-out posterolateral, which is matched as an abbreviation", () => {
    expect(r.lesions.some((l) => l.zone === "Posterolateral")).toBe(true);
  });

  it("splits a multi-level finding into one lesion per level", () => {
    // "mid to base" is one sentence but two zones on the map.
    const mri = r.lesions.filter((l) => l.source === "MRI");
    expect(mri.map((l) => l.level).sort()).toEqual(["Base", "Mid"]);
  });

  it("leaves a free-text note untouched rather than mangling it", () => {
    const note = "Biopsy\nGleason 7 (4+3) 5% Right PL PZ\nMRI\nPIRADS 5 Right PL PZ mid";
    expect(sheetToNote(note)).toBe(note);
  });

  it("ignores sheet rows COMPASS has no input for", () => {
    // ASA, DVT risk, research consent etc. are recorded for other purposes.
    expect(sheetToNote(stripSheetPhi(SHEET).text)).not.toMatch(/ASA/);
  });
});

describe("parseSafeSheet", () => {
  it("warns when prostate volume is absent — the sheet has no field for it", () => {
    const r = parseSafeSheet(SHEET);
    expect(r.warnings.some((w) => /prostate volume/i.test(w))).toBe(true);
  });

  it("parses only scrubbed text, so no identifier can reach the case", () => {
    const r = parseSafeSheet(SHEET);
    expect(JSON.stringify(r.lesions)).not.toContain("SMITH");
    expect(r.phi.count).toBeGreaterThan(0);
  });
});
