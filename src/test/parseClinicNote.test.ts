import { describe, it, expect } from "vitest";
import { parseClinicNote } from "@/lib/parseClinicNote";

const SAMPLE_NOTE = `
Biopsy
Gleason 9 (5+4) 30% Right Base Med 1/1 cores 5mm
Gleason 9 (5+4) 20% Right Base Med 1/1 cores 4mm
Gleason 9 (5+4) 50% Right Mid Med 1/1 cores 6mm
Gleason 9 (5+4) 50% Right Mid Med 1/1 cores 5mm
`.trim();

describe("parseClinicNote", () => {
  it("merges duplicate biopsy zones, summing corePct and taking max linear", () => {
    const result = parseClinicNote(SAMPLE_NOTE);
    const bx = result.lesions.filter((l) => l.source === "Bx");

    // Should produce exactly 2 rows: R Base Posterior and R Mid Posterior
    expect(bx).toHaveLength(2);

    const rBase = bx.find((l) => l.side === "R" && l.level === "Base");
    const rMid  = bx.find((l) => l.side === "R" && l.level === "Mid");

    expect(rBase).toBeDefined();
    expect(rBase?.corePct).toBe(50);      // 30 + 20
    expect(rBase?.score).toBe("5");       // GG 5
    expect(rBase?.linear).toBe(5);        // max(5, 4)

    expect(rMid).toBeDefined();
    expect(rMid?.corePct).toBe(100);      // 50 + 50, capped at 100
    expect(rMid?.score).toBe("5");
    expect(rMid?.linear).toBe(6);         // max(6, 5)

    // No left-side rows from a right-only note
    expect(bx.filter((l) => l.side === "L")).toHaveLength(0);
  });

  it("does not merge across different zones or sides", () => {
    const note = `
Biopsy
Gleason 7 (4+3) 40% Right Base PZ 1/1 cores 4mm
Gleason 6 (3+3) 20% Left Base PZ 1/1 cores 3mm
Gleason 7 (4+3) 30% Right Base PL 1/1 cores 5mm
`.trim();
    const { lesions } = parseClinicNote(note);
    const bx = lesions.filter((l) => l.source === "Bx");
    // Three distinct (side, level, zone) combos → 3 rows
    expect(bx).toHaveLength(3);
  });

  it("caps merged corePct at 100", () => {
    const note = `
Biopsy
Gleason 7 (4+3) 70% Right Base PZ 1/1 cores 5mm
Gleason 7 (4+3) 60% Right Base PZ 1/1 cores 4mm
`.trim();
    const { lesions } = parseClinicNote(note);
    const bx = lesions.filter((l) => l.source === "Bx");
    expect(bx).toHaveLength(1);
    expect(bx[0]?.corePct).toBe(100);
  });

  it("takes the higher GG when merging", () => {
    const note = `
Biopsy
Gleason 7 (3+4) 30% Right Mid PZ 1/1 cores 4mm
Gleason 8 (4+4) 20% Right Mid PZ 1/1 cores 3mm
`.trim();
    const { lesions } = parseClinicNote(note);
    const bx = lesions.filter((l) => l.source === "Bx");
    expect(bx).toHaveLength(1);
    expect(bx[0]?.score).toBe("4");   // GG 4 (Gleason 8 = GG 4) wins over GG 3
  });

  it("warns on lines missing a Gleason score", () => {
    const note = `
Biopsy
No cancer found in Left Base
Gleason 6 (3+3) 10% Right Apex PZ 1/1 cores 2mm
`.trim();
    const { warnings } = parseClinicNote(note);
    expect(warnings.some((w) => /no gleason/i.test(w))).toBe(true);
  });
});


describe("abutment wording", () => {
  const abut = (line: string) => parseClinicNote(`MUS\n${line}`).lesions[0]?.mriAbutment;

  it("reads 'abut no' as no contact, not contact", () => {
    expect(abut("PRIMUS 4, Right PL PZ Mid, abut no, EPE no.")).toBe(0);
  });
  it("still reads positive and negative forms", () => {
    expect(abut("PRIMUS 3, Left PL PZ Mid, Abut yes, EPE no.")).toBe(1);
    expect(abut("PRIMUS 3, Left PL PZ Mid, no abutment")).toBe(0);
    expect(abut("PRIMUS 3, Left PL PZ Mid, abuts capsule")).toBe(1);
  });
});

describe("zone and level parsing", () => {
  const lesions = (note: string) => parseClinicNote(note).lesions;

  it("reads PZPL as Left posterolateral at Mid (level defaulted, not expanded)", () => {
    const r = parseClinicNote("Biopsy\nGleason 7 (3+4) 20% Left PZPL");
    expect(r.lesions).toHaveLength(1);
    expect(r.lesions[0]).toMatchObject({ side: "L", zone: "Posterolateral", level: "Mid", score: "2" });
    expect(r.warnings.some((w) => /level not specified, defaulted to Mid/.test(w))).toBe(true);
  });

  it("reads PZA as Right anterior", () => {
    const l = lesions("Biopsy\nGleason 6 (3+3) 5% Right PZA");
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ side: "R", zone: "Anterior", score: "1" });
  });

  it("reads ATZ as anterior and PZPM as posterior", () => {
    expect(lesions("Biopsy\nGleason 6 (3+3) 5% Left ATZ Mid")[0]?.zone).toBe("Anterior");
    expect(lesions("Biopsy\nGleason 6 (3+3) 5% Left PZPM Mid")[0]?.zone).toBe("Posterior");
  });

  it("keeps PL PZ mid-to-apex posterolateral (no remap to anterior)", () => {
    const l = lesions("MRI\nPIRADS 4 Right PL PZ mid to apex");
    expect(l.map((x) => [x.side, x.zone, x.level])).toEqual([
      ["R", "Posterolateral", "Mid"],
      ["R", "Posterolateral", "Apex"],
    ]);
  });

  it("keeps a posterior apex lesion posterior", () => {
    const l = lesions("Biopsy\nGleason 6 (3+3) 10% Right Apex PZ");
    expect(l[0]).toMatchObject({ zone: "Posterior", level: "Apex" });
  });

  it("parses PSMA SUV Left PZ base as posterior base", () => {
    const l = lesions("PSMA\nSUV 5.2 Left PZ base");
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ side: "L", zone: "Posterior", level: "Base" });
  });

  it("still expands explicit base-to-apex ranges", () => {
    const l = lesions("MRI\nPIRADS 4 Right PZ base to apex");
    expect(l.map((x) => x.level)).toEqual(["Base", "Mid", "Apex"]);
  });

  it("warns when duplicate biopsy entries merge", () => {
    const r = parseClinicNote(SAMPLE_NOTE);
    expect(r.warnings.some((w) => /duplicate .* merged/i.test(w))).toBe(true);
  });
});
