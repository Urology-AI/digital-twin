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
/**
 * "SMITH, JOHN" — the surname-comma-forename form, all caps or title case.
 *
 * Applied to the Patient row ONLY. Anywhere else the shape matches clinical
 * lists — "Asthma, HTN", "Ibrutinib, Crohns disease" — and removing those
 * deleted real comorbidities from the case. A name in free text elsewhere is
 * left to the second-layer scan, which holds the sheet for review.
 */
const PATIENT_NAME_RE = /\b[A-Z][A-Za-z'’-]+,[ \t]*[A-Z][A-Za-z'’-]+(?:[ \t]+[A-Z])?\b/g;

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
  // Clinician names ("Dr Pedraza", "Dr. Gainsburg Comments"): not the patient,
  // but nothing downstream needs them and a free-text name is exactly what a
  // scrub can miss, so they go too. Surname only — a following capitalised word
  // is usually a label, not part of the name.
  {
    label: "clinician name",
    re: /\bDr\.?[ \t]+(?:[A-Z]\.[ \t]*)*[A-Z][A-Za-z'’-]+/g,
    replace: "Dr [removed]",
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

  text = text
    .split("\n")
    .map((line) =>
      /^\s*patient\b/i.test(line)
        ? line.replace(PATIENT_NAME_RE, () => {
            removed.add("name");
            count += 1;
            return "[name removed]";
          })
        : line,
    )
    .join("\n");

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
  /**
   * Nerve-sparing grade the surgeon expected, per side — the `Left: 2` /
   * `Right: 3` cells on the PSA row. Kept separate from the model's predicted
   * grade so the two can be shown side by side, never merged.
   */
  nsExpectedL?: number;
  nsExpectedR?: number;
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
    const m = /^([^\t]{1,80}?)(?:\t|\s{2,})(.*)$/.exec(line);
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
      // "Left: 2   Right: 3" — the surgeon's expected nerve-sparing grade.
      // Range-checked, because a bare number after Left/Right on this row is
      // only meaningful as a 1-3 grade; anything else is a different field.
      const l = find(rest, "Left");
      const r = find(rest, "Right");
      if (l !== undefined && l >= 1 && l <= 3) out.nsExpectedL = l;
      if (r !== undefined && r >= 1 && r <= 3) out.nsExpectedR = r;
    } else if (/^(?:prostate\s+)?(?:volume|vol|pv)\b/i.test(key)) {
      const m = new RegExp(`^[ \t]*${NUM}`).exec(rest);
      if (m?.[1]) out.prostateVolumeCc = parseFloat(m[1]);
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
    ["prostateVolumeCc", String.raw`(?:prostate\s+)?vol(?:ume)?`, "(?:cc|ml)?"],
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
      // "L apex" / "R mid": a bare initial before a level is a side. The
      // note parser reads "R" but not "L", and falls back to both sides.
      .replace(/\bL(?=\s+(?:apex|mid|base)\b)/g, "Left")
      .replace(/\bR(?=\s+(?:apex|mid|base)\b)/g, "Right")
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
    // PSMA reads list one finding per sentence ("… SUV 5.5. Anterior left … SUV
    // max 14.4."), with no score word to split on, so split on the sentence.
    const splitter = hit[1] === "PSMA"
      ? /\s*;\s*|(?<=\.)\s+(?=[A-Z])/
      : /\s*;\s*|(?<=\.)\s+(?=(?:PIRADS|PI-RADS|PRIMUS|PRI-MUS|SUV|Gleason|GG)\b)/i;
    for (const part of cleaned.split(splitter)) {
      // "Diffuse symmetric T2 hypointensity (PIRADS 2)" is a whole-gland read,
      // not a lesion; with no side or level it would become six phantom ones.
      // Keep what precedes it: the MRI cell leads with "33.3 cc D 0.12".
      let kept = part;
      if (/\bdiffuse\b/i.test(part) && hit[1] !== "Biopsy") kept = part.split(/\bdiffuse\b/i)[0] ?? "";
      // "…(SUV max 7.0) with extension toward the right PL PZ/mid gland": the
      // note parser reads one location per line, so the extension becomes its
      // own line carrying the same score, and is cut from the original so its
      // zone words don't leak into the first finding.
      const ext = /\s*,?\s*(?:with\s+)?extension\s+(?:toward|towards|to|into)\s+(?:the\s+)?([^.;()]+)/i.exec(kept);
      let extLine = "";
      if (ext && (hit[1] === "PSMA" || hit[1] === "MRI")) {
        const score = hit[1] === "PSMA"
          ? /\bSUV\s*(?:max)?\s*[\d.]+/i.exec(kept)?.[0]
          : /\bPI-?RADS\s*[\d]/i.exec(kept)?.[0];
        if (score) extLine = normalizeScoreWords(`${ext[1]?.trim()} ${score}`);
        kept = kept.replace(ext[0], "");
      }
      const line = normalizeScoreWords(kept.trim());
      if (line) out.push(line);
      if (extLine) out.push(extLine);
    }
  }
  // No recognisable section rows: this is a free-text note, not a grid, so pass
  // it through untouched rather than mangling it.
  return matched ? out.join("\n") : text;
}

// ── Everything else on the sheet ─────────────────────────────────────────────

export interface BiopsySide {
  /** Grade group 1–5, from the (a+b) pattern. */
  gg: number;
  /** Percent of the core involved, as written. */
  maxPct?: number;
  /** Positive cores on this side. */
  cores?: number;
}

export interface SheetExtras {
  /** `3rd` in the biopsy row: this is the third biopsy, current one included. */
  biopsySessions?: number;
  biopsy: { left?: BiopsySide; right?: BiopsySide };
  asaClass?: number;
  /** History flags read from the ASA / surgery rows. Only ever set to true. */
  history: Partial<
    Record<
      | "crohns"
      | "ulcerative_colitis"
      | "diverticulitis"
      | "osa"
      | "htn"
      | "dm"
      | "cad"
      | "anticoagulant"
      | "hernia_mesh"
      | "prior_abdominal_surgery",
      true
    >
  >;
  /** `LNs on PSMA` names a node. Never set to false: "None" is just absence. */
  psmaNodePositive?: boolean;
  /**
   * Every row's scrubbed text, keyed by label. Rows with no model input
   * (DVT risk, type of surgery, comments, DRE…) land here so the case keeps
   * them — recorded, never read by a model.
   */
  notes: Record<string, string>;
}

function gradeGroup(a: number, b: number): number {
  const sum = a + b;
  if (sum <= 6) return 1;
  if (sum === 7) return a === 3 ? 2 : 3;
  if (sum === 8) return 4;
  return 5;
}

/** Term present and not negated just before it ("no OSA", "denies anticoagulants"). */
function mentions(text: string, re: RegExp): boolean {
  const m = re.exec(text);
  if (!m) return false;
  const before = text.slice(Math.max(0, m.index - 20), m.index);
  return !/\b(?:no|denies|without|negative for|nil)\b[^.;]*$/i.test(before);
}

const EMPTY_CELL = /^\s*(?:-+|n\/?a|none|nil|no|wnl|nad|normal)\.?\s*$/i;

const HISTORY_ROWS = /^(?:asa|trans[- ]?operative|abdominal wall|general surgery)\b/i;
const HISTORY_TERMS: [keyof SheetExtras["history"], RegExp][] = [
  ["crohns", /\bcrohn'?s?\b/i],
  ["ulcerative_colitis", /\bulcerative colitis\b|\bUC\b/],
  ["diverticulitis", /\bdiverticulitis\b/i],
  ["osa", /\bOSAS?\b|\bsleep apn(?:o)?ea\b/i],
  ["anticoagulant", /\banticoag\w*|\bwarfarin\b|\bcoumadin\b|\bapixaban\b|\beliquis\b|\brivaroxaban\b|\bxarelto\b|\bdabigatran\b/i],
  ["hernia_mesh", /\bmesh\b/i],
  ["htn", /\bHTN\b|\bhypertension\b/i],
  ["dm", /\bDM2?\b|\bdiabet\w*/i],
  ["cad", /\bCAD\b|\bcoronary artery disease\b/i],
];
const SURGERY_WORDS = /repair|surger|ectomy|laparoscop|laparotom|resection|obstruction|hernia|adhesion/i;

/** Clean a row label for use as a notes key: drop scrubbed placeholders and dates. */
function noteKey(label: string): string {
  const k = label.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
  return /^dr\b.*comments?$/i.test(k) ? "Surgeon comments" : k;
}

export function parseSheetExtras(text: string): SheetExtras {
  const out: SheetExtras = { biopsy: {}, history: {}, notes: {} };
  const historyText: string[] = [];

  for (const { label, rest } of sheetRows(text)) {
    const key = noteKey(label);
    if (/^patient/i.test(key)) continue;

    // The label cell can hold a prior study and its finding ("Biopsy 1st
    // Biopsy Gleason 6"); keep it with the row instead of dropping it.
    const study = /^(biopsy|mri|mus|psma|ua\/ucx)\b(.*)$/i.exec(key);
    const studyName = study?.[1]?.toLowerCase();
    const noteName = studyName === "biopsy" ? "Biopsy" : studyName === "ua/ucx" ? "UA/UCx" : studyName ? studyName.toUpperCase() : key;
    const noteText = study ? `${(study[2] ?? "").trim()} ${rest}`.trim() : rest;
    if (noteName && noteText) {
      out.notes[noteName] = out.notes[noteName] ? `${out.notes[noteName]} | ${noteText}` : noteText;
    }

    if (/^biopsy\b/i.test(key)) {
      const ord = /\b(\d+)(?:st|nd|rd|th)\b/i.exec(rest);
      if (ord?.[1]) out.biopsySessions = parseInt(ord[1], 10);
      // "Gleason 7 (3+4) 60% Right side, 3 cores" — one result per side.
      const re = /Gleason\s*(\d+)\s*\(\s*(\d)\s*\+\s*(\d)\s*\)\s*(?:(\d+)\s*%)?\s*(Right|Left|R|L)\b(?:\s*side)?[ ,]*(?:(\d+)\s*cores?)?/gi;
      for (const m of rest.matchAll(re)) {
        const side = m[5]?.[0]?.toUpperCase() === "R" ? "right" : "left";
        const entry: BiopsySide = { gg: gradeGroup(parseInt(m[2] ?? "0", 10), parseInt(m[3] ?? "0", 10)) };
        if (m[4]) entry.maxPct = parseInt(m[4], 10);
        if (m[6]) entry.cores = parseInt(m[6], 10);
        out.biopsy[side] = entry;
      }
    } else if (/^asa\b/i.test(key)) {
      const m = /\bASA\s*(?:class\s*)?([1-5])\b/i.exec(rest);
      if (m?.[1]) out.asaClass = parseInt(m[1], 10);
    } else if (/^lns?\s+on\s+psma/i.test(key)) {
      if (rest && !EMPTY_CELL.test(rest)) out.psmaNodePositive = true;
    }

    if (HISTORY_ROWS.test(key)) historyText.push(rest);
    if (/^(?:abdominal wall|general surgery)/i.test(key) && !EMPTY_CELL.test(rest) && SURGERY_WORDS.test(rest)) {
      out.history.prior_abdominal_surgery = true;
    }
  }

  const blob = historyText.join(" ; ");
  for (const [k, re] of HISTORY_TERMS) if (mentions(blob, re)) out.history[k] = true;
  return out;
}

// ── Combined entry point ─────────────────────────────────────────────────────

export interface SafeSheetResult {
  phi: SheetPhiResult;
  fields: SheetFields;
  extras: SheetExtras;
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
  return { phi, fields, extras: parseSheetExtras(phi.text), lesions: dedupeLesions(note.lesions), note, warnings };
}

// ── Sheet → case patch (shared by the Paste-note import and the batch tool) ──

export interface SheetImportPatch {
  /** Demographics and whole-gland biopsy fields — the NoteImportClinical shape. */
  clinical: {
    vol?: number; gg?: number; cores?: number; maxcore?: number;
    age?: number; psa?: number; bmi?: number; shim?: number; ipss?: number;
  };
  /**
   * Extra `updateClinicalForm` fields: per-side biopsy, laterality, history
   * flags, ASA, biopsy session, PSMA node. Keys are ClinicalState names.
   */
  form: Record<string, unknown>;
  /**
   * The sheet gives biopsy results per side with no location. The note parser
   * spreads them over invented levels, and the app derives cores/grade from
   * any Bx rows it finds, overwriting the exact per-side values — so when the
   * sheet has them, the Bx rows are dropped.
   */
  dropBxRows: boolean;
  nsExpectedL?: number;
  nsExpectedR?: number;
  /** Scrubbed text of every row, for the case record. */
  notes: Record<string, string>;
}

export function sheetImportPatch(sheet: SafeSheetResult): SheetImportPatch {
  const { fields, note, extras } = sheet;
  const clinical: SheetImportPatch["clinical"] = {
    vol: fields.prostateVolumeCc ?? note.prostateVolumeCc,
    gg: note.biopsyGG,
    cores: fields.positiveCores ?? note.biopsyTotalCores,
    maxcore: note.biopsyMaxCorePct,
    age: fields.age,
    psa: fields.psa ?? note.psa,
    bmi: fields.bmi,
    shim: fields.shim ?? note.shim,
    ipss: fields.ipss,
  };
  const form: Record<string, unknown> = { ...extras.history };
  const { left, right } = extras.biopsy;
  const sides = [left, right].filter((x): x is BiopsySide => !!x);
  if (sides.length) {
    clinical.gg = Math.max(...sides.map((x) => x.gg));
    const pcts = sides.map((x) => x.maxPct).filter((x): x is number => x !== undefined);
    if (pcts.length) clinical.maxcore = Math.max(...pcts);
    const cores = sides.map((x) => x.cores).filter((x): x is number => x !== undefined);
    if (cores.length) clinical.cores = cores.reduce((a, b) => a + b, 0);
    form.laterality = left && right ? "bilateral" : left ? "left" : "right";
    if (left) Object.assign(form, { gg_left: left.gg, cores_left: left.cores ?? null, mc_left: left.maxPct ?? null });
    if (right) Object.assign(form, { gg_right: right.gg, cores_right: right.cores ?? null, mc_right: right.maxPct ?? null });
  }
  if (extras.biopsySessions !== undefined) form.biopsy_sessions = extras.biopsySessions;
  if (extras.asaClass !== undefined) form.asa_class = extras.asaClass;
  if (extras.psmaNodePositive) form.psma_ln = true;

  const out: SheetImportPatch = {
    clinical: Object.fromEntries(Object.entries(clinical).filter(([, v]) => v !== undefined)),
    form,
    dropBxRows: sides.length > 0,
    notes: extras.notes,
  };
  if (fields.nsExpectedL !== undefined) out.nsExpectedL = fields.nsExpectedL;
  if (fields.nsExpectedR !== undefined) out.nsExpectedR = fields.nsExpectedR;
  return out;
}
