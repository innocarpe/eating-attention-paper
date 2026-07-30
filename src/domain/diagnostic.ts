export type DomainReadiness = "ready" | "gap" | "incomplete";
export type DiagnosticDomain = "math" | "coding";
export type RouteRecommendation =
  | "main"
  | "remedial-math-then-main"
  | "remedial-coding-then-main"
  | "remedial-both-then-main"
  | "hold";

export interface DiagnosticItemResult {
  readonly itemId: string;
  readonly domain: DiagnosticDomain;
  readonly required: boolean;
  /** null means unanswered */
  readonly correct: boolean | null;
}

export interface DomainScore {
  readonly domain: DiagnosticDomain;
  readonly readiness: DomainReadiness;
  readonly correct: number;
  readonly totalRequired: number;
  readonly answeredRequired: number;
  readonly percent: number | null;
}

export interface DiagnosticEvaluation {
  readonly domains: readonly DomainScore[];
  readonly recommendation: RouteRecommendation;
}

const READY_THRESHOLD = 70;

export function scoreDomain(
  domain: DiagnosticDomain,
  items: readonly DiagnosticItemResult[],
): DomainScore {
  const required = items.filter((item) => item.domain === domain && item.required);
  const totalRequired = required.length;
  const answered = required.filter((item) => item.correct !== null);
  const answeredRequired = answered.length;
  if (answeredRequired === 0) {
    return {
      domain,
      readiness: "incomplete",
      correct: 0,
      totalRequired,
      answeredRequired,
      percent: null,
    };
  }
  // unanswered count as 0 in the full required denominator
  const correct = required.reduce((sum, item) => sum + (item.correct === true ? 1 : 0), 0);
  const percent = totalRequired === 0 ? 0 : Math.floor((correct * 100) / totalRequired);
  const readiness: DomainReadiness = percent >= READY_THRESHOLD ? "ready" : "gap";
  return {
    domain,
    readiness,
    correct,
    totalRequired,
    answeredRequired,
    percent,
  };
}

export function recommendRoute(math: DomainScore, coding: DomainScore): RouteRecommendation {
  if (math.readiness === "incomplete" || coding.readiness === "incomplete") {
    return "hold";
  }
  if (math.readiness === "ready" && coding.readiness === "ready") return "main";
  if (math.readiness === "gap" && coding.readiness === "ready") return "remedial-math-then-main";
  if (math.readiness === "ready" && coding.readiness === "gap") return "remedial-coding-then-main";
  return "remedial-both-then-main";
}

export function evaluateDiagnostic(items: readonly DiagnosticItemResult[]): DiagnosticEvaluation {
  const math = scoreDomain("math", items);
  const coding = scoreDomain("coding", items);
  return {
    domains: [math, coding],
    recommendation: recommendRoute(math, coding),
  };
}

/**
 * Learner may override the recommendation. The reason is intentionally not stored.
 */
export function chooseRoute(
  recommendation: RouteRecommendation,
  override: RouteRecommendation | null,
): RouteRecommendation {
  return override ?? recommendation;
}
