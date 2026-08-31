import { COMPASS_TO_3D, ZONE_ANATOMY } from "@/lib/compass/constants";
import {
  GG_BOOST_ZONE,
  NS_ALERT_THRESHOLDS,
  NS_MINIMAL_DISEASE,
  NS_ZONE_ECE_FALLBACK,
  NS_ZONE_THRESHOLDS,
} from "@/lib/compass/planningEvidence";
import type { ClinicalState, ZoneMap } from "@/types/patient";
import type { NsSideDetail } from "@/types/prediction";
import type { CollectedLesion } from "@/lib/utils/normalization";

const GG_BOOST = GG_BOOST_ZONE.value.byGrade;
const NS_THRESHOLDS = NS_ZONE_THRESHOLDS.value;
const A = NS_ALERT_THRESHOLDS.value;
const FB = NS_ZONE_ECE_FALLBACK.value;
const MIN_DZ = NS_MINIMAL_DISEASE.value;

export function getNsGradeZoneAware(
  side: "left" | "right",
  S: ClinicalState,
  pred: { eceL: number; eceR: number; sviL: number; sviR: number },
  Pzones: ZoneMap,
  lesions: CollectedLesion[],
): NsSideDetail {
  const sc = side === "left" ? "L" : "R";
  const modelECE = side === "left" ? pred.eceL : pred.eceR;
  const modelSVI = side === "left" ? pred.sviL : pred.sviR;
  const sGG = side === "left" ? S.gg_left : S.gg_right;
  const sCores = side === "left" ? S.cores_left || 0 : S.cores_right || 0;
  const hasCA = sGG > 0;

  type ZoneWeights = {
    posterolateral: number;
    base: number;
    apex: number;
    anterior: number;
    bladder_neck: number;
  };
  const zw: ZoneWeights = {
    posterolateral: 0,
    base: 0,
    apex: 0,
    anterior: 0,
    bladder_neck: 0,
  };
  let hasZD = false;

  if (Pzones) {
    for (const pz of Object.keys(COMPASS_TO_3D)) {
      const z3dId = COMPASS_TO_3D[pz];
      if (!z3dId) continue;
      const a = ZONE_ANATOMY[z3dId];
      if (!a || a.side !== sc) continue;
      const zd = Pzones[pz as keyof ZoneMap];
      if (!zd) continue;
      let w = Math.max(zd.cancer || 0, zd.ece || 0);
      const src = zd.sources;
      if (src && w < 0.05 && src.biopsy_gg && src.biopsy_gg > 0) {
        const ggB = GG_BOOST[src.biopsy_gg] ?? GG_BOOST[1]!;
        const pctB = src.core_pct
          ? Math.min(src.core_pct / 100, 1) * GG_BOOST_ZONE.value.coreInvolvementWeight
          : 0;
        w = Math.min(Math.max(w, ggB + pctB), 0.95);
      }
      if (w > A.zoneDataPresent) hasZD = true;
      const zwRec = zw as Record<string, number>;
      zwRec[a.zone] = Math.max(zwRec[a.zone] ?? 0, w);
    }
  }

  const re: ZoneWeights = {
    posterolateral: 0,
    base: 0,
    apex: 0,
    anterior: 0,
    bladder_neck: 0,
  };
  const total =
    zw.posterolateral + zw.base + zw.apex + zw.anterior + zw.bladder_neck;
  if (hasZD && total > 0) {
    const f = modelECE / total;
    re.posterolateral = f * zw.posterolateral;
    re.base = f * zw.base;
    re.apex = f * zw.apex;
    re.anterior = f * zw.anterior;
    re.bladder_neck = f * zw.bladder_neck;
  } else if (hasCA && modelECE > 0.05) {
    re.posterolateral = modelECE * FB.posterolateral;
    re.base = modelECE * FB.base;
    re.apex = modelECE * FB.apex;
    re.anterior = modelECE * FB.anterior;
    re.bladder_neck = modelECE * FB.bladder_neck;
    hasZD = true;
  }

  const minimalCA =
    hasCA && sGG <= MIN_DZ.maxGg && sCores <= MIN_DZ.maxCores && modelECE < MIN_DZ.maxEce;
  let ns: number;
  let reason: string;
  if (!hasCA) {
    ns = 1;
    reason = "No cancer this side";
  } else if (minimalCA) {
    ns = 1;
    reason = `Minimal disease (GG${sGG}, ${sCores} cores, ECE ${Math.round(modelECE * 100)}%)`;
  } else {
    ns = 2;
    reason = `Cancer present (GG${sGG}, ${sCores} cores)`;
  }

  if (hasZD) {
    if (re.posterolateral >= NS_THRESHOLDS.posterolateral.grade3) {
      ns = 3;
      reason = `Posterolateral ECE ${Math.round(re.posterolateral * 100)}% (PNVB)`;
    } else if (
      re.posterolateral >= NS_THRESHOLDS.posterolateral.grade2 &&
      ns < 2
    ) {
      ns = 2;
      reason = `Posterolateral ECE ${Math.round(re.posterolateral * 100)}%`;
    }
    if (re.base >= NS_THRESHOLDS.base.grade3 && ns < 3) {
      ns = 3;
      reason = `Base ECE ${Math.round(re.base * 100)}% (PNP)`;
    } else if (re.base >= NS_THRESHOLDS.base.grade2 && ns < 2) {
      ns = 2;
      reason = `Base ECE ${Math.round(re.base * 100)}%`;
    }
  } else if (hasCA && !minimalCA) {
    if (modelECE >= NS_THRESHOLDS.posterolateral.grade3) {
      ns = 3;
      reason = `ECE ${Math.round(modelECE * 100)}% (no zone data)`;
    } else if (modelECE >= NS_THRESHOLDS.posterolateral.grade2) {
      ns = Math.max(ns, 2);
      reason = `ECE ${Math.round(modelECE * 100)}% (no zone data)`;
    }
  }

  if (modelSVI >= A.sviGrade3) {
    ns = Math.max(ns, 3);
    reason = `SVI ${Math.round(modelSVI * 100)}%`;
  } else if (modelSVI >= A.sviGrade2 && ns < 2) {
    ns = 2;
  }

  const postECE = Math.max(re.posterolateral, re.base);
  if (S.mri_epe && postECE >= A.mriEpePosterior) {
    ns = Math.max(ns, 3);
    reason = `MRI EPE + posterior ${Math.round(postECE * 100)}%`;
  }
  if (S.mri_svi && modelSVI >= A.sviGrade2) {
    ns = Math.max(ns, 3);
    reason = "MRI SVI";
  }

  const alerts: NsSideDetail["alerts"] = [];
  if (re.apex >= A.apex || (hasZD && zw.apex > A.zoneWeightAlert)) {
    alerts.push({
      type: "apex",
      severity: re.apex >= A.apexHigh ? "high" : "moderate",
      message: `Apical ECE ${Math.round(Math.max(re.apex, zw.apex * modelECE) * 100)}% — apical dissection caution`,
    });
  }
  if (re.anterior >= A.anterior || (hasZD && zw.anterior > A.zoneWeightAlert)) {
    alerts.push({
      type: "anterior",
      severity: re.anterior >= A.anteriorHigh ? "high" : "moderate",
      message: `Anterior ECE ${Math.round(Math.max(re.anterior, zw.anterior * modelECE) * 100)}% — anterior dissection`,
    });
  }
  if (re.bladder_neck >= A.bladderNeck || (hasZD && zw.bladder_neck > A.zoneWeightAlert)) {
    alerts.push({
      type: "bladder_neck",
      severity: re.bladder_neck >= A.bladderNeckHigh ? "high" : "moderate",
      message: "Bladder neck ECE — wider BN margin",
    });
  }
  if (re.posterolateral >= A.nvb) {
    alerts.push({
      type: "nvb",
      severity: re.posterolateral >= A.nvbHigh ? "high" : "moderate",
      message: `Posterolateral ${Math.round(re.posterolateral * 100)}% — PNVB threatened`,
    });
  }
  if (modelSVI >= A.sviGrade2) {
    alerts.push({
      type: "svi",
      severity: modelSVI >= A.sviHigh ? "high" : "moderate",
      message: `SVI ${Math.round(modelSVI * 100)}% — SV excision`,
    });
  }

  const targetSide = side === "left" ? "L" : "R";
  const psmaLesions = lesions.filter(
    (l) => l.source === "PSMA" && l.side === targetSide,
  );
  const psmaAtBase = psmaLesions.some((l) => l.level === "Base");
  if (psmaAtBase && re.base >= A.psmaBase) {
    alerts.push({
      type: "base",
      severity: re.base >= A.psmaBaseHigh ? "high" : "moderate",
      message: "PSMA + at base — 43% ECE rate, wider base dissection",
    });
  }
  if (S.psma_svi && S.psma_avail) {
    alerts.push({
      type: "psma_svi",
      severity: "high",
      message: "PSMA SVI positive — OR 31.95 for path SVI",
    });
  }

  return {
    nsGrade: ns,
    reason,
    alerts,
    zones: re,
    svi: modelSVI,
    has_zone_data: hasZD,
  };
}
