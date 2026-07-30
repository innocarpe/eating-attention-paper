import { describe, expect, it } from "vitest";

import { evaluateMastery } from "../../../src/domain/mastery";
import type { ModuleAttempt } from "../../../src/state/progress-schema";
import { scoreCompleteAttempt } from "../../../src/state/module-attempt";

function attempt(
  outcomes: Record<string, "correct" | "incorrect" | "unanswered">,
  explanation: Record<string, "pass" | "fail" | "pending" | "notRequired"> = {},
): ModuleAttempt<"complete"> {
  const evidence = Object.fromEntries(
    Object.entries(outcomes).map(([activityId, outcome]) => [
      activityId,
      {
        activityId,
        activityRevision: "1",
        evaluatorId: "eval.multiple-choice",
        evaluatorRevision: "1",
        outcome,
        explanationEvidenceId: explanation[activityId] && explanation[activityId] !== "notRequired" ? "exp-1" : null,
        explanationEvidenceRevision: explanation[activityId] && explanation[activityId] !== "notRequired" ? "1" : null,
        explanationOutcome: explanation[activityId] ?? (outcome === "incorrect" ? "pending" : "notRequired"),
        hintLevel: 0,
        variantId: null,
        assessedAt: "2026-01-01T00:00:00.000Z",
      },
    ]),
  );
  return {
    attemptId: "a1",
    moduleId: "mod",
    status: "complete",
    manifestRevision: "1",
    moduleRevision: "1",
    contentRevision: "1",
    evaluatorRegistryRevision: "1",
    startedAt: "2026-01-01T00:00:00.000Z",
    completedOrAbandonedAt: "2026-01-01T00:01:00.000Z",
    evidence,
    migratedFromAttemptId: null,
  };
}

describe("mastery scoring", () => {
  it("uses integer compare correct*100 >= total*80 (79 fails, 80 passes)", () => {
    const ids = ["1", "2", "3", "4", "5"];
    // 4/5 = 80
    const pass = attempt({ "1": "correct", "2": "correct", "3": "correct", "4": "correct", "5": "incorrect" }, { "5": "pass" });
    expect(scoreCompleteAttempt(pass, ids)).toMatchObject({ percent: 80, mastered: true });
    // 3/5 = 60
    const fail = attempt({ "1": "correct", "2": "correct", "3": "correct", "4": "incorrect", "5": "incorrect" }, { "4": "pass", "5": "pass" });
    expect(scoreCompleteAttempt(fail, ids).mastered).toBe(false);
  });

  it("requires explanations before mastered and routes repeated concept failures to remediation/variants", () => {
    const ids = ["a", "b", "c", "d", "e"];
    const tags = {
      a: ["attn"],
      b: ["attn"],
      c: ["attn"],
      d: ["other"],
      e: ["other"],
    };
    const withPending = attempt(
      { a: "correct", b: "correct", c: "correct", d: "correct", e: "incorrect" },
      { e: "pending" },
    );
    expect(
      evaluateMastery({
        attempt: withPending,
        requiredActivityIds: ids,
        activityConceptTags: tags,
        conceptFailureCounts: {},
      }).status,
    ).toBe("explanationRequired");

    const low = attempt(
      { a: "incorrect", b: "incorrect", c: "correct", d: "correct", e: "correct" },
      { a: "pass", b: "pass" },
    );
    // Only a/b carry the failing concept so a later correct on another concept cannot reset it.
    const failTags = {
      a: ["attn"],
      b: ["attn"],
      c: ["other"],
      d: ["other"],
      e: ["other"],
    };
    const first = evaluateMastery({
      attempt: low,
      requiredActivityIds: ids,
      activityConceptTags: failTags,
      conceptFailureCounts: { attn: 0 },
    });
    expect(first.status).toBe("remediation");
    expect(first.nextConceptFailureCounts.attn).toBeGreaterThanOrEqual(2);

    const afterRemediation = evaluateMastery({
      attempt: low,
      requiredActivityIds: ids,
      activityConceptTags: failTags,
      conceptFailureCounts: { attn: 0 },
      remediationCompleteForConcepts: ["attn"],
    });
    expect(afterRemediation.status).toBe("variantRequired");
  });
});
