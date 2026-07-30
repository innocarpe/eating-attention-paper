export interface RevisionSnapshot {
  readonly manifestRevision: string;
  readonly moduleRevision: string;
  readonly contentRevision: string;
  readonly evaluatorRegistryRevision: string;
}

export function revisionsMatch(a: RevisionSnapshot, b: RevisionSnapshot): boolean {
  return (
    a.manifestRevision === b.manifestRevision &&
    a.moduleRevision === b.moduleRevision &&
    a.contentRevision === b.contentRevision &&
    a.evaluatorRegistryRevision === b.evaluatorRegistryRevision
  );
}

export function isAttemptCurrent(
  attempt: RevisionSnapshot,
  current: RevisionSnapshot,
): boolean {
  return revisionsMatch(attempt, current);
}
