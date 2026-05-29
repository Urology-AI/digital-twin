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
