import { evaluateDiagnostic, type DiagnosticItemResult, type RouteRecommendation } from "../domain/diagnostic";
import type { StorageLike } from "../state/progress-store";
import { evaluateMastery, type MasteryDecision } from "../domain/mastery";
import {
  CORE_MODULE_IDS,
  CURRICULUM_MANIFEST,
  type ActivityDefinition,
  type ModuleDefinition,
} from "../learning/manifest";
import { runEvaluator } from "../evaluators/registry";
import {
  abandonInProgress,
  completeInProgress,
  getLatestCompleteAttempt,
  recordActivityEvidence,
  scoreCompleteAttempt,
  startAttempt,
} from "../state/module-attempt";
import { createEmptyProgress, type ProgressV1 } from "../state/progress-schema";
import { MemoryStorage, ProgressStore } from "../state/progress-store";
import type { RevisionSnapshot } from "../state/revision-policy";

export const SLICE_MODULE_ID = CORE_MODULE_IDS[0] ?? "core.vector-similarity";

export function getSliceModule(): ModuleDefinition {
  const mod = CURRICULUM_MANIFEST.modules[SLICE_MODULE_ID];
  if (!mod) throw new Error(`Missing slice module ${SLICE_MODULE_ID}`);
  return mod;
}

export function getSliceActivities(): ActivityDefinition[] {
  const mod = getSliceModule();
  return mod.activityIds.map((id) => {
    const activity = CURRICULUM_MANIFEST.activities[id];
    if (!activity) throw new Error(`Missing activity ${id}`);
    return activity;
  });
}

export function currentRevisions(module: ModuleDefinition = getSliceModule()): RevisionSnapshot {
  return {
    manifestRevision: CURRICULUM_MANIFEST.manifestRevision,
    moduleRevision: module.moduleRevision,
    contentRevision: "1",
    evaluatorRegistryRevision: "1",
  };
}

export function createLearningStore(storage?: Storage): ProgressStore {
  const backend =
    storage ??
    (typeof localStorage !== "undefined"
      ? localStorage
      : new MemoryStorage());
  return new ProgressStore(CURRICULUM_MANIFEST.manifestRevision, {
    storage: backend as unknown as StorageLike,
  });
}

export function buildDiagnosticItemsFromAnswers(
  answers: Readonly<Record<string, boolean | null>>,
): DiagnosticItemResult[] {
  return CURRICULUM_MANIFEST.diagnostic.items
    .filter((item) => item.required)
    .map((item) => ({
      itemId: item.itemId,
      domain: item.domain,
      required: true,
      correct: answers[item.itemId] ?? null,
    }));
}

export function evaluatePrepDiagnostic(
  answers: Readonly<Record<string, boolean | null>>,
) {
  return evaluateDiagnostic(buildDiagnosticItemsFromAnswers(answers));
}

function seedsForModule(module: ModuleDefinition = getSliceModule()) {
  return module.activityIds.map((activityId) => {
    const activity = CURRICULUM_MANIFEST.activities[activityId]!;
    return {
      activityId,
      activityRevision: activity.activityRevision,
      evaluatorId: activity.primaryEvidenceSpec.evaluator.evaluatorId,
      evaluatorRevision: activity.primaryEvidenceSpec.evaluator.evaluatorRevision,
      conceptTags: activity.conceptTags,
    };
  });
}

export function beginModuleAttempt(
  progress: ProgressV1,
  options?: { attemptId?: string; now?: string; abandonExisting?: boolean },
): ProgressV1 {
  const module = getSliceModule();
  return startAttempt({
    progress,
    moduleId: module.moduleId,
    revisions: currentRevisions(module),
    requiredActivities: seedsForModule(module),
    now: options?.now ?? new Date().toISOString(),
    attemptId: options?.attemptId,
    abandonExistingInProgress: options?.abandonExisting ?? true,
  });
}

/**
 * Deterministic inputs aligned to allowlisted evaluator params.
 * Scoring always goes through `runEvaluator` — no marker shortcuts.
 */
export function demoInputForActivity(
  activity: ActivityDefinition,
  mode: "pass" | "fail" | "blank" = "pass",
): unknown {
  if (mode === "blank") return null;
  const evaluatorId = activity.primaryEvidenceSpec.evaluator.evaluatorId;
  if (evaluatorId === "concept.multiple-choice") {
    return { selectedOptionId: mode === "pass" ? "correct" : "wrong" };
  }
  if (evaluatorId === "concept.exact-numeric") {
    return { value: mode === "pass" ? 1 : 0 };
  }
  if (evaluatorId === "implementation.trace-match") {
    return mode === "pass" ? { traceStepIds: ["s1", "s2"] } : { traceStepIds: ["s1"] };
  }
  if (evaluatorId === "explanation.structured-rubric") {
    return mode === "pass"
      ? { fields: { claim: "claim-ok", evidence: "evidence-ok" } }
      : { fields: { claim: "" } };
  }
  return mode === "pass" ? { selectedOptionId: "correct" } : { selectedOptionId: "wrong" };
}

export function gradeActivity(args: {
  readonly progress: ProgressV1;
  readonly activityId: string;
  readonly input: unknown;
  readonly delivery: "primary" | "accessible";
  readonly now?: string;
}): { progress: ProgressV1; outcome: "correct" | "incorrect" | "unanswered" } {
  const activity = CURRICULUM_MANIFEST.activities[args.activityId];
  if (!activity) throw new Error(`Unknown activity ${args.activityId}`);
  const spec =
    args.delivery === "primary" ? activity.primaryEvidenceSpec : activity.accessibleEvidenceSpec;

  const result = runEvaluator(
    {
      evaluatorId: spec.evaluator.evaluatorId,
      revision: spec.evaluator.evaluatorRevision,
    },
    args.input,
    spec.evaluator.params,
  );

  const progress = recordActivityEvidence({
    progress: args.progress,
    moduleId: getSliceModule().moduleId,
    activityId: args.activityId,
    patch: {
      outcome: result.outcome,
      explanationOutcome: result.outcome === "incorrect" ? "pending" : "notRequired",
      explanationEvidenceId: result.evidenceId ?? null,
      explanationEvidenceRevision: result.evidenceId ? "1" : null,
      assessedAt: args.now ?? new Date().toISOString(),
      evaluatorId: spec.evaluator.evaluatorId,
      evaluatorRevision: spec.evaluator.evaluatorRevision,
      activityRevision: activity.activityRevision,
    },
  });
  return { progress, outcome: result.outcome };
}

/**
 * Grade an implementation activity via the allowlisted trace-match evaluator.
 * Used by the production implementation lab instead of self-report buttons.
 */
export function gradeImplementationTrace(args: {
  readonly progress: ProgressV1;
  readonly activityId: string;
  readonly traceStepIds: readonly string[];
  readonly delivery?: "primary" | "accessible";
  readonly now?: string;
}): { progress: ProgressV1; outcome: "correct" | "incorrect" | "unanswered" } {
  return gradeActivity({
    progress: args.progress,
    activityId: args.activityId,
    input: { traceStepIds: args.traceStepIds },
    delivery: args.delivery ?? "primary",
    now: args.now,
  });
}

export function submitExplanation(args: {
  readonly progress: ProgressV1;
  readonly activityId: string;
  readonly passed: boolean;
  readonly now?: string;
}): ProgressV1 {
  return recordActivityEvidence({
    progress: args.progress,
    moduleId: getSliceModule().moduleId,
    activityId: args.activityId,
    patch: {
      explanationOutcome: args.passed ? "pass" : "fail",
      explanationEvidenceId: args.passed ? "exp.structured" : null,
      explanationEvidenceRevision: args.passed ? "1" : null,
      assessedAt: args.now ?? new Date().toISOString(),
    },
  });
}

export function finishAttempt(progress: ProgressV1, now = new Date().toISOString()): ProgressV1 {
  const module = getSliceModule();
  let next = completeInProgress({
    progress,
    moduleId: module.moduleId,
    requiredActivityIds: module.activityIds,
    currentRevisions: currentRevisions(module),
    now,
  });

  const decision = masteryForProgress(next);
  const current = next.modules[module.moduleId];
  if (current) {
    next = {
      ...next,
      modules: {
        ...next.modules,
        [module.moduleId]: {
          ...current,
          remediationState: {
            ...current.remediationState,
            conceptFailureCounts: decision.nextConceptFailureCounts,
            pendingRemediationConceptIds: Object.entries(decision.nextConceptFailureCounts)
              .filter(([, count]) => count >= 2)
              .map(([concept]) => concept),
            pendingVariantActivityIds: Object.entries(decision.nextConceptFailureCounts)
              .filter(([, count]) => count >= 2)
              .flatMap(([concept]) =>
                Object.values(CURRICULUM_MANIFEST.variants)
                  .filter((variant) => variant.conceptFamily === concept || variant.conceptTags.includes(concept))
                  .map((variant) => variant.variantId),
              ),
            completedRemediationConceptIds: current.remediationState.completedRemediationConceptIds ?? [],
            passedVariantActivityIds: current.remediationState.passedVariantActivityIds ?? [],
          },
        },
      },
    };
  }
  return next;
}

export function abandonAttempt(progress: ProgressV1, now = new Date().toISOString()): ProgressV1 {
  return abandonInProgress({
    progress,
    moduleId: getSliceModule().moduleId,
    now,
  });
}

export function masteryForProgress(progress: ProgressV1): MasteryDecision {
  const module = getSliceModule();
  const attempt = getLatestCompleteAttempt(progress, module.moduleId, currentRevisions(module));
  const tags = Object.fromEntries(
    module.activityIds.map((id) => [id, CURRICULUM_MANIFEST.activities[id]?.conceptTags ?? []]),
  );
  const remediation = progress.modules[module.moduleId]?.remediationState;
  const counts = remediation?.conceptFailureCounts ?? {};
  const variantConcepts = (remediation?.passedVariantActivityIds ?? []).flatMap((id) => {
    const fromActivity = CURRICULUM_MANIFEST.activities[id]?.conceptTags ?? [];
    if (fromActivity.length > 0) return [...fromActivity];
    const variant =
      CURRICULUM_MANIFEST.variants[id] ??
      Object.values(CURRICULUM_MANIFEST.variants).find(
        (entry) => entry.activityId === id || entry.variantId === id,
      );
    if (!variant) return [] as string[];
    return variant.conceptTags?.length ? [...variant.conceptTags] : [variant.conceptFamily];
  });
  return evaluateMastery({
    attempt,
    requiredActivityIds: module.activityIds,
    activityConceptTags: tags,
    conceptFailureCounts: counts,
    remediationCompleteForConcepts: remediation?.completedRemediationConceptIds ?? [],
    variantPassedForConcepts: Array.from(new Set(variantConcepts.filter(Boolean))),
  });
}

export function latestScore(progress: ProgressV1) {
  const module = getSliceModule();
  const attempt = getLatestCompleteAttempt(progress, module.moduleId, currentRevisions(module));
  if (!attempt) return null;
  return scoreCompleteAttempt(attempt, module.activityIds);
}


export function markRemediationComplete(
  progress: ProgressV1,
  conceptIds: readonly string[],
): ProgressV1 {
  const moduleId = getSliceModule().moduleId;
  const current = progress.modules[moduleId] ?? {
    latestCompleteAttemptId: null,
    inProgressAttempt: null,
    attemptHistory: [],
    remediationState: {
      conceptFailureCounts: {},
      pendingRemediationConceptIds: [],
      pendingVariantActivityIds: [],
      completedRemediationConceptIds: [],
      passedVariantActivityIds: [],
    },
  };
  const completed = Array.from(
    new Set([...(current.remediationState.completedRemediationConceptIds ?? []), ...conceptIds]),
  );
  return {
    ...progress,
    modules: {
      ...progress.modules,
      [moduleId]: {
        ...current,
        remediationState: {
          ...current.remediationState,
          completedRemediationConceptIds: completed,
          pendingRemediationConceptIds: current.remediationState.pendingRemediationConceptIds.filter(
            (id) => !completed.includes(id),
          ),
        },
      },
    },
  };
}

export function markVariantPassed(
  progress: ProgressV1,
  variantActivityIds: readonly string[],
): ProgressV1 {
  const moduleId = getSliceModule().moduleId;
  const current = progress.modules[moduleId];
  if (!current) return progress;
  const passed = Array.from(
    new Set([...(current.remediationState.passedVariantActivityIds ?? []), ...variantActivityIds]),
  );
  return {
    ...progress,
    modules: {
      ...progress.modules,
      [moduleId]: {
        ...current,
        remediationState: {
          ...current.remediationState,
          passedVariantActivityIds: passed,
        },
      },
    },
  };
}

export function gradeDiagnosticAnswers(
  answers: Readonly<Record<string, string | null>>,
): { items: DiagnosticItemResult[]; recommendation: RouteRecommendation } {
  const items: DiagnosticItemResult[] = [];
  for (const item of CURRICULUM_MANIFEST.diagnostic.items.filter((i) => i.required)) {
    const selected = answers[item.itemId];
    if (selected == null || selected === "") {
      items.push({ itemId: item.itemId, domain: item.domain, required: true, correct: null });
      continue;
    }
    const result = runEvaluator(
      {
        evaluatorId: item.primaryEvidenceSpec.evaluator.evaluatorId,
        revision: item.primaryEvidenceSpec.evaluator.evaluatorRevision,
      },
      { selectedOptionId: selected },
      item.primaryEvidenceSpec.evaluator.params,
    );
    items.push({
      itemId: item.itemId,
      domain: item.domain,
      required: true,
      correct: result.outcome === "correct" ? true : result.outcome === "incorrect" ? false : null,
    });
  }
  const evaluation = evaluateDiagnostic(items);
  return { items, recommendation: evaluation.recommendation };
}

export function resetLocalProgress(store: ProgressStore): void {
  store.reset();
}

export type { RouteRecommendation, ProgressV1 };
export { createEmptyProgress, getLatestCompleteAttempt };
