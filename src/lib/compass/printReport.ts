import { usePatientStore } from "@/store/patientStore";
import { useUiStore } from "@/store/uiStore";

import { deriveClinicalFromLesions, lesionsFromRows } from "@/lib/utils/normalization";
import { clinicalStateFromRecord } from "./clinicalFromRecord";
import { COMPASS_TO_3D } from "./constants";
import type { ZoneMap } from "@/types/patient";
import type { ThreeZoneRuntime } from "@/types/prediction";

// ── SVG Prostate Sector Map ───────────────────────────────────────────────────
// Anatomically-shaped: elliptical cross-sections, PZpl/PZpm/TZ zones clipped to outline

function buildProstateMapSVG(zones: ZoneMap, threeZones: ThreeZoneRuntime[]): string {
  const f = (n: number) => n.toFixed(1);

  function fillC(v: number) {
    if (v >= 0.5) return "#FADADD";
    if (v >= 0.3) return "#FDECEA";
    if (v >= 0.15) return "#FEF3CD";
    if (v >= 0.08) return "#DFF0D8";
    return "#EEF8EE";
  }
  function strokeC(v: number) {
    if (v >= 0.3) return "#C0392B";
    if (v >= 0.15) return "#D4811E";
    return "#27AE60";
  }
  function txtC(v: number) {
    if (v >= 0.3) return "#922B21";
    if (v >= 0.15) return "#7D6608";
    return "#1A6B2F";
  }
  function gzv(key: string, ov: string): number {
    const pd = zones[key as keyof typeof zones];
    if (pd) {
      const raw = pd[ov as keyof typeof pd] as number | undefined;
      if (raw !== undefined && raw > 0.03) return raw;
    }
    const z3dId = COMPASS_TO_3D[key];
    if (!z3dId) return 0.02;
    const z3d = threeZones.find((z) => z.id === z3dId);
    if (!z3d) return 0.02;
    return (z3d[ov as keyof ThreeZoneRuntime] as number) ?? 0.02;
  }

  const overlays = ["cancer", "ece", "svi", "psm"];
  const ovLabels = ["csPCa", "ECE", "SVI", "PSM"];

  const panelW = 162;
  const pad = 6;
  const svgW = overlays.length * panelW + pad * 2;
  const svgH = 445;

  // BASE and MID: 6-zone levels (PZpl-L, PZpm-L, ANT-L, PZpl-R, PZpm-R, ANT-R)
  const fullLevels = [
    { label: "BASE", cy: 92,  rx: 50, ry: 40, antL: "1a", antR: "4a", pmL: "1p", plL: "2p", pmR: "6p", plR: "7p", pmRx: 17, pmRy: 13, pmXOff: 13, pmCyOff: 8 },
    { label: "MID",  cy: 228, rx: 50, ry: 40, antL: "2a", antR: "5a", pmL: "3p", plL: "4p", pmR: "8p", plR: "9p", pmRx: 17, pmRy: 13, pmXOff: 13, pmCyOff: 8 },
  ] as const;

  // APEX: 4-zone (no PZpm distinction)
  const apexCy = 346;
  const apexRx = 34;
  const apexRy = 27;

  // Build clipPath defs first (one ellipse per panel × level)
  let defs = "<defs>";
  overlays.forEach((_ov, idx) => {
    const px = pad + idx * panelW;
    const cx = px + panelW / 2;
    for (const { label, cy, rx, ry } of fullLevels) {
      defs += `<clipPath id="cp-${idx}-${label}"><ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${rx}" ry="${ry}"/></clipPath>`;
    }
    defs += `<clipPath id="cp-${idx}-APEX"><ellipse cx="${f(cx)}" cy="${f(apexCy)}" rx="${apexRx}" ry="${apexRy}"/></clipPath>`;
  });
  defs += "</defs>";

  let s = "";

  // Background
  s += `<rect width="${svgW}" height="${svgH}" fill="#fafafa" rx="4"/>`;

  // Column separators
  for (let i = 1; i < overlays.length; i++) {
    const lx = pad + i * panelW;
    s += `<line x1="${lx}" y1="8" x2="${lx}" y2="${svgH - 8}" stroke="#e4e4e4" stroke-width="1"/>`;
  }

  overlays.forEach((ov, idx) => {
    const px = pad + idx * panelW;
    const cx = px + panelW / 2;
    const ovLabel = ovLabels[idx] ?? ov;
    const pt = `text-anchor="middle" font-family="Arial,sans-serif" font-size="7.5" font-weight="700"`;

    // Panel heading
    s += `<rect x="${px + 4}" y="6" width="${panelW - 8}" height="20" rx="3" fill="#1a5276" opacity="0.08"/>`;
    s += `<text x="${f(cx)}" y="20" text-anchor="middle" font-family="Arial,sans-serif" font-size="10.5" font-weight="700" fill="#1a5276">${ovLabel}</text>`;

    // ── BASE & MID (6-zone, anatomical ellipse) ───────────────────────────────
    for (const { label, cy, rx, ry, antL, antR, pmL, plL, pmR, plR, pmRx, pmRy, pmXOff, pmCyOff } of fullLevels) {
      const cpId = `cp-${idx}-${label}`;
      const plLv = gzv(plL, ov);
      const plRv = gzv(plR, ov);
      const pmLv = gzv(pmL, ov);
      const pmRv = gzv(pmR, ov);
      const antLv = gzv(antL, ov);
      const antRv = gzv(antR, ov);

      s += `<text x="${px + 8}" y="${cy - ry - 6}" font-family="Arial,sans-serif" font-size="8" font-weight="700" fill="#888" letter-spacing="1.5">${label}</text>`;

      s += `<g clip-path="url(#${cpId})">`;
        // PZpl (outer posterior zone) — fills bottom half, clipped to ellipse
        s += `<rect x="${f(cx - rx - 1)}" y="${f(cy - 1)}" width="${f(rx + 1)}" height="${f(ry + 1)}" fill="${fillC(plLv)}"/>`;
        s += `<rect x="${f(cx)}" y="${f(cy - 1)}" width="${f(rx + 1)}" height="${f(ry + 1)}" fill="${fillC(plRv)}"/>`;
        // PZpm (inner medial posterior) — small ellipse overlaid on PZpl
        s += `<ellipse cx="${f(cx - pmXOff)}" cy="${f(cy + pmCyOff)}" rx="${pmRx}" ry="${pmRy}" fill="${fillC(pmLv)}" stroke="${strokeC(pmLv)}" stroke-width="0.7"/>`;
        s += `<ellipse cx="${f(cx + pmXOff)}" cy="${f(cy + pmCyOff)}" rx="${pmRx}" ry="${pmRy}" fill="${fillC(pmRv)}" stroke="${strokeC(pmRv)}" stroke-width="0.7"/>`;
        // ANT / TZ — fills top half, drawn over posterior to clean up center
        s += `<rect x="${f(cx - rx - 1)}" y="${f(cy - ry - 1)}" width="${f(rx + 1)}" height="${f(ry + 1)}" fill="${fillC(antLv)}"/>`;
        s += `<rect x="${f(cx)}" y="${f(cy - ry - 1)}" width="${f(rx + 1)}" height="${f(ry + 1)}" fill="${fillC(antRv)}"/>`;
        // Outer ellipse border
        s += `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${rx}" ry="${ry}" fill="none" stroke="#999" stroke-width="1.5"/>`;
        // ANT/POST anatomical boundary: bezier curving slightly into posterior
        s += `<path d="M${f(cx - rx)},${f(cy)} C${f(cx - rx * 0.38)},${f(cy + 8)} ${f(cx + rx * 0.38)},${f(cy + 8)} ${f(cx + rx)},${f(cy)}" fill="none" stroke="#aaa" stroke-width="0.9"/>`;
        // L/R midline
        s += `<line x1="${f(cx)}" y1="${f(cy - ry)}" x2="${f(cx)}" y2="${f(cy + ry)}" stroke="#aaa" stroke-width="0.8"/>`;
      s += `</g>`;

      // Urethra dot (rendered above clip group)
      s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="2.5" fill="#d4d4d4" stroke="#bbb" stroke-width="0.7"/>`;

      // Risk percentage labels
      s += `<text x="${f(cx - rx * 0.5)}" y="${f(cy - ry * 0.48 + 3)}" ${pt} fill="${txtC(antLv)}">${Math.round(antLv * 100)}%</text>`;
      s += `<text x="${f(cx + rx * 0.5)}" y="${f(cy - ry * 0.48 + 3)}" ${pt} fill="${txtC(antRv)}">${Math.round(antRv * 100)}%</text>`;
      s += `<text x="${f(cx - pmXOff)}" y="${f(cy + pmCyOff + 3)}" ${pt} fill="${txtC(pmLv)}">${Math.round(pmLv * 100)}%</text>`;
      s += `<text x="${f(cx + pmXOff)}" y="${f(cy + pmCyOff + 3)}" ${pt} fill="${txtC(pmRv)}">${Math.round(pmRv * 100)}%</text>`;
      s += `<text x="${f(cx - rx * 0.68)}" y="${f(cy + ry * 0.7 + 3)}" ${pt} fill="${txtC(plLv)}">${Math.round(plLv * 100)}%</text>`;
      s += `<text x="${f(cx + rx * 0.68)}" y="${f(cy + ry * 0.7 + 3)}" ${pt} fill="${txtC(plRv)}">${Math.round(plRv * 100)}%</text>`;

      // Micro anatomy labels (first panel only to avoid clutter)
      if (idx === 0) {
        const ml = `text-anchor="middle" font-family="Arial,sans-serif" font-size="6" fill="#b0b0b0"`;
        s += `<text x="${f(cx - rx * 0.5)}" y="${f(cy - ry + 9)}" ${ml}>TZ</text>`;
        s += `<text x="${f(cx + rx * 0.5)}" y="${f(cy - ry + 9)}" ${ml}>TZ</text>`;
        s += `<text x="${f(cx - rx * 0.72)}" y="${f(cy + ry - 4)}" ${ml}>PZpl</text>`;
        s += `<text x="${f(cx + rx * 0.72)}" y="${f(cy + ry - 4)}" ${ml}>PZpl</text>`;
      }
    }

    // ── APEX (4-zone) ─────────────────────────────────────────────────────────
    {
      const antLv  = gzv("3a",  ov);
      const antRv  = gzv("6a",  ov);
      const postLv = gzv("5p",  ov);
      const postRv = gzv("10p", ov);

      s += `<text x="${px + 8}" y="${apexCy - apexRy - 6}" font-family="Arial,sans-serif" font-size="8" font-weight="700" fill="#888" letter-spacing="1.5">APEX</text>`;

      s += `<g clip-path="url(#cp-${idx}-APEX)">`;
        s += `<rect x="${f(cx - apexRx - 1)}" y="${f(apexCy - 1)}" width="${f(apexRx + 1)}" height="${f(apexRy + 1)}" fill="${fillC(postLv)}"/>`;
        s += `<rect x="${f(cx)}" y="${f(apexCy - 1)}" width="${f(apexRx + 1)}" height="${f(apexRy + 1)}" fill="${fillC(postRv)}"/>`;
        s += `<rect x="${f(cx - apexRx - 1)}" y="${f(apexCy - apexRy - 1)}" width="${f(apexRx + 1)}" height="${f(apexRy + 1)}" fill="${fillC(antLv)}"/>`;
        s += `<rect x="${f(cx)}" y="${f(apexCy - apexRy - 1)}" width="${f(apexRx + 1)}" height="${f(apexRy + 1)}" fill="${fillC(antRv)}"/>`;
        s += `<ellipse cx="${f(cx)}" cy="${f(apexCy)}" rx="${apexRx}" ry="${apexRy}" fill="none" stroke="#999" stroke-width="1.5"/>`;
        s += `<path d="M${f(cx - apexRx)},${f(apexCy)} C${f(cx - apexRx * 0.4)},${f(apexCy + 6)} ${f(cx + apexRx * 0.4)},${f(apexCy + 6)} ${f(cx + apexRx)},${f(apexCy)}" fill="none" stroke="#aaa" stroke-width="0.9"/>`;
        s += `<line x1="${f(cx)}" y1="${f(apexCy - apexRy)}" x2="${f(cx)}" y2="${f(apexCy + apexRy)}" stroke="#aaa" stroke-width="0.8"/>`;
      s += `</g>`;

      s += `<circle cx="${f(cx)}" cy="${f(apexCy)}" r="2.5" fill="#d4d4d4" stroke="#bbb" stroke-width="0.7"/>`;

      s += `<text x="${f(cx - apexRx * 0.5)}" y="${f(apexCy - apexRy * 0.45 + 3)}" ${pt} fill="${txtC(antLv)}">${Math.round(antLv * 100)}%</text>`;
      s += `<text x="${f(cx + apexRx * 0.5)}" y="${f(apexCy - apexRy * 0.45 + 3)}" ${pt} fill="${txtC(antRv)}">${Math.round(antRv * 100)}%</text>`;
      s += `<text x="${f(cx - apexRx * 0.5)}" y="${f(apexCy + apexRy * 0.55 + 3)}" ${pt} fill="${txtC(postLv)}">${Math.round(postLv * 100)}%</text>`;
      s += `<text x="${f(cx + apexRx * 0.5)}" y="${f(apexCy + apexRy * 0.55 + 3)}" ${pt} fill="${txtC(postRv)}">${Math.round(postRv * 100)}%</text>`;
    }

    // ── Seminal Vesicles ──────────────────────────────────────────────────────
    const svTop = 388;
    s += `<text x="${px + 8}" y="${svTop - 5}" font-family="Arial,sans-serif" font-size="7.5" font-weight="700" fill="#888" letter-spacing="1">SV</text>`;
    const svCells = [
      { key: "SV-L", label: "SV-L", x: px + 8, w: panelW / 2 - 12 },
      { key: "SV-R", label: "SV-R", x: px + panelW / 2 + 4, w: panelW / 2 - 12 },
    ];
    for (const { key, label, x, w } of svCells) {
      const v = gzv(key, ov);
      const pct = Math.round(v * 100);
      s += `<rect x="${x}" y="${svTop}" width="${w}" height="22" rx="3" fill="${fillC(v)}" stroke="${strokeC(v)}" stroke-width="0.8"/>`;
      s += `<text x="${x + w / 2}" y="${svTop + 9}" text-anchor="middle" font-size="7" font-weight="700" fill="#666" font-family="Arial">${label}</text>`;
      s += `<text x="${x + w / 2}" y="${svTop + 19}" text-anchor="middle" font-size="8" font-weight="700" fill="${txtC(v)}" font-family="Arial">${pct}%</text>`;
    }

    // ── Per-panel legend ──────────────────────────────────────────────────────
    const legY = svgH - 20;
    const legItems = [
      { label: "<8%",    fill: "#EEF8EE", stroke: "#27AE60" },
      { label: "8–15%",  fill: "#DFF0D8", stroke: "#27AE60" },
      { label: "15–30%", fill: "#FEF3CD", stroke: "#D4811E" },
      { label: "≥30%",   fill: "#FDECEA", stroke: "#C0392B" },
    ];
    legItems.forEach(({ label, fill, stroke }, i) => {
      const lx = px + 4 + i * (panelW / 4);
      s += `<rect x="${lx}" y="${legY}" width="8" height="8" rx="1" fill="${fill}" stroke="${stroke}" stroke-width="0.7"/>`;
      s += `<text x="${lx + 10}" y="${legY + 7}" font-size="6.5" fill="#888" font-family="Arial">${label}</text>`;
    });
  });

  return `<svg width="${svgW}" height="${svgH}" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;max-width:${svgW}px">${defs}${s}</svg>`;
}

// ── HTML builder (exported for modal use) ────────────────────────────────────

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

  // ── Prostate map SVG ──────────────────────────────────────────────────────
  const prostateMapSVG = buildProstateMapSVG(entry.record.zones ?? {}, threeZones);

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
<div class="pred-row">${predCards}</div>
${sideEceHtml}

<div class="map-box">
  <div class="map-box-title">
    Prostate Sector Map — Zone Risk Distribution
    <span>Axial view · Patient L on left · ANT = top · POST = bottom · Inner ellipse = PZpm · Outer post = PZpl</span>
  </div>
  <div style="padding:10px 8px 4px">${prostateMapSVG}</div>
</div>

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
