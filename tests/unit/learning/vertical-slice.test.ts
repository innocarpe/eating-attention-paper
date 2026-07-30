import { describe, expect, it } from "vitest";

import { assertNoRawLearnerBodies } from "../../../src/state/progress-schema";
import {
  abandonAttempt,
  beginModuleAttempt,
  createEmptyProgress,
  demoInputForActivity,
  gradeDiagnosticAnswers,
  finishAttempt,
  getSliceActivities,
  getSliceModule,
  gradeActivity,
  latestScore,
  masteryForProgress,
} from "../../../src/lib/learning-runtime";

describe("vertical learning slice runtime", () => {
  it("routes diagnostic incomplete to hold when unanswered", () => {
    const held = gradeDiagnosticAnswers({});
    expect(held.recommendation).toBe("hold");
  });

  it("completes a module attempt through real evaluators on primary/accessible paths", () => {
    const module = getSliceModule();
    const activities = getSliceActivities();
    expect(new Set(module.activityIds).size).toBe(module.activityIds.length);
    expect(activities.length).toBeGreaterThanOrEqual(4);

    let progress = beginModuleAttempt(createEmptyProgress("1"), { attemptId: "S1", now: "t0" });
    for (const [index, activity] of activities.entries()) {
      const delivery = index % 2 === 0 ? "primary" : "accessible";
      progress = gradeActivity({
        progress,
        activityId: activity.activityId,
        input: demoInputForActivity(activity, "pass"),
        delivery,
        now: `t-grade-${index}`,
      }).progress;
    }
    progress = finishAttempt(progress, "t-complete");
    const score = latestScore(progress);
    expect(score).toEqual({ correct: activities.length, total: activities.length, percent: 100, mastered: true });
    expect(masteryForProgress(progress).status).toBe("mastered");
    expect(progress.modules[module.moduleId]?.remediationState.conceptFailureCounts).toBeTruthy();
    expect(() => assertNoRawLearnerBodies(progress)).not.toThrow();
  });

  it("keeps latest complete score when abandoning a later in-progress attempt", () => {
    const activities = getSliceActivities();
    let progress = beginModuleAttempt(createEmptyProgress("1"), { attemptId: "A", now: "t0" });
    for (const [index, activity] of activities.entries()) {
      progress = gradeActivity({
        progress,
        activityId: activity.activityId,
        input: demoInputForActivity(activity, "pass"),
        delivery: "primary",
        now: `a-${index}`,
      }).progress;
    }
    progress = finishAttempt(progress, "t1");
    const first = latestScore(progress)!;

    progress = beginModuleAttempt(progress, { attemptId: "B", now: "t2", abandonExisting: true });
    progress = gradeActivity({
      progress,
      activityId: activities[0]!.activityId,
      input: demoInputForActivity(activities[0]!, "fail"),
      delivery: "accessible",
      now: "t3",
    }).progress;
    progress = abandonAttempt(progress, "t4");
    expect(latestScore(progress)?.percent).toBe(first.percent);
    expect(progress.modules[getSliceModule().moduleId]?.latestCompleteAttemptId).toBe("A");
  });
});
