import { describe, expect, it } from "vitest";

import {
  abandonInProgress,
  applySignedMigration,
  completeInProgress,
  getLatestCompleteAttempt,
  recordActivityEvidence,
  scoreCompleteAttempt,
  startAttempt,
} from "../../../src/state/module-attempt";
import { assertNoRawLearnerBodies, createEmptyProgress } from "../../../src/state/progress-schema";
import { MemoryStorage, ProgressStore } from "../../../src/state/progress-store";
import type { SignedEquivalenceMap } from "../../../src/state/migrations";

const MODULE_ID = "core.demo";
const REVISIONS = {
  manifestRevision: "1",
  moduleRevision: "1",
  contentRevision: "1",
  evaluatorRegistryRevision: "1",
};
const REQUIRED = ["a1", "a2", "a3", "a4", "a5"] as const;
const SEEDS = REQUIRED.map((activityId) => ({
  activityId,
  activityRevision: "1",
  evaluatorId: "eval.multiple-choice",
  evaluatorRevision: "1",
}));

function markMany(
  progress: ReturnType<typeof createEmptyProgress>,
  outcomes: Record<string, "correct" | "incorrect">,
) {
  let next = progress;
  for (const [activityId, outcome] of Object.entries(outcomes)) {
    next = recordActivityEvidence({
      progress: next,
      moduleId: MODULE_ID,
      activityId,
      patch: {
        outcome,
        explanationOutcome: outcome === "incorrect" ? "pass" : "notRequired",
        explanationEvidenceId: outcome === "incorrect" ? "exp" : null,
        explanationEvidenceRevision: outcome === "incorrect" ? "1" : null,
        assessedAt: "t",
      },
    });
  }
  // unanswered leftovers stay unanswered explicitly by completing with them present
  return next;
}

describe("CRIT-P1-003 module attempt persistence", () => {
  it("1-2: disjoint successes never union across attempts (with and without reload)", () => {
    const storage = new MemoryStorage();
    let store = new ProgressStore("1", { storage });
    let progress = startAttempt({
      progress: store.getSnapshot(),
      moduleId: MODULE_ID,
      revisions: REVISIONS,
      requiredActivities: SEEDS,
      now: "t0",
      attemptId: "A",
    });
    progress = markMany(progress, { a1: "correct", a2: "correct", a3: "correct", a4: "incorrect", a5: "incorrect" });
    progress = completeInProgress({
      progress,
      moduleId: MODULE_ID,
      requiredActivityIds: REQUIRED,
      currentRevisions: REVISIONS,
      now: "t1",
    });
    store.commit(progress);

    // reload
    store = new ProgressStore("1", { storage });
    progress = startAttempt({
      progress: store.getSnapshot(),
      moduleId: MODULE_ID,
      revisions: REVISIONS,
      requiredActivities: SEEDS,
      now: "t2",
      attemptId: "B",
    });
    progress = markMany(progress, { a1: "incorrect", a2: "incorrect", a3: "incorrect", a4: "correct", a5: "correct" });
    progress = completeInProgress({
      progress,
      moduleId: MODULE_ID,
      requiredActivityIds: REQUIRED,
      currentRevisions: REVISIONS,
      now: "t3",
    });
    store.commit(progress);

    store = new ProgressStore("1", { storage });
    const latest = getLatestCompleteAttempt(store.getSnapshot(), MODULE_ID, REVISIONS);
    expect(latest?.attemptId).toBe("B");
    const score = scoreCompleteAttempt(latest!, REQUIRED);
    expect(score.percent).toBe(40);
    expect(score.mastered).toBe(false);
    // Ensure A is retained but not unioned
    const history = store.getSnapshot().modules[MODULE_ID]!.attemptHistory;
    expect(history.some((a) => a.attemptId === "A" && a.status === "complete")).toBe(true);
  });

  it("3: in-progress retry does not affect latest complete score across reload", () => {
    const storage = new MemoryStorage();
    let store = new ProgressStore("1", { storage });
    let progress = startAttempt({
      progress: store.getSnapshot(),
      moduleId: MODULE_ID,
      revisions: REVISIONS,
      requiredActivities: SEEDS,
      now: "t0",
      attemptId: "A",
    });
    progress = markMany(progress, { a1: "correct", a2: "correct", a3: "correct", a4: "incorrect", a5: "incorrect" });
    progress = completeInProgress({
      progress,
      moduleId: MODULE_ID,
      requiredActivityIds: REQUIRED,
      currentRevisions: REVISIONS,
      now: "t1",
    });
    progress = startAttempt({
      progress,
      moduleId: MODULE_ID,
      revisions: REVISIONS,
      requiredActivities: SEEDS,
      now: "t2",
      attemptId: "B",
    });
    progress = markMany(progress, { a1: "correct", a2: "correct", a3: "correct", a4: "correct" });
    store.commit(progress);
    store = new ProgressStore("1", { storage });
    const latest = getLatestCompleteAttempt(store.getSnapshot(), MODULE_ID, REVISIONS)!;
    expect(latest.attemptId).toBe("A");
    expect(scoreCompleteAttempt(latest, REQUIRED).percent).toBe(60);
    expect(store.getSnapshot().modules[MODULE_ID]!.inProgressAttempt?.attemptId).toBe("B");
  });

  it("4: abandon moves in-progress to immutable history without changing latest score", () => {
    let progress = startAttempt({
      progress: createEmptyProgress("1"),
      moduleId: MODULE_ID,
      revisions: REVISIONS,
      requiredActivities: SEEDS,
      now: "t0",
      attemptId: "A",
    });
    progress = markMany(progress, { a1: "correct", a2: "correct", a3: "correct", a4: "incorrect", a5: "incorrect" });
    progress = completeInProgress({
      progress,
      moduleId: MODULE_ID,
      requiredActivityIds: REQUIRED,
      currentRevisions: REVISIONS,
      now: "t1",
    });
    progress = startAttempt({
      progress,
      moduleId: MODULE_ID,
      revisions: REVISIONS,
      requiredActivities: SEEDS,
      now: "t2",
      attemptId: "B",
    });
    progress = abandonInProgress({ progress, moduleId: MODULE_ID, now: "t3" });
    expect(progress.modules[MODULE_ID]!.latestCompleteAttemptId).toBe("A");
    expect(progress.modules[MODULE_ID]!.inProgressAttempt).toBeNull();
    expect(progress.modules[MODULE_ID]!.attemptHistory.some((a) => a.attemptId === "B" && a.status === "abandoned")).toBe(true);
  });

  it("5-6: stale complete/in-progress are excluded and cannot complete after revision bump", () => {
    let progress = startAttempt({
      progress: createEmptyProgress("1"),
      moduleId: MODULE_ID,
      revisions: REVISIONS,
      requiredActivities: SEEDS,
      now: "t0",
      attemptId: "A",
    });
    progress = markMany(progress, { a1: "correct", a2: "correct", a3: "correct", a4: "correct", a5: "correct" });
    progress = completeInProgress({
      progress,
      moduleId: MODULE_ID,
      requiredActivityIds: REQUIRED,
      currentRevisions: REVISIONS,
      now: "t1",
    });
    const bumped = { ...REVISIONS, moduleRevision: "2" };
    expect(getLatestCompleteAttempt(progress, MODULE_ID, bumped)).toBeNull();

    progress = startAttempt({
      progress,
      moduleId: MODULE_ID,
      revisions: REVISIONS,
      requiredActivities: SEEDS,
      now: "t2",
      attemptId: "B",
    });
    expect(() =>
      completeInProgress({
        progress,
        moduleId: MODULE_ID,
        requiredActivityIds: REQUIRED,
        currentRevisions: bumped,
        now: "t3",
      }),
    ).toThrow(/stale/i);
  });

  it("7: only full signed migration advances pointer; partial map is rejected", () => {
    let progress = startAttempt({
      progress: createEmptyProgress("1"),
      moduleId: MODULE_ID,
      revisions: REVISIONS,
      requiredActivities: SEEDS,
      now: "t0",
      attemptId: "A",
    });
    progress = markMany(progress, { a1: "correct", a2: "correct", a3: "correct", a4: "correct", a5: "incorrect" });
    progress = completeInProgress({
      progress,
      moduleId: MODULE_ID,
      requiredActivityIds: REQUIRED,
      currentRevisions: REVISIONS,
      now: "t1",
    });

    const partial: SignedEquivalenceMap = {
      signedBy: "reviewer",
      signedAt: "t",
      from: REVISIONS,
      to: { ...REVISIONS, moduleRevision: "2" },
      activityMap: {
        a1: { activityId: "a1", activityRevision: "2", evaluatorId: "eval.multiple-choice", evaluatorRevision: "1", explanationEvidenceRevision: null },
      },
    };
    expect(() =>
      applySignedMigration({
        progress,
        moduleId: MODULE_ID,
        sourceAttemptId: "A",
        map: partial,
        requiredActivityIds: REQUIRED,
        newAttemptId: "M",
        now: "t2",
      }),
    ).toThrow(/missing required activity/i);

    const full: SignedEquivalenceMap = {
      signedBy: "reviewer",
      signedAt: "t",
      from: REVISIONS,
      to: { ...REVISIONS, moduleRevision: "2" },
      activityMap: Object.fromEntries(
        REQUIRED.map((id) => [
          id,
          {
            activityId: id,
            activityRevision: "2",
            evaluatorId: "eval.multiple-choice",
            evaluatorRevision: "1",
            explanationEvidenceRevision: id === "a5" ? "1" : null,
          },
        ]),
      ),
    };
    progress = applySignedMigration({
      progress,
      moduleId: MODULE_ID,
      sourceAttemptId: "A",
      map: full,
      requiredActivityIds: REQUIRED,
      newAttemptId: "M",
      now: "t3",
    });
    expect(progress.modules[MODULE_ID]!.latestCompleteAttemptId).toBe("M");
    const migrated = getLatestCompleteAttempt(progress, MODULE_ID, full.to);
    expect(migrated?.migratedFromAttemptId).toBe("A");
  });

  it("8: storage write failure rolls back memory pointer advance", () => {
    const storage = new MemoryStorage();
    const store = new ProgressStore("1", { storage });
    let progress = startAttempt({
      progress: store.getSnapshot(),
      moduleId: MODULE_ID,
      revisions: REVISIONS,
      requiredActivities: SEEDS,
      now: "t0",
      attemptId: "A",
    });
    progress = markMany(progress, { a1: "correct", a2: "correct", a3: "correct", a4: "correct", a5: "correct" });
    progress = completeInProgress({
      progress,
      moduleId: MODULE_ID,
      requiredActivityIds: REQUIRED,
      currentRevisions: REVISIONS,
      now: "t1",
    });
    storage.failNextWrite = true;
    expect(() => store.commit(progress)).toThrow(/QuotaExceeded/);
    expect(store.getSnapshot().modules[MODULE_ID]?.latestCompleteAttemptId ?? null).toBeNull();
  });

  it("9: privacy snapshot never contains raw answer/explanation/code bodies", () => {
    let progress = startAttempt({
      progress: createEmptyProgress("1"),
      moduleId: MODULE_ID,
      revisions: REVISIONS,
      requiredActivities: SEEDS,
      now: "t0",
      attemptId: "A",
    });
    progress = markMany(progress, { a1: "correct", a2: "correct", a3: "correct", a4: "correct", a5: "incorrect" });
    progress = completeInProgress({
      progress,
      moduleId: MODULE_ID,
      requiredActivityIds: REQUIRED,
      currentRevisions: REVISIONS,
      now: "t1",
    });
    expect(() => assertNoRawLearnerBodies(progress)).not.toThrow();
    const json = JSON.stringify(progress);
    expect(json).not.toMatch(/"answer"|"code"|"freeExplanation"|"errorBody"/);
  });
});
