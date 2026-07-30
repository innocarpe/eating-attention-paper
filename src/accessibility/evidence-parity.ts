import { getEvaluator } from "../evaluators/registry";
import { isRecord } from "../evaluators/types";

export const DELIVERY_CHANNELS = ["primary", "accessible"] as const;
export type DeliveryChannel = (typeof DELIVERY_CHANNELS)[number];

export interface EvaluatorBinding {
  readonly evaluatorId: string;
  readonly revision: string;
  /**
   * When set, marks a reviewer-approved equivalent evaluator pair across
   * channels. Both channels must share the same non-empty token.
   */
  readonly equivalenceToken?: string;
}

export interface DeliveryEvidenceSpec {
  readonly channel: DeliveryChannel;
  readonly surfaceFamily: string;
  readonly evaluator: EvaluatorBinding;
  /** Optional explicit pass-predicate ID shared across channels. */
  readonly passPredicateId?: string;
  readonly hintLadderId: string;
  readonly remediationId: string;
  readonly variantTransitionId: string;
}

export interface ActivityEvidenceParity {
  readonly activityId: string;
  readonly objectiveId: string;
  readonly difficulty: string;
  readonly primary: DeliveryEvidenceSpec;
  readonly accessible: DeliveryEvidenceSpec;
}

export interface EvidenceParityIssue {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
}

export interface EvidenceParityResult {
  readonly ok: boolean;
  readonly issues: readonly EvidenceParityIssue[];
}

function issue(code: string, message: string, path?: string): EvidenceParityIssue {
  return path === undefined ? { code, message } : { code, message, path };
}

function assertNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function parseEvaluatorBinding(value: unknown, path: string): EvaluatorBinding {
  if (!isRecord(value)) {
    throw new Error(`${path} must be an object.`);
  }
  const evaluatorId = assertNonEmptyString(value.evaluatorId, `${path}.evaluatorId`);
  const revision = assertNonEmptyString(value.revision, `${path}.revision`);
  let equivalenceToken: string | undefined;
  if (value.equivalenceToken !== undefined) {
    equivalenceToken = assertNonEmptyString(value.equivalenceToken, `${path}.equivalenceToken`);
  }
  return { evaluatorId, revision, equivalenceToken };
}

function parseDeliverySpec(value: unknown, expectedChannel: DeliveryChannel, path: string): DeliveryEvidenceSpec {
  if (!isRecord(value)) {
    throw new Error(`${path} must be an object.`);
  }
  const channel = assertNonEmptyString(value.channel, `${path}.channel`);
  if (channel !== expectedChannel) {
    throw new Error(`${path}.channel must be "${expectedChannel}".`);
  }
  const surfaceFamily = assertNonEmptyString(value.surfaceFamily, `${path}.surfaceFamily`);
  const evaluator = parseEvaluatorBinding(value.evaluator, `${path}.evaluator`);
  const hintLadderId = assertNonEmptyString(value.hintLadderId, `${path}.hintLadderId`);
  const remediationId = assertNonEmptyString(value.remediationId, `${path}.remediationId`);
  const variantTransitionId = assertNonEmptyString(
    value.variantTransitionId,
    `${path}.variantTransitionId`,
  );
  let passPredicateId: string | undefined;
  if (value.passPredicateId !== undefined) {
    passPredicateId = assertNonEmptyString(value.passPredicateId, `${path}.passPredicateId`);
  }
  return {
    channel: expectedChannel,
    surfaceFamily,
    evaluator,
    passPredicateId,
    hintLadderId,
    remediationId,
    variantTransitionId,
  };
}

/** Structural parse; throws on malformed specs. */
export function parseActivityEvidenceParity(value: unknown): ActivityEvidenceParity {
  if (!isRecord(value)) {
    throw new Error("ActivityEvidenceParity must be an object.");
  }
  return {
    activityId: assertNonEmptyString(value.activityId, "activityId"),
    objectiveId: assertNonEmptyString(value.objectiveId, "objectiveId"),
    difficulty: assertNonEmptyString(value.difficulty, "difficulty"),
    primary: parseDeliverySpec(value.primary, "primary", "primary"),
    accessible: parseDeliverySpec(value.accessible, "accessible", "accessible"),
  };
}

function evaluatorsEquivalent(
  primary: EvaluatorBinding,
  accessible: EvaluatorBinding,
): { ok: true } | { ok: false; reason: string } {
  const sameId =
    primary.evaluatorId === accessible.evaluatorId &&
    primary.revision === accessible.revision;
  if (sameId) {
    return { ok: true };
  }

  const primaryToken = primary.equivalenceToken;
  const accessibleToken = accessible.equivalenceToken;
  if (
    primaryToken &&
    accessibleToken &&
    primaryToken === accessibleToken &&
    primaryToken.length > 0
  ) {
    return { ok: true };
  }

  return {
    ok: false,
    reason:
      "primary/accessible evaluators differ without a shared equivalenceToken (reviewer-approved equivalent).",
  };
}

/**
 * Assert primary and accessible deliveries share objectiveId, difficulty,
 * pass predicate / equivalent evaluator, and hint/remediation/variant transitions.
 */
export function checkEvidenceParity(
  activity: ActivityEvidenceParity,
  options: {
    /** When true (default), both evaluator bindings must resolve in the registry. */
    readonly requireRegisteredEvaluators?: boolean;
  } = {},
): EvidenceParityResult {
  const requireRegistered = options.requireRegisteredEvaluators !== false;
  const issues: EvidenceParityIssue[] = [];

  if (activity.primary.channel !== "primary") {
    issues.push(issue("channel-mismatch", "primary.channel must be primary.", "primary.channel"));
  }
  if (activity.accessible.channel !== "accessible") {
    issues.push(
      issue("channel-mismatch", "accessible.channel must be accessible.", "accessible.channel"),
    );
  }

  if (activity.objectiveId.trim().length === 0) {
    issues.push(issue("missing-objective", "objectiveId is required."));
  }
  if (activity.difficulty.trim().length === 0) {
    issues.push(issue("missing-difficulty", "difficulty is required."));
  }

  // Both channels inherit the activity-level objectiveId/difficulty — no per-channel override field.
  // Surface families SHOULD differ (visual vs keyboard/table), but are not required to.

  const primaryPred = activity.primary.passPredicateId;
  const accessiblePred = activity.accessible.passPredicateId;
  if (primaryPred || accessiblePred) {
    if (primaryPred !== accessiblePred) {
      issues.push(
        issue(
          "pass-predicate-mismatch",
          "primary and accessible passPredicateId must match when either is set.",
          "passPredicateId",
        ),
      );
    }
  }

  const equivalence = evaluatorsEquivalent(activity.primary.evaluator, activity.accessible.evaluator);
  if (!equivalence.ok) {
    issues.push(issue("evaluator-inequivalent", equivalence.reason, "evaluator"));
  }

  if (activity.primary.hintLadderId !== activity.accessible.hintLadderId) {
    issues.push(
      issue(
        "hint-mismatch",
        "primary and accessible must share hintLadderId.",
        "hintLadderId",
      ),
    );
  }
  if (activity.primary.remediationId !== activity.accessible.remediationId) {
    issues.push(
      issue(
        "remediation-mismatch",
        "primary and accessible must share remediationId.",
        "remediationId",
      ),
    );
  }
  if (activity.primary.variantTransitionId !== activity.accessible.variantTransitionId) {
    issues.push(
      issue(
        "variant-transition-mismatch",
        "primary and accessible must share variantTransitionId.",
        "variantTransitionId",
      ),
    );
  }

  if (requireRegistered) {
    for (const [path, binding] of [
      ["primary.evaluator", activity.primary.evaluator],
      ["accessible.evaluator", activity.accessible.evaluator],
    ] as const) {
      const found = getEvaluator(binding.evaluatorId, binding.revision);
      if (!found) {
        issues.push(
          issue(
            "evaluator-unregistered",
            `Unknown evaluator ${binding.evaluatorId}@${binding.revision}.`,
            path,
          ),
        );
      }
    }
  }

  return { ok: issues.length === 0, issues };
}

export function assertEvidenceParity(
  activity: ActivityEvidenceParity,
  options?: Parameters<typeof checkEvidenceParity>[1],
): void {
  const result = checkEvidenceParity(activity, options);
  if (!result.ok) {
    const summary = result.issues.map((entry) => entry.code).join(", ");
    throw new Error(`Evidence parity failed: ${summary}`);
  }
}

/** Convenience builder for tests and skeleton activities. */
export function createParityPair(args: {
  readonly activityId: string;
  readonly objectiveId: string;
  readonly difficulty: string;
  readonly evaluatorId: string;
  readonly evaluatorRevision?: string;
  readonly accessibleEvaluatorId?: string;
  readonly accessibleEvaluatorRevision?: string;
  readonly equivalenceToken?: string;
  readonly passPredicateId?: string;
  readonly hintLadderId: string;
  readonly remediationId: string;
  readonly variantTransitionId: string;
  readonly primarySurfaceFamily?: string;
  readonly accessibleSurfaceFamily?: string;
}): ActivityEvidenceParity {
  const revision = args.evaluatorRevision ?? "1";
  const accessibleId = args.accessibleEvaluatorId ?? args.evaluatorId;
  const accessibleRevision = args.accessibleEvaluatorRevision ?? revision;
  const token = args.equivalenceToken;
  return {
    activityId: args.activityId,
    objectiveId: args.objectiveId,
    difficulty: args.difficulty,
    primary: {
      channel: "primary",
      surfaceFamily: args.primarySurfaceFamily ?? "visual-widget",
      evaluator: {
        evaluatorId: args.evaluatorId,
        revision,
        equivalenceToken: token,
      },
      passPredicateId: args.passPredicateId,
      hintLadderId: args.hintLadderId,
      remediationId: args.remediationId,
      variantTransitionId: args.variantTransitionId,
    },
    accessible: {
      channel: "accessible",
      surfaceFamily: args.accessibleSurfaceFamily ?? "labeled-table",
      evaluator: {
        evaluatorId: accessibleId,
        revision: accessibleRevision,
        equivalenceToken: token,
      },
      passPredicateId: args.passPredicateId,
      hintLadderId: args.hintLadderId,
      remediationId: args.remediationId,
      variantTransitionId: args.variantTransitionId,
    },
  };
}
