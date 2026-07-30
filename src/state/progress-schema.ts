export const PROGRESS_SCHEMA_VERSION = 1 as const;

export type AttemptStatus = "inProgress" | "complete" | "abandoned";
export type ActivityOutcome = "correct" | "incorrect" | "unanswered";
export type ExplanationOutcome = "pass" | "fail" | "notRequired" | "pending";

export interface ActivityAttemptEvidence {
  readonly activityId: string;
  readonly activityRevision: string;
  readonly evaluatorId: string;
  readonly evaluatorRevision: string;
  readonly outcome: ActivityOutcome;
  readonly explanationEvidenceId: string | null;
  readonly explanationEvidenceRevision: string | null;
  readonly explanationOutcome: ExplanationOutcome;
  readonly hintLevel: number;
  readonly variantId: string | null;
  readonly assessedAt: string | null;
}

export interface ModuleAttempt<S extends AttemptStatus = AttemptStatus> {
  readonly attemptId: string;
  readonly moduleId: string;
  readonly status: S;
  readonly manifestRevision: string;
  readonly moduleRevision: string;
  readonly contentRevision: string;
  readonly evaluatorRegistryRevision: string;
  readonly startedAt: string;
  readonly completedOrAbandonedAt: string | null;
  readonly evidence: Readonly<Record<string, ActivityAttemptEvidence>>;
  readonly migratedFromAttemptId: string | null;
}

export interface RemediationState {
  readonly conceptFailureCounts: Readonly<Record<string, number>>;
  readonly pendingRemediationConceptIds: readonly string[];
  readonly pendingVariantActivityIds: readonly string[];
  readonly completedRemediationConceptIds: readonly string[];
  readonly passedVariantActivityIds: readonly string[];
}

export interface ModuleProgress {
  readonly latestCompleteAttemptId: string | null;
  readonly inProgressAttempt: ModuleAttempt<"inProgress"> | null;
  readonly attemptHistory: readonly ModuleAttempt<"complete" | "abandoned">[];
  readonly remediationState: RemediationState;
}

export interface ProgressV1 {
  readonly schemaVersion: typeof PROGRESS_SCHEMA_VERSION;
  readonly manifestRevision: string;
  readonly modules: Readonly<Record<string, ModuleProgress>>;
}

export function emptyRemediationState(): RemediationState {
  return {
    conceptFailureCounts: {},
    pendingRemediationConceptIds: [],
    pendingVariantActivityIds: [],
    completedRemediationConceptIds: [],
    passedVariantActivityIds: [],
  };
}

export function emptyModuleProgress(): ModuleProgress {
  return {
    latestCompleteAttemptId: null,
    inProgressAttempt: null,
    attemptHistory: [],
    remediationState: emptyRemediationState(),
  };
}

export function createEmptyProgress(manifestRevision: string): ProgressV1 {
  return {
    schemaVersion: PROGRESS_SCHEMA_VERSION,
    manifestRevision,
    modules: {},
  };
}

/** Privacy guard: persisted JSON must never include these raw learner body keys. */
export const FORBIDDEN_PROGRESS_KEYS = [
  "answer",
  "answers",
  "rawAnswer",
  "explanation",
  "freeExplanation",
  "code",
  "output",
  "stdout",
  "stderr",
  "errorBody",
  "python",
] as const;

export function assertNoRawLearnerBodies(value: unknown, path = "progress"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoRawLearnerBodies(item, `${path}[${index}]`));
    return;
  }
  if (typeof value !== "object" || value === null) {
    return;
  }
  // conceptFailureCounts may use concept tag keys like "explanation"; those are map keys, not body fields.
  const skipKeyScan = path.endsWith(".conceptFailureCounts");
  for (const [key, nested] of Object.entries(value)) {
    if (!skipKeyScan && (FORBIDDEN_PROGRESS_KEYS as readonly string[]).includes(key)) {
      throw new Error(`Forbidden learner body key "${key}" at ${path}.`);
    }
    assertNoRawLearnerBodies(nested, `${path}.${key}`);
  }
}
