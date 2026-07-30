import type { ModuleAttempt } from "../state/progress-schema";
import { scoreCompleteAttempt } from "../state/module-attempt";

export type MasteryStatus =
  | "mastered"
  | "explanationRequired"
  | "retryAllowed"
  | "remediation"
  | "variantRequired"
  | "noEvidence";

export interface ConceptFailureState {
  readonly conceptFailureCounts: Readonly<Record<string, number>>;
}

export interface MasteryDecision {
  readonly status: MasteryStatus;
  readonly percent: number | null;
  readonly correct: number;
  readonly total: number;
  readonly nextConceptFailureCounts: Readonly<Record<string, number>>;
}

export function evaluateMastery(args: {
  readonly attempt: ModuleAttempt<"complete"> | null;
  readonly requiredActivityIds: readonly string[];
  readonly activityConceptTags: Readonly<Record<string, readonly string[]>>;
  readonly conceptFailureCounts: Readonly<Record<string, number>>;
  readonly remediationCompleteForConcepts?: readonly string[];
  readonly variantPassedForConcepts?: readonly string[];
}): MasteryDecision {
  if (!args.attempt) {
    return {
      status: "noEvidence",
      percent: null,
      correct: 0,
      total: args.requiredActivityIds.length,
      nextConceptFailureCounts: args.conceptFailureCounts,
    };
  }

  const score = scoreCompleteAttempt(args.attempt, args.requiredActivityIds);
  const failureCounts = { ...args.conceptFailureCounts };

  // Update concept counters from this complete attempt.
  for (const activityId of args.requiredActivityIds) {
    const evidence = args.attempt.evidence[activityId];
    const tags = args.activityConceptTags[activityId] ?? [];
    for (const tag of tags) {
      if (evidence?.outcome === "correct") {
        failureCounts[tag] = 0;
      } else if (evidence?.outcome === "incorrect") {
        failureCounts[tag] = (failureCounts[tag] ?? 0) + 1;
      }
    }
  }

  const incorrectIds = args.requiredActivityIds.filter(
    (id) => args.attempt?.evidence[id]?.outcome === "incorrect",
  );
  const explanationsPending = incorrectIds.some((id) => {
    const exp = args.attempt?.evidence[id]?.explanationOutcome;
    return exp !== "pass" && exp !== "notRequired";
  });

  const conceptsAtTwo = Object.entries(failureCounts)
    .filter(([, count]) => count >= 2)
    .map(([concept]) => concept);

  if (conceptsAtTwo.length > 0) {
    const remediationDone = (args.remediationCompleteForConcepts ?? []).length > 0
      && conceptsAtTwo.every((c) => args.remediationCompleteForConcepts?.includes(c));
    if (!remediationDone) {
      return {
        status: "remediation",
        percent: score.percent,
        correct: score.correct,
        total: score.total,
        nextConceptFailureCounts: failureCounts,
      };
    }
    const variantsDone = conceptsAtTwo.every((c) => args.variantPassedForConcepts?.includes(c));
    if (!variantsDone) {
      return {
        status: "variantRequired",
        percent: score.percent,
        correct: score.correct,
        total: score.total,
        nextConceptFailureCounts: failureCounts,
      };
    }
    // After remediation + independent variant pass, counters reset.
    for (const c of conceptsAtTwo) failureCounts[c] = 0;
  }

  if (score.mastered) {
    if (explanationsPending) {
      return {
        status: "explanationRequired",
        percent: score.percent,
        correct: score.correct,
        total: score.total,
        nextConceptFailureCounts: failureCounts,
      };
    }
    return {
      status: "mastered",
      percent: score.percent,
      correct: score.correct,
      total: score.total,
      nextConceptFailureCounts: failureCounts,
    };
  }

  return {
    status: "retryAllowed",
    percent: score.percent,
    correct: score.correct,
    total: score.total,
    nextConceptFailureCounts: failureCounts,
  };
}
