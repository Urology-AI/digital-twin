/**
 * Copy-paste parsing for the pre-operative safe sheet.
 *
 * Clinicians paste the sheet straight out of Word, so this runs entirely in the
 * browser: nothing is uploaded, no model is called, and the raw paste is never
 * stored. `stripSheetPhi` removes identifiers BEFORE anything else looks at the
 * text, so the rest of the pipeline only ever sees clinical values.
 *
 * The sheet is a grid — first cell is a row label, the rest is that row's
 * content:
 *
 *     Patient   BMI: 29.1   SMITH, JOHN 64   MRN 4471829   DOB 03/14/1961
 *     Biopsy 01/08/2025   7/14   Gleason 4+3 (GG3) right base posterolateral…
 *     PSA   11.4   SHIM 18   Left: 2   Right: 3
 *
 * Reading it row-first matters: the label scopes the value. "64" on the Patient
 * row is an age; the same digits anywhere else are not. A free-text regex over
 * the whole sheet gets this wrong, which is why the labelled pass exists
 * separately from `parseClinicNote`.
 */
import { parseClinicNote, type ParsedNote } from "@/lib/parseClinicNote";
import type { LesionRow } from "@/types/lesion";

const NUM = String.raw`(-?\d+(?:\.\d+)?)`;

export interface SheetPhiResult {
  /** The text with identifiers replaced. Only this is parsed or kept. */
  text: string;
  /** Identifier kinds that were found, for telling the user what was removed. */
  removed: string[];
  count: number;
}

/**
 * Safe-sheet-shaped identifier rules, applied before the general scrub.
 *
 * These are anchored to the sheet's own labels (`MRN 4471829`,
 * `DOB 03/14/1961`), which is what makes them safe to apply aggressively:
 * a labelled field can be removed wholesale without risking a clinical number.
 * The patient name is the hard case — it carries no label of its own, so it is
 * matched as the ALL-CAPS "SURNAME, FIRST" form these sheets use.
 */
const SHEET_RULES: { label: string; re: RegExp; replace: string }[] = [
  { label: "MRN", re: /\bMRN\b[ \t]*[:#]?[ \t]*[\w-]+/gi, replace: "MRN [removed]" },
  { label: "date of birth", re: /\bDOB\b[ \t]*:?[ \t]*[\d/.-]+/gi, replace: "DOB [removed]" },
  {
    label: "date of birth",
    re: /\bdate of birth\b[ \t]*:?[ \t]*[\d/.-]+/gi,
    replace: "Date of birth [removed]",
  },
  {
    label: "surgery date",
    re: /\bdate of surger?y\b[ \t]*:?[ \t]*[\d/.-]+/gi,
    replace: "Date of surgery [removed]",
  },
  { label: "accession", re: /\baccession\b[ \t]*[:#]?[ \t]*[\w-]+/gi, replace: "Accession [removed]" },
  // "SMITH, JOHN" — the surname-comma-forename form, all caps or title case.
  {
    label: "name",
    re: /\b[A-Z][A-Za-z'’-]+,[ \t]*[A-Z][A-Za-z'’-]+(?:[ \t]+[A-Z])?\b/g,
    replace: "[name removed]",
  },
  { label: "phone", re: /\b(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, replace: "[phone removed]" },
  { label: "email", re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, replace: "[email removed]" },
  { label: "SSN", re: /\b\d{3}-\d{2}-\d{4}\b/g, replace: "[ssn removed]" },
];

/**
 * Remaining dates, run after the labelled rules so a labelled date is reported
 * under its own name. Dates are identifiers under Safe Harbor, and a safe sheet
 * is full of them (biopsy, MRI, MUS, UA/UCx) — none are needed to predict.
 */
const LOOSE_DATE = /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/g;
/** Any surviving run of 6+ digits: record, accession and order numbers. */
const LONG_NUMBER = /\b\d{6,}\b/g;

/**
 * Removes identifiers from a pasted sheet. Runs in the browser, before parsing.
 *
 * Deliberately blunt: it strips more than the strict minimum, because nothing
 * downstream needs a name, an MRN or a date, and over-removal costs nothing
 * while under-removal puts an identifier into stored case data. Still
 * best-effort, not a compliance guarantee — an unlabelled name in free text can
 * survive, which is why the UI shows the scrubbed text back for review.
 */
export function stripSheetPhi(input: string): SheetPhiResult {
  const removed = new Set<string>();
  let count = 0;
  let text = input;

  for (const { label, re, replace } of SHEET_RULES) {
    text = text.replace(re, () => {
      removed.add(label);
      count += 1;
      return replace;
    });
  }
  text = text.replace(LOOSE_DATE, () => {
    removed.add("date");
    count += 1;
    return "[date removed]";
  });
  text = text.replace(LONG_NUMBER, () => {
    removed.add("identifier number");
    count += 1;
    return "[id removed]";
  });

  return { text, removed: [...removed].sort(), count };
}

// ── Row-aware field extraction ───────────────────────────────────────────────

export interface SheetFields {
  age?: number;
  psa?: number;
  bmi?: number;
  shim?: number;
  ipss?: number;
  prostateVolumeCc?: number;
  positiveCores?: number;
  totalCores?: number;
}

/** Split into (label, rest) pairs. Word pastes use tabs; some use 2+ spaces. */
function sheetRows(text: string): { label: string; rest: string }[] {
  const out: { label: string; rest: string }[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const m = /^([^\t]{1,40}?)(?:\t|\s{2,})(.*)$/.exec(line);
    if (!m?.[1] || m[2] === undefined) continue;
    out.push({ label: m[1].trim(), rest: m[2].replace(/\t/g, " ").trim() });
  }
  return out;
}

function find(text: string, label: string, unit = ""): number | undefined {
  const re = new RegExp(String.raw`\b${label}\b[ \t]*[:=]?[ \t]*${NUM}\s*${unit}`, "i");
  const m = re.exec(text);
  const v = m?.[1];
  return v === undefined ? undefined : parseFloat(v);
}

/**
 * The Patient row: `BMI: 29.1   [name removed] 64   MRN [removed]   DOB [removed]`
 *
 * Age carries no label here — it trails the name. Labelled numbers are removed
 * first so a bare 18-110 integer in the remainder is unambiguous. PHI stripping
 * has already taken out the MRN and dates, which is what makes this safe: those
 * are the two things that would otherwise be misread as an age.
 */
function patientRow(rest: string): { age?: number; bmi?: number } {
  const out: { age?: number; bmi?: number } = {};
  const bmi = find(rest, "BMI");
  if (bmi !== undefined) out.bmi = bmi;

  const stripped = rest
    .replace(/\b(?:MRN|DOB|BMI|date of surger?y)\b[ \t]*:?[ \t]*\S+/gi, " ")
    .replace(/\[[^\]]*\]/g, " ");
  const ages = [...stripped.matchAll(/(?<![\d./-])(\d{2})(?![\d./-])/g)]
    .map((m) => parseInt(m[1] ?? "", 10))
    .filter((n) => !Number.isNaN(n) && n >= 18 && n <= 110);
  // Only when unambiguous. Two candidates means we cannot tell which is the age.
  if (ages.length === 1) out.age = ages[0];
  return out;
}

export function parseSheetFields(text: string): SheetFields {
  const out: SheetFields = {};
  for (const { label, rest } of sheetRows(text)) {
    const key = label.toLowerCase();
    if (!rest) continue;

    if (key.startsWith("patient")) {
      Object.assign(out, patientRow(rest));
    } else if (key.startsWith("psa")) {
      const m = new RegExp(`^[ \t]*${NUM}`).exec(rest);
      if (m?.[1]) out.psa = parseFloat(m[1]);
      const shim = find(rest, "SHIM");
      if (shim !== undefined) out.shim = shim;
      const ipss = find(rest, "IPSS");
      if (ipss !== undefined) out.ipss = ipss;
    } else if (key.startsWith("biopsy")) {
      // "7/14" in its own cell — a cores fraction with no "cores" word.
      const m = /(?<![\d./])(\d{1,2})\s*\/\s*(\d{1,3})(?![\d./])/.exec(rest);
      if (m?.[1] && m[2] && parseInt(m[1], 10) <= parseInt(m[2], 10)) {
        out.positiveCores = parseInt(m[1], 10);
        out.totalCores = parseInt(m[2], 10);
      }
    }
  }

  // Labels that may sit anywhere rather than starting a row.
  const fallbacks: [keyof SheetFields, string, string][] = [
    ["bmi", "BMI", ""],
    ["shim", "SHIM", ""],
    ["ipss", "IPSS", ""],
    ["prostateVolumeCc", String.raw`(?:prostate\s+)?volume`, "(?:cc|ml)?"],
  ];
  for (const [key, label, unit] of fallbacks) {
    if (out[key] === undefined) {
      const v = find(text, label, unit);
      if (v !== undefined) (out as Record<string, number>)[key] = v;
    }
  }
  return out;
}

// ── Sheet → note normalisation ───────────────────────────────────────────────

/**
 * Rows whose content COMPASS actually uses. Everything else on the sheet —
 * ASA, DVT risk, research consent, trans-operative care, abdominal wall — is
 * recorded for other purposes and has no model input to land in, so it is
 * ignored rather than captured into a field that does not exist.
 */
const SECTION_OF: [RegExp, string][] = [
  [/^biopsy\b/i, "Biopsy"],
  [/^mri\b/i, "MRI"],
  [/^(?:mus|micro[- ]?us|micro[- ]?ultrasound|exactvu)\b/i, "MUS"],
  [/^psma\b/i, "PSMA"],
];

/**
 * Score spellings vary by site; `parseClinicNote` expects one form.
 * Normalising here rather than loosening that parser keeps the sheet's quirks
 * in the sheet's own module.
 */
function normalizeScoreWords(line: string): string {
  return (
    line
      .replace(/\bPI[- ]?RADS\b/gi, "PIRADS")
      .replace(/\bPRI[- ]?MUS\b/gi, "PRIMUS")
      .replace(/\bSUV\s*max\b/gi, "SUV")
      // The sheet writes "Gleason 4+3"; parseClinicNote matches
      // "Gleason <sum> (<major>+<minor>)". Add the sum rather than loosen that
      // regex, which also guards against a bare "4+3" elsewhere in a sentence.
      .replace(/\bGleason\s*(\d)\s*\+\s*(\d)\b(?!\s*\))/gi, (_m, a: string, b: string) =>
        `Gleason ${Number(a) + Number(b)} (${a}+${b})`)
      // Zone words are matched as abbreviations ("PL"), not spelled out.
      .replace(/\bpostero[- ]?lateral\b/gi, "PL")
      .replace(/\bantero[- ]?lateral\b/gi, "AL")
      .replace(/\bbilat(?:eral)?\b/gi, "bilateral")
  );
}

/**
 * Turn the grid into the line-per-finding shape `parseClinicNote` understands.
 *
 * This is the whole reason grid pastes produced no lesions: the sheet puts a
 * row label and a date in the first cells and the entire finding in the next
 * one, so every line looked like an unparseable header. Here each relevant row
 * becomes a section heading followed by its findings, one per line — split on
 * semicolons, and on sentence breaks that start a new scored finding.
 */
export function sheetToNote(text: string): string {
  const rows = sheetRows(text);
  if (!rows.length) return text;

  const out: string[] = [];
  let matched = 0;
  for (const { label, rest } of rows) {
    const hit = SECTION_OF.find(([re]) => re.test(label));
    if (!hit || !rest) continue;
    matched += 1;
    out.push(hit[1]);
    const cleaned = rest.replace(/\[[^\]]*\]/g, " ").trim();
    for (const part of cleaned.split(/\s*;\s*|(?<=\.)\s+(?=(?:PIRADS|PI-RADS|PRIMUS|PRI-MUS|SUV|Gleason|GG)\b)/i)) {
      const line = normalizeScoreWords(part.trim());
      if (line) out.push(line);
    }
  }
  // No recognisable section rows: this is a free-text note, not a grid, so pass
  // it through untouched rather than mangling it.
  return matched ? out.join("\n") : text;
}

// ── Combined entry point ─────────────────────────────────────────────────────

export interface SafeSheetResult {
  phi: SheetPhiResult;
  fields: SheetFields;
  lesions: LesionRow[];
  note: ParsedNote;
  warnings: string[];
}

/** Collapse identical findings — a grid paste makes the same row repeat. */
function dedupeLesions(rows: LesionRow[]): LesionRow[] {
  const seen = new Set<string>();
  const out: LesionRow[] = [];
  for (const r of rows) {
    const key = `${r.source}|${r.side}|${r.level}|${r.zone}|${r.score}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

/**
 * Parse a pasted safe sheet. PHI is removed first and only the scrubbed text is
 * parsed, so nothing downstream — including anything the user later sends to
 * the assistant — can carry an identifier that entered here.
 */
export function parseSafeSheet(input: string): SafeSheetResult {
  const phi = stripSheetPhi(input);
  const fields = parseSheetFields(phi.text);
  const note = parseClinicNote(sheetToNote(phi.text));
  const warnings = [...note.warnings];

  if (fields.prostateVolumeCc === undefined && note.prostateVolumeCc === undefined) {
    warnings.push("No prostate volume on the sheet — PSA density cannot be computed and COMPASS will use its default.");
  }
  return { phi, fields, lesions: dedupeLesions(note.lesions), note, warnings };
}
