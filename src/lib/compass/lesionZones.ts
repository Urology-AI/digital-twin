import type { ClinicalState, CompassZoneKey, ZoneMap } from "@/types/patient";
import type { LesionRow } from "@/types/lesion";

export interface LesionMapInput {
  side: "L" | "R";
  level: string;
  position: string;
  source: string;
  score: string;
  corePct: number;
  linear: number;
  epe: boolean;
}

function lesionToZone(les: LesionMapInput): CompassZoneKey {
  const s = les.side;
  const lv = les.level;
  const ps = les.position || "";
  const isAnt = ps === "Anterior";
  const isLat = ps === "Posterolateral" || ps === "Lateral";
  if (isAnt) {
    if (lv === "Base") return s === "L" ? "1a" : "4a";
    if (lv === "Mid") return s === "L" ? "2a" : "5a";
    return s === "L" ? "3a" : "6a";
  }
  if (lv === "Base") return isLat ? (s === "L" ? "2p" : "7p") : s === "L" ? "1p" : "6p";
  if (lv === "Mid") return isLat ? (s === "L" ? "4p" : "9p") : s === "L" ? "3p" : "8p";
  return s === "L" ? "5p" : "10p";
}

export function lesionToZones(les: LesionMapInput): CompassZoneKey[] {
  const s = les.side;
  const lv = les.level;
  const ps = les.position || "";
  const isAnt = ps === "Anterior";
  const isLat = ps === "Posterolateral" || ps === "Lateral";
  const isMed = ps === "Medial";
  if (les.source === "MRI") return [lesionToZone(les)];
  if (isAnt) return [lesionToZone(les)];
  if (lv === "Apex") return [s === "L" ? "5p" : "10p"];
  if (isLat || isMed) return [lesionToZone(les)];
  if (lv === "Base")
    return (s === "L" ? ["1p", "2p"] : ["6p", "7p"]) as CompassZoneKey[];
  if (lv === "Mid")
    return (s === "L" ? ["3p", "4p"] : ["8p", "9p"]) as CompassZoneKey[];
  return [lesionToZone(les)];
}

const MRI_P: Record<number, number> = {
  0: 0.02,
  1: 0.1,
  2: 0.19,
  3: 0.2,
  4: 0.21,
  5: 0.55,
};
const MUS_P: Record<number, number> = {
  0: 0.02,
  1: 0.12,
  2: 0.24,
  3: 0.39,
  4: 0.65,
  5: 0.82,
};

/** Mutates `zones` in place (same as original mapLesionsToZones). */
export function mapLesionsToZones(
  zones: ZoneMap,
  lesions: LesionRow[],
  S: ClinicalState,
): void {
  for (const zk of Object.keys(zones)) {
    const z = zones[zk as CompassZoneKey];
    if (!z) continue;
    z.cancer = 0.02;
    z.ece = 0.01;
    z.hasData = false;
    z.sources = {
      mri: null,
      mus: null,
      suv: null,
      biopsy_gg: null,
      core_pct: null,
      linear_mm: null,
      pct_4_5: null,
      cribriform: null,
    };
  }

  for (const row of lesions) {
    if (!row.side) continue;
    const les: LesionMapInput = {
      side: row.side,
      level: row.level || "Mid",
      position: row.zone || "",
      source: row.source === "ExactVu" ? "MUS" : row.source,
      score: row.score,
      corePct: row.corePct,
      linear: row.linear,
      epe: row.epe,
    };
    const zkList = lesionToZones(les);
    for (const zk of zkList) {
      const cell = zones[zk];
      if (!cell) continue;
      cell.hasData = true;
      const score = parseFloat(row.score) || 0;
      if (row.source === "MRI") {
        const mriScore = score > 0 ? score : S.pirads || 0;
        if (mriScore > 0) cell.sources.mri = mriScore;
      }
      if (row.source === "ExactVu" || row.source === "MUS") {
        const musScore = score > 0 ? score : 0;
        if (musScore > 0) cell.sources.mus = musScore;
      }
      if (row.source === "PSMA") {
        const suvScore = score > 0 ? score : S.suv || 0;
        if (suvScore > 0) cell.sources.suv = suvScore;
      }
      if (row.source === "Bx" && score > 0) {
        cell.sources.biopsy_gg = Math.max(cell.sources.biopsy_gg || 0, score);
        cell.sources.core_pct = Math.max(
          cell.sources.core_pct || 0,
          row.corePct || 0,
        );
        cell.sources.linear_mm = Math.max(
          cell.sources.linear_mm || 0,
          row.linear || 0,
        );
        cell.sources.pct_4_5 = S.pct45 || null;
        cell.sources.cribriform = S.cribriform_bx ? true : null;
      }

      const mriK = cell.sources.mri ?? 0;
      const musK = cell.sources.mus ?? 0;
      const mp = MRI_P[mriK] ?? 0.02;
      const up = MUS_P[musK] ?? 0.02;
      const sv = cell.sources.suv;
      const pp =
        !sv || sv <= 0 ? 0.02 : 1 / (1 + Math.exp(0.9517 - 0.0184 * sv));
      let cancer = Math.min(Math.max(mp, up, pp), 0.95);
      const isPost = zk.endsWith("p") && !zk.startsWith("SV");
      const isLat = ["2p", "4p", "7p", "9p"].includes(zk);
      const capFactor = isLat ? 1.2 : isPost ? 1.0 : 0.5;
      let ece = Math.min(cancer * capFactor, 0.95);
      if (row.epe) {
        ece = Math.min(Math.max(ece, 0.5), 0.95);
        cancer = Math.min(Math.max(cancer, 0.4), 0.95);
      }
      cell.cancer = Math.min(Math.max(cell.cancer, cancer), 0.95);
      cell.ece = Math.min(Math.max(cell.ece, ece), 0.95);
    }
  }

  const bxRowsBySide = { left: 0, right: 0 };
  for (const l of lesions) {
    if (l.source === "Bx" && parseFloat(l.score) > 0) {
      if (l.side === "L") bxRowsBySide.left++;
      else if (l.side === "R") bxRowsBySide.right++;
    }
  }
  const sideZones: Record<"left" | "right", CompassZoneKey[]> = {
    left: ["1p", "2p", "3p", "4p", "5p"],
    right: ["6p", "7p", "8p", "9p", "10p"],
  };
  const sideData = {
    left: {
      gg: S.gg_left || 0,
      cores: S.cores_left || 0,
      mc: S.mc_left || S.maxcore || 0,
      linear: S.linear_left || S.linear_mm || 0,
    },
    right: {
      gg: S.gg_right || 0,
      cores: S.cores_right || 0,
      mc: S.mc_right || S.maxcore || 0,
      linear: S.linear_right || S.linear_mm || 0,
    },
  } as const;

  for (const side of ["left", "right"] as const) {
    const sd = sideData[side];
    if (sd.gg <= 0) continue;
    if (bxRowsBySide[side] > 0) continue;
    const szList = sideZones[side];
    const hasBxData = szList.some(
      (key) => zones[key]?.sources.biopsy_gg && zones[key]!.sources.biopsy_gg! > 0,
    );
    if (hasBxData) continue;
    const nZones = Math.max(1, Math.min(szList.length, sd.cores));
    const priority: CompassZoneKey[] =
      side === "left"
        ? ["3p", "4p", "1p", "2p", "5p"]
        : ["8p", "9p", "6p", "7p", "10p"];
    for (let i = 0; i < priority.length && i < nZones; i++) {
      const zk = priority[i]!;
      const cell = zones[zk];
      if (!cell) continue;
      cell.hasData = true;
      cell.sources.biopsy_gg = sd.gg;
      const pctScale = i === 0 ? 1.0 : i === 1 ? 0.7 : 0.4;
      cell.sources.core_pct = Math.round(sd.mc * pctScale);
      cell.sources.linear_mm = Math.round(sd.linear * pctScale);
    }
  }
}
