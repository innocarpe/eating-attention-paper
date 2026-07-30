/**
 * Strict versioned message protocol for parent↔opaque iframe and iframe↔worker.
 *
 * Validation rejects unknown keys, wrong channel/version, missing required
 * fields, cyclic/non-cloneable/oversized payloads, and invalid shapes.
 * Callers MUST still enforce source/window, nonce, run-id, and state machines.
 * No code/input/output/error body is persisted by these helpers.
 */

import {
  CODE_MAX_BYTES,
  MAX_NUMERIC_ELEMENTS,
  PROTOCOL_VERSION,
} from "./limits";

export const PARENT_FRAME_CHANNEL = "attention-sandbox" as const;
export const WORKER_CHANNEL = "attention-sandbox-worker" as const;

export type ProtocolVersion = typeof PROTOCOL_VERSION;

export type SandboxControllerState = "idle" | "booting" | "ready" | "running" | "disposed";

export interface RuntimeSelfCheck {
  pyodide: string;
  numpy: string;
  selfCheck: "passed";
}

export interface SandboxErrorBody {
  kind: string;
  message: string;
}

export type ParentToFrame =
  | {
      channel: typeof PARENT_FRAME_CHANNEL;
      v: ProtocolVersion;
      type: "INIT";
      nonce: string;
      workerSource: string;
    }
  | {
      channel: typeof PARENT_FRAME_CHANNEL;
      v: ProtocolVersion;
      type: "RUN";
      nonce: string;
      runId: string;
      code: string;
      inputs?: unknown;
    }
  | {
      channel: typeof PARENT_FRAME_CHANNEL;
      v: ProtocolVersion;
      type: "TERMINATE";
      nonce: string;
      runId?: string;
    }
  | {
      channel: typeof PARENT_FRAME_CHANNEL;
      v: ProtocolVersion;
      type: "DISPOSE";
      nonce: string;
    };

export type FrameToParent =
  | {
      channel: typeof PARENT_FRAME_CHANNEL;
      v: ProtocolVersion;
      type: "BOOTING";
      nonce: string;
    }
  | {
      channel: typeof PARENT_FRAME_CHANNEL;
      v: ProtocolVersion;
      type: "READY";
      nonce: string;
      runtime: RuntimeSelfCheck;
    }
  | {
      channel: typeof PARENT_FRAME_CHANNEL;
      v: ProtocolVersion;
      type: "RESULT";
      nonce: string;
      runId: string;
      ok: true;
      value: unknown;
      durationMs: number;
    }
  | {
      channel: typeof PARENT_FRAME_CHANNEL;
      v: ProtocolVersion;
      type: "RESULT";
      nonce: string;
      runId: string;
      ok: false;
      error: SandboxErrorBody;
      durationMs: number;
    }
  | {
      channel: typeof PARENT_FRAME_CHANNEL;
      v: ProtocolVersion;
      type: "TIMEOUT";
      nonce: string;
      runId: string;
      observedTerminationMs: number;
    }
  | {
      channel: typeof PARENT_FRAME_CHANNEL;
      v: ProtocolVersion;
      type: "FATAL";
      nonce: string;
      error: SandboxErrorBody;
    };

/** Frame → worker payloads. INIT maps to BOOT (no workerSource). */
export type FrameToWorker =
  | {
      channel: typeof WORKER_CHANNEL;
      v: ProtocolVersion;
      type: "BOOT";
      nonce: string;
    }
  | {
      channel: typeof WORKER_CHANNEL;
      v: ProtocolVersion;
      type: "RUN";
      nonce: string;
      runId: string;
      code: string;
      inputs?: unknown;
    }
  | {
      channel: typeof WORKER_CHANNEL;
      v: ProtocolVersion;
      type: "TERMINATE";
      nonce: string;
      runId?: string;
    }
  | {
      channel: typeof WORKER_CHANNEL;
      v: ProtocolVersion;
      type: "DISPOSE";
      nonce: string;
    };

/** Worker → frame payloads (never sent to parent directly). */
export type WorkerToFrame =
  | {
      channel: typeof WORKER_CHANNEL;
      v: ProtocolVersion;
      type: "BOOTING";
      nonce: string;
    }
  | {
      channel: typeof WORKER_CHANNEL;
      v: ProtocolVersion;
      type: "READY";
      nonce: string;
      runtime: RuntimeSelfCheck;
    }
  | {
      channel: typeof WORKER_CHANNEL;
      v: ProtocolVersion;
      type: "RESULT";
      nonce: string;
      runId: string;
      ok: true;
      value: unknown;
      durationMs: number;
    }
  | {
      channel: typeof WORKER_CHANNEL;
      v: ProtocolVersion;
      type: "RESULT";
      nonce: string;
      runId: string;
      ok: false;
      error: SandboxErrorBody;
      durationMs: number;
    }
  | {
      channel: typeof WORKER_CHANNEL;
      v: ProtocolVersion;
      type: "TIMEOUT";
      nonce: string;
      runId: string;
      observedTerminationMs: number;
    }
  | {
      channel: typeof WORKER_CHANNEL;
      v: ProtocolVersion;
      type: "FATAL";
      nonce: string;
      error: SandboxErrorBody;
    };

export type SandboxRunSuccess = {
  ok: true;
  runId: string;
  value: unknown;
  durationMs: number;
};

export type SandboxRunFailure = {
  ok: false;
  runId: string;
  error: SandboxErrorBody;
  durationMs: number;
};

export type SandboxRunTimeout = {
  ok: false;
  runId: string;
  timedOut: true;
  observedTerminationMs: number;
  error: { kind: "timeout"; message: string };
};

/** Typed outcome of one controller.run() call. Never stored by the controller. */
export type SandboxRunResult = SandboxRunSuccess | SandboxRunFailure | SandboxRunTimeout;

export class ProtocolValidationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ProtocolValidationError";
    this.code = code;
  }
}

const PARENT_TO_FRAME_TYPES = new Set(["INIT", "RUN", "TERMINATE", "DISPOSE"]);
const FRAME_TO_PARENT_TYPES = new Set([
  "BOOTING",
  "READY",
  "RESULT",
  "TIMEOUT",
  "FATAL",
]);
const FRAME_TO_WORKER_TYPES = new Set(["BOOT", "RUN", "TERMINATE", "DISPOSE"]);
const WORKER_TO_FRAME_TYPES = new Set([
  "BOOTING",
  "READY",
  "RESULT",
  "TIMEOUT",
  "FATAL",
]);

/** Soft ceiling for structured-clone serialized envelope size (bytes). */
export const MAX_ENVELOPE_BYTES = 512 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function utf8ByteLength(value: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value).byteLength;
  }
  // Fallback for non-browser test hosts.
  return unescape(encodeURIComponent(value)).length;
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
): void {
  const keys = Object.keys(value).sort();
  const expected = [...allowed].sort();
  if (keys.length !== expected.length) {
    throw new ProtocolValidationError(
      "unknown-key",
      `${label} has unexpected keys.`,
    );
  }
  for (let i = 0; i < expected.length; i += 1) {
    if (keys[i] !== expected[i]) {
      throw new ProtocolValidationError(
        "unknown-key",
        `${label} has unexpected keys.`,
      );
    }
  }
}

function assertSubsetKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) {
      throw new ProtocolValidationError(
        "unknown-key",
        `${label} has unexpected key "${key}".`,
      );
    }
  }
}

function assertNonce(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.length < 16 || value.length > 128) {
    throw new ProtocolValidationError(
      "invalid-nonce",
      `${label} nonce must be a 16–128 char string.`,
    );
  }
}

function assertRunId(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.length < 8 || value.length > 128) {
    throw new ProtocolValidationError(
      "invalid-run-id",
      `${label} runId must be an 8–128 char string.`,
    );
  }
}

function assertErrorBody(
  value: unknown,
  label: string,
): asserts value is SandboxErrorBody {
  if (!isRecord(value)) {
    throw new ProtocolValidationError(
      "invalid-error",
      `${label} error must be an object.`,
    );
  }
  assertExactKeys(value, ["kind", "message"], `${label}.error`);
  if (typeof value.kind !== "string" || value.kind.length === 0 || value.kind.length > 64) {
    throw new ProtocolValidationError(
      "invalid-error",
      `${label} error.kind is invalid.`,
    );
  }
  if (
    typeof value.message !== "string" ||
    value.message.length === 0 ||
    value.message.length > 512
  ) {
    throw new ProtocolValidationError(
      "invalid-error",
      `${label} error.message is invalid.`,
    );
  }
}

function assertRuntimeSelfCheck(
  value: unknown,
  label: string,
): asserts value is RuntimeSelfCheck {
  if (!isRecord(value)) {
    throw new ProtocolValidationError(
      "invalid-runtime",
      `${label} runtime must be an object.`,
    );
  }
  assertExactKeys(value, ["pyodide", "numpy", "selfCheck"], `${label}.runtime`);
  if (typeof value.pyodide !== "string" || value.pyodide.length === 0) {
    throw new ProtocolValidationError(
      "invalid-runtime",
      `${label} runtime.pyodide is required.`,
    );
  }
  if (typeof value.numpy !== "string" || value.numpy.length === 0) {
    throw new ProtocolValidationError(
      "invalid-runtime",
      `${label} runtime.numpy is required.`,
    );
  }
  if (value.selfCheck !== "passed") {
    throw new ProtocolValidationError(
      "invalid-runtime",
      `${label} runtime.selfCheck must be "passed".`,
    );
  }
}

/**
 * Counts finite numeric leaves in arrays/typed arrays/plain objects.
 * Rejects structures that exceed MAX_NUMERIC_ELEMENTS.
 */
export function countNumericElements(value: unknown, seen = new WeakSet<object>()): number {
  if (value == null) {
    return 0;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? 1 : 0;
  }
  if (typeof value === "boolean" || typeof value === "string" || typeof value === "bigint") {
    return 0;
  }
  if (typeof value !== "object") {
    return 0;
  }
  if (seen.has(value as object)) {
    throw new ProtocolValidationError("cyclic-payload", "Cyclic structure is not allowed.");
  }
  seen.add(value as object);

  if (ArrayBuffer.isView(value)) {
    const length = (value as ArrayBufferView).byteLength /
      ((value as { BYTES_PER_ELEMENT?: number }).BYTES_PER_ELEMENT ?? 1);
    if (length > MAX_NUMERIC_ELEMENTS) {
      throw new ProtocolValidationError(
        "oversized-numeric",
        `Numeric payload exceeds ${MAX_NUMERIC_ELEMENTS} elements.`,
      );
    }
    return length;
  }
  if (value instanceof ArrayBuffer) {
    // Treat raw buffers as byte-length elements for the cap.
    if (value.byteLength > MAX_NUMERIC_ELEMENTS) {
      throw new ProtocolValidationError(
        "oversized-numeric",
        `Numeric payload exceeds ${MAX_NUMERIC_ELEMENTS} elements.`,
      );
    }
    return value.byteLength;
  }
  if (Array.isArray(value)) {
    let total = 0;
    for (const item of value) {
      total += countNumericElements(item, seen);
      if (total > MAX_NUMERIC_ELEMENTS) {
        throw new ProtocolValidationError(
          "oversized-numeric",
          `Numeric payload exceeds ${MAX_NUMERIC_ELEMENTS} elements.`,
        );
      }
    }
    return total;
  }
  let total = 0;
  for (const item of Object.values(value as Record<string, unknown>)) {
    total += countNumericElements(item, seen);
    if (total > MAX_NUMERIC_ELEMENTS) {
      throw new ProtocolValidationError(
        "oversized-numeric",
        `Numeric payload exceeds ${MAX_NUMERIC_ELEMENTS} elements.`,
      );
    }
  }
  return total;
}

/**
 * Ensures a value is structured-cloneable and within the envelope size ceiling.
 * Throws ProtocolValidationError on cycles, non-cloneable values, or oversize.
 */
export function assertCloneableWithinLimit(value: unknown, label: string): void {
  let cloned: unknown;
  try {
    if (typeof structuredClone === "function") {
      cloned = structuredClone(value);
    } else {
      cloned = JSON.parse(JSON.stringify(value));
    }
  } catch {
    throw new ProtocolValidationError(
      "non-cloneable",
      `${label} is cyclic or not structured-cloneable.`,
    );
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(cloned);
  } catch {
    throw new ProtocolValidationError(
      "non-cloneable",
      `${label} cannot be serialized for size checks.`,
    );
  }
  if (serialized !== undefined && utf8ByteLength(serialized) > MAX_ENVELOPE_BYTES) {
    throw new ProtocolValidationError(
      "oversized-payload",
      `${label} exceeds ${MAX_ENVELOPE_BYTES} bytes.`,
    );
  }
}

function assertCode(code: unknown): asserts code is string {
  if (typeof code !== "string") {
    throw new ProtocolValidationError("invalid-code", "code must be a string.");
  }
  if (utf8ByteLength(code) > CODE_MAX_BYTES) {
    throw new ProtocolValidationError(
      "oversized-code",
      `code exceeds ${CODE_MAX_BYTES} bytes.`,
    );
  }
}

function assertOptionalInputs(inputs: unknown): void {
  if (inputs === undefined) {
    return;
  }
  countNumericElements(inputs);
  assertCloneableWithinLimit(inputs, "inputs");
}

function parseBaseEnvelope(
  value: unknown,
  channel: typeof PARENT_FRAME_CHANNEL | typeof WORKER_CHANNEL,
  allowedTypes: ReadonlySet<string>,
  label: string,
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new ProtocolValidationError("invalid-envelope", `${label} must be an object.`);
  }
  assertCloneableWithinLimit(value, label);

  if (value.channel !== channel) {
    throw new ProtocolValidationError(
      "wrong-channel",
      `${label} channel must be "${channel}".`,
    );
  }
  if (value.v !== PROTOCOL_VERSION) {
    throw new ProtocolValidationError(
      "wrong-version",
      `${label} v must be ${PROTOCOL_VERSION}.`,
    );
  }
  if (typeof value.type !== "string" || !allowedTypes.has(value.type)) {
    throw new ProtocolValidationError(
      "unknown-type",
      `${label} type is not allowed.`,
    );
  }
  assertNonce(value.nonce, label);
  return value;
}

function parseResultLike(
  value: Record<string, unknown>,
  label: string,
): void {
  assertRunId(value.runId, label);
  if (typeof value.durationMs !== "number" || !Number.isFinite(value.durationMs) || value.durationMs < 0) {
    throw new ProtocolValidationError(
      "invalid-duration",
      `${label} durationMs must be a non-negative finite number.`,
    );
  }
  if (value.ok === true) {
    assertSubsetKeys(
      value,
      ["channel", "v", "type", "nonce", "runId", "ok", "value", "durationMs"],
      label,
    );
    countNumericElements(value.value);
    assertCloneableWithinLimit(value.value, `${label}.value`);
    return;
  }
  if (value.ok === false) {
    assertExactKeys(
      value,
      ["channel", "v", "type", "nonce", "runId", "ok", "error", "durationMs"],
      label,
    );
    assertErrorBody(value.error, label);
    return;
  }
  throw new ProtocolValidationError("invalid-result", `${label} ok must be boolean.`);
}

/** Parse and validate a parent → frame envelope. */
export function parseParentToFrame(value: unknown): ParentToFrame {
  const label = "ParentToFrame";
  const msg = parseBaseEnvelope(value, PARENT_FRAME_CHANNEL, PARENT_TO_FRAME_TYPES, label);
  switch (msg.type) {
    case "INIT": {
      assertExactKeys(msg, ["channel", "v", "type", "nonce", "workerSource"], label);
      if (typeof msg.workerSource !== "string" || msg.workerSource.length === 0) {
        throw new ProtocolValidationError(
          "invalid-worker-source",
          "INIT.workerSource must be non-empty text.",
        );
      }
      if (utf8ByteLength(msg.workerSource) > 8 * 1024 * 1024) {
        throw new ProtocolValidationError(
          "oversized-worker-source",
          "INIT.workerSource exceeds 8 MiB.",
        );
      }
      return msg as ParentToFrame;
    }
    case "RUN": {
      assertSubsetKeys(
        msg,
        ["channel", "v", "type", "nonce", "runId", "code", "inputs"],
        label,
      );
      assertRunId(msg.runId, label);
      assertCode(msg.code);
      assertOptionalInputs(msg.inputs);
      return msg as ParentToFrame;
    }
    case "TERMINATE": {
      assertSubsetKeys(msg, ["channel", "v", "type", "nonce", "runId"], label);
      if (msg.runId !== undefined) {
        assertRunId(msg.runId, label);
      }
      return msg as ParentToFrame;
    }
    case "DISPOSE": {
      assertExactKeys(msg, ["channel", "v", "type", "nonce"], label);
      return msg as ParentToFrame;
    }
    default:
      throw new ProtocolValidationError("unknown-type", `${label} type is not allowed.`);
  }
}

/** Parse and validate a frame → parent envelope. */
export function parseFrameToParent(value: unknown): FrameToParent {
  const label = "FrameToParent";
  const msg = parseBaseEnvelope(value, PARENT_FRAME_CHANNEL, FRAME_TO_PARENT_TYPES, label);
  switch (msg.type) {
    case "BOOTING": {
      assertExactKeys(msg, ["channel", "v", "type", "nonce"], label);
      return msg as FrameToParent;
    }
    case "READY": {
      assertExactKeys(msg, ["channel", "v", "type", "nonce", "runtime"], label);
      assertRuntimeSelfCheck(msg.runtime, label);
      return msg as FrameToParent;
    }
    case "RESULT": {
      parseResultLike(msg, label);
      return msg as FrameToParent;
    }
    case "TIMEOUT": {
      assertExactKeys(
        msg,
        ["channel", "v", "type", "nonce", "runId", "observedTerminationMs"],
        label,
      );
      assertRunId(msg.runId, label);
      if (
        typeof msg.observedTerminationMs !== "number" ||
        !Number.isFinite(msg.observedTerminationMs) ||
        msg.observedTerminationMs < 0
      ) {
        throw new ProtocolValidationError(
          "invalid-timeout",
          "TIMEOUT.observedTerminationMs must be a non-negative finite number.",
        );
      }
      return msg as FrameToParent;
    }
    case "FATAL": {
      assertExactKeys(msg, ["channel", "v", "type", "nonce", "error"], label);
      assertErrorBody(msg.error, label);
      return msg as FrameToParent;
    }
    default:
      throw new ProtocolValidationError("unknown-type", `${label} type is not allowed.`);
  }
}

/** Parse and validate a frame → worker envelope. */
export function parseFrameToWorker(value: unknown): FrameToWorker {
  const label = "FrameToWorker";
  const msg = parseBaseEnvelope(value, WORKER_CHANNEL, FRAME_TO_WORKER_TYPES, label);
  switch (msg.type) {
    case "BOOT": {
      assertExactKeys(msg, ["channel", "v", "type", "nonce"], label);
      return msg as FrameToWorker;
    }
    case "RUN": {
      assertSubsetKeys(
        msg,
        ["channel", "v", "type", "nonce", "runId", "code", "inputs"],
        label,
      );
      assertRunId(msg.runId, label);
      assertCode(msg.code);
      assertOptionalInputs(msg.inputs);
      return msg as FrameToWorker;
    }
    case "TERMINATE": {
      assertSubsetKeys(msg, ["channel", "v", "type", "nonce", "runId"], label);
      if (msg.runId !== undefined) {
        assertRunId(msg.runId, label);
      }
      return msg as FrameToWorker;
    }
    case "DISPOSE": {
      assertExactKeys(msg, ["channel", "v", "type", "nonce"], label);
      return msg as FrameToWorker;
    }
    default:
      throw new ProtocolValidationError("unknown-type", `${label} type is not allowed.`);
  }
}

/** Parse and validate a worker → frame envelope. */
export function parseWorkerToFrame(value: unknown): WorkerToFrame {
  const label = "WorkerToFrame";
  const msg = parseBaseEnvelope(value, WORKER_CHANNEL, WORKER_TO_FRAME_TYPES, label);
  switch (msg.type) {
    case "BOOTING": {
      assertExactKeys(msg, ["channel", "v", "type", "nonce"], label);
      return msg as WorkerToFrame;
    }
    case "READY": {
      assertExactKeys(msg, ["channel", "v", "type", "nonce", "runtime"], label);
      assertRuntimeSelfCheck(msg.runtime, label);
      return msg as WorkerToFrame;
    }
    case "RESULT": {
      parseResultLike(msg, label);
      return msg as WorkerToFrame;
    }
    case "TIMEOUT": {
      assertExactKeys(
        msg,
        ["channel", "v", "type", "nonce", "runId", "observedTerminationMs"],
        label,
      );
      assertRunId(msg.runId, label);
      if (
        typeof msg.observedTerminationMs !== "number" ||
        !Number.isFinite(msg.observedTerminationMs) ||
        msg.observedTerminationMs < 0
      ) {
        throw new ProtocolValidationError(
          "invalid-timeout",
          "TIMEOUT.observedTerminationMs must be a non-negative finite number.",
        );
      }
      return msg as WorkerToFrame;
    }
    case "FATAL": {
      assertExactKeys(msg, ["channel", "v", "type", "nonce", "error"], label);
      assertErrorBody(msg.error, label);
      return msg as WorkerToFrame;
    }
    default:
      throw new ProtocolValidationError("unknown-type", `${label} type is not allowed.`);
  }
}

/**
 * Translate a validated parent→frame command into the worker-channel shape.
 * INIT becomes BOOT; workerSource is never forwarded.
 */
export function toWorkerMessage(message: ParentToFrame): FrameToWorker {
  switch (message.type) {
    case "INIT":
      return {
        channel: WORKER_CHANNEL,
        v: PROTOCOL_VERSION,
        type: "BOOT",
        nonce: message.nonce,
      };
    case "RUN": {
      const out: FrameToWorker = {
        channel: WORKER_CHANNEL,
        v: PROTOCOL_VERSION,
        type: "RUN",
        nonce: message.nonce,
        runId: message.runId,
        code: message.code,
      };
      if (message.inputs !== undefined) {
        (out as { inputs?: unknown }).inputs = message.inputs;
      }
      return out;
    }
    case "TERMINATE": {
      const out: FrameToWorker = {
        channel: WORKER_CHANNEL,
        v: PROTOCOL_VERSION,
        type: "TERMINATE",
        nonce: message.nonce,
      };
      if (message.runId !== undefined) {
        (out as { runId?: string }).runId = message.runId;
      }
      return out;
    }
    case "DISPOSE":
      return {
        channel: WORKER_CHANNEL,
        v: PROTOCOL_VERSION,
        type: "DISPOSE",
        nonce: message.nonce,
      };
  }
}

/**
 * Translate a validated worker→frame event into the parent-channel shape.
 * Worker never talks to the parent; the frame is the only bridge.
 */
export function toParentMessage(message: WorkerToFrame): FrameToParent {
  switch (message.type) {
    case "BOOTING":
      return {
        channel: PARENT_FRAME_CHANNEL,
        v: PROTOCOL_VERSION,
        type: "BOOTING",
        nonce: message.nonce,
      };
    case "READY":
      return {
        channel: PARENT_FRAME_CHANNEL,
        v: PROTOCOL_VERSION,
        type: "READY",
        nonce: message.nonce,
        runtime: message.runtime,
      };
    case "RESULT":
      if (message.ok) {
        return {
          channel: PARENT_FRAME_CHANNEL,
          v: PROTOCOL_VERSION,
          type: "RESULT",
          nonce: message.nonce,
          runId: message.runId,
          ok: true,
          value: message.value,
          durationMs: message.durationMs,
        };
      }
      return {
        channel: PARENT_FRAME_CHANNEL,
        v: PROTOCOL_VERSION,
        type: "RESULT",
        nonce: message.nonce,
        runId: message.runId,
        ok: false,
        error: message.error,
        durationMs: message.durationMs,
      };
    case "TIMEOUT":
      return {
        channel: PARENT_FRAME_CHANNEL,
        v: PROTOCOL_VERSION,
        type: "TIMEOUT",
        nonce: message.nonce,
        runId: message.runId,
        observedTerminationMs: message.observedTerminationMs,
      };
    case "FATAL":
      return {
        channel: PARENT_FRAME_CHANNEL,
        v: PROTOCOL_VERSION,
        type: "FATAL",
        nonce: message.nonce,
        error: message.error,
      };
  }
}

/** Cryptographically strong hex nonce for channel binding. */
export function createChannelNonce(bytes = 16): string {
  const size = Math.max(16, Math.min(64, bytes));
  const buffer = new Uint8Array(size);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(buffer);
  } else {
    for (let i = 0; i < size; i += 1) {
      buffer[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(buffer, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Cryptographically strong run id. */
export function createRunId(): string {
  return createChannelNonce(16);
}
