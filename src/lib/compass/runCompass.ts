import { ZONE_ANATOMY } from "@/lib/compass/constants";
import { predictInflammationRisk } from "@/lib/compass/inflammationRisk";
import { mapZoneDataToThree } from "@/lib/compass/mapZoneData";
import { getNsGradeZoneAware } from "@/lib/compass/nsGrade";
import { buildSurgicalPlan } from "@/lib/compass/surgicalPlan";
import { predictBcrCox } from "@/lib/models/vnext/bcrCox";
import { predictEceVNext } from "@/lib/models/vnext/ece";
import { predictSviVNext } from "@/lib/models/vnext/svi";
import { sviSideFromInputs } from "@/lib/models/vnext/sviSide";
import { predictUpgradeVNext } from "@/lib/models/vnext/upgrade";
import {
  exactvuOnSideFromRecord,
  sideBiopsyGgFromRecord,
  sideEpeFromInputs,
} from "@/lib/models/vnext/sideEpe";
import {
  predictExtensiveEce,
} from "@/lib/models/ece";
import { predictLniVNext } from "@/lib/models/vnext/lni";
import { predictPsmSideVNext, psmIndexPiradsBySide } from "@/lib/models/vnext/psmSide";
import { clamp } from "@/lib/utils/math";
import {
  lesionsFromRecordJson,
  lesionsFromRows,
} from "@/lib/utils/normalization";
import type { LesionRow } from "@/types/lesion";
import type { ClinicalState, Prostate3DInputV1 } from "@/types/patient";
import type { CompassPredictions, ThreeZoneRuntime } from "@/types/prediction";

export function runCompassModels(
  S: ClinicalState,
  P: Prostate3DInputV1,
  lesionRows: LesionRow[],
  threeZones: ThreeZoneRuntime[],
): CompassPredictions {
  const uiLesions = lesionsFromRows(lesionRows);
  const recordLesions = lesionsFromRecordJson(P.lesions);
  const mergedLesions = [...uiLesions, ...recordLesions];

  S.psad = S.vol > 0 ? S.psa / S.vol : S.psad;

  // vNext ECE (vNext-core-candidate-2026-09-24). No clamp. If PSA, volume or
  // grade group is missing the model refuses to predict and ece is NaN; the
  // display of that "cannot compute" state is handled with the UI update.
  const eceV = predictEceVNext(S);
  const ece = eceV.ok ? eceV.probability : NaN;
  // vNext SVI (same core lock). No clamp; NaN when required inputs are missing.
  const sviV = predictSviVNext(S);
  const svi = sviV.ok ? sviV.probability : NaN;
  // vNext Grade Upgrade (same core lock), GG1-4 only. NaN when required
  // inputs are missing, and for GG5 where the endpoint is not applicable.
  const upgradeV = predictUpgradeVNext(S);
  const upgrade = upgradeV.ok && upgradeV.applicable ? upgradeV.probability : NaN;
  // vNext LNI (lni lock 2026-10-02). No clamp; NaN when required inputs are missing.
  const lniV = predictLniVNext(S);
  const lni = lniV.ok ? lniV.probability : NaN;
  const extensive = clamp(predictExtensiveEce(S), 0.1, 0.9);

  // vNext side EPE (shadow candidate 2026-09-30): global ECE logit + side
  // biopsy GG + ExactVu on side. Replaces the v22 side model, its clamps and
  // the invented "ece * 0.3" fallback. NaN when global ECE cannot be computed.
  const sideEpe = (side: "left" | "right") =>
    eceV.ok
      ? sideEpeFromInputs({
          globalLogit: eceV.logit,
          sideBiopsyGg: sideBiopsyGgFromRecord(P, side),
          exactvuOnSide: exactvuOnSideFromRecord(
            P,
            lesionRows,
            S.imaging_availability.exactvu,
            side,
          ),
        }).probability
      : NaN;
  const eceL = sideEpe("left");
  const eceR = sideEpe("right");

  // vNext side SVI (shadow candidate 2026-10-01): global SVI logit + side
  // biopsy GG. Replaces the v22 side model and its clamps.
  const sideSvi = (side: "left" | "right") =>
    sviV.ok
      ? sviSideFromInputs({
          globalLogit: sviV.logit,
          sideBiopsyGg: sideBiopsyGgFromRecord(P, side),
        }).probability
      : NaN;
  const sviL = sideSvi("left");
  const sviR = sideSvi("right");

  const predSlice = { eceL, eceR, sviL, sviR };

  const nsDetailL = getNsGradeZoneAware(
    "left",
    S,
    predSlice,
    P.zones,
    mergedLesions,
  );
  const nsDetailR = getNsGradeZoneAware(
    "right",
    S,
    predSlice,
    P.zones,
    mergedLesions,
  );

  const nsL = nsDetailL.nsGrade;
  const nsR = nsDetailR.nsGrade;
  // Side-specific PSM (psm side lock 2026-09-26): log PSAD, positive cores and
  // the side-localized index-lesion PI-RADS. No clamp; NaN when required inputs
  // are missing.
  const psmPirads = psmIndexPiradsBySide(P, lesionRows);
  const psmLv = predictPsmSideVNext(S, psmPirads.left);
  const psmRv = predictPsmSideVNext(S, psmPirads.right);
  const psmL = psmLv.ok ? psmLv.probability : NaN;
  const psmR = psmRv.ok ? psmRv.probability : NaN;

  // Preoperative BCR: Cox model, 12/24/36-month risk. No clamp; NaN when
  // required inputs are missing.
  const bcrV = predictBcrCox(S);
  const bcr12 = bcrV.ok ? bcrV.risk12 : NaN;
  const bcr24 = bcrV.ok ? bcrV.risk24 : NaN;
  const bcr36 = bcrV.ok ? bcrV.risk36 : NaN;

  const inflammation = predictInflammationRisk(S);
  const plan = buildSurgicalPlan(S, nsDetailL, nsDetailR, sviL, sviR, eceL, eceR);

  // Per-zone recommended NS grade → drives the "plan" 3D overlay.
  for (const z of threeZones) {
    const a = ZONE_ANATOMY[z.id];
    if (!a) continue;
    const side = a.side === "L" ? plan.left : plan.right;
    z.planGrade = side.zoneGrades[a.zone] ?? side.nsGrade;
  }

  const predictions: CompassPredictions = {
    ece,
    svi,
    upgrade,
    psmL,
    psmR,
    bcr12,
    bcr24,
    bcr36,
    lni,
    extensive,
    nsL,
    nsR,
    eceL,
    eceR,
    sviL,
    sviR,
    nsDetailL,
    nsDetailR,
    inflammation,
    plan,
  };

  mapZoneDataToThree(P.zones, threeZones, predictions);

  return predictions;
}
