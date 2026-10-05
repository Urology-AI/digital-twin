import { isObserved } from "@/lib/models/inputContract";
import type { ClinicalState } from "@/types/patient";
import type { CompassPredictions } from "@/types/prediction";
import type { LesionRow } from "@/types/lesion";

const AB_LABELS: Record<string, string> = {
  "-1": "N/A",
  "0": "No contact",
  "1": "Abuts",
  "2": "Abuts-broad",
  "3": "Irregular",
  "4": "Bulge",
};

function pct(v: number) {
  return Number.isFinite(v) ? `${Math.round(v * 100)}%` : "N/A";
}

function rk(v: number) {
  if (v < 0.15) return "#228B22";
  if (v < 0.3) return "#DAA520";
  return "#DC143C";
}

export function printReport(
  S: ClinicalState,
  predictions: CompassPredictions,
  lesionRows: LesionRow[],
) {
  // Patient summary table
  let patHtml = `<table><tr><th>PSA</th><th>Volume</th><th>PSAD</th><th>GG</th><th>Cores</th><th>PI-RADS</th><th>Laterality</th></tr>`;
  patHtml += `<tr><td>${S.psa}</td><td>${S.vol} cc</td><td>${(S.psad || 0).toFixed(3)}</td>`;
  patHtml += `<td>${S.gg}</td><td>${S.cores}</td><td>${S.pirads}</td><td>${S.laterality}</td></tr></table>`;

  const hasMriDetail = S.mri_size > 0 || isObserved(S.mri_abutment) && S.mri_abutment >= 0 || isObserved(S.mri_adc) && S.mri_adc > 0;
  if (hasMriDetail) {
    patHtml += `<table style="margin-top:4px"><tr><th>MRI Size</th><th>Abutment</th><th>ADC Mean</th><th>MRI EPE</th><th>MRI SVI</th></tr>`;
    patHtml += `<tr><td>${S.mri_size > 0 ? (S.mri_size * 10).toFixed(0) + " mm" : "--"}</td>`;
    patHtml += `<td>${AB_LABELS[String(S.mri_abutment ?? -1)] ?? "--"}</td>`;
    patHtml += `<td>${isObserved(S.mri_adc) && S.mri_adc > 0 ? S.mri_adc : "--"}</td>`;
    patHtml += `<td>${S.mri_epe ? "Yes" : "No"}</td>`;
    patHtml += `<td>${S.mri_svi ? "Yes" : "No"}</td></tr></table>`;
  }

  // Predictions table
  const predFields = [
    { l: "ECE", v: predictions.ece },
    { l: "SVI", v: predictions.svi },
    { l: "Upgrade", v: predictions.upgrade },
    { l: "PSM (L / R)", v: Math.max(predictions.psmL, predictions.psmR), t: `${pct(predictions.psmL)} / ${pct(predictions.psmR)}` },
    { l: "BCR (36-month risk)", v: predictions.bcr36 },
    { l: "LNI", v: predictions.lni },
  ];
  let predHtml = `<table><tr>${predFields.map((p) => `<th>${p.l}</th>`).join("")}</tr>`;
  predHtml += `<tr>${predFields.map((p) => `<td style="color:${rk(p.v)};font-weight:700;font-size:14px">${"t" in p && p.t ? p.t : pct(p.v)}</td>`).join("")}</tr></table>`;

  // NS 5-zone table
  const L = predictions.nsDetailL ?? { zones: {}, alerts: [], has_zone_data: false };
  const R = predictions.nsDetailR ?? { zones: {}, alerts: [], has_zone_data: false };
  let nsHtml = `<table><tr><th></th><th>Left</th><th>Right</th></tr>`;
  nsHtml += `<tr><td><b>Side ECE</b></td><td style="color:${rk(predictions.eceL)};font-weight:700">${pct(predictions.eceL)}</td><td style="color:${rk(predictions.eceR)};font-weight:700">${pct(predictions.eceR)}</td></tr>`;

  const zones5 = [
    { k: "posterolateral", l: "Posterolateral" },
    { k: "base", l: "Base" },
    { k: "apex", l: "Apex" },
    { k: "anterior", l: "Anterior" },
    { k: "bladder_neck", l: "Bladder Neck" },
  ];
  zones5.forEach((z) => {
    const lv = (L.zones?.[z.k] ?? 0) as number;
    const rv = (R.zones?.[z.k] ?? 0) as number;
    const lStr = L.has_zone_data ? (lv > 0 && lv < 0.005 ? "< 1%" : pct(lv)) : "—";
    const rStr = R.has_zone_data ? (rv > 0 && rv < 0.005 ? "< 1%" : pct(rv)) : "—";
    nsHtml += `<tr><td>${z.l}</td><td>${lStr}</td><td>${rStr}</td></tr>`;
  });
  nsHtml += `<tr><td><b>NS Grade</b></td><td style="font-weight:700">Grade ${predictions.nsL}</td><td style="font-weight:700">Grade ${predictions.nsR}</td></tr>`;
  nsHtml += `</table>`;

  // Surgical alerts
  let alertHtml = "";
  const allAlerts: string[] = [];
  (L.alerts ?? []).forEach((a) => allAlerts.push("L " + a.message));
  (R.alerts ?? []).forEach((a) => allAlerts.push("R " + a.message));
  if (allAlerts.length > 0) {
    alertHtml = `<div style="margin:6px 0;font-size:11px">`;
    allAlerts.forEach((a) => {
      alertHtml += `<div style="color:#DC143C;padding:2px 0">⚠ ${a}</div>`;
    });
    alertHtml += `</div>`;
  }

  // Lesions table
  let lesHtml = "";
  if (lesionRows.length > 0) {
    lesHtml = `<h2>Lesion Data</h2><table>`;
    lesHtml += `<tr><th>Source</th><th>Side</th><th>Level</th><th>Position</th><th>Score</th><th>Core%</th><th>Linear</th><th>Size</th><th>EPE</th><th>SVI</th></tr>`;
    lesionRows.forEach((l) => {
      const isBx = l.source === "Bx";
      lesHtml += `<tr>`;
      lesHtml += `<td style="font-weight:700">${l.source}</td><td>${l.side}</td><td>${l.level}</td><td>${l.zone}</td>`;
      lesHtml += `<td>${l.score}</td>`;
      lesHtml += `<td>${isBx && l.corePct ? l.corePct + "%" : ""}</td>`;
      lesHtml += `<td>${isBx && l.linear ? l.linear + " mm" : ""}</td>`;
      lesHtml += `<td>${!isBx && l.mriSize ? l.mriSize + " mm" : ""}</td>`;
      lesHtml += `<td>${l.epe ? "Yes" : "No"}</td>`;
      lesHtml += `<td>${l.svi ? "Yes" : "No"}</td>`;
      lesHtml += `</tr>`;
    });
    lesHtml += `</table>`;
  }

  // PLND table
  const isHighRisk = S.gg >= 4 || S.psa > 20;
  let plndHtml = `<table><tr><th>LNI Risk</th><th>NCCN Risk</th><th>PSMA LN</th><th>Decision</th></tr>`;
  plndHtml += `<tr><td>${pct(predictions.lni)}</td><td>${isHighRisk ? "High" : "Non-High"}</td>`;
  plndHtml += `<td>${S.psma_ln ? "Positive" : "Negative"}</td>`;
  plndHtml += `<td style="font-weight:700">${isHighRisk || S.psma_ln ? "Perform PLND" : "Consider Omitting"}</td></tr></table>`;

  const css = [
    `body{font-family:"Times New Roman",Georgia,serif;padding:24px;color:#000;max-width:800px;margin:0 auto;line-height:1.5}`,
    `h1{font-size:16px;text-align:center;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:16px;text-transform:uppercase;letter-spacing:2px}`,
    `h2{font-size:13px;text-transform:uppercase;border-bottom:1px solid #666;padding-bottom:3px;margin:18px 0 8px;letter-spacing:1px}`,
    `table{width:100%;border-collapse:collapse;margin:6px 0 14px;font-size:12px}`,
    `th{text-align:left;font-weight:700;padding:4px 8px;border-bottom:1.5px solid #000;font-size:11px}`,
    `td{padding:3px 8px;border-bottom:0.5px solid #ccc}`,
    `.print-btn{display:block;margin:20px auto;padding:8px 30px;background:#000;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:600}`,
    `@media print{.print-btn{display:none}}`,
  ].join("\n");

  const html = [
    `<!DOCTYPE html><html><head><title>COMPASS Report</title><style>${css}</style></head><body>`,
    `<h1>COMPASS — Surgical Planning Report</h1>`,
    `<div style="text-align:center;font-size:11px;color:#666;margin-bottom:16px">${new Date().toLocaleDateString()}</div>`,
    `<h2>Patient</h2>${patHtml}`,
    `<h2>COMPASS Predictions</h2>${predHtml}`,
    `<h2>Nerve Sparing — 5-Zone</h2>${nsHtml}${alertHtml}`,
    `<h2>PLND Decision</h2>${plndHtml}`,
    lesHtml,
    `<button class="print-btn" onclick="window.print()">Print</button>`,
    `</body></html>`,
  ].join("\n");

  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}
