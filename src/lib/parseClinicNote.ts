import { emptyLesion, type LesionRow } from "@/types/lesion";

function uid() {
  return `parsed-${Math.random().toString(36).slice(2, 9)}`;
}

function gleasonToGG(major: number, minor: number): number {
  const sum = major + minor;
  if (sum <= 6) return 1;
  if (major === 3 && minor === 4) return 2;
  if (major === 4 && minor === 3) return 3;
  if (sum === 8) return 4;
  return 5;
}

// ── Valid (side, position, level) combos that exist in the zone grid ───────────
// Mirrors ALL_ZONES in ZoneInputWizard. Used to expand multi-level lesions.
const VALID_ZONE_COMBOS: { side: "L" | "R"; pos: string; level: "Base" | "Mid" | "Apex" }[] = [
  { side: "R", pos: "Posterolateral", level: "Base" },
  { side: "R", pos: "Posterior",      level: "Base" },
  { side: "L", pos: "Posterior",      level: "Base" },
  { side: "L", pos: "Posterolateral", level: "Base" },
  { side: "R", pos: "Posterolateral", level: "Mid" },
  { side: "R", pos: "Posterior",      level: "Mid" },
  { side: "L", pos: "Posterior",      level: "Mid" },
  { side: "L", pos: "Posterolateral", level: "Mid" },
  { side: "R", pos: "Anterior",       level: "Base" },
  { side: "L", pos: "Anterior",       level: "Base" },
  { side: "R", pos: "Anterior",       level: "Mid" },
  { side: "L", pos: "Anterior",       level: "Mid" },
  { side: "R", pos: "Anterior",       level: "Apex" },
  { side: "L", pos: "Anterior",       level: "Apex" },
];

type Level = "Base" | "Mid" | "Apex";

function truncate(s: string, n = 60) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

/** Returns every level the lesion text covers. Unspecified → all levels. */
function parseLevelRange(text: string): Level[] {
  const m = text.match(/\b(base|mid|apex|apical)\s+to\s+(base|mid|apex)\b/i);
  if (m) {
    const a = (m[1] ?? "").toLowerCase();
    const b = (m[2] ?? "").toLowerCase();
    if ((a === "base" && b === "apex") || (a === "apex" && b === "base")) return ["Base", "Mid", "Apex"];
    if ((a === "mid" && b === "base") || (a === "base" && b === "mid")) return ["Base", "Mid"];
    if ((a === "apex" && b === "mid") || (a === "mid" && b === "apex")) return ["Mid", "Apex"];
    return ["Base", "Mid", "Apex"];
  }
  if (/\bapex\b|\bapical\b/i.test(text)) return ["Apex"];
  if (/\bmid\b/i.test(text)) return ["Mid"];
  if (/\bbase\b/i.test(text)) return ["Base"];
  return ["Base", "Mid", "Apex"]; // unspecified = full gland
}

function parseSide(text: string): "L" | "R" | "" {
  if (/\bleft\b/i.test(text)) return "L";
  if (/\bright\b/i.test(text)) return "R";
  return "";
}

function parseZone(text: string): string {
  // Order matters: check PL before PZ so "PL PZ" hits PL branch
  if (/\bpl\s+pz\b|\bpl\b/i.test(text)) return "Posterolateral";
  if (/\bpz\b/i.test(text)) return "Posterior";
  if (/\btz\b/i.test(text)) return "Anterior";
  if (/\bcz\b/i.test(text)) return "Medial";
  if (/\baz\b/i.test(text)) return "Anterior";
  return "Posterior";
}

function parseAbutment(text: string): number {
  if (/\bbroad\s+contact\b|\bbroad\s+abut/i.test(text)) return 2;
  if (/abut\s*(yes|present|contact)/i.test(text) || /\babuts?\b/i.test(text)) return 1;
  if (/no\s+abut|abut\s*(no|absent|none)|abut\s*:\s*no/i.test(text)) return 0;
  return -1;
}

function parseEpe(text: string): boolean {
  if (/no\s+epe|epe\s*(absent|negative|no\b)|epe\s*:\s*no/i.test(text)) return false;
  if (/\bepe\b|\bextracapsular/i.test(text)) return true;
  return false;
}

/**
 * Expand one parsed lesion into one row per zone grid cell it covers.
 * Falls back to the nearest valid level (e.g. Posterior+Apex → Posterior+Mid)
 * when the exact combo doesn't exist. Returns rows plus the fallback level used
 * (null if no fallback was needed), so callers can warn the user.
 */
function expandToZoneRows(
  base: Partial<Omit<LesionRow, "id" | "side" | "level">>,
  side: "L" | "R" | "",
  pos: string,
  levels: Level[],
): { rows: LesionRow[]; levelFallback: Level | null } {
  const sides: ("L" | "R")[] = side === "" ? ["L", "R"] : [side];
  const rows: LesionRow[] = [];
  for (const s of sides) {
    for (const lv of levels) {
      if (!VALID_ZONE_COMBOS.some((c) => c.side === s && c.pos === pos && c.level === lv)) continue;
      rows.push({ ...emptyLesion(uid()), ...base, side: s, zone: pos, level: lv });
    }
  }
  if (rows.length > 0) return { rows, levelFallback: null };

  // Level fallback: if none of the requested levels exist for this pos, try Mid → Base → Apex
  const fallbackOrder: Level[] = ["Mid", "Base", "Apex"];
  for (const fb of fallbackOrder) {
    if (levels.includes(fb)) continue; // already tried
    for (const s of sides) {
      if (VALID_ZONE_COMBOS.some((c) => c.side === s && c.pos === pos && c.level === fb)) {
        rows.push({ ...emptyLesion(uid()), ...base, side: s, zone: pos, level: fb });
      }
    }
    if (rows.length > 0) return { rows, levelFallback: fb };
  }

  // Final fallback: keep an unzoned row so the lesion is never silently dropped
  for (const s of sides) {
    rows.push({ ...emptyLesion(uid()), ...base, side: s, zone: pos, level: "" });
  }
  return { rows, levelFallback: null };
}

function parseBiopsyLines(lines: string[], warnings: string[]): LesionRow[] {
  const result: LesionRow[] = [];
  for (const line of lines) {
    const before = result.length;
    // Split tab-separated entries so multiple Gleason values on one line are each parsed
    for (const seg of line.split(/\t+/)) {
      const t = seg.trim();
      const m = t.match(/gleason\s*\d+\s*\((\d+)\+(\d+)\)/i);
      if (!m) continue;
      const gg = gleasonToGG(parseInt(m[1] ?? "0"), parseInt(m[2] ?? "0"));
      const pct = t.match(/(\d+(?:\.\d+)?)\s*%/);
      if (!pct) {
        warnings.push(`Biopsy: "${m[0]}" has no core % — defaulted to 0%`);
      }
      const side = parseSide(t);
      const pos = parseZone(t);
      const levels = parseLevelRange(t);
      const base = {
        source: "Bx" as const,
        zone: pos,
        score: String(gg),
        corePct: pct ? parseFloat(pct[1] ?? "0") : 0,
        linear: 0,
      };
      const { rows, levelFallback } = expandToZoneRows(base, side, pos, levels);
      if (levelFallback) {
        warnings.push(
          `Biopsy: "${m[0]}" — ${pos} ${levels[0]} is not a zone grid cell; mapped to ${pos} ${levelFallback}`,
        );
      }
      result.push(...rows);
    }
    // Warn for lines that had content but produced no rows
    const trimmed = line.trim();
    if (result.length === before && trimmed.length >= 6) {
      warnings.push(`Biopsy: no Gleason score found — line skipped: "${truncate(trimmed)}"`);
    }
  }
  return result;
}

function parseMriLines(
  lines: string[],
  warnings: string[],
): { lesions: LesionRow[]; volumeCc?: number } {
  const lesions: LesionRow[] = [];
  let volumeCc: number | undefined;
  for (const line of lines) {
    const t = line.trim();
    const vol = t.match(/(\d+(?:\.\d+)?)\s*cc/i);
    if (vol && !volumeCc) volumeCc = parseFloat(vol[1] ?? "0");
    const pm = t.match(/pirads\s*(\d+)/i);
    if (!pm) {
      // Only warn if the line looks like it was meant to describe a lesion
      if (t.length >= 6 && !vol) {
        warnings.push(`MRI: no PIRADS score found — line skipped: "${truncate(t)}"`);
      }
      continue;
    }
    const pirads = parseInt(pm[1] ?? "0");
    if (pirads < 1 || pirads > 5) {
      warnings.push(`MRI: PIRADS ${pirads} is out of range (1–5) — check the value`);
    }
    const side = parseSide(t);
    const pos = parseZone(t);
    const levels = parseLevelRange(t);
    const abut = parseAbutment(t);
    const epe = parseEpe(t);
    if (abut === -1) {
      warnings.push(`MRI: PIRADS ${pirads} — no capsular contact info found (abutment set to unknown)`);
    }
    const base = {
      source: "MRI" as const,
      zone: pos,
      score: String(pirads),
      pirads,
      mriAbutment: abut,
      epe,
      svi: false,
    };
    const { rows, levelFallback } = expandToZoneRows(base, side, pos, levels);
    if (levelFallback) {
      warnings.push(
        `MRI: PIRADS ${pirads} — ${pos} ${levels[0]} is not a zone grid cell; mapped to ${pos} ${levelFallback}`,
      );
    }
    lesions.push(...rows);
  }
  return { lesions, volumeCc };
}

function parseMusLines(lines: string[], warnings: string[]): LesionRow[] {
  const result: LesionRow[] = [];
  for (const line of lines) {
    const t = line.trim();
    const pm = t.match(/primus\s*(\d+)/i);
    if (!pm) {
      if (t.length >= 6) {
        warnings.push(`MUS: no PRIMUS score found — line skipped: "${truncate(t)}"`);
      }
      continue;
    }
    const primus = parseInt(pm[1] ?? "0");
    const side = parseSide(t);
    const pos = parseZone(t);
    const levels = parseLevelRange(t);
    const abut = parseAbutment(t);
    const epe = parseEpe(t);
    const base = {
      source: "MUS" as const,
      zone: pos,
      score: String(primus),
      primus,
      mriAbutment: abut,
      epe,
      svi: false,
    };
    const { rows, levelFallback } = expandToZoneRows(base, side, pos, levels);
    if (levelFallback) {
      warnings.push(
        `MUS: PRIMUS ${primus} — ${pos} ${levels[0]} is not a zone grid cell; mapped to ${pos} ${levelFallback}`,
      );
    }
    result.push(...rows);
  }
  return result;
}

function parsePsmaLines(lines: string[], warnings: string[]): LesionRow[] {
  const result: LesionRow[] = [];
  for (const line of lines) {
    const t = line.trim();
    const sm = t.match(/suv\s*(\d+(?:\.\d+)?)/i);
    if (!sm) {
      if (t.length >= 6) {
        warnings.push(`PSMA: no SUV value found — line skipped: "${truncate(t)}"`);
      }
      continue;
    }
    const suv = parseFloat(sm[1] ?? "0");
    const side = parseSide(t);
    const pos = parseZone(t);
    const levels = parseLevelRange(t);
    const base = {
      source: "PSMA" as const,
      zone: pos,
      score: String(suv),
      suv,
      svi: false,
    };
    const { rows, levelFallback } = expandToZoneRows(base, side, pos, levels);
    if (levelFallback) {
      warnings.push(
        `PSMA: SUV ${suv} — ${pos} ${levels[0]} is not a zone grid cell; mapped to ${pos} ${levelFallback}`,
      );
    }
    result.push(...rows);
  }
  return result;
}

export interface ParsedNote {
  lesions: LesionRow[];
  prostateVolumeCc?: number;
  biopsyTotalCores?: number;
  biopsyMaxCorePct?: number;
  biopsyGG?: number;
  warnings: string[];
}

export function parseClinicNote(text: string): ParsedNote {
  const sections = {
    biopsy: [] as string[],
    mri: [] as string[],
    mus: [] as string[],
    psma: [] as string[],
  };
  type SectionKey = keyof typeof sections;
  let current: SectionKey | null = null;

  const warnings: string[] = [];

  for (const raw of text.split(/\n/)) {
    const trimmed = raw.trim();
    if (/^biopsy\b/i.test(trimmed)) {
      current = "biopsy";
      const rest = raw.replace(/^biopsy\s*/i, "").trim();
      if (rest) sections.biopsy.push(rest);
    } else if (/^mri\b/i.test(trimmed)) {
      current = "mri";
      const rest = raw.replace(/^mri\s*/i, "").trim();
      if (rest) sections.mri.push(rest);
    } else if (/^mus\b/i.test(trimmed)) {
      current = "mus";
      const rest = raw.replace(/^mus\s*/i, "").trim();
      if (rest) sections.mus.push(rest);
    } else if (/^psma\b/i.test(trimmed)) {
      current = "psma";
      const rest = raw.replace(/^psma\s*/i, "").trim();
      if (rest) sections.psma.push(rest);
    } else if (current && trimmed) {
      sections[current].push(trimmed);
    } else if (!current && trimmed.length >= 6 && /gleason|pirads|primus|suv\b/i.test(trimmed)) {
      // Data-like content before any section header was reached
      warnings.push(`Line ignored (no section header yet): "${truncate(trimmed)}"`);
    }
  }

  const bxLesions = parseBiopsyLines(sections.biopsy, warnings);
  const { lesions: mriLesions, volumeCc } = parseMriLines(sections.mri, warnings);
  const musLesions = parseMusLines(sections.mus, warnings);
  const psmaLesions = parsePsmaLines(sections.psma, warnings);

  const biopsyText = sections.biopsy.join(" ");
  const coresMatch = biopsyText.match(/(\d+)\s+\d+(?:st|nd|rd|th)\b/i);
  const biopsyTotalCores = coresMatch ? parseInt(coresMatch[1] ?? "0") : undefined;

  const maxCorePct =
    bxLesions.length > 0 ? Math.max(...bxLesions.map((l) => l.corePct)) : undefined;
  const maxGG =
    bxLesions.length > 0
      ? Math.max(...bxLesions.map((l) => parseInt(l.score) || 0))
      : undefined;

  return {
    lesions: [...bxLesions, ...mriLesions, ...musLesions, ...psmaLesions],
    prostateVolumeCc: volumeCc,
    biopsyTotalCores,
    biopsyMaxCorePct: maxCorePct,
    biopsyGG: maxGG,
    warnings,
  };
}
