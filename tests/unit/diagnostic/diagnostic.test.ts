import { describe, expect, it } from "vitest";

import {
  chooseRoute,
  evaluateDiagnostic,
  type DiagnosticItemResult,
} from "../../../src/domain/diagnostic";

function fillDomain(
  domain: "math" | "coding",
  pattern: Array<boolean | null>,
): DiagnosticItemResult[] {
  return pattern.map((correct, index) => ({
    itemId: `${domain}-${index}`,
    domain,
    required: true,
    correct,
  }));
}

describe("diagnostic routing", () => {
  it("treats exactly 70% as ready on the full required denominator", () => {
    // 7/10 = 70
    const items = [
      ...fillDomain("math", [true, true, true, true, true, true, true, false, false, false]),
      ...fillDomain("coding", [true, true, true, true, true, true, true, false, false, false]),
    ];
    const result = evaluateDiagnostic(items);
    expect(result.domains.find((d) => d.domain === "math")?.readiness).toBe("ready");
    expect(result.domains.find((d) => d.domain === "math")?.percent).toBe(70);
    expect(result.recommendation).toBe("main");
  });

  it("marks unanswered as 0 and incomplete when a domain has no answers", () => {
    const items = [
      ...fillDomain("math", [true, true, false, null]),
      ...fillDomain("coding", [null, null, null, null]),
    ];
    const result = evaluateDiagnostic(items);
    expect(result.domains.find((d) => d.domain === "coding")?.readiness).toBe("incomplete");
    expect(result.recommendation).toBe("hold");
  });

  it("maps math/coding gap combinations to remedial recommendations", () => {
    const mathGapCodingReady = evaluateDiagnostic([
      ...fillDomain("math", [true, false, false, false]),
      ...fillDomain("coding", [true, true, true, false]),
    ]);
    expect(mathGapCodingReady.recommendation).toBe("remedial-math-then-main");

    const bothGap = evaluateDiagnostic([
      ...fillDomain("math", [true, false, false, false]),
      ...fillDomain("coding", [true, false, false, false]),
    ]);
    expect(bothGap.recommendation).toBe("remedial-both-then-main");
  });

  it("allows override without requiring a stored reason", () => {
    expect(chooseRoute("remedial-math-then-main", "main")).toBe("main");
    expect(chooseRoute("main", null)).toBe("main");
  });
});
