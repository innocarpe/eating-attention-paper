import { describe, expect, it } from "vitest";

import { CORE_MODULE_IDS, CURRICULUM_MANIFEST } from "../../../src/learning/manifest";
import { runEvaluator } from "../../../src/evaluators/registry";
import { assertNoRawLearnerBodies } from "../../../src/state/progress-schema";
import {
  beginModuleAttempt,
  createEmptyProgress,
  demoInputForActivity,
  finishAttempt,
  getSliceActivities,
  getSliceModule,
  gradeActivity,
  latestScore,
} from "../../../src/lib/learning-runtime";

describe("implementation sandbox mastery bridge", () => {
  it("has implementation activities with non-code accessible parity surfaces and valid params", () => {
    const impl = CORE_MODULE_IDS.flatMap((moduleId) =>
      CURRICULUM_MANIFEST.modules[moduleId]!.activityIds
        .map((id) => CURRICULUM_MANIFEST.activities[id]!)
        .filter((a) => a.stage === "implementation"),
    );
    expect(impl.length).toBeGreaterThanOrEqual(8);
    for (const activity of impl) {
      expect(activity.accessibleEvidenceSpec.objectiveId).toBe(activity.objectiveId);
      expect(["precomputed-trace", "code-correction", "labeled-table", "form-sequence"]).toContain(
        activity.accessibleEvidenceSpec.surfaceFormFamily,
      );
      const ev = activity.primaryEvidenceSpec.evaluator;
      expect(ev.evaluatorId).toBe("implementation.trace-match");
      const ok = runEvaluator(
        { evaluatorId: ev.evaluatorId, revision: ev.evaluatorRevision },
        { traceStepIds: ["s1", "s2"] },
        ev.params,
      );
      expect(ok.outcome).toBe("correct");
    }
  });

  it("records only privacy-safe evaluator outcomes into attempt evidence", () => {
    const module = getSliceModule();
    const activities = getSliceActivities();
    let progress = beginModuleAttempt(createEmptyProgress("1"), { attemptId: "impl-1" });
    for (const activity of activities) {
      progress = gradeActivity({
        progress,
        activityId: activity.activityId,
        input: demoInputForActivity(activity, "pass"),
        delivery: "primary",
      }).progress;
    }
    progress = finishAttempt(progress);
    const score = latestScore(progress);
    expect(score?.mastered).toBe(true);
    expect(() => assertNoRawLearnerBodies(progress)).not.toThrow();
    const json = JSON.stringify(progress);
    expect(json).not.toMatch(/import numpy|Traceback|print\(/);
    expect(module.moduleId).toBeTruthy();
  });
});
