import { z } from "zod";

/**
 * Optional integer field — blank input ("") or null → undefined rather than
 * coercing "" to 0 (which would fail min > 0 checks like age ≥ 18).
 */
function optInt(min: number, max: number) {
  return z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number().int().min(min).max(max).optional(),
  );
}

/** Optional float field — same empty-string handling. */
function optNum(min: number, max: number) {
  return z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number().min(min).max(max).optional(),
  );
}

/**
 * Optional tri-state boolean — blank stays `null` (not assessed) instead of
 * defaulting to `false`, which the vNext models read as an observed negative.
 * Stored as 0/1/null to match `OptionalPredictor`.
 */
function optFlag() {
  return z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v ? 1 : 0),
    z.union([z.literal(0), z.literal(1), z.null()]),
  );
}

/**
 * Optional integer that keeps `null` rather than collapsing to `undefined` or 0.
 *
 * `.nullable()` rather than `z.union([z.coerce.number(), z.null()])`: a coercing
 * branch turns `null` into 0, which is the exact collapse this contract exists
 * to prevent. `.nullable()` short-circuits on null before coercion runs.
 */
function optIntNullable(min: number, max: number) {
  return z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.coerce.number().int().min(min).max(max).nullable(),
  );
}

/** Optional float that keeps `null`. See `optIntNullable` on `.nullable()`. */
function optNumNullable(min: number, max: number) {
  return z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.coerce.number().min(min).max(max).nullable(),
  );
}

export const clinicalFormSchema = z.object({
  // ── Lab & anatomy ──────────────────────────────────────────────────────────
  // REQUIRED for vNext: ln(PSA / volume) needs both strictly > 0.
  psa: z.coerce.number().positive(),
  vol: z.coerce.number().positive(),
  age: optInt(18, 120),
  bmi: optNum(10, 80),

  // ── Biopsy summary ─────────────────────────────────────────────────────────
  // REQUIRED for vNext: grade group 1–5. 0 is not a grade group.
  gg: z.coerce.number().int().min(1).max(5),
  cores: optIntNullable(0, 100),
  maxcore: optNumNullable(0, 100),
  linear_mm: optNum(0, 200),
  pct45: optNum(0, 100),

  // ── Histology flags ────────────────────────────────────────────────────────
  cribriform: z.coerce.boolean().default(false),
  idc: z.coerce.boolean().default(false),
  pni: z.coerce.boolean().default(false),

  // ── Laterality & side-specific biopsy ─────────────────────────────────────
  laterality: z.enum(["left", "right", "bilateral"]).default("bilateral"),
  gg_left: optInt(0, 5),
  gg_right: optInt(0, 5),
  cores_left: optInt(0, 100),
  cores_right: optInt(0, 100),
  mc_left: optNum(0, 100),
  mc_right: optNum(0, 100),

  // ── Genomic ────────────────────────────────────────────────────────────────
  decipherStr: z.string().optional(),

  // ── MRI ───────────────────────────────────────────────────────────────────
  pirads: optIntNullable(1, 5),
  mri_epe: optFlag(),
  mri_svi: optFlag(),
  mri_size: optNum(0, 20),
  /** null = not assessed, 0–4 = capsular contact grade (was the -1 sentinel) */
  mri_abutment: optIntNullable(0, 4),
  mri_adc: optNumNullable(0, 5000),

  // ── Micro-ultrasound / ExactVu ─────────────────────────────────────────────
  mus_ece: z.coerce.boolean().default(false),
  mus_svi: z.coerce.boolean().default(false),
  primus: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number().min(0).max(5).optional(),
  ),

  // ── PSMA PET/CT ───────────────────────────────────────────────────────────
  psma_epe: z.coerce.boolean().default(false),
  psma_svi: z.coerce.boolean().default(false),
  psma_ln: optFlag(),
  suv: optNum(0, 200),

  // ── Quality of life ───────────────────────────────────────────────────────
  shim: optInt(0, 25),
  ipss: optInt(0, 35),
});

export type ClinicalFormValues = z.infer<typeof clinicalFormSchema>;
