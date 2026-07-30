import { describe, expect, it } from "vitest";

import { buildReleaseReadinessReport } from "../../../src/release/readiness";

describe("release readiness report", () => {
  it("stays honest: launch is blocked without human/production evidence", () => {
    const report = buildReleaseReadinessReport("2026-07-30T00:00:00.000Z");
    expect(report.launchAllowed).toBe(false);
    expect(report.items.some((i) => i.id === "human-resources" && i.status === "not-evidenced")).toBe(true);
    expect(report.items.some((i) => i.id === "production-deploy" && i.status === "not-evidenced")).toBe(true);
    expect(report.items.some((i) => i.id === "analytics-off" && i.status === "implemented")).toBe(true);
    expect(report.publicClaim).toMatch(/출시 완료를 주장하지 않는다/);
  });
});
