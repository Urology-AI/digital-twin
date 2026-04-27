import { COMPASS_TO_3D, ZONE_ANATOMY } from "@/lib/compass/constants";
import type { ZoneMap } from "@/types/patient";
import type { CompassPredictions, ThreeZoneRuntime } from "@/types/prediction";
import { clamp } from "@/lib/utils/math";

/**
 * Push parser zone data into 3D runtime zones and calibrate ECE vs NS distribution.
 */
export function mapZoneDataToThree(
  Pzones: ZoneMap,
  threeZones: ThreeZoneRuntime[],
  pred: CompassPredictions,
): void {
  const nsWorst = Math.max(pred.nsL, pred.nsR);

  for (const cz of Object.keys(COMPASS_TO_3D)) {
    const z3dId = COMPASS_TO_3D[cz];
    if (!z3dId) continue;
    const zoneData = Pzones[cz as keyof ZoneMap];
    if (!zoneData) continue;
    const z3d = threeZones.find((z) => z.id === z3dId);
    if (!z3d) continue;

    let cancer = zoneData.cancer || 0.02;
    let ece = zoneData.ece || 0.01;
    const src = zoneData.sources;

    if (src && cancer <= 0.03) {
      if (src.biopsy_gg && src.biopsy_gg > 0) {
        const ggBoost =
          { 1: 0.3, 2: 0.55, 3: 0.7, 4: 0.8, 5: 0.9 }[src.biopsy_gg] || 0.3;
        const pctBoost = src.core_pct
          ? Math.min(src.core_pct / 100, 1) * 0.3
          : 0;
        cancer = Math.min(Math.max(cancer, ggBoost + pctBoost), 0.95);
        const isPost = z3d.region === "Posterior";
        const isLat = z3d.subregion === "lateral";
        const capFactor = isPost && isLat ? 1.2 : isPost ? 1.0 : 0.4;
        ece = Math.max(ece, cancer * 0.4 * capFactor);
      }
      if (src.mus && src.mus > 0 && cancer < 0.15) {
        const musP =
          { 1: 0.12, 2: 0.24, 3: 0.39, 4: 0.65, 5: 0.82 }[src.mus] || 0.12;
        cancer = Math.max(cancer, musP);
      }
      if (src.mri && src.mri > 0 && cancer < 0.15) {
        const mriP = { 3: 0.2, 4: 0.4, 5: 0.65 }[src.mri] || 0.1;
        cancer = Math.max(cancer, mriP);
      }
      if (src.suv && src.suv > 0 && cancer < 0.15) {
        const suvP = 1 / (1 + Math.exp(0.95 - 0.018 * src.suv));
        cancer = Math.max(cancer, suvP);
      }
    }

    z3d.cancer = cancer;
    z3d.ece = ece;
    z3d.svi = zoneData.svi || 0.01;

    if (zoneData.hasData && z3d.cancer < 0.08) z3d.cancer = 0.08;

    const apexFactor = z3d.level === "Apex" ? 1.8 : z3d.level === "Base" ? 0.7 : 1.0;
    const posterolateralFactor =
      z3d.region === "Posterior" && z3d.subregion === "lateral" ? 1.3 : 1.0;
    const nsFactor = nsWorst === 1 ? 0.6 : nsWorst === 2 ? 1.0 : 1.5;
    z3d.psm = clamp(
      z3d.ece * apexFactor * posterolateralFactor * nsFactor * 0.8,
      0.02,
      0.85,
    );
  }

  const nsDetails = {
    L: pred.nsDetailL,
    R: pred.nsDetailR,
  } as const;
  for (const side of ["L", "R"] as const) {
    const nsZones = nsDetails[side].zones || {};
    const groups: Record<string, { z3d: ThreeZoneRuntime; heuristic: number }[]> =
      {};
    for (const z of threeZones) {
      if (z.side !== side) continue;
      const za = ZONE_ANATOMY[z.id];
      const clinZone = za ? za.zone : null;
      if (!clinZone) continue;
      if (!groups[clinZone]) groups[clinZone] = [];
      groups[clinZone].push({ z3d: z, heuristic: z.ece });
    }
    for (const cz of Object.keys(groups)) {
      const nsVal = nsZones[cz] || 0;
      const members = groups[cz];
      if (!members) continue;
      let maxH = 0;
      for (const m of members) maxH = Math.max(maxH, m.heuristic);
      if (maxH > 0.01 && nsVal > 0) {
        const scale = nsVal / maxH;
        for (const m of members) {
          m.z3d.ece = Math.max(0.06, m.z3d.ece * scale);
          m.z3d.cancer = Math.max(m.z3d.cancer, m.z3d.ece * 1.2);
          const apF =
            m.z3d.level === "Apex" ? 1.8 : m.z3d.level === "Base" ? 0.7 : 1.0;
          const plF =
            m.z3d.region === "Posterior" && m.z3d.subregion === "lateral"
              ? 1.3
              : 1.0;
          const nsF = nsWorst === 1 ? 0.6 : nsWorst === 2 ? 1.0 : 1.5;
          m.z3d.psm = clamp(m.z3d.ece * apF * plF * nsF * 0.8, 0.02, 0.85);
        }
      } else if (nsVal > 0.01 && maxH <= 0.01) {
        const perZone = nsVal / members.length;
        for (const m of members) {
          m.z3d.ece = perZone;
          m.z3d.cancer = Math.max(m.z3d.cancer, perZone * 1.5);
          const apF =
            m.z3d.level === "Apex" ? 1.8 : m.z3d.level === "Base" ? 0.7 : 1.0;
          const plF =
            m.z3d.region === "Posterior" && m.z3d.subregion === "lateral"
              ? 1.3
              : 1.0;
          const nsF = nsWorst === 1 ? 0.6 : nsWorst === 2 ? 1.0 : 1.5;
          m.z3d.psm = clamp(m.z3d.ece * apF * plF * nsF * 0.8, 0.02, 0.85);
        }
      } else if (nsVal <= 0) {
        for (const m of members) {
          m.z3d.ece = 0.005;
          m.z3d.psm = 0.02;
        }
      }
    }
  }

  // Distribute side-level SVI predictions into zones so paintGlbSV and the
  // prostate heatmap both reflect the actual model output instead of the raw
  // zone-level default (0.01).  SVI risk is anatomically concentrated at the
  // posterior base (where SVs attach), attenuated at the posterior midgland,
  // and not meaningful elsewhere.
  for (const z of threeZones) {
    const sideRisk = z.side === "L" ? pred.sviL : pred.sviR;
    if (z.level === "Base" && z.region === "Posterior") {
      z.svi = sideRisk;
    } else if (z.level === "Mid" && z.region === "Posterior") {
      z.svi = sideRisk * 0.35;
    } else {
      z.svi = 0.01;
    }
  }
}
