import { isObserved } from "@/lib/models/inputContract";
import { usePatientStore } from "@/store/patientStore";
import { useUiStore } from "@/store/uiStore";
import { deriveClinicalFromLesions, lesionsFromRows } from "@/lib/utils/normalization";
import { clinicalStateFromRecord } from "./clinicalFromRecord";
import { COMPASS_TO_3D } from "./constants";
import { computePlanningView } from "./planningView";
import { buildPlanningHtml } from "./printPlanning";

// ── Sector map: positive sectors colored by cancer probability (green→red) ───
// Same ramp as the 3D model's overlayColor("cancer").

function lesionRowToSectors(row: import("@/types/lesion").LesionRow): string[] {
  const pos = row.zone || "";
  const isAnt = pos === "Anterior";
  const isLat = pos === "Posterolateral" || pos === "Lateral";
  const isMed = pos === "Medial";
  function sectorsForSide(s: "L" | "R"): string[] {
    if (isAnt) {
      if (row.level === "Base") return [s === "L" ? "1a" : "4a"];
      if (row.level === "Mid")  return [s === "L" ? "2a" : "5a"];
      return [s === "L" ? "3a" : "6a"];
    }
    if (row.level === "Apex") return [s === "L" ? "5p" : "10p"];
    if (isLat) {
      if (row.level === "Base") return [s === "L" ? "2p" : "7p"];
      if (row.level === "Mid")  return [s === "L" ? "4p" : "9p"];
    }
    if (isMed) {
      if (row.level === "Base") return [s === "L" ? "1p" : "6p"];
      if (row.level === "Mid")  return [s === "L" ? "3p" : "8p"];
    }
    if (row.level === "Base") return s === "L" ? ["1p", "2p"] : ["6p", "7p"];
    if (row.level === "Mid")  return s === "L" ? ["3p", "4p"] : ["8p", "9p"];
    return [s === "L" ? "5p" : "10p"];
  }
  if (row.side === "L" || row.side === "R") return sectorsForSide(row.side);
  return [...sectorsForSide("L"), ...sectorsForSide("R")];
}

/**
 * The report is assembled as an HTML string and handed to an <iframe srcDoc>,
 * so React does no escaping for us here. Record fields reach this file from
 * imported JSON and from /patient/<id> shares, i.e. they are not necessarily
 * the well-formed numbers the schema promises — escape before interpolating.
 * (The iframe is also sandboxed without allow-scripts, in PrintReportModal;
 * these are two independent layers and both should stay.)
 */
function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cancerColor(val: number): string {
  // Mirrors overlayColor(val, "cancer") from prostateScene.ts
  let r: number, g: number, b: number;
  if (val < 0.1) {
    r = 0.18; g = 0.8; b = 0.44;
  } else if (val < 0.3) {
    const t = (val - 0.1) / 0.2;
    r = 0.18 + t * 0.72; g = 0.8 - t * 0.3; b = 0.44 - t * 0.34;
  } else if (val < 0.6) {
    const t = (val - 0.3) / 0.3;
    r = 0.9; g = 0.5 - t * 0.2; b = 0.1;
  } else {
    const t = Math.min((val - 0.6) / 0.4, 1);
    r = 0.95; g = 0.3 - t * 0.25; b = 0.08;
  }
  const h = (x: number) => Math.round(Math.min(x, 1) * 255).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function buildZoneHeatmapSVG(
  lesionRows: import("@/types/lesion").LesionRow[],
  threeZones: import("@/types/prediction").ThreeZoneRuntime[],
  sviProbs: { L: number; R: number },
): string {
  const f = (n: number) => n.toFixed(1);

  type Col = "MRI" | "MUS" | "PET";
  const cols: Col[] = ["MRI", "MUS", "PET"];

  // Build positive sector sets and SV flags per modality (same as original)
  const pos: Record<Col, Set<string>> = { MRI: new Set(), MUS: new Set(), PET: new Set() };
  const svL: Record<Col, boolean> = { MRI: false, MUS: false, PET: false };
  const svR: Record<Col, boolean> = { MRI: false, MUS: false, PET: false };

  for (const row of lesionRows) {
    if (row.source === "Bx") continue; // biopsy is not an imaging modality — shown in lesion table
    const grp: Col = row.source === "MRI" ? "MRI" : row.source === "PSMA" ? "PET" : "MUS";
    if (row.svi) {
      if (row.side === "L" || row.side === "") svL[grp] = true;
      if (row.side === "R" || row.side === "") svR[grp] = true;
    }
    lesionRowToSectors(row).forEach((z) => pos[grp].add(z));
  }

  // Only render columns that have at least one finding
  const activeCols = cols.filter((c) => pos[c].size > 0 || svL[c] || svR[c]);
  if (activeCols.length === 0) return "";

  const colW = 218;
  const pad  = 8;
  const svgW = activeCols.length * colW + pad * 2;

  const svTop = 36;
  const svH   = 26;
  const baseY = 148;
  const midY  = 278;
  const apexY = 383;
  const lrY   = 428;
  const legY  = 448;
  const svgH  = 470;

  const fRx = 58, fRy = 48;
  const aRx = 44, aRy = 35;
  const pmRx = 18, pmRy = 14, pmXOff = 16, pmCyOff = 11;

  const NEG_FILL = "#ffffff";
  const BORDER   = "#2c2c2c";
  const LABEL_C  = "#1a1a1a";
  const LEVEL_C  = "#666666";
  const DASH     = `stroke-dasharray="3 2"`;
  const FA       = `font-family="Arial,sans-serif"`;

  const COL_HEADER: Record<Col, string> = {
    MRI: "#1d4ed8",
    MUS: "#0f766e",
    PET: "#6d28d9",
  };
  const COL_BG: Record<Col, string> = {
    MRI: "#dbeafe",
    MUS: "#ccfbf1",
    PET: "#ede9fe",
  };

  // Look up cancer probability for a sector via COMPASS_TO_3D zone id
  function sectorProb(sector: string): number {
    const zoneId = COMPASS_TO_3D[sector];
    return zoneId ? (threeZones.find((z) => z.id === zoneId)?.cancer ?? 0.25) : 0.25;
  }

  // Positive sectors use cancer-probability color (green→red); negative = white
  function fill(col: Col, sector: string): string {
    if (!pos[col].has(sector)) return NEG_FILL;
    return cancerColor(sectorProb(sector));
  }

  let defs = "<defs>";
  activeCols.forEach((_c, idx) => {
    const cx = pad + idx * colW + colW / 2;
    defs += `<clipPath id="cb${idx}"><ellipse cx="${f(cx)}" cy="${f(baseY)}" rx="${fRx}" ry="${fRy}"/></clipPath>`;
    defs += `<clipPath id="cm${idx}"><ellipse cx="${f(cx)}" cy="${f(midY)}"  rx="${fRx}" ry="${fRy}"/></clipPath>`;
    defs += `<clipPath id="ca${idx}"><ellipse cx="${f(cx)}" cy="${f(apexY)}" rx="${aRx}"  ry="${aRy}"/></clipPath>`;
  });
  defs += `<linearGradient id="leg" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%"   stop-color="${cancerColor(0.02)}"/>
    <stop offset="33%"  stop-color="${cancerColor(0.15)}"/>
    <stop offset="60%"  stop-color="${cancerColor(0.35)}"/>
    <stop offset="100%" stop-color="${cancerColor(0.80)}"/>
  </linearGradient>`;
  defs += "</defs>";

  let s = `<rect width="${svgW}" height="${svgH}" fill="#f9f9f9" rx="4"/>`;

  for (let i = 1; i < activeCols.length; i++) {
    const lx = pad + i * colW;
    s += `<line x1="${lx}" y1="8" x2="${lx}" y2="${legY - 8}" stroke="#d8d8d8" stroke-width="1"/>`;
  }

  activeCols.forEach((col, idx) => {
    const px  = pad + idx * colW;
    const cx  = px + colW / 2;
    const lbl = `text-anchor="middle" ${FA}`;

    // Column header
    s += `<rect x="${px + 6}" y="5" width="${colW - 12}" height="22" rx="3" fill="${COL_BG[col]}"/>`;
    s += `<text x="${f(cx)}" y="20" ${lbl} font-size="13" font-weight="800" fill="${COL_HEADER[col]}">${col}</text>`;

    // ── Seminal Vesicles ──────────────────────────────────────────────────────
    s += `<text x="${px + 10}" y="${svTop - 3}" ${FA} font-size="8" font-weight="700" fill="${LEVEL_C}" letter-spacing="1">SV</text>`;
    const svW  = colW / 2 - 14;
    const svLx = px + 10, svRx = px + colW / 2 + 4;
    for (const [x, hasPos, lbTxt, isLeft] of [
      [svLx, svL[col], "SV-L", true],
      [svRx, svR[col], "SV-R", false],
    ] as [number, boolean, string, boolean][]) {
      const fc = hasPos ? cancerColor(isLeft ? sviProbs.L : sviProbs.R) : NEG_FILL;
      s += `<rect x="${x}" y="${svTop}" width="${svW}" height="${svH}" rx="9" fill="${fc}" stroke="${BORDER}" stroke-width="1.3"/>`;
      s += `<text x="${x + svW / 2}" y="${svTop + svH / 2 + 4}" ${lbl} font-size="9" font-weight="700" fill="${LABEL_C}">${lbTxt}</text>`;
    }

    // ── BASE ──────────────────────────────────────────────────────────────────
    {
      const cy = baseY;
      s += `<text x="${px + 10}" y="${cy - fRy - 5}" ${FA} font-size="8" font-weight="700" fill="${LEVEL_C}" letter-spacing="1">base</text>`;
      s += `<g clip-path="url(#cb${idx})">`;
      s += `<rect x="${f(cx - fRx)}" y="${f(cy)}"       width="${f(fRx)}" height="${f(fRy)}" fill="${fill(col, "2p")}"/>`;
      s += `<rect x="${f(cx)}"       y="${f(cy)}"       width="${f(fRx)}" height="${f(fRy)}" fill="${fill(col, "7p")}"/>`;
      s += `<ellipse cx="${f(cx - pmXOff)}" cy="${f(cy + pmCyOff)}" rx="${pmRx}" ry="${pmRy}" fill="${fill(col, "1p")}" stroke="${BORDER}" stroke-width="0.8"/>`;
      s += `<ellipse cx="${f(cx + pmXOff)}" cy="${f(cy + pmCyOff)}" rx="${pmRx}" ry="${pmRy}" fill="${fill(col, "6p")}" stroke="${BORDER}" stroke-width="0.8"/>`;
      s += `<rect x="${f(cx - fRx)}" y="${f(cy - fRy)}" width="${f(fRx)}" height="${f(fRy)}" fill="${fill(col, "1a")}"/>`;
      s += `<rect x="${f(cx)}"       y="${f(cy - fRy)}" width="${f(fRx)}" height="${f(fRy)}" fill="${fill(col, "4a")}"/>`;
      s += `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${fRx}" ry="${fRy}" fill="none" stroke="${BORDER}" stroke-width="1.6"/>`;
      s += `<line x1="${f(cx - fRx)}" y1="${f(cy)}" x2="${f(cx + fRx)}" y2="${f(cy)}" stroke="${BORDER}" stroke-width="0.9" ${DASH}/>`;
      s += `<line x1="${f(cx)}" y1="${f(cy - fRy)}" x2="${f(cx)}" y2="${f(cy + fRy)}" stroke="${BORDER}" stroke-width="0.9" ${DASH}/>`;
      s += `</g>`;
      s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="3" fill="#cccccc" stroke="${BORDER}" stroke-width="0.8"/>`;
      const tl = `text-anchor="middle" ${FA} font-size="9" font-weight="700" fill="${LABEL_C}"`;
      s += `<text x="${f(cx - fRx * 0.52)}" y="${f(cy - fRy * 0.5 + 4)}"  ${tl}>1a</text>`;
      s += `<text x="${f(cx + fRx * 0.52)}" y="${f(cy - fRy * 0.5 + 4)}"  ${tl}>4a</text>`;
      s += `<text x="${f(cx - pmXOff)}"      y="${f(cy + pmCyOff + 4)}"    ${tl}>1p</text>`;
      s += `<text x="${f(cx + pmXOff)}"      y="${f(cy + pmCyOff + 4)}"    ${tl}>6p</text>`;
      s += `<text x="${f(cx - fRx * 0.82)}" y="${f(cy + fRy * 0.75 + 3)}" ${tl}>2p</text>`;
      s += `<text x="${f(cx + fRx * 0.82)}" y="${f(cy + fRy * 0.75 + 3)}" ${tl}>7p</text>`;
    }

    // ── MID ───────────────────────────────────────────────────────────────────
    {
      const cy = midY;
      s += `<text x="${px + 10}" y="${cy - fRy - 5}" ${FA} font-size="8" font-weight="700" fill="${LEVEL_C}" letter-spacing="1">mid</text>`;
      s += `<g clip-path="url(#cm${idx})">`;
      s += `<rect x="${f(cx - fRx)}" y="${f(cy)}"       width="${f(fRx)}" height="${f(fRy)}" fill="${fill(col, "4p")}"/>`;
      s += `<rect x="${f(cx)}"       y="${f(cy)}"       width="${f(fRx)}" height="${f(fRy)}" fill="${fill(col, "9p")}"/>`;
      s += `<ellipse cx="${f(cx - pmXOff)}" cy="${f(cy + pmCyOff)}" rx="${pmRx}" ry="${pmRy}" fill="${fill(col, "3p")}" stroke="${BORDER}" stroke-width="0.8"/>`;
      s += `<ellipse cx="${f(cx + pmXOff)}" cy="${f(cy + pmCyOff)}" rx="${pmRx}" ry="${pmRy}" fill="${fill(col, "8p")}" stroke="${BORDER}" stroke-width="0.8"/>`;
      s += `<rect x="${f(cx - fRx)}" y="${f(cy - fRy)}" width="${f(fRx)}" height="${f(fRy)}" fill="${fill(col, "2a")}"/>`;
      s += `<rect x="${f(cx)}"       y="${f(cy - fRy)}" width="${f(fRx)}" height="${f(fRy)}" fill="${fill(col, "5a")}"/>`;
      s += `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${fRx}" ry="${fRy}" fill="none" stroke="${BORDER}" stroke-width="1.6"/>`;
      s += `<line x1="${f(cx - fRx)}" y1="${f(cy)}" x2="${f(cx + fRx)}" y2="${f(cy)}" stroke="${BORDER}" stroke-width="0.9" ${DASH}/>`;
      s += `<line x1="${f(cx)}" y1="${f(cy - fRy)}" x2="${f(cx)}" y2="${f(cy + fRy)}" stroke="${BORDER}" stroke-width="0.9" ${DASH}/>`;
      s += `</g>`;
      s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="3" fill="#cccccc" stroke="${BORDER}" stroke-width="0.8"/>`;
      const tl = `text-anchor="middle" ${FA} font-size="9" font-weight="700" fill="${LABEL_C}"`;
      s += `<text x="${f(cx - fRx * 0.52)}" y="${f(cy - fRy * 0.5 + 4)}"  ${tl}>2a</text>`;
      s += `<text x="${f(cx + fRx * 0.52)}" y="${f(cy - fRy * 0.5 + 4)}"  ${tl}>5a</text>`;
      s += `<text x="${f(cx - pmXOff)}"      y="${f(cy + pmCyOff + 4)}"    ${tl}>3p</text>`;
      s += `<text x="${f(cx + pmXOff)}"      y="${f(cy + pmCyOff + 4)}"    ${tl}>8p</text>`;
      s += `<text x="${f(cx - fRx * 0.82)}" y="${f(cy + fRy * 0.75 + 3)}" ${tl}>4p</text>`;
      s += `<text x="${f(cx + fRx * 0.82)}" y="${f(cy + fRy * 0.75 + 3)}" ${tl}>9p</text>`;
    }

    // ── APEX ──────────────────────────────────────────────────────────────────
    {
      const cy = apexY;
      s += `<text x="${px + 10}" y="${cy - aRy - 5}" ${FA} font-size="8" font-weight="700" fill="${LEVEL_C}" letter-spacing="1">apex</text>`;
      s += `<g clip-path="url(#ca${idx})">`;
      s += `<rect x="${f(cx - aRx)}" y="${f(cy)}"       width="${f(aRx)}" height="${f(aRy)}" fill="${fill(col, "5p")}"/>`;
      s += `<rect x="${f(cx)}"       y="${f(cy)}"       width="${f(aRx)}" height="${f(aRy)}" fill="${fill(col, "10p")}"/>`;
      s += `<rect x="${f(cx - aRx)}" y="${f(cy - aRy)}" width="${f(aRx)}" height="${f(aRy)}" fill="${fill(col, "3a")}"/>`;
      s += `<rect x="${f(cx)}"       y="${f(cy - aRy)}" width="${f(aRx)}" height="${f(aRy)}" fill="${fill(col, "6a")}"/>`;
      s += `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${aRx}" ry="${aRy}" fill="none" stroke="${BORDER}" stroke-width="1.6"/>`;
      s += `<line x1="${f(cx - aRx)}" y1="${f(cy)}" x2="${f(cx + aRx)}" y2="${f(cy)}" stroke="${BORDER}" stroke-width="0.9" ${DASH}/>`;
      s += `<line x1="${f(cx)}" y1="${f(cy - aRy)}" x2="${f(cx)}" y2="${f(cy + aRy)}" stroke="${BORDER}" stroke-width="0.9" ${DASH}/>`;
      s += `</g>`;
      s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="5.5" fill="#ffffff" stroke="${BORDER}" stroke-width="1.3"/>`;
      s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="2.5" fill="${BORDER}"/>`;
      const tl = `text-anchor="middle" ${FA} font-size="9" font-weight="700" fill="${LABEL_C}"`;
      s += `<text x="${f(cx - aRx * 0.5)}" y="${f(cy - aRy * 0.48 + 4)}"  ${tl}>3a</text>`;
      s += `<text x="${f(cx + aRx * 0.5)}" y="${f(cy - aRy * 0.48 + 4)}"  ${tl}>6a</text>`;
      s += `<text x="${f(cx - aRx * 0.5)}" y="${f(cy + aRy * 0.68 + 3)}"  ${tl}>5p</text>`;
      s += `<text x="${f(cx + aRx * 0.5)}" y="${f(cy + aRy * 0.68 + 3)}"  ${tl}>10p</text>`;
    }

    // ── L / R labels ──────────────────────────────────────────────────────────
    const lrTl = `text-anchor="middle" ${FA} font-size="12" font-weight="700" fill="#444"`;
    s += `<text x="${f(cx - fRx * 0.45)}" y="${lrY}" ${lrTl}>L</text>`;
    s += `<text x="${f(cx + fRx * 0.45)}" y="${lrY}" ${lrTl}>R</text>`;
  });

  // Legend — gradient bar (Low→High cancer probability) + No finding chip
  const legBarW = Math.min(svgW - 80, 160);
  s += `<text x="12" y="${legY - 1}" ${FA} font-size="7.5" fill="#777">Low</text>`;
  s += `<rect x="34" y="${legY - 9}" width="${legBarW}" height="9" fill="url(#leg)" rx="2" stroke="${BORDER}" stroke-width="0.5"/>`;
  s += `<text x="${34 + legBarW + 3}" y="${legY - 1}" ${FA} font-size="7.5" fill="#777">High</text>`;
  const negX = 34 + legBarW + 32;
  s += `<rect x="${negX}" y="${legY - 9}" width="9" height="9" rx="1" fill="${NEG_FILL}" stroke="${BORDER}" stroke-width="0.8"/>`;
  s += `<text x="${negX + 11}" y="${legY - 1}" ${FA} font-size="7.5" fill="#777">No finding</text>`;

  return `<svg width="${svgW}" height="${svgH}" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;max-width:${svgW}px">${defs}${s}</svg>`;
}

// ── HTML builder (exported for modal use) ────────────────────────────────────

const ZONE_PRINT_LABELS: Record<string, string> = {
  "P-RB-L": "R Base Lat", "P-RB-M": "R Base Med",
  "P-LB-M": "L Base Med", "P-LB-L": "L Base Lat",
  "P-RM-L": "R Mid Lat",  "P-RM-M": "R Mid Med",
  "P-LM-M": "L Mid Med",  "P-LM-L": "L Mid Lat",
  "P-RA":   "R Apex",     "P-LA":   "L Apex",
  "A-RB":   "R Ant Base", "A-LB":   "L Ant Base",
  "A-RM":   "R Ant Mid",  "A-LM":   "L Ant Mid",
};

/** `modelViews`: anterior and posterior snapshots of the 3D model (white background). */
export function buildPrintHtml(modelViews: string[] = []): string | null {
  const { patients, activeId, predictions, threeZones } = usePatientStore.getState();

  const entry = patients.find((p) => p.id === activeId);
  if (!entry || !predictions) return null;

  const record = { ...entry.record, lesions: entry.lesionRows };
  const S = deriveClinicalFromLesions(
    clinicalStateFromRecord(record),
    lesionsFromRows(entry.lesionRows),
  );

  const pct = (v: number) => (Number.isFinite(v) ? Math.round(v * 100) + "%" : "N/A");

  // Colour only values that need attention; everything else prints black.
  const riskColor = (v: number) =>
    v >= 0.3 ? "#A11D1D" : v >= 0.15 ? "#8A5A00" : "#111";

  // ── Zone heatmap (columns per modality, colored by cancer probability) ──────
  const prostateMapSVG = buildZoneHeatmapSVG(
    entry.lesionRows,
    threeZones,
    { L: predictions.sviL, R: predictions.sviR },
  );

  // ── Prediction cards ──────────────────────────────────────────────────────
  const predFields = [
    { label: "ECE",     val: predictions.ece },
    { label: "SVI",     val: predictions.svi },
    { label: "Upgrade", val: predictions.upgrade },
    { label: "PSM (L / R)", val: Math.max(predictions.psmL, predictions.psmR), txt: `${pct(predictions.psmL)} / ${pct(predictions.psmR)}` },
    { label: "36-mo BCR risk", val: predictions.bcr36 },
    { label: "LNI",     val: predictions.lni },
  ];

  const predHtml = `<table class="data">
    <thead><tr>${predFields.map((f) => `<th>${f.label}</th>`).join("")}</tr></thead>
    <tbody><tr>${predFields
      .map((f) => {
        const txt = "txt" in f && f.txt ? f.txt : pct(f.val);
        return `<td style="font-size:14px;font-weight:700;color:${riskColor(f.val)}">${txt}</td>`;
      })
      .join("")}</tr></tbody>
  </table>`;

  // ── DA Sparing helper ────────────────────────────────────────────────────
  function daLabel(grade: number): string {
    if (grade === 1) return "Regular drop";
    if (grade === 2) return "Modified hood";
    return "Wide excision";
  }
  const daText =
    predictions.nsL === predictions.nsR
      ? daLabel(predictions.nsL)
      : `${daLabel(predictions.nsL)}, ${daLabel(predictions.nsR)}`;

  // ── Surgical summary table (OR-style) ─────────────────────────────────────
  // Mirrors the compact table surgeons use intraoperatively: ECE (standard +
  // extensive), SVI, PLND, NS grade, and DA sparing technique.
  const surgSummaryHtml = `
  <table style="border-collapse:collapse;width:100%;margin:0 0 14px;font-size:11px">
    <thead>
      <tr>
        <th style="border:1px solid #555;padding:4px 8px;background:#f2f2f2;width:22%"></th>
        <th colspan="2" style="border:1px solid #555;padding:4px 8px;background:#f2f2f2;text-align:center;font-weight:700">Left</th>
        <th colspan="2" style="border:1px solid #555;padding:4px 8px;background:#f2f2f2;text-align:center;font-weight:700">Right</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="border:1px solid #555;padding:4px 8px;font-weight:700">Prob of ECE (%)</td>
        <td style="border:1px solid #555;padding:4px 8px;text-align:center;font-weight:700;color:${riskColor(predictions.eceL)}">${Math.round(predictions.eceL * 100)}&nbsp;%</td>
        <td style="border:1px solid #555;padding:4px 8px;text-align:center;font-weight:700;color:${riskColor(predictions.extensive)}">${Math.round(predictions.extensive * 100)}&nbsp;%</td>
        <td style="border:1px solid #555;padding:4px 8px;text-align:center;font-weight:700;color:${riskColor(predictions.eceR)}">${Math.round(predictions.eceR * 100)}&nbsp;%</td>
        <td style="border:1px solid #555;padding:4px 8px;text-align:center;font-weight:700;color:${riskColor(predictions.extensive)}">${Math.round(predictions.extensive * 100)}&nbsp;%</td>
      </tr>
      <tr>
        <td style="border:1px solid #555;padding:4px 8px;font-weight:700">Prob of SVI (%)</td>
        <td style="border:1px solid #555;padding:4px 8px;text-align:center;font-weight:700;color:${riskColor(predictions.sviL)}">${Math.round(predictions.sviL * 100)}&nbsp;%</td>
        <td style="border:1px solid #555;padding:4px 8px;text-align:center;color:#999">-</td>
        <td style="border:1px solid #555;padding:4px 8px;text-align:center;font-weight:700;color:${riskColor(predictions.sviR)}">${Math.round(predictions.sviR * 100)}&nbsp;%</td>
        <td style="border:1px solid #555;padding:4px 8px;text-align:center;color:#999">-</td>
      </tr>
      <tr>
        <td style="border:1px solid #555;padding:4px 8px;font-weight:700"><span style="text-decoration:underline">PLND</span>(%)</td>
        <td colspan="4" style="border:1px solid #555;padding:4px 8px;text-align:center;font-weight:700;color:${riskColor(predictions.lni)}">${Math.round(predictions.lni * 100)}&nbsp;%</td>
      </tr>
      <tr>
        <td style="border:1px solid #555;padding:4px 8px;font-weight:700">Grade of NS</td>
        <td colspan="2" style="border:1px solid #555;padding:4px 8px;text-align:center;font-weight:700;font-size:13px;background:#f2f2f2;color:#333">${predictions.nsL}</td>
        <td colspan="2" style="border:1px solid #555;padding:4px 8px;text-align:center;font-weight:700;font-size:13px;background:#f2f2f2;color:#333">${predictions.nsR}</td>
      </tr>
      <tr>
        <td style="border:1px solid #555;padding:4px 8px;font-weight:700">DA Sparing</td>
        <td colspan="4" style="border:1px solid #555;padding:4px 8px;text-align:center;font-weight:700">${daText}</td>
      </tr>
    </tbody>
  </table>`;

  // ── Patient table ─────────────────────────────────────────────────────────
  const abLabels: Record<string, string> = {
    "-1": "N/A", "0": "No contact", "1": "Abuts",
    "2": "Abuts-broad", "3": "Irregular", "4": "Bulge",
  };

  let patHtml = `<table>
    <thead><tr><th>PSA</th><th>Volume</th><th>PSAD</th><th>Grade group</th><th>Cores</th><th>PI-RADS</th><th>Laterality</th></tr></thead>
    <tbody><tr>
      <td>${esc(S.psa)} ng/mL</td><td>${esc(S.vol)} cc</td><td>${S.psad.toFixed(3)}</td>
      <td>GG ${esc(S.gg)}</td><td>${esc(S.cores)}</td><td>${esc(S.pirads)}</td><td>${esc(S.laterality)}</td>
    </tr></tbody>
  </table>`;

  patHtml += `<table>
    <thead><tr><th>Age</th><th>BMI</th><th>SHIM</th><th>IPSS</th></tr></thead>
    <tbody><tr>
      <td>${esc(S.age)}</td><td>${S.bmi > 0 ? esc(S.bmi) : "—"}</td><td>${esc(S.shim)}</td><td>${esc(S.ipss)}</td>
    </tr></tbody>
  </table>`;

  const hasMri = S.mri_size > 0 || isObserved(S.mri_abutment) && S.mri_abutment >= 0 || isObserved(S.mri_adc) && S.mri_adc > 0;
  if (hasMri) {
    patHtml += `<table>
      <thead><tr><th>MRI size</th><th>Capsular contact</th><th>ADC mean</th><th>MRI EPE</th><th>MRI SVI</th></tr></thead>
      <tbody><tr>
        <td>${S.mri_size > 0 ? (S.mri_size * 10).toFixed(0) + " mm" : "—"}</td>
        <td>${abLabels[String(S.mri_abutment ?? -1)] ?? "—"}</td>
        <td>${isObserved(S.mri_adc) && S.mri_adc > 0 ? esc(S.mri_adc) : "—"}</td>
        <td>${S.mri_epe ? "Yes" : "No"}</td>
        <td>${S.mri_svi ? "Yes" : "No"}</td>
      </tr></tbody>
    </table>`;
  }

  // ── NS 5-zone table ───────────────────────────────────────────────────────
  const L = predictions.nsDetailL;
  const R = predictions.nsDetailR;
  const zones5 = [
    { k: "posterolateral", l: "Posterolateral" },
    { k: "base",           l: "Base" },
    { k: "apex",           l: "Apex" },
    { k: "anterior",       l: "Anterior" },
    { k: "bladder_neck",   l: "Bladder Neck" },
  ];

  let nsRows = zones5.map(({ k, l }) => {
    const lv = (L.zones?.[k] ?? 0) as number;
    const rv = (R.zones?.[k] ?? 0) as number;
    const ls = L.has_zone_data ? (lv > 0 && lv < 0.005 ? "<1%" : pct(lv)) : "—";
    const rs = R.has_zone_data ? (rv > 0 && rv < 0.005 ? "<1%" : pct(rv)) : "—";
    return `<tr>
      <td>${l}</td>
      <td style="color:${riskColor(lv)};font-weight:700">${ls}</td>
      <td style="color:${riskColor(rv)};font-weight:700">${rs}</td>
    </tr>`;
  }).join("");

  const nsHtml = `<table>
    <thead><tr><th>Zone</th><th>Left</th><th>Right</th></tr></thead>
    <tbody>${nsRows}</tbody>
  </table>`;

  // ── Zone cancer probability table ─────────────────────────────────────────
  const zoneCancerItems = threeZones
    .filter((z) => (z.cancer ?? 0) > 0.05 && ZONE_PRINT_LABELS[z.id])
    .sort((a, b) => (b.cancer ?? 0) - (a.cancer ?? 0))
    .map((z) => {
      const v = z.cancer ?? 0;
      return `<tr>
        <td>${ZONE_PRINT_LABELS[z.id]}</td>
        <td class="num" style="font-weight:700;color:${riskColor(v)}">${pct(v)}</td>
      </tr>`;
    });
  const zoneCancerHtml = zoneCancerItems.length > 0
    ? `<table>
        <thead><tr><th>Zone</th><th class="num">csPCa probability</th></tr></thead>
        <tbody>${zoneCancerItems.join("")}</tbody>
      </table>`
    : `<p class="muted">No zones above 5%.</p>`;

  const allAlerts: string[] = [];
  (L.alerts ?? []).forEach((a) => allAlerts.push("L — " + a.message));
  (R.alerts ?? []).forEach((a) => allAlerts.push("R — " + a.message));
  const alertHtml = allAlerts.length > 0
    ? `<ul class="alerts">${allAlerts.map((a) => `<li><b>Alert:</b> ${esc(a)}</li>`).join("")}</ul>`
    : "";

  // ── PLND decision ─────────────────────────────────────────────────────────
  const isHighRisk = S.gg >= 4 || S.psa >= 20;
  const plndDecision = predictions.lni >= 0.05 || isHighRisk || S.psma_ln;

  const plndHtml = `<table>
    <thead><tr><th>LNI risk</th><th>NCCN category</th><th>PSMA LN</th><th>Recommendation</th></tr></thead>
    <tbody><tr>
      <td style="font-weight:700;color:${riskColor(predictions.lni)}">${pct(predictions.lni)}</td>
      <td>${isHighRisk ? "High risk" : "Non-high risk"}</td>
      <td>${S.psma_ln ? "Positive" : "Negative"}</td>
      <td style="font-weight:700">${plndDecision ? "Perform PLND" : "Consider Omitting PLND"}</td>
    </tr></tbody>
  </table>`;

  // ── Lesion table ──────────────────────────────────────────────────────────
  let lesHtml = "";
  if (entry.lesionRows.length > 0) {
    const rows = entry.lesionRows.map((l) => {
      const isBx = l.source === "Bx";
      return `<tr>
        <td style="font-weight:700">${l.source}</td><td>${l.side}</td><td>${l.level}</td><td>${l.zone}</td>
        <td>${l.score}</td>
        <td>${isBx && l.corePct ? l.corePct + "%" : "—"}</td>
        <td>${isBx && l.linear ? l.linear + " mm" : !isBx && l.mriSize ? l.mriSize + " mm" : "—"}</td>
        <td>${l.epe ? "Yes" : "—"}</td>
        <td>${l.svi ? "Yes" : "—"}</td>
      </tr>`;
    }).join("");
    lesHtml = `
      <h2>Lesion data</h2>
      <table>
        <thead><tr><th>Source</th><th>Side</th><th>Level</th><th>Zone</th><th>Score</th><th>Core %</th><th>Size</th><th>EPE</th><th>SVI</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  // ── CSS ───────────────────────────────────────────────────────────────────
  const css = `
    @page { margin: 1.5cm 1.6cm; }
    * { box-sizing: border-box; }
    body { font-family: "Helvetica Neue", Arial, sans-serif; color: #111; max-width: 760px; margin: 0 auto; font-size: 11px; line-height: 1.45; }
    .header { border-bottom: 1.5px solid #111; padding-bottom: 6px; margin-bottom: 14px; }
    .header-title { font-size: 17px; font-weight: 700; }
    .header-meta { display: flex; justify-content: space-between; margin-top: 3px; font-size: 10px; color: #555; }
    h2 { font-size: 12px; font-weight: 700; border-bottom: 1px solid #999; padding-bottom: 2px; margin: 16px 0 6px; break-after: avoid; }
    h2.break { break-before: page; }
    table { width: 100%; border-collapse: collapse; margin: 0 0 10px; font-size: 11px; }
    th { text-align: left; font-weight: 700; padding: 3px 6px; border-bottom: 1px solid #444; font-size: 10.5px; }
    td { padding: 3px 6px; border-bottom: 1px solid #ddd; vertical-align: top; }
    tbody tr:last-child td { border-bottom: none; }
    table.data td { border-bottom: none; }
    table.grid tbody th { width: 30%; font-weight: 600; border-bottom: 1px solid #ddd; }
    table.compact td, table.compact th { padding: 2px 6px; }
    table, .card, .notice, .figure { break-inside: avoid; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .muted { color: #666; font-weight: 400; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
    .figure { margin: 0 0 10px; text-align: center; }
    .views { display: flex; justify-content: center; gap: 8px; }
    .views > div { flex: 1; text-align: center; }
    .figure img { max-width: 100%; max-height: 270px; object-fit: contain; }
    .view-label { font-size: 10px; font-weight: 700; margin-top: 1px; }
    .figure svg { max-width: 100%; }
    .caption { font-size: 9.5px; color: #444; text-align: left; margin-top: 3px; }
    .alerts { margin: 4px 0 8px; padding-left: 16px; font-size: 10.5px; }
    .lead { margin: 0 0 6px; }
    .note { margin: 4px 0 8px; font-size: 10.5px; color: #333; }
    .tier { font-weight: 700; }
    .notice { border: 1px solid #8A5A00; padding: 5px 8px; margin: 0 0 8px; font-size: 10.5px; }
    .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 0 0 10px; }
    .card { border: 1px solid #bbb; padding: 6px 8px; }
    .card-head { display: flex; justify-content: space-between; font-weight: 700; margin-bottom: 3px; }
    .card .flag { font-weight: 700; margin-bottom: 3px; }
    .card ul { list-style: none; margin: 0; padding: 0; }
    .card li { display: flex; justify-content: space-between; gap: 8px; padding: 1px 0; font-size: 10.5px; }
    .refs { margin: 0; padding-left: 16px; font-size: 8.5px; color: #555; line-height: 1.35; }
    .footer { margin-top: 18px; font-size: 8.5px; color: #666; border-top: 1px solid #ccc; padding-top: 5px; }
    @media print { .map-box { break-inside: avoid; } }
  `;

  // ── Compose HTML ──────────────────────────────────────────────────────────
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const patientId = entry.record.patient?.age ? `Age ${esc(entry.record.patient.age)}` : "";

  const planningHtml = buildPlanningHtml(S, predictions, computePlanningView(S, predictions));

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>COMPASS Surgical Planning Report</title>
<style>${css}</style></head>
<body>

<div class="header">
  <div class="header-title">COMPASS Surgical Planning Report</div>
  <div class="header-meta">
    <span>Mount Sinai Department of Urology · IRB STUDY-14-00050 · Research use only</span>
    <span>${patientId ? patientId + " · " : ""}${dateStr}</span>
  </div>
</div>

<h2>Clinical data</h2>
${patHtml}

<h2>Predictions</h2>
${predHtml}
${surgSummaryHtml}

${modelViews.length ? `<div class="figure">
  <div class="views">${["Anterior", "Posterior"].map((n, i) => modelViews[i] ? `<div><img src="${modelViews[i]}" alt="3D prostate model, ${n.toLowerCase()} view" /><div class="view-label">${n}</div></div>` : "").join("")}</div>
  <div class="caption"><b>Figure 1.</b> 3D prostate model, anterior and posterior views. Coloured areas mark zones with csPCa probability of 15% or more (orange 15–50%, red above 50%); grey gland is below 15%. Each zone is shown on both faces, so a view can show disease that lies on the opposite face.</div>
</div>` : ""}

${prostateMapSVG ? `<div class="figure">
  ${prostateMapSVG}
  <div class="caption"><b>Figure ${modelViews.length ? 2 : 1}.</b> Axial sector map by modality. Left on left, anterior at top. Colour shows cancer probability from green (low) to red (high); white means no finding.</div>
</div>` : ""}

<div class="two-col">
  <div><h2>Zone cancer probability</h2>${zoneCancerHtml}</div>
  <div><h2>Nerve sparing, 5-zone analysis</h2>${nsHtml}</div>
</div>
${alertHtml}

<h2>PLND decision</h2>
${plndHtml}

${planningHtml}

${lesHtml}

<div class="footer">
  COMPASS is a research decision-support tool. It is not FDA cleared and does not replace clinical judgement.<br>
  Model card: MODEL_CARD.md · Data dictionary: DATA_DICTIONARY.md
</div>

</body></html>`;

  return html;
}

// ── Open the in-app print modal ───────────────────────────────────────────────

export function printReport() {
  const { patients, activeId, predictions } = usePatientStore.getState();
  const entry = patients.find((p) => p.id === activeId);
  if (!entry || !predictions) {
    alert("No patient data loaded.");
    return;
  }
  useUiStore.getState().setPrintReportOpen(true);
}
