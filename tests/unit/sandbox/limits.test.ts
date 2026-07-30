import { describe, expect, it } from "vitest";

import {
  CODE_MAX_BYTES,
  EXECUTION_DEADLINE_MS,
  MAX_NUMERIC_ELEMENTS,
  OBSERVED_TERMINATION_TARGET_MS,
  PINNED_PYODIDE_CDN_BASE,
  PROTOCOL_VERSION,
  READINESS_BUDGET_MS,
  SANDBOX_LIMITS,
} from "../../../src/sandbox/limits";

describe("sandbox limits", () => {
  it("locks the approved M0B resource and timing caps", () => {
    expect(CODE_MAX_BYTES).toBe(32 * 1024);
    expect(MAX_NUMERIC_ELEMENTS).toBe(10_000);
    expect(READINESS_BUDGET_MS).toBe(30_000);
    expect(EXECUTION_DEADLINE_MS).toBe(3_000);
    expect(OBSERVED_TERMINATION_TARGET_MS).toBe(3_250);
    expect(PROTOCOL_VERSION).toBe(1);
    expect(PINNED_PYODIDE_CDN_BASE).toBe(
      "https://cdn.jsdelivr.net/pyodide/v314.0.3/full/",
    );
    expect(SANDBOX_LIMITS.EXECUTION_DEADLINE_MS).toBe(3_000);
  });

  it("keeps the observed termination target above the execution deadline", () => {
    expect(OBSERVED_TERMINATION_TARGET_MS).toBeGreaterThan(EXECUTION_DEADLINE_MS);
    expect(OBSERVED_TERMINATION_TARGET_MS - EXECUTION_DEADLINE_MS).toBeLessThanOrEqual(500);
  });
});
