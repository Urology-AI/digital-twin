import { describe, it, expect } from "vitest";
import { parseSafeSheet } from "@/lib/safeSheet";
import { collapseToReviewEntries, reviewEntriesToRows } from "@/components/NoteImportModal";
import { ALL_ZONES, rowsToZoneData, zoneDataToRows } from "@/components/ZoneInputWizard";
import { mapLesionsToZones } from "@/lib/compass/lesionZones";
import { createDefaultZones, COMPASS_TO_3D } from "@/lib/compass/constants";
import { defaultClinicalState } from "@/types/patient";

/** Paste → review → apply → grid → stored rows, as the import dialog and wizard do it. */
function importNote(note: string) {
  const parsed = parseSafeSheet(note).lesions;
  const grid = rowsToZoneData(reviewEntriesToRows(collapseToReviewEntries(parsed)));
  const stored = zoneDataToRows(grid);
  const summary = ALL_ZONES.filter((z) => grid[z.id]).map((z) => z.label);
  const zones = createDefaultZones();
  mapLesionsToZones(zones, stored, defaultClinicalState());
  const anatomy = Object.entries(zones)
    .filter(([, z]) => z.sources?.biopsy_gg)
    .map(([k]) => COMPASS_TO_3D[k]);
  return { parsed, grid, stored, summary, anatomy };
}

describe("biopsy core codes survive import into the zone grid", () => {
  const cases = [
    ["RLB", "R", "Base", "R Base Lat", "P-RB-L"],
    ["RLM", "R", "Mid", "R Mid Lat", "P-RM-L"],
    ["RLA", "R", "Apex", "R Apex Lat", "P-RA"],
    ["LLB", "L", "Base", "L Base Lat", "P-LB-L"],
    ["LLM", "L", "Mid", "L Mid Lat", "P-LM-L"],
    ["LLA", "L", "Apex", "L Apex Lat", "P-LA"],
  ] as const;

  it.each(cases)("%s → %s %s lateral", (code, side, level, label, anatomyId) => {
    const r = importNote(`Biopsy\nGleason 6 (3+3) 35% ${code}`);
    const want = { source: "Bx", side, zone: "Posterolateral", level, score: "1", corePct: 35 };
    expect(r.parsed).toHaveLength(1);
    expect(r.parsed[0]).toMatchObject(want);
    expect(r.stored).toHaveLength(1);
    expect(r.stored[0]).toMatchObject(want);
    expect(r.summary).toEqual([label]);
    expect(r.anatomy).toEqual([anatomyId]);
  });

  it("keeps biopsy and MRI at their own levels in a mixed note", () => {
    const r = importNote(
      "Biopsy\nGleason 7 (4+3) 12% RLB\nGleason 6 (3+3) 45% LLA\n\nMRI 41cc\nPIRADS 4 Left PL PZ base\nPIRADS 4 Left PL PZ apex",
    );
    const byLabel = Object.fromEntries(ALL_ZONES.filter((z) => r.grid[z.id]).map((z) => [z.label, r.grid[z.id]]));
    expect(byLabel).toEqual({
      "R Base Lat": { gg: 3, corePct: 12 },
      "L Base Lat": { pirads: 4 },
      "L Apex Lat": { pirads: 4, gg: 1, corePct: 45 },
    });
  });

  it("does not merge same-grade cores at different levels into one core %", () => {
    const r = importNote("Biopsy\nGleason 6 (3+3) 45% LLA\nGleason 6 (3+3) 10% LLB");
    const byLabel = Object.fromEntries(ALL_ZONES.filter((z) => r.grid[z.id]).map((z) => [z.label, r.grid[z.id]?.corePct]));
    expect(byLabel).toEqual({ "L Base Lat": 10, "L Apex Lat": 45 });
  });
});
