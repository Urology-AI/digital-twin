import { usePatientStore } from "@/store/patientStore";
import { useUiStore } from "@/store/uiStore";

import { deriveClinicalFromLesions, lesionsFromRows } from "@/lib/utils/normalization";
import { clinicalStateFromRecord } from "./clinicalFromRecord";
import type { LesionRow } from "@/types/lesion";

// ── OR-style Prostate Sector Map ──────────────────────────────────────────────
// Three columns (MRI / MUS / PET), binary sector shading from lesion rows.
// Matches the clinical OR printout format surgeons use intraoperatively.

function lesionRowToSectors(row: LesionRow): string[] {
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
    // Generic posterior — mark both medial + lateral
    if (row.level === "Base") return s === "L" ? ["1p", "2p"] : ["6p", "7p"];
    if (row.level === "Mid")  return s === "L" ? ["3p", "4p"] : ["8p", "9p"];
    return [s === "L" ? "5p" : "10p"];
  }

  if (row.side === "L" || row.side === "R") return sectorsForSide(row.side);
  return [...sectorsForSide("L"), ...sectorsForSide("R")];
}

function buildORSectorMapSVG(lesionRows: LesionRow[]): string {
  const f = (n: number) => n.toFixed(1);

  type Col = "MRI" | "MUS" | "PET";
  const cols: Col[] = ["MRI", "MUS", "PET"];

  // Build positive sector sets and SV flags per modality
  const pos: Record<Col, Set<string>> = { MRI: new Set(), MUS: new Set(), PET: new Set() };
  const svL: Record<Col, boolean> = { MRI: false, MUS: false, PET: false };
  const svR: Record<Col, boolean> = { MRI: false, MUS: false, PET: false };

  for (const row of lesionRows) {
    const grp: Col = row.source === "MRI" ? "MRI" : row.source === "PSMA" ? "PET" : "MUS";
    if (row.svi) {
      if (row.side === "L" || row.side === "") svL[grp] = true;
      if (row.side === "R" || row.side === "") svR[grp] = true;
    }
    lesionRowToSectors(row).forEach((z) => pos[grp].add(z));
  }

  const colW = 218;
  const pad = 8;
  const svgW = cols.length * colW + pad * 2;

  // Row vertical positions
  const svTop = 36;
  const svH = 26;
  const baseY = 148;
  const midY = 278;
  const apexY = 383;
  const lrY   = 428;
  const svgH  = 440;

  // Ellipse radii
  const fRx = 58, fRy = 48;
  const aRx = 44, aRy = 35;
  const pmRx = 18, pmRy = 14, pmXOff = 16, pmCyOff = 11;

  const NEG_FILL   = "#ffffff";
  const BORDER     = "#2c2c2c";
  const LABEL_C    = "#1a1a1a";
  const LEVEL_C    = "#666666";
  const DASH       = `stroke-dasharray="3 2"`;
  const FA         = `font-family="Arial,sans-serif"`;

  // L sectors: 1a–3a, 1p–5p  |  R sectors: 4a–6a, 6p–10p
  function isLeftSector(s: string): boolean {
    const n = parseInt(s);
    return s.endsWith("a") ? n <= 3 : n <= 5;
  }

  function fill(col: Col, sector: string): string {
    if (!pos[col].has(sector)) return NEG_FILL;
    if (col === "MRI") return "#C0392B";
    if (col === "MUS") return isLeftSector(sector) ? "#2471A3" : "#D4AC0D";
    return "#D4AC0D"; // PET
  }

  // clipPath defs
  let defs = "<defs>";
  cols.forEach((_c, idx) => {
    const cx = pad + idx * colW + colW / 2;
    defs += `<clipPath id="cb${idx}"><ellipse cx="${f(cx)}" cy="${f(baseY)}" rx="${fRx}" ry="${fRy}"/></clipPath>`;
    defs += `<clipPath id="cm${idx}"><ellipse cx="${f(cx)}" cy="${f(midY)}"  rx="${fRx}" ry="${fRy}"/></clipPath>`;
    defs += `<clipPath id="ca${idx}"><ellipse cx="${f(cx)}" cy="${f(apexY)}" rx="${aRx}"  ry="${aRy}"/></clipPath>`;
  });
  defs += "</defs>";

  let s = `<rect width="${svgW}" height="${svgH}" fill="#f9f9f9" rx="4"/>`;

  // Column separators
  for (let i = 1; i < cols.length; i++) {
    const lx = pad + i * colW;
    s += `<line x1="${lx}" y1="8" x2="${lx}" y2="${svgH - 8}" stroke="#d8d8d8" stroke-width="1"/>`;
  }

  cols.forEach((col, idx) => {
    const px = pad + idx * colW;
    const cx = px + colW / 2;
    const lbl = `text-anchor="middle" ${FA}`;

    // Column header
    s += `<rect x="${px + 6}" y="5" width="${colW - 12}" height="22" rx="3" fill="#2c3e50" opacity="0.09"/>`;
    s += `<text x="${f(cx)}" y="20" ${lbl} font-size="13" font-weight="800" fill="#2c3e50">${col}</text>`;

    // ── Seminal Vesicles ──────────────────────────────────────────────────────
    s += `<text x="${px + 10}" y="${svTop - 3}" ${FA} font-size="8" font-weight="700" fill="${LEVEL_C}" letter-spacing="1">SV</text>`;
    const svW = colW / 2 - 14;
    const svLx = px + 10, svRx = px + colW / 2 + 4;
    for (const [x, hasPos, lbTxt, isLeft] of [
      [svLx, svL[col], "SV-L", true],
      [svRx, svR[col], "SV-R", false],
    ] as [number, boolean, string, boolean][]) {
      let fc = NEG_FILL;
      if (hasPos) {
        if (col === "MRI") fc = "#C0392B";
        else if (col === "MUS") fc = isLeft ? "#2471A3" : "#D4AC0D";
        else fc = "#D4AC0D";
      }
      s += `<rect x="${x}" y="${svTop}" width="${svW}" height="${svH}" rx="9" fill="${fc}" stroke="${BORDER}" stroke-width="1.3"/>`;
      s += `<text x="${x + svW / 2}" y="${svTop + svH / 2 + 4}" ${lbl} font-size="9" font-weight="700" fill="${LABEL_C}">${lbTxt}</text>`;
    }

    // ── BASE ──────────────────────────────────────────────────────────────────
    {
      const cy = baseY;
      s += `<text x="${px + 10}" y="${cy - fRy - 5}" ${FA} font-size="8" font-weight="700" fill="${LEVEL_C}" letter-spacing="1">base</text>`;

      const antL = fill(col, "1a"), antR = fill(col, "4a");
      const plL  = fill(col, "2p"), plR  = fill(col, "7p");
      const pmL  = fill(col, "1p"), pmR  = fill(col, "6p");

      s += `<g clip-path="url(#cb${idx})">`;
      s += `<rect x="${f(cx - fRx)}" y="${f(cy)}"      width="${f(fRx)}" height="${f(fRy)}" fill="${plL}"/>`;
      s += `<rect x="${f(cx)}"       y="${f(cy)}"      width="${f(fRx)}" height="${f(fRy)}" fill="${plR}"/>`;
      s += `<ellipse cx="${f(cx - pmXOff)}" cy="${f(cy + pmCyOff)}" rx="${pmRx}" ry="${pmRy}" fill="${pmL}" stroke="${BORDER}" stroke-width="0.8"/>`;
      s += `<ellipse cx="${f(cx + pmXOff)}" cy="${f(cy + pmCyOff)}" rx="${pmRx}" ry="${pmRy}" fill="${pmR}" stroke="${BORDER}" stroke-width="0.8"/>`;
      s += `<rect x="${f(cx - fRx)}" y="${f(cy - fRy)}" width="${f(fRx)}" height="${f(fRy)}" fill="${antL}"/>`;
      s += `<rect x="${f(cx)}"       y="${f(cy - fRy)}" width="${f(fRx)}" height="${f(fRy)}" fill="${antR}"/>`;
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

      const antL = fill(col, "2a"), antR = fill(col, "5a");
      const plL  = fill(col, "4p"), plR  = fill(col, "9p");
      const pmL  = fill(col, "3p"), pmR  = fill(col, "8p");

      s += `<g clip-path="url(#cm${idx})">`;
      s += `<rect x="${f(cx - fRx)}" y="${f(cy)}"      width="${f(fRx)}" height="${f(fRy)}" fill="${plL}"/>`;
      s += `<rect x="${f(cx)}"       y="${f(cy)}"      width="${f(fRx)}" height="${f(fRy)}" fill="${plR}"/>`;
      s += `<ellipse cx="${f(cx - pmXOff)}" cy="${f(cy + pmCyOff)}" rx="${pmRx}" ry="${pmRy}" fill="${pmL}" stroke="${BORDER}" stroke-width="0.8"/>`;
      s += `<ellipse cx="${f(cx + pmXOff)}" cy="${f(cy + pmCyOff)}" rx="${pmRx}" ry="${pmRy}" fill="${pmR}" stroke="${BORDER}" stroke-width="0.8"/>`;
      s += `<rect x="${f(cx - fRx)}" y="${f(cy - fRy)}" width="${f(fRx)}" height="${f(fRy)}" fill="${antL}"/>`;
      s += `<rect x="${f(cx)}"       y="${f(cy - fRy)}" width="${f(fRx)}" height="${f(fRy)}" fill="${antR}"/>`;
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

      const antL  = fill(col, "3a"),  antR  = fill(col, "6a");
      const postL = fill(col, "5p"),  postR = fill(col, "10p");

      s += `<g clip-path="url(#ca${idx})">`;
      s += `<rect x="${f(cx - aRx)}" y="${f(cy)}"      width="${f(aRx)}" height="${f(aRy)}" fill="${postL}"/>`;
      s += `<rect x="${f(cx)}"       y="${f(cy)}"      width="${f(aRx)}" height="${f(aRy)}" fill="${postR}"/>`;
      s += `<rect x="${f(cx - aRx)}" y="${f(cy - aRy)}" width="${f(aRx)}" height="${f(aRy)}" fill="${antL}"/>`;
      s += `<rect x="${f(cx)}"       y="${f(cy - aRy)}" width="${f(aRx)}" height="${f(aRy)}" fill="${antR}"/>`;
      s += `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${aRx}" ry="${aRy}" fill="none" stroke="${BORDER}" stroke-width="1.6"/>`;
      s += `<line x1="${f(cx - aRx)}" y1="${f(cy)}" x2="${f(cx + aRx)}" y2="${f(cy)}" stroke="${BORDER}" stroke-width="0.9" ${DASH}/>`;
      s += `<line x1="${f(cx)}" y1="${f(cy - aRy)}" x2="${f(cx)}" y2="${f(cy + aRy)}" stroke="${BORDER}" stroke-width="0.9" ${DASH}/>`;
      s += `</g>`;
      // Open-circle urethra marker at apex
      s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="5.5" fill="#ffffff" stroke="${BORDER}" stroke-width="1.3"/>`;
      s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="2.5" fill="${BORDER}"/>`;

      const tl = `text-anchor="middle" ${FA} font-size="9" font-weight="700" fill="${LABEL_C}"`;
      s += `<text x="${f(cx - aRx * 0.5)}" y="${f(cy - aRy * 0.48 + 4)}"  ${tl}>3a</text>`;
      s += `<text x="${f(cx + aRx * 0.5)}" y="${f(cy - aRy * 0.48 + 4)}"  ${tl}>6a</text>`;
      s += `<text x="${f(cx - aRx * 0.5)}" y="${f(cy + aRy * 0.68 + 3)}"  ${tl}>5p</text>`;
      s += `<text x="${f(cx + aRx * 0.5)}" y="${f(cy + aRy * 0.68 + 3)}"  ${tl}>10p</text>`;
    }

    // ── L / R labels ──────────────────────────────────────────────────────────
    const tl = `text-anchor="middle" ${FA} font-size="12" font-weight="700" fill="#444"`;
    s += `<text x="${f(cx - fRx * 0.45)}" y="${lrY}" ${tl}>L</text>`;
    s += `<text x="${f(cx + fRx * 0.45)}" y="${lrY}" ${tl}>R</text>`;
  });

  // Bottom legend
  const legY = svgH - 14;
  const legItems: [string, string][] = [
    ["#C0392B", "MRI"], ["#2471A3", "MUS-L"], ["#D4AC0D", "MUS-R / PET"], [NEG_FILL, "Negative"],
  ];
  let legX = 12;
  legItems.forEach(([color, label]) => {
    s += `<rect x="${legX}" y="${legY - 9}" width="9" height="9" rx="1" fill="${color}" stroke="${BORDER}" stroke-width="0.8"/>`;
    s += `<text x="${legX + 11}" y="${legY - 1}" ${FA} font-size="7.5" fill="#777">${label}</text>`;
    legX += label.length * 5 + 18;
  });

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

export function buildPrintHtml(): string | null {
  const { patients, activeId, predictions, threeZones } = usePatientStore.getState();

  const entry = patients.find((p) => p.id === activeId);
  if (!entry || !predictions) return null;

  const record = { ...entry.record, lesions: entry.lesionRows };
  const S = deriveClinicalFromLesions(
    clinicalStateFromRecord(record),
    lesionsFromRows(entry.lesionRows),
  );

  const pct = (v: number) => Math.round(v * 100) + "%";

  const riskColor = (v: number) =>
    v >= 0.3 ? "#922B21" : v >= 0.15 ? "#7D6608" : "#1A6B2F";

  const riskBgColor = (v: number) =>
    v >= 0.3 ? "#FDECEA" : v >= 0.15 ? "#FEF9E7" : "#EAFAF1";

  const riskBorderColor = (v: number) =>
    v >= 0.3 ? "#F1948A" : v >= 0.15 ? "#F8C471" : "#82E0AA";

  // ── OR-style prostate sector map ─────────────────────────────────────────
  const prostateMapSVG = buildORSectorMapSVG(entry.lesionRows);

  // ── Prediction cards ──────────────────────────────────────────────────────
  const predFields = [
    { label: "ECE",     val: predictions.ece },
    { label: "SVI",     val: predictions.svi },
    { label: "Upgrade", val: predictions.upgrade },
    { label: "PSM",     val: predictions.psm },
    { label: "BCR",     val: predictions.bcr },
    { label: "LNI",     val: predictions.lni },
  ];

  const predCards = predFields
    .map(({ label, val }) => {
      const color = riskColor(val);
      const bg = riskBgColor(val);
      const border = riskBorderColor(val);
      return `<div style="flex:1;text-align:center;padding:8px 6px;background:${bg};border:1.5px solid ${border};border-radius:6px">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#555;margin-bottom:2px">${label}</div>
        <div style="font-size:22px;font-weight:800;color:${color};line-height:1">${pct(val)}</div>
      </div>`;
    })
    .join("");

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
  <table style="border-collapse:collapse;width:100%;margin:0 0 14px;font-size:11.5px">
    <thead>
      <tr>
        <th style="border:1.5px solid #000;padding:4px 8px;background:#e8eaf0;width:22%"></th>
        <th colspan="2" style="border:1.5px solid #000;padding:4px 8px;background:#e8eaf0;text-align:center;font-weight:800">LEFT</th>
        <th colspan="2" style="border:1.5px solid #000;padding:4px 8px;background:#ddeedd;text-align:center;font-weight:800">RIGHT</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="border:1.5px solid #000;padding:4px 8px;font-weight:700">Prob of ECE (%)</td>
        <td style="border:1.5px solid #000;padding:4px 8px;text-align:center;font-weight:700;color:${riskColor(predictions.eceL)}">${Math.round(predictions.eceL * 100)}&nbsp;%</td>
        <td style="border:1.5px solid #000;padding:4px 8px;text-align:center;font-weight:700;color:${riskColor(predictions.extensive)}">${Math.round(predictions.extensive * 100)}&nbsp;%</td>
        <td style="border:1.5px solid #000;padding:4px 8px;text-align:center;font-weight:700;color:${riskColor(predictions.eceR)}">${Math.round(predictions.eceR * 100)}&nbsp;%</td>
        <td style="border:1.5px solid #000;padding:4px 8px;text-align:center;font-weight:700;color:${riskColor(predictions.extensive)}">${Math.round(predictions.extensive * 100)}&nbsp;%</td>
      </tr>
      <tr>
        <td style="border:1.5px solid #000;padding:4px 8px;font-weight:700">Prob of SVI (%)</td>
        <td style="border:1.5px solid #000;padding:4px 8px;text-align:center;font-weight:700;color:${riskColor(predictions.sviL)}">${Math.round(predictions.sviL * 100)}&nbsp;%</td>
        <td style="border:1.5px solid #000;padding:4px 8px;text-align:center;color:#999">-</td>
        <td style="border:1.5px solid #000;padding:4px 8px;text-align:center;font-weight:700;color:${riskColor(predictions.sviR)}">${Math.round(predictions.sviR * 100)}&nbsp;%</td>
        <td style="border:1.5px solid #000;padding:4px 8px;text-align:center;color:#999">-</td>
      </tr>
      <tr>
        <td style="border:1.5px solid #000;padding:4px 8px;font-weight:700"><span style="text-decoration:underline">PLND</span>(%)</td>
        <td colspan="4" style="border:1.5px solid #000;padding:4px 8px;text-align:center;font-weight:700;color:${riskColor(predictions.lni)}">${Math.round(predictions.lni * 100)}&nbsp;%</td>
      </tr>
      <tr>
        <td style="border:1.5px solid #000;padding:4px 8px;font-weight:700">Grade of NS</td>
        <td colspan="2" style="border:1.5px solid #000;padding:4px 8px;text-align:center;font-weight:900;font-size:15px;background:#fffacd;color:#333">${predictions.nsL}</td>
        <td colspan="2" style="border:1.5px solid #000;padding:4px 8px;text-align:center;font-weight:900;font-size:15px;background:#fffacd;color:#333">${predictions.nsR}</td>
      </tr>
      <tr>
        <td style="border:1.5px solid #000;padding:4px 8px;font-weight:700">DA Sparing</td>
        <td colspan="4" style="border:1.5px solid #000;padding:4px 8px;text-align:center;font-weight:700">${daText}</td>
      </tr>
    </tbody>
  </table>`;

  // ── Side ECE row ─────────────────────────────────────────────────────────
  const sideEceHtml = `
    <div style="display:flex;gap:12px;margin:0 0 10px">
      <div style="flex:1;padding:6px 10px;background:${riskBgColor(predictions.eceL)};border:1px solid ${riskBorderColor(predictions.eceL)};border-radius:5px">
        <span style="font-size:9px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.8px">Left ECE</span>
        <span style="font-size:16px;font-weight:800;color:${riskColor(predictions.eceL)};margin-left:8px">${pct(predictions.eceL)}</span>
        &nbsp;<span style="font-size:10px;font-weight:700;color:#555">NS Grade ${predictions.nsL}</span>
      </div>
      <div style="flex:1;padding:6px 10px;background:${riskBgColor(predictions.eceR)};border:1px solid ${riskBorderColor(predictions.eceR)};border-radius:5px">
        <span style="font-size:9px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.8px">Right ECE</span>
        <span style="font-size:16px;font-weight:800;color:${riskColor(predictions.eceR)};margin-left:8px">${pct(predictions.eceR)}</span>
        &nbsp;<span style="font-size:10px;font-weight:700;color:#555">NS Grade ${predictions.nsR}</span>
      </div>
    </div>`;

  // ── Patient table ─────────────────────────────────────────────────────────
  const abLabels: Record<string, string> = {
    "-1": "N/A", "0": "No contact", "1": "Abuts",
    "2": "Abuts-broad", "3": "Irregular", "4": "Bulge",
  };

  let patHtml = `<table>
    <thead><tr><th>PSA</th><th>Volume</th><th>PSAD</th><th>Grade Group</th><th>Cores</th><th>PI-RADS</th><th>Laterality</th></tr></thead>
    <tbody><tr>
      <td>${S.psa} ng/mL</td><td>${S.vol} cc</td><td>${S.psad.toFixed(3)}</td>
      <td>GG ${S.gg}</td><td>${S.cores}</td><td>${S.pirads}</td><td>${S.laterality}</td>
    </tr></tbody>
  </table>`;

  const hasMri = S.mri_size > 0 || S.mri_abutment >= 0 || S.mri_adc > 0;
  if (hasMri) {
    patHtml += `<table>
      <thead><tr><th>MRI Size</th><th>Capsular Contact</th><th>ADC Mean</th><th>MRI EPE</th><th>MRI SVI</th></tr></thead>
      <tbody><tr>
        <td>${S.mri_size > 0 ? (S.mri_size * 10).toFixed(0) + " mm" : "—"}</td>
        <td>${abLabels[String(S.mri_abutment)] ?? "—"}</td>
        <td>${S.mri_adc > 0 ? S.mri_adc : "—"}</td>
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
      const bg = riskBgColor(v);
      const border = riskBorderColor(v);
      const col = riskColor(v);
      return `<tr>
        <td>${ZONE_PRINT_LABELS[z.id]}</td>
        <td style="text-align:right;font-weight:700;color:${col};background:${bg};border-left:3px solid ${border}">${pct(v)}</td>
      </tr>`;
    });
  const zoneCancerHtml = zoneCancerItems.length > 0
    ? `<table>
        <thead><tr><th>Zone</th><th style="text-align:right">csPCa Probability</th></tr></thead>
        <tbody>${zoneCancerItems.join("")}</tbody>
      </table>`
    : `<p style="font-size:10px;color:#999">No zones above 5%</p>`;

  const allAlerts: string[] = [];
  (L.alerts ?? []).forEach((a) => allAlerts.push("L — " + a.message));
  (R.alerts ?? []).forEach((a) => allAlerts.push("R — " + a.message));
  const alertHtml = allAlerts.length > 0
    ? `<div style="margin:6px 0 10px">${allAlerts.map((a) => `<div style="color:#922B21;font-size:10px;padding:2px 0;display:flex;align-items:center;gap:6px"><span style="font-size:12px">⚠</span> ${a}</div>`).join("")}</div>`
    : "";

  // ── PLND decision ─────────────────────────────────────────────────────────
  const isHighRisk = S.gg >= 4 || S.psa >= 20;
  const plndDecision = predictions.lni >= 0.05 || isHighRisk || S.psma_ln;
  const plndColor = plndDecision ? "#922B21" : "#1A6B2F";
  const plndBg = plndDecision ? "#FDECEA" : "#EAFAF1";

  const plndHtml = `<table>
    <thead><tr><th>LNI Risk</th><th>NCCN Category</th><th>PSMA LN</th><th>Recommendation</th></tr></thead>
    <tbody><tr>
      <td style="color:${riskColor(predictions.lni)};font-weight:700">${pct(predictions.lni)}</td>
      <td>${isHighRisk ? "High Risk" : "Non-High Risk"}</td>
      <td>${S.psma_ln ? "Positive" : "Negative"}</td>
      <td style="font-weight:700;color:${plndColor};background:${plndBg};padding:4px 8px;border-radius:3px">${plndDecision ? "Perform PLND" : "Consider Omitting PLND"}</td>
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
      <h2>Lesion Data</h2>
      <table>
        <thead><tr><th>Source</th><th>Side</th><th>Level</th><th>Zone</th><th>Score</th><th>Core %</th><th>Size</th><th>EPE</th><th>SVI</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  // ── CSS ───────────────────────────────────────────────────────────────────
  const css = `
    @page { margin: 1.4cm 1.5cm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; padding: 0; color: #1a1a1a; max-width: 760px; margin: 0 auto; font-size: 11.5px; line-height: 1.45; }
    .header { padding-bottom: 10px; margin-bottom: 18px; border-bottom: 3px solid #1a5276; }
    .header-title { font-size: 17px; font-weight: 800; text-align: center; color: #1a5276; letter-spacing: 3px; text-transform: uppercase; margin: 0; }
    .header-meta { display: flex; justify-content: space-between; margin-top: 5px; font-size: 10px; color: #888; }
    h2 { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; border-bottom: 1.5px solid #ddd; padding-bottom: 3px; margin: 18px 0 8px; color: #555; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin: 0 0 14px; font-size: 11px; }
    thead tr { background: #f5f7fa; }
    th { text-align: left; font-weight: 700; padding: 5px 8px; border-bottom: 2px solid #ddd; font-size: 9.5px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 4px 8px; border-bottom: 1px solid #f0f0f0; }
    tbody tr:last-child td { border-bottom: none; }
    .pred-row { display: flex; gap: 7px; margin: 0 0 14px; }
    .map-box { border: 1px solid #e4e4e4; border-radius: 6px; overflow: hidden; margin: 0 0 14px; }
    .map-box-title { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #1a5276; padding: 5px 10px 4px; background: #f0f4f9; border-bottom: 1px solid #e4e4e4; display: flex; align-items: center; gap: 6px; }
    .map-box-title span { font-weight: 400; color: #888; font-size: 9px; letter-spacing: 0; }
    .print-btn { display: block; margin: 24px auto 0; padding: 10px 44px; background: #1a5276; color: #fff; border: none; border-radius: 5px; cursor: pointer; font-size: 12px; font-weight: 700; letter-spacing: 1px; }
    .footer { margin-top: 20px; font-size: 8.5px; color: #aaa; text-align: center; border-top: 1px solid #eee; padding-top: 8px; }
    .risk-c-low  { color: #1A6B2F; }
    .risk-c-mod  { color: #7D6608; }
    .risk-c-high { color: #922B21; }
    .alert-item { color: #922B21; font-size: 10px; display: flex; align-items: center; gap: 4px; padding: 1px 0; }
    @media print { .print-btn { display: none; } .map-box { page-break-inside: avoid; } }
  `;

  // ── Compose HTML ──────────────────────────────────────────────────────────
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const patientId = entry.record.patient?.age ? `Age ${entry.record.patient.age}` : "";

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>COMPASS Surgical Planning Report</title>
<style>${css}</style></head>
<body>

<div class="header">
  <h1 class="header-title">COMPASS — Surgical Planning Report</h1>
  <div class="header-meta">
    <span>IRB STUDY-14-00050 · Mount Sinai · Research Use Only</span>
    <span>${patientId ? patientId + " · " : ""}${dateStr}</span>
  </div>
</div>

<h2>Clinical Data</h2>
${patHtml}

<h2>COMPASS Predictions</h2>
${surgSummaryHtml}
<div class="pred-row">${predCards}</div>
${sideEceHtml}

<div class="map-box">
  <div class="map-box-title">
    Prostate Sector Map — Imaging Findings by Modality
    <span>Axial view · L on left · ANT = top · POST = bottom · Shaded = positive finding · Inner ellipse = PZpm</span>
  </div>
  <div style="padding:10px 8px 4px">${prostateMapSVG}</div>
</div>

<h2>Zone Cancer Probability</h2>
${zoneCancerHtml}

<h2>Nerve Sparing — 5-Zone Analysis</h2>
${nsHtml}
${alertHtml}

<h2>PLND Decision</h2>
${plndHtml}

${lesHtml}

<div class="footer">
  COMPASS is a decision-support tool for prostate cancer surgical planning. Not FDA cleared. Not for autonomous clinical decision-making.<br>
  Model card: MODEL_CARD.md · Data dictionary: DATA_DICTIONARY.md · IRB STUDY-14-00050
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
