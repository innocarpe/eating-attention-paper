import { validateEvaluatorParams } from "../../evaluators/registry";
import type {
  ActivityDefinition,
  CurriculumManifest,
  ManifestValidationIssue,
  ManifestValidationResult,
  ModuleDefinition,
  VariantDefinition,
} from "./types";

function issue(code: string, message: string, path?: string): ManifestValidationIssue {
  return path ? { code, message, path } : { code, message };
}

function moduleMinutes(module: ModuleDefinition): number {
  return module.estimatedMinutes;
}

function hasCycle(modules: Readonly<Record<string, ModuleDefinition>>): string | null {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const dfs = (id: string): string | null => {
    if (visiting.has(id)) return id;
    if (visited.has(id)) return null;
    visiting.add(id);
    const mod = modules[id];
    if (!mod) return id;
    for (const pre of mod.prerequisites) {
      const hit = dfs(pre);
      if (hit) return hit;
    }
    visiting.delete(id);
    visited.add(id);
    return null;
  };
  for (const id of Object.keys(modules)) {
    const hit = dfs(id);
    if (hit) return hit;
  }
  return null;
}

function assertEvidenceParity(activity: ActivityDefinition, path: string, issues: ManifestValidationIssue[]) {
  const p = activity.primaryEvidenceSpec;
  const a = activity.accessibleEvidenceSpec;
  if (p.objectiveId !== a.objectiveId || p.parityObjectiveId !== a.parityObjectiveId || p.objectiveId !== activity.objectiveId) {
    issues.push(issue("parity-objective-mismatch", "Primary/accessible/activity objectiveIds must match.", path));
  }
  if (p.mode !== "primary" || a.mode !== "accessible") {
    issues.push(issue("parity-mode", "Evidence modes must be primary/accessible.", path));
  }
  if (p.passPredicateKey !== a.passPredicateKey) {
    issues.push(issue("parity-predicate", "Pass predicates must match across deliveries.", path));
  }
  if (p.surfaceFormFamily === a.surfaceFormFamily) {
    issues.push(issue("parity-surface-collapse", "Accessible surface family should differ from primary.", path));
  }
}

function assertVariantIndependence(
  variant: VariantDefinition,
  parent: ActivityDefinition | undefined,
  path: string,
  issues: ManifestValidationIssue[],
) {
  if (!parent) {
    issues.push(issue("variant-parent-missing", "Variant parent activity is missing.", path));
    return;
  }
  if (variant.activityId === parent.activityId) {
    issues.push(issue("variant-activity-id", "Variant activityId must differ from parent.", path));
  }
  if (variant.objectiveId !== parent.objectiveId) {
    issues.push(issue("variant-objective", "Variant must share parent objectiveId.", path));
  }
  if (variant.fixtureId === parent.primaryEvidenceSpec.fixtureId) {
    issues.push(issue("variant-fixture", "Variant fixture must differ from parent primary fixture.", path));
  }
  if (variant.surfaceFormFamily === parent.primaryEvidenceSpec.surfaceFormFamily) {
    issues.push(issue("variant-surface", "Variant surface family must differ from parent primary surface.", path));
  }
}

/** Validate locale-neutral curriculum invariants from the approved plan. */
export function validateCurriculumManifest(manifest: CurriculumManifest): ManifestValidationResult {
  const issues: ManifestValidationIssue[] = [];

  if (manifest.schemaVersion !== 1) {
    issues.push(issue("schema-version", "schemaVersion must be 1."));
  }
  if (!manifest.manifestRevision) {
    issues.push(issue("manifest-revision", "manifestRevision is required."));
  }

  const modules = Object.values(manifest.modules);
  const core = modules.filter((m) => m.kind === "core");
  const deep = modules.filter((m) => m.kind === "deep-dive");
  if (core.length !== 8) issues.push(issue("core-count", `Expected 8 core modules, found ${core.length}.`));
  if (deep.length !== 3) issues.push(issue("deep-count", `Expected 3 deep-dive modules, found ${deep.length}.`));
  if (deep.some((m) => m.blocksCoreCompletion || m.required)) {
    issues.push(issue("deep-optional", "Deep-dive modules must be optional and non-blocking."));
  }

  const cycle = hasCycle(manifest.modules);
  if (cycle) issues.push(issue("prerequisite-cycle", `Prerequisite cycle involving ${cycle}.`));

  const seenActivity = new Set<string>();
  for (const mod of modules) {
    if (!mod.moduleRevision) issues.push(issue("module-revision", "moduleRevision required.", mod.moduleId));
    for (const part of mod.sessionParts) {
      if (
        part.estimatedMinutes < manifest.timeBudget.sessionMinMinutes ||
        part.estimatedMinutes > manifest.timeBudget.sessionMaxMinutes
      ) {
        issues.push(
          issue(
            "session-minutes",
            `Session part ${part.sessionPartId} must be ${manifest.timeBudget.sessionMinMinutes}-${manifest.timeBudget.sessionMaxMinutes} minutes.`,
            mod.moduleId,
          ),
        );
      }
    }
    for (const pre of mod.prerequisites) {
      if (!manifest.modules[pre]) {
        issues.push(issue("missing-prerequisite", `Missing prerequisite module ${pre}.`, mod.moduleId));
      }
    }
    for (const activityId of mod.activityIds) {
      if (seenActivity.has(activityId)) {
        issues.push(issue("duplicate-activity", `Activity ${activityId} referenced twice.`, mod.moduleId));
      }
      seenActivity.add(activityId);
      const activity = manifest.activities[activityId];
      if (!activity) {
        issues.push(issue("missing-activity", `Activity ${activityId} not in registry.`, mod.moduleId));
        continue;
      }
      if (activity.moduleId !== mod.moduleId) {
        issues.push(issue("activity-module-mismatch", `Activity ${activityId} module mismatch.`, activityId));
      }
      if (!manifest.objectives[activity.objectiveId]) {
        issues.push(issue("missing-objective", `Objective ${activity.objectiveId} missing.`, activityId));
      }
      if (activity.required) {
        assertEvidenceParity(activity, activityId, issues);
        try {
          validateEvaluatorParams(
            activity.primaryEvidenceSpec.evaluator.evaluatorId,
            activity.primaryEvidenceSpec.evaluator.evaluatorRevision,
            activity.primaryEvidenceSpec.evaluator.params,
          );
          validateEvaluatorParams(
            activity.accessibleEvidenceSpec.evaluator.evaluatorId,
            activity.accessibleEvidenceSpec.evaluator.evaluatorRevision,
            activity.accessibleEvidenceSpec.evaluator.params,
          );
        } catch (error) {
          issues.push(
            issue(
              "evaluator-params",
              error instanceof Error ? error.message : "Invalid evaluator params.",
              activityId,
            ),
          );
        }
      }
      for (const variantId of activity.variantPool) {
        const variant = manifest.variants[variantId];
        if (!variant) {
          issues.push(issue("missing-variant", `Variant ${variantId} missing.`, activityId));
          continue;
        }
        assertVariantIndependence(variant, activity, variantId, issues);
      }
      if (activity.required && activity.scorable && activity.variantPool.length < 2) {
        // Require at least 2 variants for core/remedial required scorable concept families.
        if (mod.kind === "core") {
          issues.push(issue("variant-count", `Core required activity ${activityId} needs ≥2 variants.`, activityId));
        }
      }
    }
  }

  // Time budgets
  const coreMinutes = core.reduce((sum, m) => sum + moduleMinutes(m), 0);
  const diagnosticMinutes = manifest.diagnostic.estimatedMinutes;
  const mainMinutes = Math.round(
    (coreMinutes + diagnosticMinutes) * manifest.timeBudget.masteryOverheadFactor,
  );
  if (mainMinutes < manifest.timeBudget.mainPathMinMinutes || mainMinutes > manifest.timeBudget.mainPathMaxMinutes) {
    issues.push(
      issue(
        "main-path-time",
        `Main path estimate ${mainMinutes}m outside ${manifest.timeBudget.mainPathMinMinutes}-${manifest.timeBudget.mainPathMaxMinutes}.`,
      ),
    );
  }
  const remedialMinutes = modules
    .filter((m) => m.kind === "remedial")
    .reduce((sum, m) => sum + moduleMinutes(m), 0);
  if (remedialMinutes > manifest.timeBudget.remedialMaxMinutes) {
    issues.push(issue("remedial-time", `Remedial path ${remedialMinutes}m exceeds max.`));
  }

  // Diagnostic evaluator params
  for (const item of manifest.diagnostic.items) {
    try {
      validateEvaluatorParams(
        item.primaryEvidenceSpec.evaluator.evaluatorId,
        item.primaryEvidenceSpec.evaluator.evaluatorRevision,
        item.primaryEvidenceSpec.evaluator.params,
      );
      validateEvaluatorParams(
        item.accessibleEvidenceSpec.evaluator.evaluatorId,
        item.accessibleEvidenceSpec.evaluator.evaluatorRevision,
        item.accessibleEvidenceSpec.evaluator.params,
      );
    } catch (error) {
      issues.push(
        issue(
          "diagnostic-evaluator-params",
          error instanceof Error ? error.message : "Invalid diagnostic evaluator params.",
          item.itemId,
        ),
      );
    }
  }

  // Variant evaluator params
  for (const variant of Object.values(manifest.variants)) {
    try {
      validateEvaluatorParams(
        variant.evaluator.evaluatorId,
        variant.evaluator.evaluatorRevision,
        variant.evaluator.params,
      );
    } catch (error) {
      issues.push(
        issue(
          "variant-evaluator-params",
          error instanceof Error ? error.message : "Invalid variant evaluator params.",
          variant.variantId,
        ),
      );
    }
  }

  // Diagnostic threshold lock
  if (manifest.diagnostic.readyThresholdPercent !== 70) {
    issues.push(issue("diagnostic-threshold", "Diagnostic ready threshold must be exactly 70."));
  }
  const requiredDiag = manifest.diagnostic.items.filter((i) => i.required);
  if (requiredDiag.length < 8) {
    issues.push(issue("diagnostic-coverage", "Diagnostic bank needs at least 8 required items."));
  }
  for (const item of manifest.diagnostic.items) {
    if (item.primaryEvidenceSpec.objectiveId !== item.accessibleEvidenceSpec.objectiveId) {
      issues.push(issue("diagnostic-parity", "Diagnostic item parity objective mismatch.", item.itemId));
    }
  }

  return { ok: issues.length === 0, issues };
}
