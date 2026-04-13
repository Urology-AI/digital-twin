import { zoneKeyToSide } from "@/lib/utils/helpers";
import type { LesionRow } from "@/types/lesion";
import type { ClinicalState, Prostate3DInputV1 } from "@/types/patient";

export interface CollectedLesion {
  source: "MRI" | "MUS" | "PSMA" | "Bx";
  side: "L" | "R";
  zone?: string;
  score: string;
  epe?: boolean;
  svi?: boolean;
  corePct?: number;
  linear?: number;
  mriSize?: number;
  mriAbutment?: number;
  mriAdc?: number;
  level?: "Base" | "Mid" | "Apex";
}

export function lesionsFromRows(rows: LesionRow[]): CollectedLesion[] {
  return rows
    .filter((r) => r.source && r.side)
    .map((r) => ({
      source:
        r.source === "ExactVu"
          ? "MUS"
          : (r.source as CollectedLesion["source"]),
      side: r.side as "L" | "R",
      zone: r.zone,
      score: r.score,
      epe: r.epe,
      svi: r.svi,
      corePct: r.corePct,
      linear: r.linear,
      mriSize: r.mriSize,
      mriAbutment: r.mriAbutment,
      mriAdc: r.mriAdc,
      level: r.level || undefined,
    }));
}

/** Parser-exported lesions → lateralization inputs (mirrors `predECE_side` P.lesions loop). */
export function lesionsFromRecordJson(
  raw: Prostate3DInputV1["lesions"],
): CollectedLesion[] {
  const out: CollectedLesion[] = [];
  for (const l of raw || []) {
    const side =
      l.side === "L" || l.side === "R"
        ? l.side
        : zoneKeyToSide(l.zone) ?? "L";
    const srcRaw = l.source;
    if (srcRaw !== "MRI" && srcRaw !== "MUS" && srcRaw !== "PSMA" && srcRaw !== "Bx" && srcRaw !== "ExactVu")
      continue;
    const source: CollectedLesion["source"] =
      srcRaw === "ExactVu" ? "MUS" : srcRaw === "Bx" ? "Bx" : srcRaw;
    out.push({
      source,
      side,
      zone: l.zone,
      score: l.score,
      epe: l.epe,
      svi: l.svi,
      corePct: l.corePct,
      linear: l.linear,
      mriSize: l.mriSize,
      mriAbutment: l.mriAbutment,
      mriAdc: l.mriAdc,
      level: l.level || undefined,
    });
  }
  return out;
}

/** Imaging on ipsilateral side for lateralized models */
export function imagingFlagsForSide(
  lesions: CollectedLesion[],
  side: "left" | "right",
): { mriOnSide: boolean; musOnSide: boolean; psmaOnSide: boolean } {
  const target = side === "left" ? "L" : "R";
  let mriOnSide = false;
  let musOnSide = false;
  let psmaOnSide = false;
  for (const l of lesions) {
    if (l.side !== target) continue;
    if (l.source === "MRI") mriOnSide = true;
    if (l.source === "MUS") musOnSide = true;
    if (l.source === "PSMA") psmaOnSide = true;
  }
  return { mriOnSide, musOnSide, psmaOnSide };
}

/**
 * Merge manual clinical overrides with lesion-derived fields (mirrors runFromInputs).
 */
export function deriveClinicalFromLesions(
  base: ClinicalState,
  lesions: CollectedLesion[],
): ClinicalState {
  const bxRows = lesions.filter(
    (l) => l.source === "Bx" && parseFloat(l.score) > 0,
  );
  const bxL = bxRows.filter((l) => l.side === "L");
  const bxR = bxRows.filter((l) => l.side === "R");

  let next = { ...base };

  if (bxRows.length > 0) {
    next.gg = Math.max(...bxRows.map((l) => parseInt(l.score, 10) || 0));
    next.cores = bxRows.length;
    next.maxcore = Math.max(...bxRows.map((l) => l.corePct ?? 0));
    next.linear_mm = Math.max(...bxRows.map((l) => l.linear ?? 0));
    next.gg_left =
      bxL.length > 0 ? Math.max(...bxL.map((l) => parseInt(l.score, 10) || 0)) : 0;
    next.gg_right =
      bxR.length > 0 ? Math.max(...bxR.map((l) => parseInt(l.score, 10) || 0)) : 0;
    next.cores_left = bxL.length;
    next.cores_right = bxR.length;
    next.mc_left =
      bxL.length > 0 ? Math.max(...bxL.map((l) => l.corePct ?? 0)) : 0;
    next.mc_right =
      bxR.length > 0 ? Math.max(...bxR.map((l) => l.corePct ?? 0)) : 0;
    next.linear_left =
      bxL.length > 0 ? Math.max(...bxL.map((l) => l.linear ?? 0)) : 0;
    next.linear_right =
      bxR.length > 0 ? Math.max(...bxR.map((l) => l.linear ?? 0)) : 0;
    if (bxL.length > 0 && bxR.length > 0) next.laterality = "bilateral";
    else if (bxL.length > 0) next.laterality = "left";
    else next.laterality = "right";
  } else {
    next.gg = base.gg;
    next.cores = base.cores;
    next.maxcore = base.maxcore;
    next.linear_mm = base.linear_mm;
    next.gg_left = base.gg_left;
    next.gg_right = base.gg_right;
    next.cores_left = base.cores_left;
    next.cores_right = base.cores_right;
    next.mc_left = base.mc_left;
    next.mc_right = base.mc_right;
    next.linear_left = base.linear_left;
    next.linear_right = base.linear_right;
    next.laterality = base.laterality;
  }

  next.bilateral = next.laterality === "bilateral" ? 1 : 0;
  next.psad = next.vol > 0 ? next.psa / next.vol : next.psad;

  const mriRows = lesions.filter((l) => l.source === "MRI");
  const musRows = lesions.filter((l) => l.source === "MUS");
  const psmaRows = lesions.filter((l) => l.source === "PSMA");

  if (mriRows.length > 0) {
    const lesionPirads = Math.max(...mriRows.map((l) => Math.min(parseInt(l.score, 10) || 2, 5)));
    next.pirads = Math.max(base.pirads, lesionPirads);
    next.mri_epe = (base.mri_epe || mriRows.some((l) => l.epe)) ? 1 : 0;
    next.mri_svi = (base.mri_svi || mriRows.some((l) => l.svi)) ? 1 : 0;
    const lesionSizes = mriRows.map((l) => (l.mriSize ?? 0) / 10).filter((v) => v > 0);
    if (lesionSizes.length > 0)
      next.mri_size = Math.max(base.mri_size, Math.max(...lesionSizes));
    const abVals = mriRows
      .map((l) => l.mriAbutment)
      .filter((v): v is number => v !== undefined && v >= 0);
    next.mri_abutment =
      abVals.length > 0 ? Math.max(...abVals) : (base.mri_abutment >= 0 ? base.mri_abutment : -1);
    const adcVals = mriRows
      .map((l) => l.mriAdc)
      .filter((v): v is number => v !== undefined && v > 0);
    next.mri_adc = adcVals.length > 0 ? Math.min(...adcVals) : (base.mri_adc > 0 ? base.mri_adc : 0);
  }

  if (musRows.length > 0) {
    next.mus_ece = (base.mus_ece || musRows.some((l) => l.epe)) ? 1 : 0;
    next.mus_svi = (base.mus_svi || musRows.some((l) => l.svi)) ? 1 : 0;
    next.ev_n_lesions = musRows.length;
    next.ev_at_base = musRows.some((l) => l.level === "Base") ? 1 : 0;
    next.ev_size =
      musRows.length > 0 ? Math.max(...musRows.map((l) => l.mriSize ?? 0)) : 0;
    const musAb = musRows
      .map((l) => l.mriAbutment)
      .filter((v): v is number => v !== undefined && v >= 0);
    next.ev_abutment = musAb.length > 0 ? Math.max(...musAb) : -1;
  }

  if (psmaRows.length > 0) {
    const lesionSuv = Math.max(...psmaRows.map((l) => parseFloat(l.score) || 0));
    next.suv = Math.max(base.suv, lesionSuv);
    next.psma_epe = (base.psma_epe || psmaRows.some((l) => l.epe)) ? 1 : 0;
    next.psma_avail = 1;
    next.psma_lesion_count = psmaRows.length;
    next.psma_multifocal = psmaRows.length > 1 ? 1 : 0;
    next.psma_at_base = psmaRows.some((l) => l.level === "Base") ? 1 : 0;
    next.psma_svi = (base.psma_svi || psmaRows.some((l) => l.svi)) ? 1 : 0;
    const psmaL = psmaRows.some((l) => l.side === "L");
    const psmaR = psmaRows.some((l) => l.side === "R");
    next.psma_side =
      psmaL && psmaR ? "bilateral" : psmaL ? "left" : psmaR ? "right" : "none";
  }

  return next;
}
