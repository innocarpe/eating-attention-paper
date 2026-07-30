import {
  assertNonNegativeNumber,
  assertString,
  assertStringArray,
  correct,
  incorrect,
  isBlankInput,
  isRecord,
  type EvaluatorDefinition,
  unanswered,
  withinTolerance,
} from "./types";

export interface MultipleChoiceParams {
  readonly correctOptionIds: readonly string[];
  /** When true, selection must match correct set exactly (order-insensitive). Default true. */
  readonly requireExactSet?: boolean;
  readonly evidenceId?: string;
}

export type MultipleChoiceInput =
  | string
  | readonly string[]
  | {
      readonly selectedOptionId?: string;
      readonly selectedOptionIds?: readonly string[];
      readonly choiceId?: string;
    };

function normalizeSelectedIds(input: MultipleChoiceInput): string[] | null {
  if (typeof input === "string") {
    return input.trim().length === 0 ? null : [input];
  }
  if (Array.isArray(input)) {
    if (input.length === 0) {
      return null;
    }
    if (!input.every((v) => typeof v === "string")) {
      return null;
    }
    return [...input];
  }
  if (isRecord(input)) {
    if (typeof input.selectedOptionId === "string") {
      return input.selectedOptionId.trim().length === 0 ? null : [input.selectedOptionId];
    }
    if (typeof input.choiceId === "string") {
      return input.choiceId.trim().length === 0 ? null : [input.choiceId];
    }
    if (Array.isArray(input.selectedOptionIds)) {
      if (input.selectedOptionIds.length === 0) {
        return null;
      }
      if (!input.selectedOptionIds.every((v) => typeof v === "string")) {
        return null;
      }
      return [...input.selectedOptionIds];
    }
  }
  return null;
}

function sameIdSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const left = [...a].sort();
  const right = [...b].sort();
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) {
      return false;
    }
  }
  return true;
}

export function validateMultipleChoiceParams(params: unknown): MultipleChoiceParams {
  if (!isRecord(params)) {
    throw new Error("concept.multiple-choice params must be an object.");
  }
  const correctOptionIds = assertStringArray(params.correctOptionIds, "correctOptionIds");
  const unique = new Set(correctOptionIds);
  if (unique.size !== correctOptionIds.length) {
    throw new Error("correctOptionIds must be unique.");
  }
  let requireExactSet = true;
  if (params.requireExactSet !== undefined) {
    if (typeof params.requireExactSet !== "boolean") {
      throw new Error("requireExactSet must be a boolean.");
    }
    requireExactSet = params.requireExactSet;
  }
  const evidenceId =
    params.evidenceId === undefined
      ? undefined
      : assertString(params.evidenceId, "evidenceId");
  return { correctOptionIds, requireExactSet, evidenceId };
}

export const multipleChoiceEvaluator: EvaluatorDefinition<
  MultipleChoiceParams,
  MultipleChoiceInput
> = {
  evaluatorId: "concept.multiple-choice",
  revision: "1",
  validateParams: validateMultipleChoiceParams,
  evaluate(input, params) {
    if (isBlankInput(input)) {
      return unanswered();
    }
    const selected = normalizeSelectedIds(input);
    if (selected === null) {
      return incorrect(params.evidenceId, "invalid-selection");
    }
    const requireExact = params.requireExactSet !== false;
    if (requireExact) {
      return sameIdSet(selected, params.correctOptionIds)
        ? correct(params.evidenceId)
        : incorrect(params.evidenceId, "option-mismatch");
    }
    // Subset mode: every selected id must be correct and at least one selected.
    if (selected.length === 0) {
      return unanswered();
    }
    const allowed = new Set(params.correctOptionIds);
    const allAllowed = selected.every((id) => allowed.has(id));
    return allAllowed
      ? correct(params.evidenceId)
      : incorrect(params.evidenceId, "option-mismatch");
  },
};

export interface ExactNumericParams {
  readonly expected: number;
  readonly tolerance: number;
  readonly evidenceId?: string;
}

export type ExactNumericInput =
  | number
  | string
  | {
      readonly value?: number | string;
    };

function coerceNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function validateExactNumericParams(params: unknown): ExactNumericParams {
  if (!isRecord(params)) {
    throw new Error("concept.exact-numeric params must be an object.");
  }
  if (typeof params.expected !== "number" || !Number.isFinite(params.expected)) {
    throw new Error("expected must be a finite number.");
  }
  const tolerance = assertNonNegativeNumber(params.tolerance, "tolerance");
  const evidenceId =
    params.evidenceId === undefined
      ? undefined
      : assertString(params.evidenceId, "evidenceId");
  return { expected: params.expected, tolerance, evidenceId };
}

export const exactNumericEvaluator: EvaluatorDefinition<ExactNumericParams, ExactNumericInput> = {
  evaluatorId: "concept.exact-numeric",
  revision: "1",
  validateParams: validateExactNumericParams,
  evaluate(input, params) {
    if (isBlankInput(input)) {
      return unanswered();
    }
    let raw: unknown = input;
    if (isRecord(input) && "value" in input) {
      raw = input.value;
    }
    const actual = coerceNumber(raw);
    if (actual === null) {
      return incorrect(params.evidenceId, "non-numeric");
    }
    return withinTolerance(actual, params.expected, params.tolerance)
      ? correct(params.evidenceId)
      : incorrect(params.evidenceId, "out-of-tolerance");
  },
};

export interface SequenceOrderParams {
  readonly correctOrder: readonly string[];
  readonly evidenceId?: string;
}

export type SequenceOrderInput =
  | readonly string[]
  | {
      readonly order?: readonly string[];
    };

export function validateSequenceOrderParams(params: unknown): SequenceOrderParams {
  if (!isRecord(params)) {
    throw new Error("concept.sequence-order params must be an object.");
  }
  const correctOrder = assertStringArray(params.correctOrder, "correctOrder");
  const evidenceId =
    params.evidenceId === undefined
      ? undefined
      : assertString(params.evidenceId, "evidenceId");
  return { correctOrder, evidenceId };
}

export const sequenceOrderEvaluator: EvaluatorDefinition<
  SequenceOrderParams,
  SequenceOrderInput
> = {
  evaluatorId: "concept.sequence-order",
  revision: "1",
  validateParams: validateSequenceOrderParams,
  evaluate(input, params) {
    if (isBlankInput(input)) {
      return unanswered();
    }
    let order: unknown = input;
    if (isRecord(input) && "order" in input) {
      order = input.order;
    }
    if (!Array.isArray(order) || order.length === 0) {
      return unanswered();
    }
    if (!order.every((v) => typeof v === "string")) {
      return incorrect(params.evidenceId, "invalid-order");
    }
    if (order.length !== params.correctOrder.length) {
      return incorrect(params.evidenceId, "length-mismatch");
    }
    for (let i = 0; i < order.length; i += 1) {
      if (order[i] !== params.correctOrder[i]) {
        return incorrect(params.evidenceId, "order-mismatch");
      }
    }
    return correct(params.evidenceId);
  },
};

export const conceptEvaluators = [
  multipleChoiceEvaluator,
  exactNumericEvaluator,
  sequenceOrderEvaluator,
] as const;
