import { describe, expect, it } from "vitest";

import {
  CORE_MODULE_IDS,
  CURRICULUM_MANIFEST,
  DEEP_DIVE_MODULE_IDS,
  assertCurriculumManifest,
  validateCurriculumManifest,
} from "../../../src/learning/manifest";

describe("curriculum manifest", () => {
  it("has 8 core and 3 optional deep-dive modules with locked revisions", () => {
    expect(CORE_MODULE_IDS).toHaveLength(8);
    expect(DEEP_DIVE_MODULE_IDS).toHaveLength(3);
    expect(CURRICULUM_MANIFEST.manifestRevision).toBeTruthy();
    const core = Object.values(CURRICULUM_MANIFEST.modules).filter((m) => m.kind === "core");
    const deep = Object.values(CURRICULUM_MANIFEST.modules).filter((m) => m.kind === "deep-dive");
    expect(core).toHaveLength(8);
    expect(deep).toHaveLength(3);
    expect(deep.every((m) => !m.required && !m.blocksCoreCompletion)).toBe(true);
  });

  it("passes DAG, parity, variant, diagnostic 70%, and time-budget validation", () => {
    const result = validateCurriculumManifest(CURRICULUM_MANIFEST);
    if (!result.ok) {
      throw new Error(result.issues.map((i) => `${i.code}:${i.message}`).join(" | "));
    }
    expect(result.ok).toBe(true);
    expect(assertCurriculumManifest()).toBe(CURRICULUM_MANIFEST);
    expect(CURRICULUM_MANIFEST.diagnostic.readyThresholdPercent).toBe(70);
  });

  it("rejects a missing prerequisite edge", () => {
    const broken = structuredClone(CURRICULUM_MANIFEST);
    const firstCore = CORE_MODULE_IDS[0];
    broken.modules[firstCore] = {
      ...broken.modules[firstCore]!,
      prerequisites: ["module.does-not-exist"],
    };
    const result = validateCurriculumManifest(broken);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "missing-prerequisite")).toBe(true);
  });

  it("requires primary/accessible objective parity on required activities", () => {
    const activity = Object.values(CURRICULUM_MANIFEST.activities).find((a) => a.required);
    expect(activity).toBeTruthy();
    expect(activity!.primaryEvidenceSpec.objectiveId).toBe(activity!.accessibleEvidenceSpec.objectiveId);
    expect(activity!.primaryEvidenceSpec.objectiveId).toBe(activity!.objectiveId);
  });
});
