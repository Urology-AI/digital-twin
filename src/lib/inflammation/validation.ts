/**
 * Cohort validation for the inflammation instrument: scores every side of
 * every case against `scoreSide` and compares against the post-op ground
 * truth (`outInflGrade`, `outEce`) already captured in the schema. Reports
 * discrimination (AUC) for inflammation (primary outcome) and side-specific
 * EPE (secondary outcome). Purely a research-side analysis — does not write
 * back into any store.
 */
import { scoreSide } from "@/lib/inflammation/model";
import type { CohortCase, InflammationConfig } from "@/types/inflammation";

export interface AucResult {
  auc: number | null;
  nPos: number;
  nNeg: number;
}

/** Mann-Whitney U / rank-sum AUC, with midranks for ties. */
export function auc(scores: number[], labels: boolean[]): AucResult {
  const nPos = labels.filter(Boolean).length;
  const nNeg = labels.length - nPos;
  if (nPos === 0 || nNeg === 0) return { auc: null, nPos, nNeg };

  const order = scores.map((_, i) => i).sort((a, b) => scores[a]! - scores[b]!);
  const ranks = new Array<number>(scores.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && scores[order[j + 1]!] === scores[order[i]!]) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[order[k]!] = avgRank;
    i = j + 1;
  }

  const sumPosRanks = labels.reduce((t, pos, k) => (pos ? t + ranks[k]! : t), 0);
  const u = sumPosRanks - (nPos * (nPos + 1)) / 2;
  return { auc: u / (nPos * nNeg), nPos, nNeg };
}

export interface CohortValidationSummary {
  nCases: number;
  nSidesScored: number;
  /** Primary outcome: inflammation index vs. any periprostatic inflammation on whole-mount (grade >= 1). */
  inflammation: AucResult;
  /** Secondary outcome: adjusted P(ECE) vs. whole-mount ECE, this side. */
  epe: AucResult;
}

export function validateCohort(cases: CohortCase[], cfg: InflammationConfig): CohortValidationSummary {
  const inflScores: number[] = [];
  const inflLabels: boolean[] = [];
  const epeScores: number[] = [];
  const epeLabels: boolean[] = [];
  let nSidesScored = 0;

  for (const c of cases) {
    (["L", "R"] as const).forEach((s) => {
      const side = c.sides[s];
      const r = scoreSide(c.patient, side, cfg);
      if (r.touched > 0) nSidesScored++;
      if (side.outInflGrade !== null) {
        inflScores.push(r.inflScore);
        inflLabels.push(Number(side.outInflGrade) >= 1);
      }
      if (side.outEce !== null) {
        epeScores.push(r.pAdj);
        epeLabels.push(side.outEce === "yes");
      }
    });
  }

  return {
    nCases: cases.length,
    nSidesScored,
    inflammation: auc(inflScores, inflLabels),
    epe: auc(epeScores, epeLabels),
  };
}
