import { DEFAULT_PRIVACY_POLICY, hasAnalyticsEnablementEvidence } from "../privacy/policy";
import { RELEASE_STATES, type ReleaseState } from "./contracts";

export type ReadinessStatus = "implemented" | "configured-pending" | "not-evidenced" | "blocked";

export interface ReadinessItem {
  readonly id: string;
  readonly title: string;
  readonly status: ReadinessStatus;
  readonly detail: string;
}

export interface ReleaseReadinessReport {
  readonly generatedAt: string;
  readonly launchAllowed: boolean;
  readonly currentMaxState: ReleaseState;
  readonly items: readonly ReadinessItem[];
  readonly publicClaim: string;
}

/**
 * Human/resource readiness is intentionally fail-closed in-repo.
 * Filling docs/validation/resource-register.json is required before launch claims.
 * Browser bundle must not depend on filesystem reads, so this stays constant unless
 * tests inject an override.
 */
let resourcesAssignedOverride: boolean | null = null;

export function __setResourcesAssignedForTests(value: boolean | null): void {
  resourcesAssignedOverride = value;
}

function resourcesReady(): boolean {
  if (resourcesAssignedOverride != null) return resourcesAssignedOverride;
  // Default repository state: unassigned.
  return false;
}

export function buildReleaseReadinessReport(now = new Date().toISOString()): ReleaseReadinessReport {
  const items: ReadinessItem[] = [
    {
      id: "source-verified",
      title: "Source build/test/lint",
      status: "implemented",
      detail: "Local npm check/lint/test/build contracts exist.",
    },
    {
      id: "origin-contracts",
      title: "Distinct production/preview/RC origin contracts",
      status: "configured-pending",
      detail: "Code and workflows enforce pairwise distinct HTTPS origins; provider vars still required.",
    },
    {
      id: "sandbox",
      title: "Hostile Pyodide containment spike",
      status: "implemented",
      detail: "Automated unit/e2e coverage exists; multi-browser signed memo still separate.",
    },
    {
      id: "learning-contracts",
      title: "Manifest/mastery/attempt contracts",
      status: "implemented",
      detail: "CRIT-P1-003 regressions and vertical slice are in-repo.",
    },
    {
      id: "capstone-template",
      title: "Capstone template + evidence semantics",
      status: "implemented",
      detail: "Template and self/reviewed evaluator exist; no auto-fetch of GitHub repos.",
    },
    {
      id: "analytics-off",
      title: "Analytics default off",
      status: DEFAULT_PRIVACY_POLICY.analytics.enabled
        ? "blocked"
        : hasAnalyticsEnablementEvidence(DEFAULT_PRIVACY_POLICY.analyticsEnablementEvidence)
          ? "configured-pending"
          : "implemented",
      detail: "No SDK/endpoint shipped; enablement evidence incomplete by design.",
    },
    {
      id: "human-resources",
      title: "Reviewers / AT / learners assigned",
      status: resourcesReady() ? "implemented" : "not-evidenced",
      detail: resourcesReady()
        ? "Resource register filled."
        : "docs/validation/resource-register.json still marks roles unassigned.",
    },
    {
      id: "production-deploy",
      title: "Production deploy + postdeploy verified",
      status: "not-evidenced",
      detail: "No signed production artifact/postdeploy receipt in this workspace.",
    },
  ];

  const launchAllowed = items.every((item) => item.status === "implemented");

  return {
    generatedAt: now,
    launchAllowed,
    currentMaxState: launchAllowed ? "LAUNCHED" : RELEASE_STATES[0],
    items,
    publicClaim:
      "이 저장소는 Attention 0→100 학습 경험의 구현 중 오픈소스 기반이며, 독립 검토·실사용자 검증·프로덕션 출시 완료를 주장하지 않는다.",
  };
}
