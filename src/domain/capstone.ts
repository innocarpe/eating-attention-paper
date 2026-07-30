export type CapstoneArea = "implementation" | "explanation" | "critique";
export type CapstoneEvidenceLevel = "none" | "self-assessed" | "reviewed";

export interface CapstoneAreaScore {
  readonly area: CapstoneArea;
  /** Rubric 0..4; pass threshold is >= 3 */
  readonly score: number;
  readonly evidencePath: string;
}

export interface CapstoneSelfAssessment {
  readonly repositoryUrl: string;
  readonly commitSha: string;
  readonly areas: readonly CapstoneAreaScore[];
}

export interface CapstoneReviewRecord {
  readonly repositoryUrl: string;
  readonly commitSha: string;
  readonly reviewerId: string;
  readonly reviewedAt: string;
  readonly rubricRevision: string;
  readonly evidencePath: string;
  readonly areas: readonly CapstoneAreaScore[];
}

const SHA_RE = /^[0-9a-f]{7,64}$/i;
const BRANCH_HINT_RE = /\/tree\/|\/blob\/|@|heads\//i;

function isPublicRepoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname.length > 0 && !BRANCH_HINT_RE.test(url);
  } catch {
    return false;
  }
}

function areasPass(areas: readonly CapstoneAreaScore[]): boolean {
  const byArea = new Map(areas.map((a) => [a.area, a]));
  for (const area of ["implementation", "explanation", "critique"] as const) {
    const row = byArea.get(area);
    if (!row || row.score < 3 || !row.evidencePath.trim()) return false;
  }
  return true;
}

export function evaluateCapstoneEvidence(args: {
  readonly selfAssessment?: CapstoneSelfAssessment | null;
  readonly review?: CapstoneReviewRecord | null;
}): {
  readonly level: CapstoneEvidenceLevel;
  readonly complete: boolean;
  readonly label: "미완" | "자기평가 완주" | "검토 완료";
  readonly reasons: readonly string[];
} {
  const reasons: string[] = [];
  const self = args.selfAssessment;
  if (!self) {
    return { level: "none", complete: false, label: "미완", reasons: ["self-assessment missing"] };
  }
  if (!isPublicRepoUrl(self.repositoryUrl)) {
    reasons.push("repository URL must be https and must not be branch-only");
  }
  if (!SHA_RE.test(self.commitSha) || self.commitSha.length < 40) {
    // require full immutable sha
    reasons.push("commitSha must be a full immutable git SHA");
  }
  if (!areasPass(self.areas)) {
    reasons.push("each area needs score >= 3 and evidence path");
  }
  if (reasons.length > 0) {
    return { level: "none", complete: false, label: "미완", reasons };
  }

  const review = args.review;
  if (
    review &&
    review.repositoryUrl === self.repositoryUrl &&
    review.commitSha === self.commitSha &&
    review.reviewerId.trim() &&
    review.reviewedAt.trim() &&
    review.rubricRevision.trim() &&
    review.evidencePath.trim() &&
    areasPass(review.areas)
  ) {
    return { level: "reviewed", complete: true, label: "검토 완료", reasons: [] };
  }

  return { level: "self-assessed", complete: true, label: "자기평가 완주", reasons: [] };
}
