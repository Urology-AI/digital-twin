/**
 * PIPS-H — side-specific plane hostility.
 *
 * A transparent additive-points model (NOT fitted on pathology) estimating
 * the probability that THIS side's posterolateral fascial plane will be
 * difficult: fused, fibrotic, or otherwise requiring more traction, more
 * energy, or a wider plane than intended. Deliberately kept independent of
 * `predictEceSide` (PIPS-EPE, the oncologic axis) — the two are combined only
 * in `planeDecisionMatrix.ts`, never blended into one number. See the PIPS
 * (Periprostatic Inflammation and Plane Score) development framework: "PIPS
 * should not be a single blended score... combining inflammation and EPE
 * into a single number could make the model unsafe, because tumor-related
 * capsular changes can resemble inflammation, while inflammation can mimic
 * tumor."
 *
 * Reuses the whole-patient history/systemic points from
 * `inflammationRisk.ts`'s `preopHistoryPoints` (radiation, prior BPH surgery,
 * infection history, BMI, IPSS — these apply identically to both sides) and
 * adds the side-specific MRI plane-phenotype terms that a single
 * patient-level score cannot represent. Weights live in `planningEvidence.ts`
 * (`PLANE_HOSTILITY_MRI_WEIGHTS`, `PLANE_HOSTILITY_CUTS`).
 */
import { PLANE_HOSTILITY_CUTS, PLANE_HOSTILITY_MRI_WEIGHTS, INFLAMMATION_WEIGHTS } from "@/lib/compass/planningEvidence";
import { preopHistoryPoints } from "@/lib/compass/inflammationRisk";
import { clamp, sigmoid } from "@/lib/utils/math";
import type { ClinicalState } from "@/types/patient";

export type HostilityTier = "low" | "intermediate" | "high" | "very-high";

export interface PlaneHostility {
  side: "left" | "right";
  score: number; // 0..1
  tier: HostilityTier;
  contributors: { label: string; points: number }[];
}

export function predictPlaneHostility(S: ClinicalState, side: "left" | "right"): PlaneHostility {
  const W = PLANE_HOSTILITY_MRI_WEIGHTS.value;
  const { points: historyPoints, contributors: historyContributors } = preopHistoryPoints(S);
  const contributors = [...historyContributors];
  const add = (level: number, perLevel: number, label: string) => {
    if (level > 0) contributors.push({ label, points: level * perLevel });
  };

  const sfx = side === "left" ? "_l" : "_r";
  const otherSfx = side === "left" ? "_r" : "_l";
  const field = (name: string, s: string) => (S as unknown as Record<string, number>)[`${name}${s}`] ?? 0;
  const capsuleInterface = field("mri_capsule_interface", sfx);
  const nvbPlane = field("mri_nvb_plane", sfx);
  const postTreatment = field("mri_post_treatment_distortion", sfx);
  const nonmassSignal = field("mri_nonmass_inflammatory_signal", sfx);
  const fatStranding = field("mri_fat_stranding", sfx);
  const ownAblation = field("prior_focal_ablation", sfx);
  const otherAblation = field("prior_focal_ablation", otherSfx);

  add(capsuleInterface, W.capsuleInterfacePerLevel, `Capsule–fat interface, grade ${capsuleInterface}/3`);
  add(nvbPlane, W.nvbPlanePerLevel, `NVB corridor plane, grade ${nvbPlane}/2`);
  add(postTreatment, W.postTreatmentDistortionPerLevel, `Post-treatment distortion, grade ${postTreatment}/2`);
  add(nonmassSignal, W.nonmassInflammatorySignalPerLevel, `Non-mass inflammatory signal, grade ${nonmassSignal}/2`);
  add(fatStranding, W.fatStrandingPerLevel, `Fat stranding, grade ${fatStranding}/2`);

  let mriPoints =
    capsuleInterface * W.capsuleInterfacePerLevel +
    nvbPlane * W.nvbPlanePerLevel +
    postTreatment * W.postTreatmentDistortionPerLevel +
    nonmassSignal * W.nonmassInflammatorySignalPerLevel +
    fatStranding * W.fatStrandingPerLevel;

  // Prior focal/whole-gland ablation: ipsilateral counts by severity; any
  // ablation on the other side adds a smaller "contralateral" bump (the PIPS
  // calculator's own simplification — the near side is more affected, but a
  // whole-gland ablative course leaves some mark on both).
  if (ownAblation === 1) {
    contributors.push({ label: "Prior ipsilateral focal ablation (IRE/laser/PDT)", points: W.focalAblationIpsilateral });
    mriPoints += W.focalAblationIpsilateral;
  } else if (ownAblation >= 2) {
    contributors.push({ label: "Prior ipsilateral/whole-gland ablation (HIFU/cryo)", points: W.focalAblationIpsilateralWholeGland });
    mriPoints += W.focalAblationIpsilateralWholeGland;
  }
  if (otherAblation > 0) {
    contributors.push({ label: "Prior contralateral focal/ablative therapy", points: W.focalAblationContralateral });
    mriPoints += W.focalAblationContralateral;
  }

  const logit = INFLAMMATION_WEIGHTS.value.intercept + historyPoints + mriPoints;
  const score = clamp(sigmoid(logit), 0.02, 0.98);

  const cuts = PLANE_HOSTILITY_CUTS.value;
  const tier: HostilityTier =
    score >= cuts.veryHigh ? "very-high" : score >= cuts.high ? "high" : score >= cuts.intermediate ? "intermediate" : "low";

  return { side, score, tier, contributors: contributors.sort((a, b) => b.points - a.points) };
}
