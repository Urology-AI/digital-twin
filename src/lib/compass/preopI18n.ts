/**
 * Spanish for patient mode (all four tabs, the patient labels in
 * ModifiableFactorsPanel and the patient 3D overlay).
 *
 * Keys are the exact English text. Missing keys fall back to English; the
 * tests in src/test/preopCounseling.test.ts fail if any patient-facing string
 * has no translation. UI strings use `{name}` placeholders filled by `tr`.
 *
 * Machine-drafted — must be reviewed by a certified medical translator
 * before patient use.
 */
import type { Lang } from "@/lib/compass/preopCounseling";
import { ES } from "@/lib/compass/preopI18n.es";

/** Interpolated strings produced by preopCounseling.ts. */
const ES_PATTERNS: [RegExp, (...g: string[]) => string][] = [
  [/^Anesthesia · ASA (\d)$/, (n) => `Anestesia · ASA ${n}`],
  [/^ASA class (\d)$/, (n) => `clase ASA ${n}`],
  [/^About 2–(\d+) hours in the operating room$/, (n) => `Unas 2–${n} horas en el quirófano`],
  [/^Most men go home the next day \(range 1–(\d+) nights\)$/, (n) => `La mayoría de los hombres se van a casa al día siguiente (entre 1 y ${n} noches)`],
  [/^Urinary catheter for about 5–(\d+) days$/, (n) => `Sonda urinaria durante unos 5–${n} días`],
  [/^You have (\d) of the 4 metabolic-health warning signs we track \(a BMI of 30 or more, diabetes, high blood pressure, high cholesterol\)\.$/,
    (n) => `Usted tiene ${n} de las 4 señales de alerta de salud metabólica que seguimos (un IMC de 30 o más, diabetes, presión alta, colesterol alto).`],
  [/^Highest PSMA uptake in the prostate \(SUVmax\) ≈ ([\d.]+)\. Higher values tend to go with more aggressive tumors\.$/,
    (n) => `Captación máxima de PSMA en la próstata (SUVmax) ≈ ${n}. Los valores más altos suelen asociarse con tumores más agresivos.`],
  [/^Your current training level: (\w+)\. Starting early is linked to regaining continence sooner\.$/,
    (lvl) => `Su nivel de entrenamiento actual: ${ES[lvl] ?? lvl}. Empezar temprano se asocia con recuperar la continencia antes.`],
  [/^Day (\d+)$/, (n) => `Día ${n}`],
  [/^Week (\d+)$/, (n) => `Semana ${n}`],
];

export function tr(s: string, lang: Lang, vars?: Record<string, string | number>): string {
  let out = s;
  if (lang === "es") {
    const hit = ES[s];
    if (hit !== undefined) out = hit;
    else {
      for (const [re, fn] of ES_PATTERNS) {
        const m = s.match(re);
        if (m) { out = fn(...m.slice(1)); break; }
      }
    }
  }
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

/** True when `s` has a Spanish rendering (dictionary or pattern). */
export function hasSpanish(s: string): boolean {
  return ES[s] !== undefined || ES_PATTERNS.some(([re]) => re.test(s));
}
