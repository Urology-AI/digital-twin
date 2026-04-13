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

export const clinicalFormSchema = z.object({
  // ── Lab & anatomy ──────────────────────────────────────────────────────────
  psa: z.coerce.number().nonnegative(),
  vol: z.coerce.number().positive(),
  age: optInt(18, 120),
  bmi: optNum(10, 80),

  // ── Biopsy summary ─────────────────────────────────────────────────────────
  gg: z.coerce.number().int().min(0).max(5),
  cores: z.coerce.number().int().min(0),
  maxcore: z.coerce.number().min(0).max(100),
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
  pirads: optInt(1, 5),
  mri_epe: z.coerce.boolean().default(false),
  mri_svi: z.coerce.boolean().default(false),
  mri_size: optNum(0, 20),
  /** -1 = not assessed, 0–4 = capsular contact grade */
  mri_abutment: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? -1 : v),
    z.coerce.number().int().min(-1).max(4),
  ),
  mri_adc: optNum(0, 5000),

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
  psma_ln: z.coerce.boolean().default(false),
  suv: optNum(0, 200),

  // ── Quality of life ───────────────────────────────────────────────────────
  shim: optInt(0, 25),
  ipss: optInt(0, 35),
});

export type ClinicalFormValues = z.infer<typeof clinicalFormSchema>;
