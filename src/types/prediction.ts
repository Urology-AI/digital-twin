export type OverlayType = "cancer" | "ece" | "svi" | "psm" | "plan";

export interface NsAlert {
  type: string;
  severity: "high" | "moderate";
  message: string;
}

export interface NsSideDetail {
  nsGrade: number;
  reason: string;
  alerts: NsAlert[];
  zones: Record<string, number>;
  svi: number;
  has_zone_data: boolean;
}

export interface CompassPredictions {
  ece: number;
  svi: number;
  upgrade: number;
  psm: number;
  bcr: number;
  lni: number;
  extensive: number;
  nsL: number;
  nsR: number;
  eceL: number;
  eceR: number;
  sviL: number;
  sviR: number;
  nsDetailL: NsSideDetail;
  nsDetailR: NsSideDetail;
  inflammation: InflammationRisk;
  plan: SurgicalPlan;
}

export type InflammationTier = "low" | "moderate" | "high";

export interface InflammationRisk {
  score: number;
  tier: InflammationTier;
  contributors: { label: string; points: number }[];
  reviewMri: boolean;
  intraopObserved: boolean;
  intraopDriven: boolean;
}

export interface PlanRec<T> {
  value: T;
  rationale: string;
  /** key into REFERENCES / evidence citation shown in the explain modal */
  citation: string;
}

export interface SidePlan {
  side: "left" | "right";
  /** final grade actually planned (model + inflammation escalation + surgeon override) */
  nsGrade: number;
  /** the model's zone-aware grade before inflammation escalation or override */
  modelGrade: number;
  /** what the model recommends = modelGrade + inflammation escalation, no override */
  recommendedGrade: number;
  /** true when the surgeon override differs from recommendedGrade */
  overridden: boolean;
  /** why the model landed on modelGrade, + any inflammation escalation note */
  gradeRationale: string;
  gradeCitation: string;
  plane: string;
  planeNote: string;
  zoneGrades: Record<string, number>;
  hydrodissection: PlanRec<boolean>;
  svPreservation: PlanRec<boolean>;
  cautions: string[];
}

export interface SurgicalPlan {
  left: SidePlan;
  right: SidePlan;
  hood: PlanRec<"none" | "unilateral" | "bilateral">;
  bladderNeckPreservation: PlanRec<boolean>;
}

/** Tri-state surgeon override: null = follow the model recommendation. */
export type OverrideTri = boolean | null;

export interface PlndRecommendation {
  title: string;
  detail: string;
  tone: "success" | "warning" | "danger";
  icon: string;
}

export interface ThreeZoneRuntime {
  id: string;
  name: string;
  side: string;
  level: string;
  region: string;
  subregion: string;
  cancer: number;
  ece: number;
  svi: number;
  psm: number;
  /** recommended NS grade for this zone (1–3), for the "plan" overlay */
  planGrade: number;
}
