import { describe, expect, it } from "vitest";

import {
  assertEvidenceParity,
  checkEvidenceParity,
  createParityPair,
} from "../../../src/accessibility/evidence-parity";
import { exactNumericEvaluator, multipleChoiceEvaluator } from "../../../src/evaluators/concept";
import { structuredRubricEvaluator } from "../../../src/evaluators/explanation";
import { codeCorrectionEvaluator, traceMatchEvaluator } from "../../../src/evaluators/implementation";
import {
  attentionWeightShapeEvaluator,
  matrixMultiplyEvaluator,
  softmax,
  softmaxEvaluator,
} from "../../../src/evaluators/math";
import {
  EVALUATOR_REGISTRY_REVISION,
  EvaluatorRegistryError,
  getEvaluator,
  listEvaluators,
  requireEvaluator,
  runEvaluator,
  validateEvaluatorParams,
} from "../../../src/evaluators/registry";

describe("evaluator registry", () => {
  it("lists builtin evaluators keyed by id+revision", () => {
    const listed = listEvaluators();
    expect(EVALUATOR_REGISTRY_REVISION).toBe("1");
    expect(listed.length).toBeGreaterThanOrEqual(8);
    expect(getEvaluator("concept.multiple-choice", "1")).toBe(multipleChoiceEvaluator);
    expect(getEvaluator("math.softmax", "1")).toBe(softmaxEvaluator);
    expect(getEvaluator("explanation.structured-rubric", "1")).toBe(structuredRubricEvaluator);
  });

  it("throws on registry miss", () => {
    expect(getEvaluator("concept.multiple-choice", "999")).toBeUndefined();
    expect(() => requireEvaluator("no.such.evaluator", "1")).toThrowError(EvaluatorRegistryError);
    try {
      requireEvaluator("no.such.evaluator", "1");
    } catch (error) {
      expect(error).toBeInstanceOf(EvaluatorRegistryError);
      expect((error as EvaluatorRegistryError).code).toBe("not-found");
    }
  });

  it("validates params schemas before evaluate", () => {
    expect(() =>
      validateEvaluatorParams("concept.exact-numeric", "1", {
        expected: 1,
        tolerance: -0.1,
      }),
    ).toThrowError(EvaluatorRegistryError);

    expect(
      validateEvaluatorParams("concept.multiple-choice", "1", {
        correctOptionIds: ["a"],
      }),
    ).toEqual({ correctOptionIds: ["a"], requireExactSet: true, evidenceId: undefined });
  });
});

describe("concept.multiple-choice", () => {
  const params = multipleChoiceEvaluator.validateParams({
    correctOptionIds: ["opt-b"],
    evidenceId: "ev-mc-1",
  });

  it("scores correct / incorrect / unanswered", () => {
    expect(multipleChoiceEvaluator.evaluate("opt-b", params)).toEqual({
      outcome: "correct",
      evidenceId: "ev-mc-1",
    });
    expect(multipleChoiceEvaluator.evaluate("opt-a", params)).toEqual({
      outcome: "incorrect",
      evidenceId: "ev-mc-1",
      notes: "option-mismatch",
    });
    expect(multipleChoiceEvaluator.evaluate(null, params).outcome).toBe("unanswered");
    expect(multipleChoiceEvaluator.evaluate({ selectedOptionId: "" }, params).outcome).toBe(
      "unanswered",
    );
  });
});

describe("concept.exact-numeric tolerance boundaries", () => {
  const params = exactNumericEvaluator.validateParams({
    expected: 1,
    tolerance: 0.01,
    evidenceId: "ev-num-1",
  });

  it("accepts values inside and on the boundary", () => {
    expect(exactNumericEvaluator.evaluate(1, params).outcome).toBe("correct");
    expect(exactNumericEvaluator.evaluate(1.01, params).outcome).toBe("correct");
    expect(exactNumericEvaluator.evaluate(0.99, params).outcome).toBe("correct");
    expect(exactNumericEvaluator.evaluate("1.005", params).outcome).toBe("correct");
  });

  it("rejects values outside the boundary and blanks", () => {
    expect(exactNumericEvaluator.evaluate(1.0100001, params).outcome).toBe("incorrect");
    expect(exactNumericEvaluator.evaluate(0.9899999, params).outcome).toBe("incorrect");
    expect(exactNumericEvaluator.evaluate(undefined, params).outcome).toBe("unanswered");
    expect(exactNumericEvaluator.evaluate({ value: "" }, params).outcome).toBe("unanswered");
  });
});

describe("math evaluators", () => {
  it("checks matrix multiply within tolerance", () => {
    const params = matrixMultiplyEvaluator.validateParams({
      left: [
        [1, 2],
        [3, 4],
      ],
      right: [
        [5, 6],
        [7, 8],
      ],
      tolerance: 1e-9,
      evidenceId: "ev-mm-1",
    });
    expect(
      matrixMultiplyEvaluator.evaluate(
        [
          [19, 22],
          [43, 50],
        ],
        params,
      ).outcome,
    ).toBe("correct");
    expect(
      matrixMultiplyEvaluator.evaluate(
        [
          [0, 0],
          [0, 0],
        ],
        params,
      ).outcome,
    ).toBe("incorrect");
    expect(matrixMultiplyEvaluator.evaluate(null, params).outcome).toBe("unanswered");
  });

  it("checks softmax numeric outputs", () => {
    const logits = [1, 2, 3];
    const expected = softmax(logits);
    const params = softmaxEvaluator.validateParams({
      logits,
      tolerance: 1e-6,
      evidenceId: "ev-sm-1",
    });
    expect(softmaxEvaluator.evaluate(expected, params).outcome).toBe("correct");
    expect(softmaxEvaluator.evaluate([0.2, 0.2, 0.2], params).outcome).toBe("incorrect");
    expect(softmaxEvaluator.evaluate([], params).outcome).toBe("unanswered");
  });

  it("checks attention weight shape and causal mask", () => {
    const params = attentionWeightShapeEvaluator.validateParams({
      queryLength: 2,
      keyLength: 2,
      causal: true,
      tolerance: 1e-6,
      evidenceId: "ev-attn-1",
    });
    expect(
      attentionWeightShapeEvaluator.evaluate(
        {
          weights: [
            [1, 0],
            [0.25, 0.75],
          ],
        },
        params,
      ).outcome,
    ).toBe("correct");
    expect(
      attentionWeightShapeEvaluator.evaluate(
        {
          weights: [
            [0.5, 0.5],
            [0.25, 0.75],
          ],
        },
        params,
      ).outcome,
    ).toBe("incorrect");
    expect(
      attentionWeightShapeEvaluator.evaluate({ shape: [2, 2] }, params).outcome,
    ).toBe("correct");
    expect(attentionWeightShapeEvaluator.evaluate(null, params).outcome).toBe("unanswered");
  });
});

describe("implementation evaluators", () => {
  it("matches ordered traces and code-correction choices", () => {
    const traceParams = traceMatchEvaluator.validateParams({
      expectedStepIds: ["embed", "attn", "ffn"],
      evidenceId: "ev-trace-1",
    });
    expect(traceMatchEvaluator.evaluate(["embed", "attn", "ffn"], traceParams).outcome).toBe(
      "correct",
    );
    expect(traceMatchEvaluator.evaluate(["embed", "ffn", "attn"], traceParams).outcome).toBe(
      "incorrect",
    );
    expect(traceMatchEvaluator.evaluate([], traceParams).outcome).toBe("unanswered");

    const fixParams = codeCorrectionEvaluator.validateParams({
      correctChoiceId: "fix-scale-sqrt-dk",
      evidenceId: "ev-fix-1",
    });
    expect(
      codeCorrectionEvaluator.evaluate({ choiceId: "fix-scale-sqrt-dk" }, fixParams).outcome,
    ).toBe("correct");
    expect(codeCorrectionEvaluator.evaluate({ choiceId: "fix-drop-mask" }, fixParams).outcome).toBe(
      "incorrect",
    );
  });
});

describe("explanation.structured-rubric", () => {
  const params = structuredRubricEvaluator.validateParams({
    requiredFields: ["claim", "whyWrong", "correctIdea"],
    requiredClaimIds: ["claim-scale"],
    evidenceId: "ev-expl-1",
  });

  it("requires structured fields and does not echo free text", () => {
    const pass = structuredRubricEvaluator.evaluate(
      {
        fields: {
          claim: true,
          whyWrong: true,
          correctIdea: true,
        },
        selectedClaimIds: ["claim-scale"],
        freeTextByField: {
          whyWrong: "스케일을 빠뜨려 소프트맥스가 뾰족해진다",
          correctIdea: "sqrt(d_k)로 나눈다",
        },
      },
      params,
    );
    expect(pass).toEqual({ outcome: "correct", evidenceId: "ev-expl-1" });
    expect(JSON.stringify(pass)).not.toContain("소프트맥스");
    expect(JSON.stringify(pass)).not.toContain("sqrt");

    expect(
      structuredRubricEvaluator.evaluate(
        {
          fields: { claim: true },
          freeTextByField: { whyWrong: "..." },
        },
        params,
      ),
    ).toMatchObject({ outcome: "incorrect", notes: expect.stringContaining("missing-field") });

    expect(structuredRubricEvaluator.evaluate({}, params).outcome).toBe("unanswered");
  });
});

describe("runEvaluator integration", () => {
  it("runs end-to-end through the registry without persisting input bodies", () => {
    const result = runEvaluator(
      { evaluatorId: "concept.multiple-choice", revision: "1" },
      { selectedOptionIds: ["a", "c"] },
      { correctOptionIds: ["a", "c"], evidenceId: "ev-run-1" },
    );
    expect(result.outcome).toBe("correct");
    expect(result.evidenceId).toBe("ev-run-1");
    expect(Object.keys(result).sort()).toEqual(["evidenceId", "outcome"]);
  });
});

describe("evidence parity", () => {
  it("passes when objective, difficulty, evaluator, and transitions match", () => {
    const activity = createParityPair({
      activityId: "act-attn-shape-1",
      objectiveId: "obj-attention-weights-row-stochastic",
      difficulty: "core",
      evaluatorId: "math.attention-weight-shape",
      passPredicateId: "pred-row-stochastic-causal",
      hintLadderId: "hint-attn-1",
      remediationId: "rem-attn-weights",
      variantTransitionId: "var-attn-1",
    });
    const result = checkEvidenceParity(activity);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(() => assertEvidenceParity(activity)).not.toThrow();
  });

  it("allows reviewer-equivalent evaluators via shared equivalenceToken", () => {
    const activity = createParityPair({
      activityId: "act-impl-1",
      objectiveId: "obj-trace-order",
      difficulty: "core",
      evaluatorId: "implementation.trace-match",
      accessibleEvaluatorId: "implementation.code-correction",
      equivalenceToken: "equiv-trace-vs-correction-v1",
      hintLadderId: "hint-impl-1",
      remediationId: "rem-impl-1",
      variantTransitionId: "var-impl-1",
    });
    expect(checkEvidenceParity(activity).ok).toBe(true);
  });

  it("fails when objective-strength fields diverge", () => {
    const base = createParityPair({
      activityId: "act-mc-1",
      objectiveId: "obj-qkv-roles",
      difficulty: "intro",
      evaluatorId: "concept.multiple-choice",
      hintLadderId: "hint-mc-1",
      remediationId: "rem-mc-1",
      variantTransitionId: "var-mc-1",
    });

    const hintMismatch = {
      ...base,
      accessible: { ...base.accessible, hintLadderId: "hint-other" },
    };
    const hintResult = checkEvidenceParity(hintMismatch);
    expect(hintResult.ok).toBe(false);
    expect(hintResult.issues.some((i) => i.code === "hint-mismatch")).toBe(true);

    const evaluatorMismatch = {
      ...base,
      accessible: {
        ...base.accessible,
        evaluator: {
          evaluatorId: "concept.exact-numeric",
          revision: "1",
        },
      },
    };
    const evalResult = checkEvidenceParity(evaluatorMismatch);
    expect(evalResult.ok).toBe(false);
    expect(evalResult.issues.some((i) => i.code === "evaluator-inequivalent")).toBe(true);

    const predicateMismatch = {
      ...base,
      primary: { ...base.primary, passPredicateId: "pred-a" },
      accessible: { ...base.accessible, passPredicateId: "pred-b" },
    };
    const predResult = checkEvidenceParity(predicateMismatch);
    expect(predResult.ok).toBe(false);
    expect(predResult.issues.some((i) => i.code === "pass-predicate-mismatch")).toBe(true);

    expect(() => assertEvidenceParity(hintMismatch)).toThrow(/Evidence parity failed/);
  });
});
