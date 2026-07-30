export const PERFORMANCE_BUCKETS = ["under-1s", "1s-to-3s", "over-3s"] as const;
export type PerformanceBucket = (typeof PERFORMANCE_BUCKETS)[number];

export interface AnalyticsPayload {
  pageId: string;
  performanceBucket: PerformanceBucket;
}

export interface AnalyticsEnablementEvidence {
  processorContractVerified: boolean;
  transportSchemaVerified: boolean;
  rawRequestLogsDisabled: boolean;
  edgeAndAccessLogsDisabled: boolean;
  ipUserAgentReferrerExcluded: boolean;
  cookiesAndSessionIdsExcluded: boolean;
  namedOwnerAssigned: boolean;
  dpaVerified: boolean;
  retentionDays: number | null;
}

export interface PrivacyPolicy {
  analytics: {
    enabled: false;
    sdk: null;
    endpoint: null;
  };
  canonicalUrls: "strip-query-and-fragment";
  referrerPolicy: "no-referrer";
  persistedLearnerData: readonly [
    "stable-ids",
    "revisions",
    "outcomes",
    "hint-level",
    "variant-id",
    "local-timestamp",
  ];
  forbiddenPersistedData: readonly [
    "raw-answer",
    "free-explanation",
    "python-code",
    "python-output",
    "error-body",
  ];
  analyticsEnablementEvidence: AnalyticsEnablementEvidence;
}

export const ANALYTICS_ENABLEMENT_EVIDENCE: AnalyticsEnablementEvidence = {
  processorContractVerified: false,
  transportSchemaVerified: false,
  rawRequestLogsDisabled: false,
  edgeAndAccessLogsDisabled: false,
  ipUserAgentReferrerExcluded: false,
  cookiesAndSessionIdsExcluded: false,
  namedOwnerAssigned: false,
  dpaVerified: false,
  retentionDays: null,
};

export const DEFAULT_PRIVACY_POLICY: PrivacyPolicy = {
  analytics: {
    enabled: false,
    sdk: null,
    endpoint: null,
  },
  canonicalUrls: "strip-query-and-fragment",
  referrerPolicy: "no-referrer",
  persistedLearnerData: [
    "stable-ids",
    "revisions",
    "outcomes",
    "hint-level",
    "variant-id",
    "local-timestamp",
  ],
  forbiddenPersistedData: [
    "raw-answer",
    "free-explanation",
    "python-code",
    "python-output",
    "error-body",
  ],
  analyticsEnablementEvidence: ANALYTICS_ENABLEMENT_EVIDENCE,
};

/** Produces a canonical URL without query, fragment, or credentials. */
export function cleanCanonicalUrl(value: string): string {
  const url = new URL(value);
  url.search = "";
  url.hash = "";
  url.username = "";
  url.password = "";
  return url.toString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Analytics is not shipped in v1. This validator defines the only payload that
 * a separately approved processor could accept: a fixed page ID and a coarse
 * performance bucket, with no nested or additional learner-derived fields.
 */
export function assertSafeAnalyticsPayload(
  payload: unknown,
  allowedPageIds: readonly string[],
): asserts payload is AnalyticsPayload {
  if (!isRecord(payload)) {
    throw new Error("Analytics payload must be an object.");
  }

  const keys = Object.keys(payload).sort();
  if (keys.length !== 2 || keys[0] !== "pageId" || keys[1] !== "performanceBucket") {
    throw new Error("Analytics payload contains a forbidden field.");
  }

  if (typeof payload.pageId !== "string" || !allowedPageIds.includes(payload.pageId)) {
    throw new Error("Analytics pageId is not in the fixed allowlist.");
  }

  if (!(PERFORMANCE_BUCKETS as readonly unknown[]).includes(payload.performanceBucket)) {
    throw new Error("Analytics performanceBucket is not an allowed coarse bucket.");
  }
}

export function hasAnalyticsEnablementEvidence(evidence: AnalyticsEnablementEvidence): boolean {
  return (
    evidence.processorContractVerified &&
    evidence.transportSchemaVerified &&
    evidence.rawRequestLogsDisabled &&
    evidence.edgeAndAccessLogsDisabled &&
    evidence.ipUserAgentReferrerExcluded &&
    evidence.cookiesAndSessionIdsExcluded &&
    evidence.namedOwnerAssigned &&
    evidence.dpaVerified &&
    evidence.retentionDays !== null &&
    evidence.retentionDays > 0 &&
    evidence.retentionDays <= 90
  );
}
