/**
 * Best-effort PHI scrub applied to any free text before it leaves the browser
 * for the LLM proxy (which forwards to Google Gemini — see `src/lib/api.ts`).
 *
 * This is a safety net, NOT a compliance guarantee: regex de-identification
 * cannot reliably catch every name or identifier in prose. The real guard is
 * that AI parsing is off by default and the user is told, in plain terms, that
 * turning it on sends text to Google. Keep both.
 *
 * Clinical numbers the models actually need (PSA, age, grade group, PI-RADS,
 * mm/cc measurements, ADC ~4 digits) are all short or decimal, so the "6+ bare
 * digits" rule below removes MRNs / account numbers without touching them.
 */

interface Rule {
  label: string;
  re: RegExp;
  replace: string;
}

const RULES: Rule[] = [
  { label: "email", re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, replace: "[email]" },
  { label: "ssn", re: /\b\d{3}-\d{2}-\d{4}\b/g, replace: "[ssn]" },
  {
    label: "phone",
    re: /\b(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
    replace: "[phone]",
  },
  // Labelled identifiers — take the label + whatever follows on the line.
  {
    label: "labelled-id",
    re: /\b(MRN|Medical Record(?:\s*(?:No|Number|#))?|Account(?:\s*(?:No|Number|#))?|Acct)\b[\s:#]*\S+/gi,
    replace: "[mrn]",
  },
  {
    label: "labelled-name",
    re: /^([ \t]*(?:Patient(?:\s*Name)?|Name|Pt|DOB|Date of Birth|Address)[ \t]*:)[ \t]*[^\n]+/gim,
    replace: "$1 [redacted]",
  },
  // Numeric + written dates.
  { label: "date", re: /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, replace: "[date]" },
  {
    label: "date",
    re: /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b/gi,
    replace: "[date]",
  },
  // Any remaining run of 6+ digits — MRNs, accession/order numbers, etc.
  { label: "long-number", re: /\b\d{6,}\b/g, replace: "[id]" },
];

export interface DeidentifyResult {
  text: string;
  /** How many substitutions were made — surface this so the user sees it worked. */
  redactions: number;
}

export function deidentify(input: string): DeidentifyResult {
  let redactions = 0;
  let text = input;
  for (const { re, replace } of RULES) {
    text = text.replace(re, (...m) => {
      redactions += 1;
      // Support the one rule that keeps a capture group ($1).
      return replace.replace("$1", typeof m[1] === "string" ? m[1] : "");
    });
  }
  return { text, redactions };
}

/** Strip identifier-bearing keys from the structured clinical block sent to chat. */
export function deidentifyClinical(
  clinical: Record<string, unknown>,
): Record<string, unknown> {
  const { patient_name, name, mrn, dob, ...rest } = clinical;
  void patient_name;
  void name;
  void mrn;
  void dob;
  return rest;
}

/**
 * Age bands used when de-identifying JSON. Boundaries follow the knots the
 * functional-outcome model actually uses (50/55/60/65/70 — see
 * `src/lib/compass/functionalOutcomes.ts`), so a band still says something
 * clinically meaningful. 90+ collapses into "85-89" per HIPAA Safe Harbor,
 * which forbids reporting ages over 89.
 */
const AGE_BAND_EDGES = [50, 55, 60, 65, 70, 75, 80, 85] as const;

export function ageRange(age: number): string {
  const first = AGE_BAND_EDGES[0];
  if (age < first) return `<${first}`;
  const lo = [...AGE_BAND_EDGES].reverse().find((e) => age >= e) ?? first;
  return `${lo}-${lo + 4}`;
}

/** Keys whose value is a date, or free text likely to carry one. */
const DATE_KEY = /(^|_)(date|dob|birth|dos|surgery_date|exported_at|exportedat|created_at|createdat|updated_at|updatedat|saved_at|savedat|timestamp)($|_)/i;
/** Keys carrying a human identifier rather than clinical data. */
const NAME_KEY = /^(name|patient_name|patientname|mrn|medical_record_number|accession|address|phone|email)$/i;

/**
 * Strip PHI from a parsed JSON value: drops date-bearing and identifier keys,
 * scrubs any remaining free-text strings with `deidentify`, and replaces every
 * `age` with an `age_range` band. Returns a new value; the input is untouched.
 *
 * Same caveat as `deidentify`: best-effort, not a compliance guarantee.
 */
export function deidentifyJson<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => deidentifyJson(v)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (DATE_KEY.test(k) || NAME_KEY.test(k)) continue;
      if (k.toLowerCase() === "age") {
        if (typeof v === "number") out.age_range = ageRange(v);
        continue;
      }
      out[k] = deidentifyJson(v);
    }
    return out as T;
  }
  if (typeof value === "string") {
    return deidentify(value).text as unknown as T;
  }
  return value;
}

/** `deidentifyJson` plus a top-level marker so the recipient can see it ran. */
export function deidentifyBundle<T extends object>(bundle: T): T & { _phi_removed: true } {
  return { _phi_removed: true, ...deidentifyJson(bundle) };
}
