/**
 * Planning section of the COMPASS PDF report: operative plan, plane risk,
 * bladder-neck / apical difficulty and expected outcomes. It adds only
 * what the surgical sections of `printReport.ts` do not already show (ECE, SVI,
 * NS grade, PLND and zone tables live there), so nothing is printed twice.
 */
import { predictApicalDifficulty, predictBladderNeckDifficulty, type StepDifficulty } from "@/lib/compass/rarpDifficulty";
import type { computePlanningView } from "@/lib/compass/planningView";
import type { RiskContributor } from "@/lib/compass/inflammationRisk";
import type { ClinicalState } from "@/types/patient";
import type { CompassPredictions, SidePlan } from "@/types/prediction";

type View = ReturnType<typeof computePlanningView>;

const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Colour only the tiers that need attention; the rest print black.
const TIER_COLOR: Record<string, string> = {
  moderate: "#8A5A00",
  intermediate: "#8A5A00",
  high: "#A11D1D",
  "very-high": "#A11D1D",
};
const tier = (t: string, extra = "") =>
  `<span class="tier" style="color:${TIER_COLOR[t] ?? "#111"}">${esc(cap(t.replace("-", " ")))}${extra ? ` <span class="muted">${esc(extra)}</span>` : ""}</span>`;
const pct = (v: number) => (Number.isFinite(v) ? `${Math.round(v * 100)}%` : "N/A");
const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);
const yesNo = (v: boolean) => (v ? "Yes" : "No");

const HEALER: Record<string, string> = {
  super: "Super healer",
  healer: "Healer",
  delayed: "Delayed healer",
  "non-recovery": "Unaided recovery unlikely",
};
const EVIDENCE: Record<RiskContributor["evidence"], string> = {
  direct: "Direct",
  surrogate: "Surrogate",
  unvalidated: "Unvalidated",
  null: "Validated null",
  none: "Unstudied",
};

/** Shared factors once, side-specific ones tagged L / R. */
function mergeSideContributors(l: RiskContributor[], r: RiskContributor[]) {
  const key = (c: RiskContributor) => `${c.label}|${c.points.toFixed(3)}`;
  const rKeys = new Set(r.map(key));
  const lKeys = new Set(l.map(key));
  const rows: { c: RiskContributor; applies: string }[] = [];
  for (const c of l) rows.push({ c, applies: rKeys.has(key(c)) ? "Both" : "Left" });
  for (const c of r) if (!lKeys.has(key(c))) rows.push({ c, applies: "Right" });
  return rows;
}

function factorTable(rows: { c: RiskContributor; applies?: string }[], withApplies: boolean) {
  const scored = rows.filter((x) => x.c.points > 0).sort((a, b) => b.c.points - a.c.points);
  const context = rows.filter((x) => x.c.points <= 0).map((x) => x.c.label);
  const body = scored.length
    ? `<table class="compact"><thead><tr><th>Factor</th>${withApplies ? "<th>Side</th>" : ""}<th>Evidence</th><th class="num">Points</th></tr></thead><tbody>${scored
        .map(
          (x) =>
            `<tr><td>${esc(x.c.label)}</td>${withApplies ? `<td>${x.applies}</td>` : ""}<td>${EVIDENCE[x.c.evidence]}</td><td class="num">+${x.c.points.toFixed(2)}</td></tr>`,
        )
        .join("")}</tbody></table>`
    : `<p class="muted">No scored factors recorded.</p>`;
  const ctx = context.length ? `<p class="muted">Recorded but not scored: ${esc(context.join("; "))}.</p>` : "";
  return body + ctx;
}

function sideCell(fn: (sp: SidePlan, side: "left" | "right") => string, plan: CompassPredictions["plan"]) {
  return `<td>${fn(plan.left, "left")}</td><td>${fn(plan.right, "right")}</td>`;
}

function stepCard(title: string, d: StepDifficulty, note?: string) {
  const rows = d.contributors.filter((c) => c.points > 0);
  return `<div class="card">
    <div class="card-head"><span>${title}</span>${tier(d.tier)}</div>
    ${note ? `<div class="flag">${esc(note)}</div>` : ""}
    ${
      rows.length
        ? `<ul>${rows.map((c) => `<li><span>${esc(c.label)}</span><span>+${c.points.toFixed(1)}</span></li>`).join("")}</ul>`
        : `<p class="muted">No difficulty factors recorded.</p>`
    }
  </div>`;
}

function delta(from: number, to: number, invert = false): string {
  const d = Math.round((to - from) * 100);
  if (d === 0) return `<span class="muted">0</span>`;
  const good = invert ? d < 0 : d > 0;
  return `<span style="font-weight:700">${d > 0 ? "+" : ""}${d} pp${good ? "" : " (worse)"}</span>`;
}

export function buildPlanningHtml(S: ClinicalState, predictions: CompassPredictions, view: View): string {
  const { plan, inflammation } = predictions;
  const { baseline, withPlan, bcr, counseling, reserve } = view;
  const bn = predictBladderNeckDifficulty(S);
  const ap = predictApicalDifficulty(S);
  const g = plan.gates;

  // ── Gates (only when set) ────────────────────────────────────────────────
  const gateMsgs = [
    g.activeInfection && "Active infection: surgery deferred; neither side is scored.",
    g.imagingDiscordant && "Imaging discordant: multidisciplinary review before finalising the plane.",
    g.mriArtifact && "MRI degraded by artifact: lower confidence in PIPS-EPE and PIPS-H.",
    g.keyDataMissing && "Key data missing (MRI plane read, baseline IIEF or prior operative reports).",
  ].filter(Boolean) as string[];
  const gatesHtml = gateMsgs.length
    ? `<div class="notice">${gateMsgs.map((m) => `<div><b>Alert:</b> ${esc(m)}</div>`).join("")}</div>`
    : "";

  // Nerve-sparing alerts are already printed under the 5-zone table; don't repeat them.
  const alreadyShown = new Set(
    [...(predictions.nsDetailL.alerts ?? []), ...(predictions.nsDetailR.alerts ?? [])].map((a) => a.message),
  );

  // ── Operative plan, per side ─────────────────────────────────────────────
  const gradeNote = (sp: SidePlan, model: number) =>
    sp.nsGrade !== model ? ` <span class="muted">(planned grade ${sp.nsGrade}, model ${model})</span>` : "";
  const planHtml = `<table class="grid">
    <thead><tr><th></th><th>Left</th><th>Right</th></tr></thead>
    <tbody>
      <tr><th>Planned plane</th><td>${esc(plan.left.plane)}${gradeNote(plan.left, predictions.nsL)}</td><td>${esc(plan.right.plane)}${gradeNote(plan.right, predictions.nsR)}</td></tr>
      <tr><th>Plane hostility (PIPS-H)</th>${sideCell((sp) => tier(sp.hostilityTier, pct(sp.hostilityScore)), plan)}</tr>
      <tr><th>Bundle preservable (oncologic)</th><td>${pct(counseling.left.preservableOncologically)}</td><td>${pct(counseling.right.preservableOncologically)}</td></tr>
      <tr><th>NVB hydrodissection</th>${sideCell((sp) => yesNo(sp.hydrodissection.value), plan)}</tr>
      <tr><th>Seminal-vesicle tip-sparing</th>${sideCell((sp) => yesNo(sp.svPreservation.value), plan)}</tr>
      <tr><th>Chance plan is reduced intra-operatively</th><td>${esc(cap(counseling.left.planReduction.likelihood.replace("-", " ")))}</td><td>${esc(cap(counseling.right.planReduction.likelihood.replace("-", " ")))}</td></tr>
      <tr><th>Confidence</th><td>${esc(cap(counseling.left.confidence.level))}</td><td>${esc(cap(counseling.right.confidence.level))}</td></tr>
      <tr><th>Cautions</th>${sideCell((sp) => {
        const extra = sp.cautions.filter((c) => !alreadyShown.has(c));
        return extra.length ? extra.map(esc).join("<br>") : "—";
      }, plan)}</tr>
    </tbody></table>
    <p class="note"><b>Left:</b> ${esc(plan.left.planeNote)}<br><b>Right:</b> ${esc(plan.right.planeNote)}</p>`;

  // ── Plane risk & inflammation ────────────────────────────────────────────
  const merged = mergeSideContributors(counseling.left.contributors, counseling.right.contributors);
  const riskHtml = `<p class="lead">Periprostatic inflammation risk (whole patient): ${tier(inflammation.tier, pct(inflammation.score))}${
    inflammation.intraopObserved ? ` <span class="muted">(set by the recorded intra-operative grade)</span>` : ""
  }</p>${factorTable(merged, true)}`;

  // ── Step difficulty ──────────────────────────────────────────────────────
  const stepHtml = `<div class="cols">${stepCard(
    "Bladder neck",
    bn,
    bn.reconstructionLikely ? "Plan for bladder-neck reconstruction" : undefined,
  )}${stepCard("Apex / anastomosis", ap)}</div>`;

  // ── Outcomes ─────────────────────────────────────────────────────────────
  const row = (label: string, a: number | null, b: number | null, invert = false) =>
    a == null || b == null
      ? `<tr><th>${label}</th><td colspan="3" class="muted">Not estimated (baseline SHIM below 12)</td></tr>`
      : `<tr><th>${label}</th><td>${pct(a)}</td><td>${pct(b)}</td><td>${delta(a, b, invert)}</td></tr>`;
  const hb = (t: string | null) => (t ? HEALER[t] ?? t : "—");
  const outcomesHtml = `<table class="grid">
    <thead><tr><th></th><th>Model-recommended</th><th>Planned</th><th>Change</th></tr></thead>
    <tbody>
      ${row("Continence, 12 mo (0–1 pad)", baseline.continence12 / 100, withPlan.continence12 / 100)}
      ${row("Potency, 12 mo (SHIM ≥ 12)", baseline.potency12 == null ? null : baseline.potency12 / 100, withPlan.potency12 == null ? null : withPlan.potency12 / 100)}
      ${Number.isFinite(predictions.bcr36) ? row("BCR, 1 year", bcr.baseline.y1, bcr.withPlan.y1, true) + row("BCR, 2–3 years", bcr.baseline.y23, bcr.withPlan.y23, true) : ""}
      <tr><th>Erectile-recovery phenotype</th><td>${hb(baseline.healerTier)}</td><td>${hb(withPlan.healerTier)}</td><td></td></tr>
    </tbody></table>
    <p class="note">${
      reserve.available && reserve.tier && reserve.probability !== null
        ? `<b>Recovery reserve (PIPS-R):</b> ${esc(reserve.tier)}. Expected unassisted erectile function at 18 months with bilateral preservation: ${pct(reserve.probability)}.`
        : `<b>Recovery reserve (PIPS-R):</b> not estimated (baseline SHIM below 12).`
    }</p>
    ${counseling.uncertainty.length ? `<p class="note"><b>Key uncertainty:</b> ${counseling.uncertainty.map(esc).join("; ")}.</p>` : ""}`;

  return `
<div class="planning">
<h2 class="break">Operative plan</h2>
${gatesHtml}
${planHtml}

<h2>Plane risk and inflammation</h2>
${riskHtml}

<h2>Bladder-neck and apical difficulty</h2>
${stepHtml}

<h2>Expected outcomes: planned vs model-recommended</h2>
${outcomesHtml}

<p class="note">Planning estimates use provisional weights that have not been fitted to our cohort. Research use only.</p>
</div>`;
}
