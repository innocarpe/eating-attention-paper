import { ACTIVITIES } from "./activities";
import { DIAGNOSTIC_BANK } from "./diagnostic";
import {
  CAPSTONE_MODULE_IDS,
  CORE_MODULE_IDS,
  DEEP_DIVE_MODULE_IDS,
  MODULES,
  OBJECTIVES,
  REMEDIAL_MODULE_IDS,
} from "./modules";
import type { CurriculumManifest } from "./types";
import { validateCurriculumManifest } from "./validate";
import { VARIANTS } from "./variants";

export * from "./types";
export * from "./validate";
export {
  ACTIVITIES,
  DIAGNOSTIC_BANK,
  MODULES,
  OBJECTIVES,
  VARIANTS,
  CORE_MODULE_IDS,
  DEEP_DIVE_MODULE_IDS,
  REMEDIAL_MODULE_IDS,
  CAPSTONE_MODULE_IDS,
};

export const TIME_BUDGET = Object.freeze({
  mainPathMinMinutes: 1500,
  mainPathMaxMinutes: 2100,
  remedialMaxMinutes: 900,
  sessionMinMinutes: 30,
  sessionMaxMinutes: 45,
  masteryOverheadFactor: 1.35,
});

/** Frozen locale-neutral curriculum manifest (Korean presentation strings allowed). */
export const CURRICULUM_MANIFEST: CurriculumManifest = Object.freeze({
  schemaVersion: 1,
  manifestRevision: "1",
  title: "Attention Is All You Need — 0→100",
  timeBudget: TIME_BUDGET,
  objectives: OBJECTIVES,
  modules: MODULES,
  activities: ACTIVITIES,
  diagnostic: DIAGNOSTIC_BANK,
  variants: VARIANTS,
});

export function assertCurriculumManifest(manifest: CurriculumManifest = CURRICULUM_MANIFEST): CurriculumManifest {
  const result = validateCurriculumManifest(manifest);
  if (!result.ok) {
    const details = result.issues.map((i) => `${i.code}: ${i.message}`).join("; ");
    throw new Error(`Invalid curriculum manifest: ${details}`);
  }
  return manifest;
}
