import {
  assertNonNegativeNumber,
  assertNumberMatrix,
  assertNumberVector,
  assertString,
  correct,
  incorrect,
  isBlankInput,
  isRecord,
  matricesWithinTolerance,
  type EvaluatorDefinition,
  unanswered,
  vectorsWithinTolerance,
  withinTolerance,
} from "./types";

function multiplyMatrices(
  a: readonly (readonly number[])[],
  b: readonly (readonly number[])[],
): number[][] {
  const aRows = a.length;
  const aCols = a[0]!.length;
  const bRows = b.length;
  const bCols = b[0]!.length;
  if (aCols !== bRows) {
    throw new Error("matrix inner dimensions must agree.");
  }
  const out: number[][] = [];
  for (let i = 0; i < aRows; i += 1) {
    const row: number[] = [];
    for (let j = 0; j < bCols; j += 1) {
      let sum = 0;
      for (let k = 0; k < aCols; k += 1) {
        sum += a[i]![k]! * b[k]![j]!;
      }
      row.push(sum);
    }
    out.push(row);
  }
  return out;
}

/** Numerically stable softmax over a vector. */
export function softmax(values: readonly number[]): number[] {
  let max = values[0]!;
  for (let i = 1; i < values.length; i += 1) {
    if (values[i]! > max) {
      max = values[i]!;
    }
  }
  const exps = values.map((v) => Math.exp(v - max));
  const sum = exps.reduce((acc, v) => acc + v, 0);
  return exps.map((v) => v / sum);
}

export interface MatrixMultiplyParams {
  readonly left: readonly (readonly number[])[];
  readonly right: readonly (readonly number[])[];
  readonly tolerance: number;
  /** Optional precomputed expected; when omitted, computed from left/right. */
  readonly expected?: readonly (readonly number[])[];
  readonly evidenceId?: string;
}

export type MatrixMultiplyInput =
  | readonly (readonly number[])[]
  | {
      readonly result?: readonly (readonly number[])[];
      readonly matrix?: readonly (readonly number[])[];
    };

export function validateMatrixMultiplyParams(params: unknown): MatrixMultiplyParams {
  if (!isRecord(params)) {
    throw new Error("math.matrix-multiply params must be an object.");
  }
  const left = assertNumberMatrix(params.left, "left");
  const right = assertNumberMatrix(params.right, "right");
  if (left[0]!.length !== right.length) {
    throw new Error("left columns must equal right rows.");
  }
  const tolerance = assertNonNegativeNumber(params.tolerance, "tolerance");
  const expected =
    params.expected === undefined
      ? multiplyMatrices(left, right)
      : assertNumberMatrix(params.expected, "expected");
  const computed = multiplyMatrices(left, right);
  if (!matricesWithinTolerance(expected, computed, tolerance)) {
    throw new Error("expected matrix does not match left×right within tolerance.");
  }
  const evidenceId =
    params.evidenceId === undefined
      ? undefined
      : assertString(params.evidenceId, "evidenceId");
  return { left, right, tolerance, expected, evidenceId };
}

export const matrixMultiplyEvaluator: EvaluatorDefinition<
  MatrixMultiplyParams,
  MatrixMultiplyInput
> = {
  evaluatorId: "math.matrix-multiply",
  revision: "1",
  validateParams: validateMatrixMultiplyParams,
  evaluate(input, params) {
    if (isBlankInput(input)) {
      return unanswered();
    }
    let raw: unknown = input;
    if (isRecord(input)) {
      if ("result" in input) {
        raw = input.result;
      } else if ("matrix" in input) {
        raw = input.matrix;
      }
    }
    let actual: readonly (readonly number[])[];
    try {
      actual = assertNumberMatrix(raw, "result");
    } catch {
      return incorrect(params.evidenceId, "invalid-matrix");
    }
    const expected = params.expected ?? multiplyMatrices(params.left, params.right);
    return matricesWithinTolerance(actual, expected, params.tolerance)
      ? correct(params.evidenceId)
      : incorrect(params.evidenceId, "matrix-mismatch");
  },
};

export interface SoftmaxParams {
  readonly logits: readonly number[];
  readonly tolerance: number;
  readonly expected?: readonly number[];
  readonly evidenceId?: string;
}

export type SoftmaxInput =
  | readonly number[]
  | {
      readonly values?: readonly number[];
      readonly result?: readonly number[];
    };

export function validateSoftmaxParams(params: unknown): SoftmaxParams {
  if (!isRecord(params)) {
    throw new Error("math.softmax params must be an object.");
  }
  const logits = assertNumberVector(params.logits, "logits");
  const tolerance = assertNonNegativeNumber(params.tolerance, "tolerance");
  const computed = softmax(logits);
  const expected =
    params.expected === undefined
      ? computed
      : assertNumberVector(params.expected, "expected");
  if (expected.length !== logits.length) {
    throw new Error("expected length must match logits length.");
  }
  if (!vectorsWithinTolerance(expected, computed, tolerance)) {
    throw new Error("expected softmax does not match logits within tolerance.");
  }
  const evidenceId =
    params.evidenceId === undefined
      ? undefined
      : assertString(params.evidenceId, "evidenceId");
  return { logits, tolerance, expected, evidenceId };
}

export const softmaxEvaluator: EvaluatorDefinition<SoftmaxParams, SoftmaxInput> = {
  evaluatorId: "math.softmax",
  revision: "1",
  validateParams: validateSoftmaxParams,
  evaluate(input, params) {
    if (isBlankInput(input)) {
      return unanswered();
    }
    let raw: unknown = input;
    if (isRecord(input)) {
      if ("values" in input) {
        raw = input.values;
      } else if ("result" in input) {
        raw = input.result;
      }
    }
    let actual: readonly number[];
    try {
      actual = assertNumberVector(raw, "values");
    } catch {
      return incorrect(params.evidenceId, "invalid-vector");
    }
    const expected = params.expected ?? softmax(params.logits);
    if (actual.length !== expected.length) {
      return incorrect(params.evidenceId, "length-mismatch");
    }
    // Softmax outputs must be a probability simplex within tolerance.
    const sum = actual.reduce((acc, v) => acc + v, 0);
    if (!withinTolerance(sum, 1, params.tolerance)) {
      return incorrect(params.evidenceId, "not-normalized");
    }
    return vectorsWithinTolerance(actual, expected, params.tolerance)
      ? correct(params.evidenceId)
      : incorrect(params.evidenceId, "softmax-mismatch");
  },
};

export interface AttentionWeightShapeParams {
  readonly queryLength: number;
  readonly keyLength: number;
  /** When true, require causal lower-triangular mask shape (zeros above diagonal). */
  readonly causal?: boolean;
  readonly tolerance: number;
  readonly evidenceId?: string;
}

export type AttentionWeightShapeInput =
  | readonly (readonly number[])[]
  | {
      readonly matrix?: readonly (readonly number[])[];
      readonly weights?: readonly (readonly number[])[];
      readonly shape?: readonly number[];
    };

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function validateAttentionWeightShapeParams(
  params: unknown,
): AttentionWeightShapeParams {
  if (!isRecord(params)) {
    throw new Error("math.attention-weight-shape params must be an object.");
  }
  if (!isPositiveInt(params.queryLength)) {
    throw new Error("queryLength must be a positive integer.");
  }
  if (!isPositiveInt(params.keyLength)) {
    throw new Error("keyLength must be a positive integer.");
  }
  let causal = false;
  if (params.causal !== undefined) {
    if (typeof params.causal !== "boolean") {
      throw new Error("causal must be a boolean.");
    }
    causal = params.causal;
  }
  const tolerance = assertNonNegativeNumber(params.tolerance, "tolerance");
  const evidenceId =
    params.evidenceId === undefined
      ? undefined
      : assertString(params.evidenceId, "evidenceId");
  return {
    queryLength: params.queryLength,
    keyLength: params.keyLength,
    causal,
    tolerance,
    evidenceId,
  };
}

function checkAttentionMatrix(
  matrix: readonly (readonly number[])[],
  params: AttentionWeightShapeParams,
): { ok: true } | { ok: false; notes: string } {
  if (matrix.length !== params.queryLength) {
    return { ok: false, notes: "row-count-mismatch" };
  }
  for (let i = 0; i < matrix.length; i += 1) {
    const row = matrix[i]!;
    if (row.length !== params.keyLength) {
      return { ok: false, notes: "col-count-mismatch" };
    }
    let sum = 0;
    for (let j = 0; j < row.length; j += 1) {
      const v = row[j]!;
      if (!Number.isFinite(v)) {
        return { ok: false, notes: "non-finite" };
      }
      if (v < -params.tolerance) {
        return { ok: false, notes: "negative-weight" };
      }
      if (params.causal && j > i && !withinTolerance(v, 0, params.tolerance)) {
        return { ok: false, notes: "causal-mask-violation" };
      }
      sum += v;
    }
    if (!withinTolerance(sum, 1, params.tolerance)) {
      return { ok: false, notes: "row-not-normalized" };
    }
  }
  return { ok: true };
}

export const attentionWeightShapeEvaluator: EvaluatorDefinition<
  AttentionWeightShapeParams,
  AttentionWeightShapeInput
> = {
  evaluatorId: "math.attention-weight-shape",
  revision: "1",
  validateParams: validateAttentionWeightShapeParams,
  evaluate(input, params) {
    if (isBlankInput(input)) {
      return unanswered();
    }
    // Allow shape-only answers: [queryLength, keyLength]
    if (isRecord(input) && Array.isArray(input.shape)) {
      const shape = input.shape;
      if (
        shape.length === 2 &&
        shape[0] === params.queryLength &&
        shape[1] === params.keyLength
      ) {
        return correct(params.evidenceId, "shape-only");
      }
      return incorrect(params.evidenceId, "shape-mismatch");
    }

    let raw: unknown = input;
    if (isRecord(input)) {
      if ("weights" in input) {
        raw = input.weights;
      } else if ("matrix" in input) {
        raw = input.matrix;
      }
    }
    let matrix: readonly (readonly number[])[];
    try {
      matrix = assertNumberMatrix(raw, "weights");
    } catch {
      return incorrect(params.evidenceId, "invalid-matrix");
    }
    const checked = checkAttentionMatrix(matrix, params);
    return checked.ok
      ? correct(params.evidenceId)
      : incorrect(params.evidenceId, checked.notes);
  },
};

export interface ScaledDotProductParams {
  readonly query: readonly (readonly number[])[];
  readonly key: readonly (readonly number[])[];
  readonly scale: number;
  readonly tolerance: number;
  readonly expectedScores?: readonly (readonly number[])[];
  readonly evidenceId?: string;
}

export type ScaledDotProductInput =
  | readonly (readonly number[])[]
  | {
      readonly scores?: readonly (readonly number[])[];
      readonly result?: readonly (readonly number[])[];
    };

export function validateScaledDotProductParams(params: unknown): ScaledDotProductParams {
  if (!isRecord(params)) {
    throw new Error("math.scaled-dot-product params must be an object.");
  }
  const query = assertNumberMatrix(params.query, "query");
  const key = assertNumberMatrix(params.key, "key");
  if (query[0]!.length !== key[0]!.length) {
    throw new Error("query and key must share the same depth dimension.");
  }
  if (typeof params.scale !== "number" || !Number.isFinite(params.scale) || params.scale === 0) {
    throw new Error("scale must be a non-zero finite number.");
  }
  const scale = params.scale;
  const tolerance = assertNonNegativeNumber(params.tolerance, "tolerance");
  const keyT = key[0]!.map((_, c) => key.map((row) => row[c]!));
  const dots = multiplyMatrices(query, keyT);
  const computed = dots.map((row) => row.map((v) => v / scale));
  const expectedScores =
    params.expectedScores === undefined
      ? computed
      : assertNumberMatrix(params.expectedScores, "expectedScores");
  if (!matricesWithinTolerance(expectedScores, computed, tolerance)) {
    throw new Error("expectedScores do not match QK^T/scale within tolerance.");
  }
  const evidenceId =
    params.evidenceId === undefined
      ? undefined
      : assertString(params.evidenceId, "evidenceId");
  return {
    query,
    key,
    scale: params.scale,
    tolerance,
    expectedScores,
    evidenceId,
  };
}

export const scaledDotProductEvaluator: EvaluatorDefinition<
  ScaledDotProductParams,
  ScaledDotProductInput
> = {
  evaluatorId: "math.scaled-dot-product",
  revision: "1",
  validateParams: validateScaledDotProductParams,
  evaluate(input, params) {
    if (isBlankInput(input)) {
      return unanswered();
    }
    let raw: unknown = input;
    if (isRecord(input)) {
      if ("scores" in input) {
        raw = input.scores;
      } else if ("result" in input) {
        raw = input.result;
      }
    }
    let actual: readonly (readonly number[])[];
    try {
      actual = assertNumberMatrix(raw, "scores");
    } catch {
      return incorrect(params.evidenceId, "invalid-matrix");
    }
    const expected = params.expectedScores;
    if (!expected) {
      return incorrect(params.evidenceId, "missing-expected");
    }
    return matricesWithinTolerance(actual, expected, params.tolerance)
      ? correct(params.evidenceId)
      : incorrect(params.evidenceId, "score-mismatch");
  },
};

export const mathEvaluators = [
  matrixMultiplyEvaluator,
  softmaxEvaluator,
  attentionWeightShapeEvaluator,
  scaledDotProductEvaluator,
] as const;
