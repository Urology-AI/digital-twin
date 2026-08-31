import { ZONE_ANATOMY } from "@/lib/compass/constants";
import { predictInflammationRisk } from "@/lib/compass/inflammationRisk";
import { mapZoneDataToThree } from "@/lib/compass/mapZoneData";
import { getNsGradeZoneAware } from "@/lib/compass/nsGrade";
import { buildSurgicalPlan } from "@/lib/compass/surgicalPlan";
import { predictBcrPreop } from "@/lib/models/bcr";
import {
  clampEcePatient,
  clampEceSide,
  predictEcePatient,
  predictEceSide,
  predictExtensiveEce,
} from "@/lib/models/ece";
import { predictLni } from "@/lib/models/lni";
import { predictPsm } from "@/lib/models/psm";
import { predictSviPatient, predictSviSide } from "@/lib/models/svi";
import { predictUpgrade } from "@/lib/models/upgrade";
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

  const ece = clampEcePatient(predictEcePatient(S));
  const svi = clamp(predictSviPatient(S), 0.01, 0.9);
  const upgrade =
    S.gg >= 1 ? clamp(predictUpgrade(S), 0.05, 0.85) : 0.05;
  const lni = clamp(predictLni(S), 0.005, 0.95);
  const extensive = clamp(predictExtensiveEce(S), 0.1, 0.9);

  const lat = P.biopsy.laterality || "bilateral";

  const eceL =
    S.gg_left > 0 || lat === "left" || lat === "bilateral"
      ? clampEceSide(predictEceSide(S, "left", uiLesions, recordLesions))
      : clamp(ece * 0.3, 0.02, 0.15);

  const eceR =
    S.gg_right > 0 || lat === "right" || lat === "bilateral"
      ? clampEceSide(predictEceSide(S, "right", uiLesions, recordLesions))
      : clamp(ece * 0.3, 0.02, 0.15);

  const sviL = clamp(
    predictSviSide(S, "left", uiLesions, recordLesions),
    0.01,
    0.85,
  );
  const sviR = clamp(
    predictSviSide(S, "right", uiLesions, recordLesions),
    0.01,
    0.85,
  );

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
  const psm = clamp(predictPsm(S), 0.05, 0.8);

  const bcr = clamp(predictBcrPreop(S), 0.03, 0.75);

  const inflammation = predictInflammationRisk(S);
  const plan = buildSurgicalPlan(S, nsDetailL, nsDetailR, sviL, sviR, inflammation);

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
    psm,
    bcr,
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
