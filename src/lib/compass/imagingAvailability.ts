/**
 * Study-level imaging availability: was MRI / ExactVu / PSMA performed?
 *
 * Why this exists: before vNext, saved records stored MRI EPE/SVI as plain
 * booleans, so a case with no MRI carried `epe: false` exactly like a case with
 * a negative MRI. A negative finding can only be trusted when the study is
 * known to have been performed.
 *
 * Resolution:
 *   1. An explicit `staging.availability` status in the record wins.
 *   2. Otherwise infer conservatively: affirmative modality-specific data means
 *      "performed"; anything else is "unknown". Absence is never inferred as
 *      "not_performed", and a legacy `false` is never evidence of a study.
 *   3. Explicit "not_performed" alongside modality-specific data is a conflict;
 *      vNext refuses to run rather than guessing which is right.
 *
 * Migration happens at read time on every load, so no STORAGE_VERSION bump is
 * needed (a bump deletes the user's open cases).
 */
import type {
  ImagingAvailability,
  ImagingModality,
  ModalityStatus,
  Prostate3DInputV1,
} from "@/types/patient";

const positive = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > 0;

function rows(P: Prostate3DInputV1) {
  return P.lesions ?? [];
}

function hasMriEvidence(P: Prostate3DInputV1): boolean {
  const s = P.staging;
  return (
    rows(P).some((l) => l.source === "MRI") ||
    s.epe === true ||
    s.svi === true ||
    // PI-RADS 2 alone is not evidence: the pre-vNext parser seeded 2 as a
    // default, so a legacy record with only max_pirads = 2 may never have had
    // an MRI. Conservative by design.
    (typeof s.max_pirads === "number" && s.max_pirads >= 3) ||
    positive(s.lesion_size_cm) ||
    (typeof s.abutment === "number" && s.abutment >= 0) ||
    positive(s.adc_mean)
  );
}

function hasExactvuEvidence(P: Prostate3DInputV1): boolean {
  const s = P.staging;
  return (
    rows(P).some((l) => l.source === "MUS" || (l.source as string) === "ExactVu") ||
    s.epe_mus === true ||
    s.svi_mus === true ||
    positive(s.max_primus)
  );
}

function hasPsmaEvidence(P: Prostate3DInputV1): boolean {
  const s = P.staging;
  return (
    rows(P).some((l) => l.source === "PSMA") ||
    s.psma_epe === true ||
    s.psma_svi === true ||
    positive(s.max_suv) ||
    // Any recorded nodal read, positive or negative, means PSMA was done.
    (s.lymph_nodes_psma !== undefined && s.lymph_nodes_psma !== null)
  );
}

const EVIDENCE: Record<ImagingModality, (P: Prostate3DInputV1) => boolean> = {
  mri: hasMriEvidence,
  exactvu: hasExactvuEvidence,
  psma: hasPsmaEvidence,
};

export function resolveImagingAvailability(P: Prostate3DInputV1): {
  status: ImagingAvailability;
  conflicts: ImagingModality[];
} {
  const explicit = P.staging.availability ?? {};
  const status = {} as ImagingAvailability;
  const conflicts: ImagingModality[] = [];
  for (const m of ["mri", "exactvu", "psma"] as const) {
    const evidence = EVIDENCE[m](P);
    const stated: ModalityStatus | undefined = explicit[m];
    if (stated) {
      status[m] = stated;
      if (stated === "not_performed" && evidence) conflicts.push(m);
    } else {
      status[m] = evidence ? "performed" : "unknown";
    }
  }
  return { status, conflicts };
}
