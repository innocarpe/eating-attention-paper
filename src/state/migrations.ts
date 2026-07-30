import type { ActivityAttemptEvidence, ModuleAttempt } from "./progress-schema";

/**
 * Reviewer-signed semantic equivalence map.
 * Must cover every required activity/evaluator/explanation evidence key.
 */
export interface SignedEquivalenceMap {
  readonly signedBy: string;
  readonly signedAt: string;
  readonly from: {
    readonly manifestRevision: string;
    readonly moduleRevision: string;
    readonly contentRevision: string;
    readonly evaluatorRegistryRevision: string;
  };
  readonly to: {
    readonly manifestRevision: string;
    readonly moduleRevision: string;
    readonly contentRevision: string;
    readonly evaluatorRegistryRevision: string;
  };
  /** oldActivityId -> new activity evidence seed (no raw bodies). */
  readonly activityMap: Readonly<
    Record<
      string,
      {
        readonly activityId: string;
        readonly activityRevision: string;
        readonly evaluatorId: string;
        readonly evaluatorRevision: string;
        readonly explanationEvidenceRevision: string | null;
      }
    >
  >;
}

export function assertFullEquivalenceCoverage(
  map: SignedEquivalenceMap,
  requiredActivityIds: readonly string[],
): void {
  for (const activityId of requiredActivityIds) {
    if (!map.activityMap[activityId]) {
      throw new Error(`Equivalence map missing required activity ${activityId}.`);
    }
  }
}

export function migrateCompleteAttempt(args: {
  readonly source: ModuleAttempt<"complete">;
  readonly map: SignedEquivalenceMap;
  readonly requiredActivityIds: readonly string[];
  readonly newAttemptId: string;
  readonly now: string;
}): ModuleAttempt<"complete"> {
  assertFullEquivalenceCoverage(args.map, args.requiredActivityIds);
  if (
    args.source.manifestRevision !== args.map.from.manifestRevision ||
    args.source.moduleRevision !== args.map.from.moduleRevision ||
    args.source.contentRevision !== args.map.from.contentRevision ||
    args.source.evaluatorRegistryRevision !== args.map.from.evaluatorRegistryRevision
  ) {
    throw new Error("Source attempt revisions do not match equivalence map.from.");
  }

  const evidence: Record<string, ActivityAttemptEvidence> = {};
  for (const oldActivityId of args.requiredActivityIds) {
    const oldEvidence = args.source.evidence[oldActivityId];
    const mapped = args.map.activityMap[oldActivityId];
    if (!oldEvidence || !mapped) {
      throw new Error(`Cannot migrate incomplete coverage for ${oldActivityId}.`);
    }
    evidence[mapped.activityId] = {
      activityId: mapped.activityId,
      activityRevision: mapped.activityRevision,
      evaluatorId: mapped.evaluatorId,
      evaluatorRevision: mapped.evaluatorRevision,
      outcome: oldEvidence.outcome,
      explanationEvidenceId: oldEvidence.explanationEvidenceId,
      explanationEvidenceRevision: mapped.explanationEvidenceRevision,
      explanationOutcome: oldEvidence.explanationOutcome,
      hintLevel: oldEvidence.hintLevel,
      variantId: oldEvidence.variantId,
      assessedAt: oldEvidence.assessedAt,
    };
  }

  return {
    attemptId: args.newAttemptId,
    moduleId: args.source.moduleId,
    status: "complete",
    manifestRevision: args.map.to.manifestRevision,
    moduleRevision: args.map.to.moduleRevision,
    contentRevision: args.map.to.contentRevision,
    evaluatorRegistryRevision: args.map.to.evaluatorRegistryRevision,
    startedAt: args.now,
    completedOrAbandonedAt: args.now,
    evidence,
    migratedFromAttemptId: args.source.attemptId,
  };
}
