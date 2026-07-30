/**
 * One-way, non-destructive input plumbing from the main COMPASS patient record into
 * the standalone inflammation instrument. Only fields with an unambiguous, same-unit
 * match are copied (PSA, volume, BMI, grade group, max core involvement %, PNI, index-
 * lesion ADC/SUV per side) — anything without a direct digital-twin equivalent (contact
 * length, contact angle, percent positive cores per side, etc.) is deliberately left
 * for manual entry rather than guessed at. This copies values only; it never touches
 * either model's predictions (see `src/lib/inflammation/model.ts` header).
 */
import type { LesionRow } from "@/types/lesion";
import type { Prostate3DInputV1 } from "@/types/patient";
import type { PatientInflammationInput, SideInflammationInput } from "@/types/inflammation";

export interface PatientSyncResult {
  patient: Partial<PatientInflammationInput>;
  sides: { L: Partial<SideInflammationInput>; R: Partial<SideInflammationInput> };
}

function ggString(gg: number | null | undefined): "1" | "2" | "3" | "4" | "5" | null {
  if (!gg || gg < 1) return null;
  const clamped = Math.min(5, Math.round(gg));
  return String(clamped) as "1" | "2" | "3" | "4" | "5";
}

/** First lesion on the given side with a usable ADC or SUV reading, standing in for "index lesion". */
function indexLesion(lesions: LesionRow[], side: "L" | "R"): LesionRow | undefined {
  return lesions.find((l) => l.side === side && (l.mriAdc || l.suv));
}

export function buildPatientSync(record: Prostate3DInputV1, lesionRows: LesionRow[]): PatientSyncResult {
  const patient: Partial<PatientInflammationInput> = {};
  if (record.patient.psa !== null && record.patient.psa !== undefined) patient.psa = record.patient.psa;
  if (record.prostate.volume_cc !== null && record.prostate.volume_cc !== undefined) patient.vol = record.prostate.volume_cc;
  if (record.patient.bmi !== null && record.patient.bmi !== undefined) patient.bmi = record.patient.bmi;

  const laterality = record.biopsy.laterality;
  const pniPresent = Boolean(record.biopsy.has_pni);

  const sideSync = (side: "L" | "R"): Partial<SideInflammationInput> => {
    const out: Partial<SideInflammationInput> = {};
    const gg = ggString(side === "L" ? record.biopsy.gg_left : record.biopsy.gg_right);
    if (gg) out.gg = gg;

    const maxI = side === "L" ? record.biopsy.mc_left : record.biopsy.mc_right;
    if (maxI !== null && maxI !== undefined) out.maxI = maxI;

    if (pniPresent && (laterality === "bilateral" || laterality === (side === "L" ? "left" : "right"))) {
      out.pni = true;
    }

    const lesion = indexLesion(lesionRows, side);
    if (lesion) {
      if (lesion.mriAdc) out.adcL = lesion.mriAdc;
      if (lesion.suv) out.suvL = lesion.suv;
    }
    return out;
  };

  return { patient, sides: { L: sideSync("L"), R: sideSync("R") } };
}
