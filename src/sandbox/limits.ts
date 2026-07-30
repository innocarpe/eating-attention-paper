/**
 * Immutable resource and timing caps for the hostile Pyodide sandbox (M0B).
 * Raising any of these values requires a new security/performance review.
 */

/** Maximum UTF-8 byte length of learner Python source accepted per RUN. */
export const CODE_MAX_BYTES = 32 * 1024;

/** Maximum number of numeric elements in any single input or output value. */
export const MAX_NUMERIC_ELEMENTS = 10_000;

/**
 * Wall-clock budget for BOOTING → READY (runtime + NumPy + denial self-check).
 * Separate from the per-run execution deadline.
 */
export const READINESS_BUDGET_MS = 30_000;

/** Wall-clock deadline from valid RUN dequeue to forced termination. */
export const EXECUTION_DEADLINE_MS = 3_000;

/**
 * Observed termination target after an execution deadline fires, including
 * scheduler slack. Controllers SHOULD complete kill/recreate within this window.
 */
export const OBSERVED_TERMINATION_TARGET_MS = 3_250;

/** Wire protocol version shared by parent↔frame and frame↔worker envelopes. */
export const PROTOCOL_VERSION = 1 as const;

/** Pinned jsDelivr base for Pyodide 314.0.3 + NumPy boot assets (BOOT only). */
export const PINNED_PYODIDE_CDN_BASE =
  "https://cdn.jsdelivr.net/pyodide/v314.0.3/full/" as const;

/** Frozen snapshot of every hard cap for tests and diagnostics (no bodies). */
export const SANDBOX_LIMITS = Object.freeze({
  CODE_MAX_BYTES,
  MAX_NUMERIC_ELEMENTS,
  READINESS_BUDGET_MS,
  EXECUTION_DEADLINE_MS,
  OBSERVED_TERMINATION_TARGET_MS,
  PROTOCOL_VERSION,
  PINNED_PYODIDE_CDN_BASE,
} as const);

export type SandboxLimits = typeof SANDBOX_LIMITS;
