import {
  emptyModuleProgress,
  type ActivityAttemptEvidence,
  type ActivityOutcome,
  type ExplanationOutcome,
  type ModuleAttempt,
  type ModuleProgress,
  type ProgressV1,
} from "./progress-schema";
import { isAttemptCurrent, type RevisionSnapshot } from "./revision-policy";
import { migrateCompleteAttempt, type SignedEquivalenceMap } from "./migrations";

export class AttemptError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "AttemptError";
    this.code = code;
  }
}

export interface RequiredActivitySeed {
  readonly activityId: string;
  readonly activityRevision: string;
  readonly evaluatorId: string;
  readonly evaluatorRevision: string;
  readonly conceptTags?: readonly string[];
}

type MutableProgress = {
  schemaVersion: ProgressV1["schemaVersion"];
  manifestRevision: string;
  modules: Record<string, ModuleProgress>;
};

function cloneProgress(progress: ProgressV1): MutableProgress {
  return structuredClone(progress) as MutableProgress;
}

function freezeProgress(progress: MutableProgress): ProgressV1 {
  return progress as ProgressV1;
}

function moduleOf(progress: ProgressV1, moduleId: string): ModuleProgress {
  return progress.modules[moduleId] ?? emptyModuleProgress();
}

function initialEvidence(seeds: readonly RequiredActivitySeed[]): Record<string, ActivityAttemptEvidence> {
  const evidence: Record<string, ActivityAttemptEvidence> = {};
  for (const seed of seeds) {
    evidence[seed.activityId] = {
      activityId: seed.activityId,
      activityRevision: seed.activityRevision,
      evaluatorId: seed.evaluatorId,
      evaluatorRevision: seed.evaluatorRevision,
      outcome: "unanswered",
      explanationEvidenceId: null,
      explanationEvidenceRevision: null,
      explanationOutcome: "notRequired",
      hintLevel: 0,
      variantId: null,
      assessedAt: null,
    };
  }
  return evidence;
}

export function createAttemptId(randomUuid: () => string = () => crypto.randomUUID()): string {
  return randomUuid();
}

export function startAttempt(args: {
  readonly progress: ProgressV1;
  readonly moduleId: string;
  readonly revisions: RevisionSnapshot;
  readonly requiredActivities: readonly RequiredActivitySeed[];
  readonly now: string;
  readonly attemptId?: string;
  readonly abandonExistingInProgress?: boolean;
}): ProgressV1 {
  const next = cloneProgress(args.progress);
  const current = moduleOf(next, args.moduleId);
  let history = current.attemptHistory;
  if (current.inProgressAttempt) {
    if (!args.abandonExistingInProgress) {
      throw new AttemptError("in-progress-exists", "Module already has an in-progress attempt.");
    }
    history = [
      ...history,
      {
        ...current.inProgressAttempt,
        status: "abandoned",
        completedOrAbandonedAt: args.now,
      },
    ];
  }
  const attempt: ModuleAttempt<"inProgress"> = {
    attemptId: args.attemptId ?? createAttemptId(),
    moduleId: args.moduleId,
    status: "inProgress",
    manifestRevision: args.revisions.manifestRevision,
    moduleRevision: args.revisions.moduleRevision,
    contentRevision: args.revisions.contentRevision,
    evaluatorRegistryRevision: args.revisions.evaluatorRegistryRevision,
    startedAt: args.now,
    completedOrAbandonedAt: null,
    evidence: initialEvidence(args.requiredActivities),
    migratedFromAttemptId: null,
  };
  next.modules = {
    ...next.modules,
    [args.moduleId]: {
      ...current,
      inProgressAttempt: attempt,
      attemptHistory: history,
    },
  };
  return freezeProgress(next);
}

export function recordActivityEvidence(args: {
  readonly progress: ProgressV1;
  readonly moduleId: string;
  readonly activityId: string;
  readonly patch: Partial<
    Pick<
      ActivityAttemptEvidence,
      | "outcome"
      | "explanationEvidenceId"
      | "explanationEvidenceRevision"
      | "explanationOutcome"
      | "hintLevel"
      | "variantId"
      | "assessedAt"
      | "activityRevision"
      | "evaluatorId"
      | "evaluatorRevision"
    >
  >;
}): ProgressV1 {
  const next = cloneProgress(args.progress);
  const current = moduleOf(next, args.moduleId);
  const attempt = current.inProgressAttempt;
  if (!attempt) throw new AttemptError("no-in-progress", "No in-progress attempt.");
  const existing = attempt.evidence[args.activityId];
  if (!existing) throw new AttemptError("unknown-activity", `Activity ${args.activityId} not in attempt.`);
  const updated: ModuleAttempt<"inProgress"> = {
    ...attempt,
    evidence: {
      ...attempt.evidence,
      [args.activityId]: {
        ...existing,
        ...args.patch,
        activityId: existing.activityId,
      },
    },
  };
  next.modules = {
    ...next.modules,
    [args.moduleId]: {
      ...current,
      inProgressAttempt: updated,
    },
  };
  return freezeProgress(next);
}

export function abandonInProgress(args: {
  readonly progress: ProgressV1;
  readonly moduleId: string;
  readonly now: string;
}): ProgressV1 {
  const next = cloneProgress(args.progress);
  const current = moduleOf(next, args.moduleId);
  if (!current.inProgressAttempt) return freezeProgress(next);
  const abandoned: ModuleAttempt<"abandoned"> = {
    ...current.inProgressAttempt,
    status: "abandoned",
    completedOrAbandonedAt: args.now,
  };
  next.modules = {
    ...next.modules,
    [args.moduleId]: {
      ...current,
      inProgressAttempt: null,
      attemptHistory: [...current.attemptHistory, abandoned],
    },
  };
  return freezeProgress(next);
}

function assertCompletable(
  attempt: ModuleAttempt<"inProgress">,
  requiredActivityIds: readonly string[],
  current: RevisionSnapshot,
): void {
  if (!isAttemptCurrent(attempt, current)) {
    throw new AttemptError("stale-attempt", "In-progress attempt revisions are stale.");
  }
  const ids = Object.keys(attempt.evidence);
  if (ids.length !== requiredActivityIds.length) {
    throw new AttemptError("evidence-count", "Attempt evidence count mismatch.");
  }
  const set = new Set(ids);
  for (const id of requiredActivityIds) {
    if (!set.has(id)) throw new AttemptError("missing-evidence", `Missing evidence for ${id}.`);
    if (!attempt.evidence[id]) throw new AttemptError("missing-evidence", `Missing evidence for ${id}.`);
  }
  if (set.size !== ids.length) {
    throw new AttemptError("duplicate-evidence", "Duplicate evidence keys.");
  }
}

export function completeInProgress(args: {
  readonly progress: ProgressV1;
  readonly moduleId: string;
  readonly requiredActivityIds: readonly string[];
  readonly currentRevisions: RevisionSnapshot;
  readonly now: string;
}): ProgressV1 {
  const next = cloneProgress(args.progress);
  const current = moduleOf(next, args.moduleId);
  const attempt = current.inProgressAttempt;
  if (!attempt) throw new AttemptError("no-in-progress", "No in-progress attempt.");
  assertCompletable(attempt, args.requiredActivityIds, args.currentRevisions);
  const completed: ModuleAttempt<"complete"> = {
    ...attempt,
    status: "complete",
    completedOrAbandonedAt: args.now,
  };
  next.modules = {
    ...next.modules,
    [args.moduleId]: {
      ...current,
      inProgressAttempt: null,
      latestCompleteAttemptId: completed.attemptId,
      attemptHistory: [...current.attemptHistory, completed],
    },
  };
  return freezeProgress(next);
}

export function getLatestCompleteAttempt(
  progress: ProgressV1,
  moduleId: string,
  currentRevisions: RevisionSnapshot,
): ModuleAttempt<"complete"> | null {
  const mod = progress.modules[moduleId];
  if (!mod?.latestCompleteAttemptId) return null;
  const found = mod.attemptHistory.find(
    (a): a is ModuleAttempt<"complete"> =>
      a.attemptId === mod.latestCompleteAttemptId && a.status === "complete",
  );
  if (!found) return null;
  if (!isAttemptCurrent(found, currentRevisions)) return null;
  return found;
}

export function scoreCompleteAttempt(
  attempt: ModuleAttempt<"complete">,
  requiredActivityIds: readonly string[],
): { correct: number; total: number; percent: number; mastered: boolean } {
  let correct = 0;
  for (const id of requiredActivityIds) {
    const evidence = attempt.evidence[id];
    if (!evidence) throw new AttemptError("missing-evidence", `Missing ${id}`);
    if (evidence.outcome === "correct") correct += 1;
  }
  const total = requiredActivityIds.length;
  const percent = total === 0 ? 0 : Math.floor((correct * 100) / total);
  // integer compare correct*100 >= total*80
  const mastered = correct * 100 >= total * 80;
  return { correct, total, percent, mastered };
}

export function applySignedMigration(args: {
  readonly progress: ProgressV1;
  readonly moduleId: string;
  readonly sourceAttemptId: string;
  readonly map: SignedEquivalenceMap;
  readonly requiredActivityIds: readonly string[];
  readonly newAttemptId: string;
  readonly now: string;
}): ProgressV1 {
  const next = cloneProgress(args.progress);
  const current = moduleOf(next, args.moduleId);
  const source = current.attemptHistory.find(
    (a): a is ModuleAttempt<"complete"> => a.attemptId === args.sourceAttemptId && a.status === "complete",
  );
  if (!source) throw new AttemptError("source-missing", "Source complete attempt not found.");
  const migrated = migrateCompleteAttempt({
    source,
    map: args.map,
    requiredActivityIds: args.requiredActivityIds,
    newAttemptId: args.newAttemptId,
    now: args.now,
  });
  next.modules = {
    ...next.modules,
    [args.moduleId]: {
      ...current,
      latestCompleteAttemptId: migrated.attemptId,
      attemptHistory: [...current.attemptHistory, migrated],
    },
  };
  next.manifestRevision = args.map.to.manifestRevision;
  return freezeProgress(next);
}

export type { ActivityOutcome, ExplanationOutcome };
