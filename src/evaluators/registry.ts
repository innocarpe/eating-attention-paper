import { conceptEvaluators } from "./concept";
import { explanationEvaluators } from "./explanation";
import { implementationEvaluators } from "./implementation";
import { mathEvaluators } from "./math";
import {
  type EvaluationResult,
  type EvaluatorDefinition,
  type EvaluatorParams,
  type EvaluatorRef,
  isRecord,
} from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- registry stores heterogeneous evaluators
export type AnyEvaluatorDefinition = EvaluatorDefinition<any, any>;

function registryKey(evaluatorId: string, revision: string): string {
  return `${evaluatorId}@${revision}`;
}

const BUILTIN_EVALUATORS: readonly AnyEvaluatorDefinition[] = [
  ...conceptEvaluators,
  ...mathEvaluators,
  ...implementationEvaluators,
  ...explanationEvaluators,
];

function buildRegistry(
  evaluators: readonly AnyEvaluatorDefinition[],
): ReadonlyMap<string, AnyEvaluatorDefinition> {
  const map = new Map<string, AnyEvaluatorDefinition>();
  for (const evaluator of evaluators) {
    if (typeof evaluator.evaluatorId !== "string" || evaluator.evaluatorId.length === 0) {
      throw new Error("Evaluator is missing evaluatorId.");
    }
    if (typeof evaluator.revision !== "string" || evaluator.revision.length === 0) {
      throw new Error(`Evaluator ${evaluator.evaluatorId} is missing revision.`);
    }
    const key = registryKey(evaluator.evaluatorId, evaluator.revision);
    if (map.has(key)) {
      throw new Error(`Duplicate evaluator registration: ${key}`);
    }
    map.set(key, evaluator);
  }
  return map;
}

const DEFAULT_REGISTRY = buildRegistry(BUILTIN_EVALUATORS);

/** Frozen registry revision for the bundled allowlist. Bump when entries change. */
export const EVALUATOR_REGISTRY_REVISION = "1";

export function listEvaluators(
  registry: ReadonlyMap<string, AnyEvaluatorDefinition> = DEFAULT_REGISTRY,
): readonly EvaluatorRef[] {
  return [...registry.values()].map((evaluator) => ({
    evaluatorId: evaluator.evaluatorId,
    revision: evaluator.revision,
  }));
}

export function getEvaluator(
  evaluatorId: string,
  revision: string,
  registry: ReadonlyMap<string, AnyEvaluatorDefinition> = DEFAULT_REGISTRY,
): AnyEvaluatorDefinition | undefined {
  return registry.get(registryKey(evaluatorId, revision));
}

export class EvaluatorRegistryError extends Error {
  readonly code: "not-found" | "invalid-params" | "invalid-ref";

  constructor(code: EvaluatorRegistryError["code"], message: string) {
    super(message);
    this.name = "EvaluatorRegistryError";
    this.code = code;
  }
}

export function requireEvaluator(
  evaluatorId: string,
  revision: string,
  registry: ReadonlyMap<string, AnyEvaluatorDefinition> = DEFAULT_REGISTRY,
): AnyEvaluatorDefinition {
  const found = getEvaluator(evaluatorId, revision, registry);
  if (!found) {
    throw new EvaluatorRegistryError(
      "not-found",
      `Unknown evaluator ${evaluatorId}@${revision}.`,
    );
  }
  return found;
}

export function validateEvaluatorParams(
  evaluatorId: string,
  revision: string,
  params: unknown,
  registry: ReadonlyMap<string, AnyEvaluatorDefinition> = DEFAULT_REGISTRY,
): EvaluatorParams {
  const evaluator = requireEvaluator(evaluatorId, revision, registry);
  try {
    return evaluator.validateParams(params) as EvaluatorParams;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid evaluator params.";
    throw new EvaluatorRegistryError("invalid-params", message);
  }
}

/**
 * Resolve, validate params, and evaluate. Pure: no Date.now, randomness, or I/O.
 * Does not persist input; callers must store only EvaluationResult fields.
 */
export function runEvaluator(
  ref: EvaluatorRef,
  input: unknown,
  params: unknown,
  registry: ReadonlyMap<string, AnyEvaluatorDefinition> = DEFAULT_REGISTRY,
): EvaluationResult {
  if (!isRecord(ref) || typeof ref.evaluatorId !== "string" || typeof ref.revision !== "string") {
    throw new EvaluatorRegistryError("invalid-ref", "evaluator ref requires evaluatorId and revision.");
  }
  const evaluator = requireEvaluator(ref.evaluatorId, ref.revision, registry);
  let validated: unknown;
  try {
    validated = evaluator.validateParams(params);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid evaluator params.";
    throw new EvaluatorRegistryError("invalid-params", message);
  }
  return evaluator.evaluate(input, validated as never);
}

export function createEvaluatorRegistry(
  extras: readonly AnyEvaluatorDefinition[] = [],
): ReadonlyMap<string, AnyEvaluatorDefinition> {
  return buildRegistry([...BUILTIN_EVALUATORS, ...extras]);
}

export { DEFAULT_REGISTRY as evaluatorRegistry };
