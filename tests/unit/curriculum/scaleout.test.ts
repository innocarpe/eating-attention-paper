import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  CORE_MODULE_IDS,
  CURRICULUM_MANIFEST,
  DEEP_DIVE_MODULE_IDS,
  REMEDIAL_MODULE_IDS,
  validateCurriculumManifest,
} from "../../../src/learning/manifest";

describe("curriculum scale-out", () => {
  it("covers 8 core, 3 deep-dive, remedial modules within time budgets", () => {
    expect(CORE_MODULE_IDS).toHaveLength(8);
    expect(DEEP_DIVE_MODULE_IDS).toHaveLength(3);
    expect(REMEDIAL_MODULE_IDS.length).toBeGreaterThanOrEqual(2);
    const result = validateCurriculumManifest(CURRICULUM_MANIFEST);
    expect(result.ok).toBe(true);

    for (const id of CORE_MODULE_IDS) {
      const mod = CURRICULUM_MANIFEST.modules[id]!;
      expect(mod.activityIds.length).toBeGreaterThanOrEqual(3);
      for (const part of mod.sessionParts) {
        expect(part.estimatedMinutes).toBeGreaterThanOrEqual(30);
        expect(part.estimatedMinutes).toBeLessThanOrEqual(45);
      }
    }
  });

  it("ships Korean content files and eight concept widgets", () => {
    const contentRoot = "src/content/ko";
    const files: string[] = [];
    for (const folder of ["core", "deep-dive", "remedial", "capstone", "diagnostic"]) {
      for (const name of readdirSync(join(contentRoot, folder))) {
        if (name.endsWith(".md")) files.push(join(contentRoot, folder, name));
      }
    }
    expect(files.length).toBeGreaterThanOrEqual(16);
    const sample = readFileSync(files[0]!, "utf8");
    expect(sample).toMatch(/title:/);

    const widgets = readdirSync("src/components/widgets").filter((f) => f.endsWith("Widget.tsx"));
    expect(widgets).toHaveLength(8);
  });

  it("keeps required activity objective parity across the full registry", () => {
    for (const activity of Object.values(CURRICULUM_MANIFEST.activities)) {
      if (!activity.required) continue;
      expect(activity.primaryEvidenceSpec.objectiveId).toBe(activity.objectiveId);
      expect(activity.accessibleEvidenceSpec.objectiveId).toBe(activity.objectiveId);
      expect(activity.primaryEvidenceSpec.surfaceFormFamily).not.toBe(
        activity.accessibleEvidenceSpec.surfaceFormFamily,
      );
    }
  });
});
