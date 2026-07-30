/**
 * Deterministic evaluator contracts for locale-neutral learning activities.
 * Evaluators MUST NOT use randomness, network I/O, or wall-clock time in scoring.
 * Results MUST NOT embed raw learner answer bodies for persistence.
 */

export const EVALUATION_OUTCOMES = ["correct", "incorrect", "unanswered"] as const;
export type EvaluationOutcome = (typeof EVALUATION_OUTCOMES)[number];

/** Privacy-safe evaluation product. Never includes raw free text or code bodies. */
export interface EvaluationResult {
  outcome: EvaluationOutcome;
  /** Stable evidence kind / fixture ID when an answer was assessed. */
  evidenceId?: string;
  /** Machine-oriented diagnostic codes only (e.g. "missing-field:claim"). */
  notes?: string;
}

/**
 * Declarative params carried on activities. Nested structures are allowed for
 * numeric fixtures; free-form learner prose is never a param value.
 */
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export type EvaluatorParams = { readonly [key: string]: JsonValue };

export type ParamsValidator<TParams> = (params: unknown) => TParams;

/**
 * Canonical evaluator definition. `evaluate` is pure with respect to wall clock
 * and external state: same (input, params) → same result.
 */
export interface EvaluatorDefinition<TParams = EvaluatorParams, TInput = unknown> {
  readonly evaluatorId: string;
  readonly revision: string;
  readonly validateParams: ParamsValidator<TParams>;
  evaluate(input: TInput, params: TParams): EvaluationResult;
}

export interface EvaluatorRef {
  readonly evaluatorId: string;
  readonly revision: string;
}

export function isEvaluationOutcome(value: unknown): value is EvaluationOutcome {
  return (
    value === "correct" || value === "incorrect" || value === "unanswered"
  );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** True when the learner left the activity blank / skipped. */
export function isBlankInput(input: unknown): boolean {
  if (input === null || input === undefined) {
    return true;
  }
  if (typeof input === "string") {
    return input.trim().length === 0;
  }
  if (Array.isArray(input)) {
    return input.length === 0;
  }
  if (isRecord(input)) {
    const keys = Object.keys(input);
    if (keys.length === 0) {
      return true;
    }
    // Common wrapper shapes used by skeleton activities.
    if ("value" in input && isBlankInput(input.value)) {
      return true;
    }
    if ("selectedOptionId" in input && isBlankInput(input.selectedOptionId)) {
      return true;
    }
    if ("selectedOptionIds" in input && isBlankInput(input.selectedOptionIds)) {
      return true;
    }
    if ("order" in input && isBlankInput(input.order)) {
      return true;
    }
    if ("matrix" in input && isBlankInput(input.matrix)) {
      return true;
    }
    if ("shape" in input && isBlankInput(input.shape)) {
      return true;
    }
    if ("result" in input && isBlankInput(input.result)) {
      return true;
    }
    if ("values" in input && isBlankInput(input.values)) {
      return true;
    }
    if ("fields" in input && isBlankInput(input.fields)) {
      return true;
    }
    if ("traceStepIds" in input && isBlankInput(input.traceStepIds)) {
      return true;
    }
    if ("choiceId" in input && isBlankInput(input.choiceId)) {
      return true;
    }
  }
  return false;
}

export function unanswered(notes = "unanswered"): EvaluationResult {
  return { outcome: "unanswered", notes };
}

export function correct(evidenceId?: string, notes?: string): EvaluationResult {
  const result: EvaluationResult = { outcome: "correct" };
  if (evidenceId !== undefined) {
    result.evidenceId = evidenceId;
  }
  if (notes !== undefined) {
    result.notes = notes;
  }
  return result;
}

export function incorrect(evidenceId?: string, notes?: string): EvaluationResult {
  const result: EvaluationResult = { outcome: "incorrect" };
  if (evidenceId !== undefined) {
    result.evidenceId = evidenceId;
  }
  if (notes !== undefined) {
    result.notes = notes;
  }
  return result;
}

export function assertFiniteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return value;
}

export function assertNonNegativeNumber(value: unknown, label: string): number {
  const n = assertFiniteNumber(value, label);
  if (n < 0) {
    throw new Error(`${label} must be >= 0.`);
  }
  return n;
}

export function assertString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

export function assertStringArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0 || !value.every((v) => typeof v === "string")) {
    throw new Error(`${label} must be a non-empty string array.`);
  }
  return value as readonly string[];
}

export function assertNumberMatrix(value: unknown, label: string): readonly (readonly number[])[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must be a non-empty matrix.`);
  }
  const matrix: number[][] = [];
  let width: number | null = null;
  for (let r = 0; r < value.length; r += 1) {
    const row = value[r];
    if (!Array.isArray(row) || row.length === 0) {
      throw new Error(`${label} row ${r} must be a non-empty array.`);
    }
    if (width === null) {
      width = row.length;
    } else if (row.length !== width) {
      throw new Error(`${label} must be rectangular.`);
    }
    const nums: number[] = [];
    for (let c = 0; c < row.length; c += 1) {
      nums.push(assertFiniteNumber(row[c], `${label}[${r}][${c}]`));
    }
    matrix.push(nums);
  }
  return matrix;
}

export function assertNumberVector(value: unknown, label: string): readonly number[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must be a non-empty number array.`);
  }
  return value.map((entry, index) => assertFiniteNumber(entry, `${label}[${index}]`));
}

/** Absolute tolerance comparison; both sides must be finite. */
export function withinTolerance(actual: number, expected: number, tolerance: number): boolean {
  const delta = Math.abs(actual - expected);
  if (delta <= tolerance) {
    return true;
  }
  // Decimal boundaries such as expected=1, tolerance=0.01, actual=1.01 can exceed
  // the nominal tolerance by a few ULPs under IEEE-754 subtraction.
  const ulpSlack =
    Number.EPSILON * 8 * Math.max(1, Math.abs(actual), Math.abs(expected), Math.abs(tolerance));
  return delta <= tolerance + ulpSlack;
}

export function vectorsWithinTolerance(
  actual: readonly number[],
  expected: readonly number[],
  tolerance: number,
): boolean {
  if (actual.length !== expected.length) {
    return false;
  }
  for (let i = 0; i < actual.length; i += 1) {
    if (!withinTolerance(actual[i]!, expected[i]!, tolerance)) {
      return false;
    }
  }
  return true;
}

export function matricesWithinTolerance(
  actual: readonly (readonly number[])[],
  expected: readonly (readonly number[])[],
  tolerance: number,
): boolean {
  if (actual.length !== expected.length) {
    return false;
  }
  for (let r = 0; r < actual.length; r += 1) {
    if (!vectorsWithinTolerance(actual[r]!, expected[r]!, tolerance)) {
      return false;
    }
  }
  return true;
}
