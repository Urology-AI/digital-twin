/**
 * COMPASS vNext Regional Evidence Shadow Layer v2
 * Version: vNext-regional-evidence-shadow-v2-2026-09-30
 *
 * This layer is deterministic and intentionally does NOT generate region-level EPE probabilities.
 * It also does NOT modify the frozen global ECE probability or the formal side-derived NS grade.
 */

export type NsGrade = 1 | 2 | 3;
export type RegionalEvidenceState =
  | "Direct_EPE_concern"
  | "Localized_signal"
  | "No_localized_signal"
  | "Indeterminate";
export type LocalizationConfidence = "High" | "Moderate" | "Limited";

export type ImagingModality = "MRI" | "ExactVu" | "PSMA" | "Biopsy";

export interface RegionalEvidenceInput {
  sideEpeProbability: number;
  psmProbability?: number | null;

  biopsyLocalized?: boolean;
  mriLesion?: boolean;
  mriEpePositive?: boolean;
  exactvuLesion?: boolean;
  exactvuEpePositive?: boolean;
  psmaLesion?: boolean;
  psmaEpePositive?: boolean;

  /** True when conflicting regional/laterality evidence is known upstream. */
  discordant?: boolean;

  /** Modalities unavailable/not documented. Missing is never interpreted as negative. */
  missingModalities?: ImagingModality[];

  /** False when this region cannot be meaningfully assessed/localized at all. Defaults to true. */
  regionAssessed?: boolean;
}

export interface RegionalEvidenceOutput {
  formalNsGrade: NsGrade;
  evidenceState: RegionalEvidenceState;
  confidence: LocalizationConfidence;
  flags: string[];
  localizedSources: ImagingModality[];
  directEpeSources: Array<"MRI" | "ExactVu">;
  dataLimited: boolean;
  /** Always false by governance: regional evidence never silently mutates formal grade. */
  automaticGradeOverride: false;
}

export function nsGradeFromSideEpe(p: number): NsGrade {
  if (!Number.isFinite(p) || p < 0 || p > 1) {
    throw new Error("sideEpeProbability must be between 0 and 1");
  }
  if (p < 0.10) return 1;
  if (p < 0.30) return 2;
  return 3;
}

function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

export function evaluateRegionalEvidence(input: RegionalEvidenceInput): RegionalEvidenceOutput {
  const formalNsGrade = nsGradeFromSideEpe(input.sideEpeProbability);
  const flags: string[] = [];
  const missing = input.missingModalities ?? [];
  const dataLimited = missing.length > 0 || input.regionAssessed === false;

  const directEpeSources: Array<"MRI" | "ExactVu"> = [];
  if (input.mriEpePositive) directEpeSources.push("MRI");
  if (input.exactvuEpePositive) directEpeSources.push("ExactVu");

  const localizedSources: ImagingModality[] = [];
  if (input.biopsyLocalized) localizedSources.push("Biopsy");
  if (input.mriLesion || input.mriEpePositive) localizedSources.push("MRI");
  if (input.exactvuLesion || input.exactvuEpePositive) localizedSources.push("ExactVu");
  if (input.psmaLesion || input.psmaEpePositive) localizedSources.push("PSMA");
  const localized = unique(localizedSources);

  let evidenceState: RegionalEvidenceState;
  if (input.regionAssessed === false) {
    evidenceState = "Indeterminate";
  } else if (directEpeSources.length > 0) {
    evidenceState = "Direct_EPE_concern";
  } else if (localized.length > 0) {
    evidenceState = "Localized_signal";
  } else if (missing.length >= 3) {
    // Absence of signal is not reassuring when almost all regional modalities are missing.
    evidenceState = "Indeterminate";
  } else {
    evidenceState = "No_localized_signal";
  }

  let confidence: LocalizationConfidence;
  if (input.discordant) {
    confidence = "Limited";
    flags.push("DISCORDANT_EVIDENCE");
  } else if (localized.length >= 2) {
    confidence = "High";
  } else if (directEpeSources.length === 1 || localized.length === 1) {
    confidence = "Moderate";
  } else {
    confidence = "Limited";
  }

  if (directEpeSources.length > 0) {
    flags.push("REGIONAL_CAUTION_CONSIDER_WIDER_PLANE");
  }
  if (input.psmaEpePositive) {
    flags.push("PSMA_EPE_ALERT_NO_AUTOMATIC_NS_CHANGE");
  }
  if (input.psmProbability != null && Number.isFinite(input.psmProbability) && input.psmProbability >= 0.15) {
    flags.push("PSM_MARGIN_VULNERABILITY_ALERT");
  }
  if (dataLimited) {
    flags.push("LIMITED_REGIONAL_DATA_MISSING_IS_NOT_NEGATIVE");
  }
  if (evidenceState === "No_localized_signal" && dataLimited) {
    flags.push("NO_SIGNAL_WITH_INCOMPLETE_DATA_NOT_REASSURING");
  }

  return {
    formalNsGrade,
    evidenceState,
    confidence,
    flags,
    localizedSources: localized,
    directEpeSources,
    dataLimited,
    automaticGradeOverride: false,
  };
}
