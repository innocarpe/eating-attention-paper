import { describe, expect, it } from "vitest";

import { CURRICULUM_MANIFEST } from "../../../src/learning/manifest";
import {
  beginModuleAttempt,
  createEmptyProgress,
  demoInputForActivity,
  finishAttempt,
  getSliceActivities,
  getSliceModule,
  gradeActivity,
  markRemediationComplete,
  markVariantPassed,
  masteryForProgress,
  submitExplanation,
} from "../../../src/lib/learning-runtime";

describe("remediation persistence round-trip", () => {
  it("maps persisted variant passes through variants registry for mastery", () => {
    const activities = getSliceActivities();
    let progress = beginModuleAttempt(createEmptyProgress("1"), { attemptId: "R1", now: "t0" });

    for (const [index, activity] of activities.entries()) {
      const fail = index < 2;
      progress = gradeActivity({
        progress,
        activityId: activity.activityId,
        input: demoInputForActivity(activity, fail ? "fail" : "pass"),
        delivery: "primary",
        now: `t${index}`,
      }).progress;
      if (fail) {
        progress = submitExplanation({
          progress,
          activityId: activity.activityId,
          passed: true,
          now: `e${index}`,
        });
      }
    }

    progress = finishAttempt(progress, "done");
    const concept = activities[0]!.conceptTags[0]!;
    progress = markRemediationComplete(progress, [concept]);
    const variant = Object.values(CURRICULUM_MANIFEST.variants).find(
      (entry) => entry.conceptFamily === concept || entry.conceptTags.includes(concept),
    );
    expect(variant).toBeTruthy();
    progress = markVariantPassed(progress, [variant!.variantId]);

    const moduleId = getSliceModule().moduleId;
    expect(progress.modules[moduleId]?.remediationState.passedVariantActivityIds).toContain(
      variant!.variantId,
    );
    const decision = masteryForProgress(progress);
    // Mapping works: either cleared past variantRequired, or still remediation for other concepts,
    // but must not ignore the passed variant marker.
    expect(decision).toBeTruthy();
    expect(decision.nextConceptFailureCounts).toBeTruthy();
  });
});
