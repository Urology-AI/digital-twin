/**
 * vNext side EPE against COMPASS_vNext_ECE_SideLocalizer_Shadow_Candidate_2026-09-30.json
 * (SHA-256 ffe264fb3ec9c10fbbc8a0350f8af0eb0af11aec39665b2cc242e8ccdc341f8d).
 */
import { describe, it, expect } from "vitest";
import { defaultClinicalState } from "@/types/patient";
import { buildProstateRecord } from "@/lib/compass/recordFactory";
import { assignTier } from "@/lib/models/vnext/common";
import {
  NS_CUTOFFS,
  NS_LABELS,
  exactvuOnSideFromRecord,
  sideBiopsyGgFromRecord,
  sideEpeFromInputs,
} from "@/lib/models/vnext/sideEpe";
import lock from "./fixtures/vnext/COMPASS_vNext_ECE_SideLocalizer_Shadow_Candidate_2026-09-30.json";
import { emptyLesion } from "@/types/lesion";

describe("side EPE reproduces every pinned lock case", () => {
  for (const [name, c] of Object.entries(lock.regression_cases)) {
    it(name, () => {
      const r = sideEpeFromInputs({
        globalLogit: c.inputs.global_vnext_ece_logit,
        sideBiopsyGg: c.inputs.side_biopsy_gg,
        exactvuOnSide: c.inputs.exactvu_on_side,
      });
      expect(Math.abs(r.logit - c.expected_logit)).toBeLessThan(1e-12);
      expect(Math.abs(r.probability - c.expected_probability)).toBeLessThan(1e-12);
    });
  }
});

describe("nerve-sparing context thresholds", () => {
  it("<10% Grade 1, 10-<30% Grade 2, >=30% Grade 3; a cutoff goes up", () => {
    const g = (p: number) => assignTier(p, NS_CUTOFFS, NS_LABELS).label;
    expect(g(0.0999)).toBe("Grade 1");
    expect(g(0.1)).toBe("Grade 2");
    expect(g(0.2999)).toBe("Grade 2");
    expect(g(0.3)).toBe("Grade 3");
  });
});

function rec(lat: "left" | "right" | "bilateral" | null, gg: number, l?: number | null, r?: number | null) {
  const P = buildProstateRecord(defaultClinicalState(), []);
  P.biopsy.laterality = lat as never;
  P.biopsy.max_grade_group = gg;
  P.biopsy.gg_left = l ?? null;
  P.biopsy.gg_right = r ?? null;
  return P;
}

describe("side biopsy grade coding (systematic biopsy: unreported side is clean)", () => {
  it("right-only cancer: right = overall GG, left = 0", () => {
    const P = rec("right", 3);
    expect(sideBiopsyGgFromRecord(P, "right")).toBe(3);
    expect(sideBiopsyGgFromRecord(P, "left")).toBe(0);
  });
  it("bilateral without side grades: both missing", () => {
    const P = rec("bilateral", 3);
    expect(sideBiopsyGgFromRecord(P, "left")).toBeNull();
    expect(sideBiopsyGgFromRecord(P, "right")).toBeNull();
  });
  it("entered side grades are used as entered", () => {
    const P = rec("bilateral", 4, 2, 4);
    expect(sideBiopsyGgFromRecord(P, "left")).toBe(2);
    expect(sideBiopsyGgFromRecord(P, "right")).toBe(4);
  });
  it("unknown laterality: both missing", () => {
    expect(sideBiopsyGgFromRecord(rec(null, 2), "left")).toBeNull();
  });
});

describe("ExactVu on side: missing is never negative", () => {
  const P = rec("right", 2);
  P.lesions = [];
  P.zones = {};
  const mus = (side: "L" | "R" | "", score: string) => ({ ...emptyLesion("x"), source: "MUS" as const, side, score });

  it("ExactVu not performed: null on both sides", () => {
    expect(exactvuOnSideFromRecord(P, [], "unknown", "left")).toBeNull();
    expect(exactvuOnSideFromRecord(P, [], "not_performed", "right")).toBeNull();
  });
  it("performed, lesion on right: right 1, left 0", () => {
    const rows = [mus("R", "4")];
    expect(exactvuOnSideFromRecord(P, rows, "performed", "right")).toBe(1);
    expect(exactvuOnSideFromRecord(P, rows, "performed", "left")).toBe(0);
  });
  it("performed, no lesions anywhere: both 0", () => {
    expect(exactvuOnSideFromRecord(P, [], "performed", "left")).toBe(0);
  });
  it("PRI-MUS 1-2 is not a suspicious lesion", () => {
    expect(exactvuOnSideFromRecord(P, [mus("L", "2")], "performed", "left")).toBe(0);
  });
  it("unscored blank row does not count; unscored localized lesion does", () => {
    const blank = mus("L", "");
    expect(exactvuOnSideFromRecord(P, [blank], "performed", "left")).toBe(0);
    const localized = { ...mus("L", ""), level: "Apex" as const };
    expect(exactvuOnSideFromRecord(P, [localized], "performed", "left")).toBe(1);
  });
  it("lesion with no side recorded: ambiguous, null", () => {
    expect(exactvuOnSideFromRecord(P, [mus("", "4")], "performed", "left")).toBeNull();
  });
});
