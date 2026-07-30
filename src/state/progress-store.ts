import {
  assertNoRawLearnerBodies,
  createEmptyProgress,
  PROGRESS_SCHEMA_VERSION,
  type ProgressV1,
} from "./progress-schema";

export const PROGRESS_STORAGE_KEY = "attention.progress.v1";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class ProgressStore {
  private memory: ProgressV1;
  private readonly storage: StorageLike | null;
  private readonly key: string;

  constructor(
    manifestRevision: string,
    options?: {
      storage?: StorageLike | null;
      key?: string;
      initial?: ProgressV1;
    },
  ) {
    this.storage = options?.storage === undefined ? null : options.storage;
    this.key = options?.key ?? PROGRESS_STORAGE_KEY;
    this.memory = options?.initial ?? this.read() ?? createEmptyProgress(manifestRevision);
  }

  getSnapshot(): ProgressV1 {
    return structuredClone(this.memory);
  }

  /**
   * Atomically replace the whole ProgressV1 document.
   * On storage write failure, memory is rolled back and the error is rethrown.
   */
  commit(next: ProgressV1): ProgressV1 {
    if (next.schemaVersion !== PROGRESS_SCHEMA_VERSION) {
      throw new Error(`Unsupported progress schemaVersion ${next.schemaVersion}.`);
    }
    assertNoRawLearnerBodies(next);
    const previous = this.memory;
    this.memory = structuredClone(next);
    if (this.storage) {
      try {
        this.storage.setItem(this.key, JSON.stringify(this.memory));
      } catch (error) {
        this.memory = previous;
        throw error;
      }
    }
    return this.getSnapshot();
  }

  reset(): void {
    const revision = this.memory.manifestRevision;
    this.memory = createEmptyProgress(revision);
    this.storage?.removeItem(this.key);
  }

  private read(): ProgressV1 | null {
    if (!this.storage) return null;
    const raw = this.storage.getItem(this.key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProgressV1;
    assertNoRawLearnerBodies(parsed);
    return parsed;
  }
}

/** Simple in-memory Storage mock for tests. */
export class MemoryStorage implements StorageLike {
  private readonly data = new Map<string, string>();
  failNextWrite = false;

  getItem(key: string): string | null {
    return this.data.has(key) ? (this.data.get(key) ?? null) : null;
  }

  setItem(key: string, value: string): void {
    if (this.failNextWrite) {
      this.failNextWrite = false;
      throw new Error("QuotaExceededError");
    }
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }
}
