import { COMPASS_TO_3D, NS_THRESHOLDS, ZONE_ANATOMY } from "@/lib/compass/constants";
import type { ClinicalState, ZoneMap } from "@/types/patient";
import type { NsSideDetail } from "@/types/prediction";
import type { CollectedLesion } from "@/lib/utils/normalization";

const GG_BOOST: Record<number, number> = {
  1: 0.3,
  2: 0.55,
  3: 0.7,
  4: 0.8,
  5: 0.9,
};

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
        const ggB = GG_BOOST[src.biopsy_gg] ?? 0.3;
        const pctB = src.core_pct
          ? Math.min(src.core_pct / 100, 1) * 0.3
          : 0;
        w = Math.min(Math.max(w, ggB + pctB), 0.95);
      }
      if (w > 0.03) hasZD = true;
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
    re.posterolateral = modelECE * 0.35;
    re.base = modelECE * 0.3;
    re.apex = modelECE * 0.2;
    re.anterior = modelECE * 0.1;
    re.bladder_neck = modelECE * 0.05;
    hasZD = true;
  }

  const minimalCA = hasCA && sGG <= 2 && sCores <= 2 && modelECE < 0.1;
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
    if (modelECE >= 0.3) {
      ns = 3;
      reason = `ECE ${Math.round(modelECE * 100)}% (no zone data)`;
    } else if (modelECE >= 0.1) {
      ns = Math.max(ns, 2);
      reason = `ECE ${Math.round(modelECE * 100)}% (no zone data)`;
    }
  }

  if (modelSVI >= 0.25) {
    ns = Math.max(ns, 3);
    reason = `SVI ${Math.round(modelSVI * 100)}%`;
  } else if (modelSVI >= 0.15 && ns < 2) {
    ns = 2;
  }

  const postECE = Math.max(re.posterolateral, re.base);
  if (S.mri_epe && postECE >= 0.15) {
    ns = Math.max(ns, 3);
    reason = `MRI EPE + posterior ${Math.round(postECE * 100)}%`;
  }
  if (S.mri_svi && modelSVI >= 0.15) {
    ns = Math.max(ns, 3);
    reason = "MRI SVI";
  }

  const alerts: NsSideDetail["alerts"] = [];
  if (re.apex >= 0.1 || (hasZD && zw.apex > 0.05)) {
    alerts.push({
      type: "apex",
      severity: re.apex >= 0.2 ? "high" : "moderate",
      message: `Apical ECE ${Math.round(Math.max(re.apex, zw.apex * modelECE) * 100)}% — apical dissection caution`,
    });
  }
  if (re.anterior >= 0.1 || (hasZD && zw.anterior > 0.05)) {
    alerts.push({
      type: "anterior",
      severity: re.anterior >= 0.2 ? "high" : "moderate",
      message: `Anterior ECE ${Math.round(Math.max(re.anterior, zw.anterior * modelECE) * 100)}% — anterior dissection`,
    });
  }
  if (re.bladder_neck >= 0.1 || (hasZD && zw.bladder_neck > 0.05)) {
    alerts.push({
      type: "bladder_neck",
      severity: re.bladder_neck >= 0.2 ? "high" : "moderate",
      message: "Bladder neck ECE — wider BN margin",
    });
  }
  if (re.posterolateral >= 0.15) {
    alerts.push({
      type: "nvb",
      severity: re.posterolateral >= 0.3 ? "high" : "moderate",
      message: `Posterolateral ${Math.round(re.posterolateral * 100)}% — PNVB threatened`,
    });
  }
  if (modelSVI >= 0.15) {
    alerts.push({
      type: "svi",
      severity: modelSVI >= 0.3 ? "high" : "moderate",
      message: `SVI ${Math.round(modelSVI * 100)}% — SV excision`,
    });
  }

  const targetSide = side === "left" ? "L" : "R";
  const psmaLesions = lesions.filter(
    (l) => l.source === "PSMA" && l.side === targetSide,
  );
  const psmaAtBase = psmaLesions.some((l) => l.level === "Base");
  if (psmaAtBase && re.base >= 0.08) {
    alerts.push({
      type: "base",
      severity: re.base >= 0.25 ? "high" : "moderate",
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
