export const RELEASE_STATES = [
  "SOURCE_VERIFIED",
  "PR_PREVIEW",
  "RC",
  "PREDEPLOY_APPROVED",
  "PRODUCTION_DEPLOYED_UNLAUNCHED",
  "POSTDEPLOY_VERIFIED",
  "LAUNCHED",
] as const;

export type ReleaseState = (typeof RELEASE_STATES)[number];
export type FindingSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type FindingDisposition = "open" | "resolved" | "risk-accepted" | "deferred";
export type RetestStatus = "not-run" | "passed" | "failed";

export interface ReleaseFinding {
  id: string;
  severity: FindingSeverity;
  disposition: FindingDisposition;
  evidence: string;
  owner: string;
  retestStatus: RetestStatus;
  publicIssueUrl?: string;
}

export interface ReleaseEvidence {
  sourceVerified?: boolean;
  previewVerified?: boolean;
  rcVerified?: boolean;
  predeployApproved?: boolean;
  productionDeployed?: boolean;
  postdeployVerified?: boolean;
  launchApproved?: boolean;
}

const EVIDENCE_FOR_STATE: Readonly<Record<ReleaseState, keyof ReleaseEvidence>> = {
  SOURCE_VERIFIED: "sourceVerified",
  PR_PREVIEW: "previewVerified",
  RC: "rcVerified",
  PREDEPLOY_APPROVED: "predeployApproved",
  PRODUCTION_DEPLOYED_UNLAUNCHED: "productionDeployed",
  POSTDEPLOY_VERIFIED: "postdeployVerified",
  LAUNCHED: "launchApproved",
};

function hasPublicIssue(finding: ReleaseFinding): boolean {
  if (finding.publicIssueUrl === undefined) {
    return false;
  }

  try {
    const url = new URL(finding.publicIssueUrl);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export function assertFindingRecord(finding: ReleaseFinding): void {
  if (finding.id.trim() === "" || finding.evidence.trim() === "" || finding.owner.trim() === "") {
    throw new Error("Every release finding requires an id, evidence, and accountable owner.");
  }

  if (finding.disposition === "resolved" && finding.retestStatus !== "passed") {
    throw new Error("Resolved findings require passing retest evidence.");
  }

  if (finding.severity === "MEDIUM" && finding.disposition === "risk-accepted" && !hasPublicIssue(finding)) {
    throw new Error("Risk-accepted MEDIUM findings require a public issue URL.");
  }

  if (finding.severity === "LOW" && finding.disposition === "deferred" && !hasPublicIssue(finding)) {
    throw new Error("Deferred LOW findings require a public issue URL.");
  }

  if ((finding.severity === "CRITICAL" || finding.severity === "HIGH") && finding.disposition !== "open" && finding.disposition !== "resolved") {
    throw new Error(`${finding.severity} findings cannot be risk-accepted or deferred.`);
  }
}

export function isBlockingFinding(finding: ReleaseFinding): boolean {
  assertFindingRecord(finding);

  if (finding.disposition === "resolved") {
    return false;
  }
  if (finding.severity === "CRITICAL" || finding.severity === "HIGH") {
    return true;
  }
  if (finding.severity === "MEDIUM") {
    return finding.disposition !== "risk-accepted";
  }
  return finding.disposition !== "deferred";
}

export function hasBlockingFindings(findings: readonly ReleaseFinding[]): boolean {
  return findings.some(isBlockingFinding);
}

/** Only the immediately following state is valid, preventing skipped or circular release flows. */
export function canTransitionRelease(from: ReleaseState, to: ReleaseState): boolean {
  return RELEASE_STATES.indexOf(to) === RELEASE_STATES.indexOf(from) + 1;
}

export function assertReleaseTransition(
  from: ReleaseState,
  to: ReleaseState,
  evidence: ReleaseEvidence,
  findings: readonly ReleaseFinding[] = [],
): void {
  if (!canTransitionRelease(from, to)) {
    throw new Error(`Invalid release transition: ${from} to ${to}.`);
  }

  if (hasBlockingFindings(findings)) {
    throw new Error("Release transition blocked by unresolved findings.");
  }

  const requiredEvidence = EVIDENCE_FOR_STATE[to];
  if (evidence[requiredEvidence] !== true) {
    throw new Error(`Release transition to ${to} requires ${requiredEvidence} evidence.`);
  }
}

export function transitionRelease(
  from: ReleaseState,
  to: ReleaseState,
  evidence: ReleaseEvidence,
  findings: readonly ReleaseFinding[] = [],
): ReleaseState {
  assertReleaseTransition(from, to, evidence, findings);
  return to;
}
