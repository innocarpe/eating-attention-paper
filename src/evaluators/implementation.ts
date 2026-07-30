import {
  assertString,
  assertStringArray,
  correct,
  incorrect,
  isBlankInput,
  isRecord,
  type EvaluatorDefinition,
  unanswered,
} from "./types";

export interface TraceMatchParams {
  /** Ordered expected step IDs in the reference execution trace. */
  readonly expectedStepIds: readonly string[];
  readonly evidenceId?: string;
}

export type TraceMatchInput =
  | readonly string[]
  | {
      readonly traceStepIds?: readonly string[];
      readonly stepIds?: readonly string[];
    };

export function validateTraceMatchParams(params: unknown): TraceMatchParams {
  if (!isRecord(params)) {
    throw new Error("implementation.trace-match params must be an object.");
  }
  const expectedStepIds = assertStringArray(params.expectedStepIds, "expectedStepIds");
  const evidenceId =
    params.evidenceId === undefined
      ? undefined
      : assertString(params.evidenceId, "evidenceId");
  return { expectedStepIds, evidenceId };
}

export const traceMatchEvaluator: EvaluatorDefinition<TraceMatchParams, TraceMatchInput> = {
  evaluatorId: "implementation.trace-match",
  revision: "1",
  validateParams: validateTraceMatchParams,
  evaluate(input, params) {
    if (isBlankInput(input)) {
      return unanswered();
    }
    let steps: unknown = input;
    if (isRecord(input)) {
      if ("traceStepIds" in input) {
        steps = input.traceStepIds;
      } else if ("stepIds" in input) {
        steps = input.stepIds;
      }
    }
    if (!Array.isArray(steps) || steps.length === 0) {
      return unanswered();
    }
    if (!steps.every((s) => typeof s === "string")) {
      return incorrect(params.evidenceId, "invalid-trace");
    }
    if (steps.length !== params.expectedStepIds.length) {
      return incorrect(params.evidenceId, "length-mismatch");
    }
    for (let i = 0; i < steps.length; i += 1) {
      if (steps[i] !== params.expectedStepIds[i]) {
        return incorrect(params.evidenceId, "trace-mismatch");
      }
    }
    return correct(params.evidenceId);
  },
};

export interface CodeCorrectionParams {
  /** Locale-neutral ID of the correct patched choice / fix. */
  readonly correctChoiceId: string;
  readonly evidenceId?: string;
}

export type CodeCorrectionInput =
  | string
  | {
      readonly choiceId?: string;
      readonly selectedOptionId?: string;
    };

export function validateCodeCorrectionParams(params: unknown): CodeCorrectionParams {
  if (!isRecord(params)) {
    throw new Error("implementation.code-correction params must be an object.");
  }
  const correctChoiceId = assertString(params.correctChoiceId, "correctChoiceId");
  const evidenceId =
    params.evidenceId === undefined
      ? undefined
      : assertString(params.evidenceId, "evidenceId");
  return { correctChoiceId, evidenceId };
}

export const codeCorrectionEvaluator: EvaluatorDefinition<
  CodeCorrectionParams,
  CodeCorrectionInput
> = {
  evaluatorId: "implementation.code-correction",
  revision: "1",
  validateParams: validateCodeCorrectionParams,
  evaluate(input, params) {
    if (isBlankInput(input)) {
      return unanswered();
    }
    let choice: unknown = input;
    if (isRecord(input)) {
      if (typeof input.choiceId === "string") {
        choice = input.choiceId;
      } else if (typeof input.selectedOptionId === "string") {
        choice = input.selectedOptionId;
      }
    }
    if (typeof choice !== "string" || choice.trim().length === 0) {
      return unanswered();
    }
    return choice === params.correctChoiceId
      ? correct(params.evidenceId)
      : incorrect(params.evidenceId, "choice-mismatch");
  },
};

export const implementationEvaluators = [
  traceMatchEvaluator,
  codeCorrectionEvaluator,
] as const;
