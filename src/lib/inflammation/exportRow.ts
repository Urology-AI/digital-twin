/**
 * CSV/JSON export-import for the standalone inflammation instrument, ported
 * from the HTML calculator's collectRow/exportCSV/saveJSON/loadJSON. This is
 * a self-contained export path — rows are NOT written into the main
 * patientStore case library (see project decision to keep this prototype
 * separate until it has been fitted on real data).
 */
import { nsGrade, scoreSide } from "@/lib/inflammation/model";
import type {
  InflammationConfig,
  PatientInflammationInput,
  SideInflammationInput,
} from "@/types/inflammation";

export interface InflammationRow {
  [key: string]: string | number;
}

export function collectRow(
  patient: PatientInflammationInput,
  sides: { L: SideInflammationInput; R: SideInflammationInput },
  cfg: InflammationConfig,
): InflammationRow {
  const row: InflammationRow = {};
  for (const [k, v] of Object.entries(patient)) {
    row[k] = typeof v === "boolean" ? (v ? 1 : 0) : v ?? "";
  }
  (["L", "R"] as const).forEach((s) => {
    const side = sides[s];
    for (const [k, v] of Object.entries(side)) {
      row[`${s}_${k}`] = typeof v === "boolean" ? (v ? 1 : 0) : v ?? "";
    }
    const r = scoreSide(patient, side, cfg);
    row[`${s}_pECE_unadj`] = r.pRaw.toFixed(2);
    row[`${s}_pECE_adj`] = r.pAdj.toFixed(2);
    row[`${s}_inflIndex`] = r.inflScore.toFixed(1);
    row[`${s}_lambda`] = r.lambda.toFixed(3);
    row[`${s}_gradeRec`] = nsGrade(r.pAdj).n;
  });
  row.timestamp = new Date().toISOString();
  return row;
}

function download(text: string, name: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function exportCSV(
  patient: PatientInflammationInput,
  sides: { L: SideInflammationInput; R: SideInflammationInput },
  cfg: InflammationConfig,
) {
  const row = collectRow(patient, sides, cfg);
  const keys = Object.keys(row);
  const csv =
    keys.join(",") +
    "\n" +
    keys.map((k) => `"${String(row[k]).replace(/"/g, '""')}"`).join(",") +
    "\n";
  download(csv, `ppi-row-${Date.now()}.csv`, "text/csv");
}

export function saveJSON(
  patient: PatientInflammationInput,
  sides: { L: SideInflammationInput; R: SideInflammationInput },
) {
  download(
    JSON.stringify({ patient, sides }, null, 2),
    `ppi-case-${Date.now()}.json`,
    "application/json",
  );
}
