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

/**
 * Structured explanation rubric.
 *
 * Free-text learner bodies are accepted only as ephemeral presence checks and
 * MUST NOT be copied into EvaluationResult. Callers persist evidenceId + outcome only.
 */
export interface StructuredRubricParams {
  /** Field keys that must be present and non-empty after trim. */
  readonly requiredFields: readonly string[];
  /**
   * Optional allowlisted token IDs that must appear under `selectedClaimIds`
   * (or `claimIds`) — never free-text matching.
   */
  readonly requiredClaimIds?: readonly string[];
  readonly evidenceId?: string;
}

export type StructuredRubricInput = {
  readonly fields?: Readonly<Record<string, unknown>>;
  readonly selectedClaimIds?: readonly string[];
  readonly claimIds?: readonly string[];
  /** Ephemeral free text; presence-only, never returned in the result. */
  readonly freeTextByField?: Readonly<Record<string, string>>;
};

export function validateStructuredRubricParams(params: unknown): StructuredRubricParams {
  if (!isRecord(params)) {
    throw new Error("explanation.structured-rubric params must be an object.");
  }
  const requiredFields = assertStringArray(params.requiredFields, "requiredFields");
  const uniqueFields = new Set(requiredFields);
  if (uniqueFields.size !== requiredFields.length) {
    throw new Error("requiredFields must be unique.");
  }
  let requiredClaimIds: readonly string[] | undefined;
  if (params.requiredClaimIds !== undefined) {
    requiredClaimIds = assertStringArray(params.requiredClaimIds, "requiredClaimIds");
    const uniqueClaims = new Set(requiredClaimIds);
    if (uniqueClaims.size !== requiredClaimIds.length) {
      throw new Error("requiredClaimIds must be unique.");
    }
  }
  const evidenceId =
    params.evidenceId === undefined
      ? undefined
      : assertString(params.evidenceId, "evidenceId");
  return { requiredFields, requiredClaimIds, evidenceId };
}

function fieldPresent(
  fields: Readonly<Record<string, unknown>> | undefined,
  freeText: Readonly<Record<string, string>> | undefined,
  key: string,
): boolean {
  if (freeText && typeof freeText[key] === "string" && freeText[key]!.trim().length > 0) {
    return true;
  }
  if (!fields) {
    return false;
  }
  const value = fields[key];
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (typeof value === "boolean") {
    return value === true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return value !== null && value !== undefined;
}

export const structuredRubricEvaluator: EvaluatorDefinition<
  StructuredRubricParams,
  StructuredRubricInput
> = {
  evaluatorId: "explanation.structured-rubric",
  revision: "1",
  validateParams: validateStructuredRubricParams,
  evaluate(input, params) {
    if (isBlankInput(input)) {
      return unanswered();
    }
    if (!isRecord(input)) {
      return incorrect(params.evidenceId, "invalid-input");
    }

    const fields = isRecord(input.fields)
      ? (input.fields as Readonly<Record<string, unknown>>)
      : undefined;
    const freeText =
      isRecord(input.freeTextByField)
        ? (input.freeTextByField as Readonly<Record<string, string>>)
        : undefined;

    const missing: string[] = [];
    for (const key of params.requiredFields) {
      if (!fieldPresent(fields, freeText, key)) {
        missing.push(key);
      }
    }
    if (missing.length > 0) {
      // notes carry field keys only — never free-text content.
      return incorrect(params.evidenceId, `missing-field:${missing.join(",")}`);
    }

    if (params.requiredClaimIds && params.requiredClaimIds.length > 0) {
      const claimsRaw = Array.isArray(input.selectedClaimIds)
        ? input.selectedClaimIds
        : Array.isArray(input.claimIds)
          ? input.claimIds
          : null;
      if (claimsRaw === null || claimsRaw.length === 0) {
        return incorrect(params.evidenceId, "missing-claims");
      }
      if (!claimsRaw.every((c) => typeof c === "string")) {
        return incorrect(params.evidenceId, "invalid-claims");
      }
      const have = new Set(claimsRaw);
      const missingClaims = params.requiredClaimIds.filter((id) => !have.has(id));
      if (missingClaims.length > 0) {
        return incorrect(params.evidenceId, `missing-claim:${missingClaims.join(",")}`);
      }
    }

    // Deliberately omit any free-text from the result payload.
    return correct(params.evidenceId);
  },
};

export const explanationEvaluators = [structuredRubricEvaluator] as const;
