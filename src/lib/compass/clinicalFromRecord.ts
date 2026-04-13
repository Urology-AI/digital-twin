import {
  defaultClinicalState,
  type ClinicalState,
  type Prostate3DInputV1,
} from "@/types/patient";

function parsePsmaLn(staging: Prostate3DInputV1["staging"]): number {
  const lnPsma = staging.lymph_nodes_psma;
  if (Array.isArray(lnPsma)) {
    return lnPsma.some(
      (ln: { assessment?: string }) =>
        ln.assessment === "positive" || ln.assessment === "suspicious",
    )
      ? 1
      : 0;
  }
  if (typeof lnPsma === "string") {
    return /positive|suspicious|avid|uptake/i.test(lnPsma) ? 1 : 0;
  }
  if (lnPsma === 1 || lnPsma === true) return 1;
  return 0;
}

/** Build clinical state from imported `prostate-3d-input-v1` (mirrors `loadPatientData`). */
export function clinicalStateFromRecord(
  P: Prostate3DInputV1,
): ClinicalState {
  const S = defaultClinicalState();
  S.age = 64;
  S.bmi = 27;
  S.psa = 6.5;
  S.vol = 45;
  S.psad = 0.144;
  S.gg = 1;
  S.cores = 0;
  S.maxcore = 0;
  S.linear_mm = 0;
  S.pct45 = 0;
  S.cribriform_bx = 0;
  S.idc_bx = 0;
  S.pni_bx = 0;
  S.bilateral = 0;
  S.laterality = "bilateral";
  S.pirads = 2;
  S.mri_epe = 0;
  S.mri_svi = 0;
  S.primus = 0;
  S.mus_ece = 0;
  S.mus_svi = 0;
  S.psma_avail = 0;
  S.suv = 0;
  S.psma_epe = 0;
  S.psma_svi = 0;
  S.dec = null;
  S.gg_left = 0;
  S.gg_right = 0;
  S.cores_left = 0;
  S.cores_right = 0;
  S.mc_left = 0;
  S.mc_right = 0;
  S.linear_left = 0;
  S.linear_right = 0;
  S.mri_size = 0;
  S.mri_abutment = -1;
  S.mri_adc = 0;

  const pat = P.patient;
  const bx = P.biopsy;
  const pr = P.prostate;
  const st = P.staging;

  if (pat.age !== null && pat.age !== undefined) S.age = pat.age;
  if (pat.psa !== null && pat.psa !== undefined) S.psa = pat.psa;
  if (pr.volume_cc !== null && pr.volume_cc !== undefined) S.vol = pr.volume_cc;
  S.psad = S.psa / S.vol;
  if (bx.max_grade_group !== null && bx.max_grade_group !== undefined)
    S.gg = bx.max_grade_group;
  if (bx.total_positive_cores !== null && bx.total_positive_cores !== undefined)
    S.cores = bx.total_positive_cores;
  if (
    bx.max_core_involvement_pct !== null &&
    bx.max_core_involvement_pct !== undefined
  )
    S.maxcore = bx.max_core_involvement_pct;
  if (
    bx.max_linear_extent_mm !== null &&
    bx.max_linear_extent_mm !== undefined
  )
    S.linear_mm = bx.max_linear_extent_mm;
  if (bx.max_pct_pattern45 !== null && bx.max_pct_pattern45 !== undefined)
    S.pct45 = bx.max_pct_pattern45;
  if (bx.has_cribriform !== null && bx.has_cribriform !== undefined)
    S.cribriform_bx = bx.has_cribriform;
  if (bx.has_idc !== null && bx.has_idc !== undefined) S.idc_bx = bx.has_idc;
  if (bx.has_pni !== null && bx.has_pni !== undefined) S.pni_bx = bx.has_pni;
  S.bilateral = bx.laterality === "bilateral" ? 1 : 0;
  S.mri_epe = st.epe ? 1 : 0;
  S.mri_svi = st.svi ? 1 : 0;
  if (st.lesion_size_cm) S.mri_size = st.lesion_size_cm;
  if (st.abutment !== null && st.abutment !== undefined)
    S.mri_abutment = st.abutment;
  if (st.adc_mean) S.mri_adc = st.adc_mean;
  if (pat.shim !== null && pat.shim !== undefined) S.shim = pat.shim;
  if (pat.ipss !== null && pat.ipss !== undefined) S.ipss = pat.ipss;
  if (pat.bmi !== null && pat.bmi !== undefined) S.bmi = pat.bmi;
  if (pat.dm === true) S.dm = true;
  if (pat.htn === true) S.htn = true;
  if (pat.cad === true) S.cad = true;
  if (pat.statin === true) S.statin = true;
  if (pat.smoking) S.smoking = pat.smoking;
  if (pat.exercise) S.exercise = pat.exercise;
  if (pat.pde5 === true) S.pde5 = "daily";
  S.laterality = bx.laterality || "bilateral";

  if (bx.gg_left !== undefined && bx.gg_left !== null) S.gg_left = bx.gg_left;
  if (bx.gg_right !== undefined && bx.gg_right !== null)
    S.gg_right = bx.gg_right;
  if (bx.cores_left !== undefined && bx.cores_left !== null)
    S.cores_left = bx.cores_left;
  if (bx.cores_right !== undefined && bx.cores_right !== null)
    S.cores_right = bx.cores_right;
  if (bx.mc_left !== undefined && bx.mc_left !== null) S.mc_left = bx.mc_left;
  if (bx.mc_right !== undefined && bx.mc_right !== null) S.mc_right = bx.mc_right;
  if (bx.linear_left !== undefined && bx.linear_left !== null)
    S.linear_left = bx.linear_left;
  if (bx.linear_right !== undefined && bx.linear_right !== null)
    S.linear_right = bx.linear_right;
  if (bx.decipher_score !== null && bx.decipher_score !== undefined)
    S.dec = bx.decipher_score;

  const parserSetGGLeft = bx.gg_left !== undefined && bx.gg_left !== null;
  const parserSetGGRight = bx.gg_right !== undefined && bx.gg_right !== null;
  if (
    !parserSetGGLeft &&
    S.gg_left === 0 &&
    (S.laterality === "left" || S.laterality === "bilateral")
  )
    S.gg_left = S.gg;
  if (
    !parserSetGGRight &&
    S.gg_right === 0 &&
    (S.laterality === "right" || S.laterality === "bilateral")
  )
    S.gg_right = S.gg;
  if (!S.mc_left && S.gg_left > 0) S.mc_left = S.maxcore;
  if (!S.mc_right && S.gg_right > 0) S.mc_right = S.maxcore;
  if (!S.linear_left && S.gg_left > 0) S.linear_left = S.linear_mm;
  if (!S.linear_right && S.gg_right > 0) S.linear_right = S.linear_mm;

  let maxPirads = 2;
  for (const l of P.lesions || []) {
    if (l.pirads && l.pirads > maxPirads) maxPirads = l.pirads;
  }
  S.pirads = maxPirads;

  let maxPrimus = 0;
  for (const l of P.lesions || []) {
    if (l.primus && l.primus > maxPrimus) maxPrimus = l.primus;
  }
  if (maxPrimus > 0) S.primus = maxPrimus;

  let maxSuv = 0;
  for (const l of P.lesions || []) {
    if (l.suv && l.suv > maxSuv) maxSuv = l.suv;
  }
  if (maxSuv === 0 && P.zones) {
    for (const zk of Object.keys(P.zones)) {
      const zs = P.zones[zk as keyof typeof P.zones]?.sources;
      if (zs?.suv && zs.suv > maxSuv) maxSuv = zs.suv;
    }
  }
  if (maxSuv > 0) {
    S.psma_avail = 1;
    S.suv = maxSuv;
  }

  if (st.max_pirads && st.max_pirads > S.pirads) S.pirads = st.max_pirads;
  if (st.max_suv && st.max_suv > S.suv) {
    S.suv = st.max_suv;
    S.psma_avail = 1;
  }
  if (st.epe_mus) S.mus_ece = 1;
  if (st.svi_mus) S.mus_svi = 1;
  if (st.psma_epe) S.psma_epe = 1;
  if (st.psma_svi) S.psma_svi = 1;
  // If any PSMA staging flag is explicitly set, mark PSMA as available so
  // downstream alerts fire correctly (psma_avail is otherwise only set by SUV).
  if (S.psma_epe || S.psma_svi) S.psma_avail = 1;
  if (st.max_primus !== null && st.max_primus !== undefined)
    S.primus = Math.max(S.primus, st.max_primus);

  for (const l of P.lesions || []) {
    if ((l.source === "ExactVu" || l.source === "MUS") && l.epe) S.mus_ece = 1;
  }
  if (!S.mus_ece && P.zones) {
    for (const zk of Object.keys(P.zones)) {
      const zs = P.zones[zk as keyof typeof P.zones]?.sources;
      if (zs && zs.mus && zs.mus >= 3) S.mus_ece = 1;
    }
  }

  S.psma_ln = parsePsmaLn(st);

  return S;
}
