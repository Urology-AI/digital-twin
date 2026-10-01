/**
 * Adapter from the app's lesions to the regional evidence reference
 * (regionalEvidenceShadow.ts, copied unchanged from the governance package,
 * vNext-regional-evidence-shadow-v2-2026-09-30).
 *
 * For each side and each of the five planning regions it collects which
 * modalities localize a positive finding there and whether MRI / ExactVu call
 * EPE there. No regional probabilities are produced.
 */
import type { ClinicalState } from "@/types/patient";
import type { LesionRow } from "@/types/lesion";
import { COMPASS_TO_3D, ZONE_ANATOMY } from "@/lib/compass/constants";
import { lesionToZones } from "@/lib/compass/lesionZones";
import {
  evaluateRegionalEvidence,
  type ImagingModality,
  type RegionalEvidenceOutput,
} from "@/lib/compass/regionalEvidenceShadow";

export const REGIONS = ["posterolateral", "base", "apex", "anterior", "bladder_neck"] as const;
export type Region = (typeof REGIONS)[number];
export type SideRegional = Record<Region, RegionalEvidenceOutput>;

type Flags = {
  biopsyLocalized: boolean;
  mriLesion: boolean;
  mriEpePositive: boolean;
  exactvuLesion: boolean;
  exactvuEpePositive: boolean;
  psmaLesion: boolean;
  psmaEpePositive: boolean;
};

const blank = (): Flags => ({
  biopsyLocalized: false,
  mriLesion: false,
  mriEpePositive: false,
  exactvuLesion: false,
  exactvuEpePositive: false,
  psmaLesion: false,
  psmaEpePositive: false,
});

function scoreOf(l: LesionRow, fallback?: number): number | null {
  const n = parseFloat(l.score);
  if (Number.isFinite(n)) return n;
  return fallback ?? null;
}

/** Which planning regions (and sides) a lesion row falls in. */
function regionsOf(l: LesionRow): { side: "L" | "R"; region: Region }[] {
  if (!l.side) return [];
  const keys = lesionToZones({
    side: l.side,
    level: l.level || "Mid",
    position: l.zone || "",
    source: l.source,
    score: l.score,
    corePct: l.corePct,
    linear: l.linear,
    epe: l.epe,
  });
  const out: { side: "L" | "R"; region: Region }[] = [];
  for (const k of keys) {
    const a = ZONE_ANATOMY[COMPASS_TO_3D[k] ?? ""];
    if (a && (REGIONS as readonly string[]).includes(a.zone)) out.push({ side: a.side, region: a.zone as Region });
  }
  return out;
}

export function computeRegionalEvidence(
  S: ClinicalState,
  lesionRows: LesionRow[],
  sideEpe: { left: number; right: number },
): { left: SideRegional; right: SideRegional } | null {
  if (!Number.isFinite(sideEpe.left) || !Number.isFinite(sideEpe.right)) return null;

  const grid: Record<"L" | "R", Record<Region, Flags>> = {
    L: Object.fromEntries(REGIONS.map((r) => [r, blank()])) as Record<Region, Flags>,
    R: Object.fromEntries(REGIONS.map((r) => [r, blank()])) as Record<Region, Flags>,
  };

  for (const l of lesionRows) {
    for (const { side, region } of regionsOf(l)) {
      const f = grid[side][region];
      if (l.source === "MRI") {
        const s = scoreOf(l, l.pirads);
        if (s === null || s >= 3) f.mriLesion = true;
        if (l.epe) f.mriEpePositive = true;
      } else if (l.source === "MUS" || l.source === "ExactVu") {
        const s = scoreOf(l, l.primus);
        if (s === null ? Boolean(l.zone || l.level) : s >= 3) f.exactvuLesion = true;
        if (l.epe) f.exactvuEpePositive = true;
      } else if (l.source === "PSMA") {
        f.psmaLesion = true;
        if (l.epe) f.psmaEpePositive = true;
      } else if (l.source === "Bx") {
        const gg = scoreOf(l);
        if (gg === null || gg >= 1) f.biopsyLocalized = true;
      }
    }
  }

  const missing: ImagingModality[] = [];
  if (S.imaging_availability.mri !== "performed") missing.push("MRI");
  if (S.imaging_availability.exactvu !== "performed") missing.push("ExactVu");
  if (S.imaging_availability.psma !== "performed") missing.push("PSMA");

  const side = (k: "L" | "R", p: number): SideRegional =>
    Object.fromEntries(
      REGIONS.map((r) => [
        r,
        evaluateRegionalEvidence({ sideEpeProbability: p, ...grid[k][r], missingModalities: missing }),
      ]),
    ) as SideRegional;

  return { left: side("L", sideEpe.left), right: side("R", sideEpe.right) };
}
