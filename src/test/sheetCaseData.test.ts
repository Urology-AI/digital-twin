import { describe, it, expect } from "vitest";
import { usePatientStore } from "@/store/patientStore";

describe("safe-sheet case data survives export", () => {
  it("keeps the expected NS grade and the sheet notes", () => {
    const s = () => usePatientStore.getState();
    s().newCase();
    s().applySheetCaseData({ nsExpectedL: 2, nsExpectedR: 1, notes: { "DVT Risk": "High Risk" } });
    const out = JSON.parse(s().exportActiveJson());
    expect(out.plan.ns_expected_l).toBe(2);
    expect(out.plan.ns_expected_r).toBe(1);
    expect(out.sheet_notes).toEqual({ "DVT Risk": "High Risk" });
  });
});
