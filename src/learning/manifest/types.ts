/**
 * Locale-neutral learning manifest contracts for Attention 0→100.
 * IDs are English kebab/dotted stable keys. Presentation strings may be Korean.
 * No network/storage and no raw learner bodies live here.
 */

/** Opaque stable identifier (locale-neutral). */
export type StableId = string;

/** Monotonic learning-meaning revision string (e.g. "1"). */
export type Revision = string;

export type ModuleKind =
  | "diagnostic"
  | "remedial"
  | "core"
  | "deep-dive"
  | "capstone";

export type ActivityStage = "concept" | "math" | "implementation" | "explanation";

export type SurfaceFormFamily =
  | "interactive-widget"
  | "labeled-table"
  | "form-sequence"
  | "precomputed-trace"
  | "code-correction"
  | "multiple-choice"
  | "numeric-entry"
  | "structured-rubric";

export type EvidenceDeliveryMode = "primary" | "accessible";

export type DiagnosticDomain = "math" | "coding";

export type RouteEffect =
  | "ready-signal"
  | "gap-signal"
  | "neutral";

/** Learning objective owned by the manifest (not by MDX prose). */
export interface LearningObjective {
  readonly objectiveId: StableId;
  readonly revision: Revision;
  readonly conceptTags: readonly string[];
  /** Presentation title; Korean allowed. */
  readonly title: string;
  readonly description: string;
}

/** Allowlisted evaluator reference; function bodies live in src/evaluators. */
export interface EvaluatorRef {
  readonly evaluatorId: StableId;
  readonly evaluatorRevision: Revision;
  readonly params: Readonly<Record<string, string | number | boolean | readonly string[]>>;
}

/** Delivery-mode evidence specification with parity objective. */
export interface EvidenceSpec {
  readonly mode: EvidenceDeliveryMode;
  readonly surfaceFormFamily: SurfaceFormFamily;
  readonly objectiveId: StableId;
  /** Must equal sibling delivery mode objectiveId for required activities. */
  readonly parityObjectiveId: StableId;
  readonly evaluator: EvaluatorRef;
  readonly fixtureId: StableId;
  readonly fixtureRevision: Revision;
  readonly passPredicateKey: StableId;
}

export interface ActivityDefinition {
  readonly activityId: StableId;
  readonly activityRevision: Revision;
  readonly moduleId: StableId;
  readonly stage: ActivityStage;
  readonly objectiveId: StableId;
  readonly conceptTags: readonly string[];
  readonly required: boolean;
  readonly scorable: boolean;
  readonly estimatedMinutes: number;
  readonly title: string;
  readonly contentKey: string;
  readonly hintIds: readonly StableId[];
  readonly misconceptionIds: readonly StableId[];
  /** Variant pool IDs for remediation after repeated concept failure. */
  readonly variantPool: readonly StableId[];
  readonly primaryEvidenceSpec: EvidenceSpec;
  readonly accessibleEvidenceSpec: EvidenceSpec;
}

export interface SessionPart {
  readonly sessionPartId: StableId;
  readonly estimatedMinutes: number;
  readonly activityIds: readonly StableId[];
}

export interface MasteryGate {
  /** Integer percent threshold; locked plan uses 80. */
  readonly passPercent: number;
  readonly requireWrongAnswerExplanations: boolean;
  readonly consecutiveConceptFailuresBeforeRemediation: number;
}

export interface ModuleDefinition {
  readonly moduleId: StableId;
  readonly moduleRevision: Revision;
  readonly kind: ModuleKind;
  readonly required: boolean;
  /** Blocks core completion path when true (deep-dives must be false). */
  readonly blocksCoreCompletion: boolean;
  readonly title: string;
  readonly description: string;
  readonly englishTerms: readonly string[];
  readonly sourceCitations: readonly string[];
  readonly conceptTags: readonly string[];
  readonly objectiveIds: readonly StableId[];
  readonly prerequisites: readonly StableId[];
  readonly estimatedMinutes: number;
  readonly sessionParts: readonly SessionPart[];
  readonly activityIds: readonly StableId[];
  readonly masteryGate: MasteryGate | null;
  readonly misconceptionRefs: readonly StableId[];
  readonly next: readonly StableId[];
  readonly contentKey: string;
}

export interface DiagnosticItem {
  readonly itemId: StableId;
  readonly itemRevision: Revision;
  readonly domain: DiagnosticDomain;
  readonly conceptTags: readonly string[];
  readonly routeEffect: RouteEffect;
  readonly required: boolean;
  readonly estimatedMinutes: number;
  readonly title: string;
  readonly objectiveId: StableId;
  readonly primaryEvidenceSpec: EvidenceSpec;
  readonly accessibleEvidenceSpec: EvidenceSpec;
}

export interface DiagnosticBank {
  readonly bankId: StableId;
  readonly bankRevision: Revision;
  /** Exact ready threshold percent; locked plan uses 70. */
  readonly readyThresholdPercent: number;
  readonly domains: readonly DiagnosticDomain[];
  readonly items: readonly DiagnosticItem[];
  readonly estimatedMinutes: number;
}

/**
 * Independent variant of a parent activity.
 * Must differ in activityId, fixture, and surface family while sharing objective/concept.
 */
export interface VariantDefinition {
  readonly variantId: StableId;
  readonly variantRevision: Revision;
  /** Concept family key shared with the original required activity. */
  readonly conceptFamily: string;
  readonly objectiveId: StableId;
  readonly conceptTags: readonly string[];
  /** Original required activity this variant remediates. */
  readonly parentActivityId: StableId;
  /** Distinct from parent activityId. */
  readonly activityId: StableId;
  readonly fixtureId: StableId;
  readonly fixtureRevision: Revision;
  readonly surfaceFormFamily: SurfaceFormFamily;
  readonly estimatedMinutes: number;
  readonly title: string;
  readonly evaluator: EvaluatorRef;
  readonly passPredicateKey: StableId;
}

export interface TimeBudgetPolicy {
  /** Main path lower bound (core + diagnostic + mastery overhead), minutes. */
  readonly mainPathMinMinutes: number;
  /** Main path upper bound, minutes. */
  readonly mainPathMaxMinutes: number;
  /** Remedial path upper bound, minutes. */
  readonly remedialMaxMinutes: number;
  readonly sessionMinMinutes: number;
  readonly sessionMaxMinutes: number;
  /**
   * Multiplier applied to core required activity minutes to account for
   * mastery retries/explanations without persisting raw learner bodies.
   */
  readonly masteryOverheadFactor: number;
}

export interface CurriculumManifest {
  readonly schemaVersion: 1;
  readonly manifestRevision: Revision;
  readonly title: string;
  readonly timeBudget: TimeBudgetPolicy;
  readonly objectives: Readonly<Record<StableId, LearningObjective>>;
  readonly modules: Readonly<Record<StableId, ModuleDefinition>>;
  readonly activities: Readonly<Record<StableId, ActivityDefinition>>;
  readonly diagnostic: DiagnosticBank;
  readonly variants: Readonly<Record<StableId, VariantDefinition>>;
}

export interface ManifestValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
}

export interface ManifestValidationResult {
  readonly ok: boolean;
  readonly issues: readonly ManifestValidationIssue[];
}
