import { describe, expect, it } from "vitest";

import { CODE_MAX_BYTES, MAX_NUMERIC_ELEMENTS } from "../../../src/sandbox/limits";
import {
  PARENT_FRAME_CHANNEL,
  ProtocolValidationError,
  WORKER_CHANNEL,
  countNumericElements,
  createChannelNonce,
  createRunId,
  parseFrameToParent,
  parseFrameToWorker,
  parseParentToFrame,
  parseWorkerToFrame,
  toParentMessage,
  toWorkerMessage,
} from "../../../src/sandbox/protocol";

const nonce = "a".repeat(32);
const runId = "b".repeat(32);

describe("sandbox protocol", () => {
  it("creates cryptographic-looking nonces and run ids", () => {
    const a = createChannelNonce();
    const b = createRunId();
    expect(a).toHaveLength(32);
    expect(b).toHaveLength(32);
    expect(a).not.toBe(b);
  });

  it("accepts a valid INIT and maps it to worker BOOT without workerSource", () => {
    const init = parseParentToFrame({
      channel: PARENT_FRAME_CHANNEL,
      v: 1,
      type: "INIT",
      nonce,
      workerSource: "export {}",
    });
    expect(init.type).toBe("INIT");
    const boot = toWorkerMessage(init);
    expect(boot).toEqual({
      channel: WORKER_CHANNEL,
      v: 1,
      type: "BOOT",
      nonce,
    });
    expect(JSON.stringify(boot)).not.toContain("workerSource");
  });

  it("rejects unknown keys, wrong channel, oversized code, and oversized numeric payloads", () => {
    expect(() =>
      parseParentToFrame({
        channel: PARENT_FRAME_CHANNEL,
        v: 1,
        type: "INIT",
        nonce,
        workerSource: "x",
        extra: true,
      }),
    ).toThrow(ProtocolValidationError);

    expect(() =>
      parseFrameToParent({
        channel: WORKER_CHANNEL,
        v: 1,
        type: "BOOTING",
        nonce,
      }),
    ).toThrow(/channel/);

    expect(() =>
      parseParentToFrame({
        channel: PARENT_FRAME_CHANNEL,
        v: 1,
        type: "RUN",
        nonce,
        runId,
        code: "x".repeat(CODE_MAX_BYTES + 1),
      }),
    ).toThrow(/code/);

    expect(() => countNumericElements(Array.from({ length: MAX_NUMERIC_ELEMENTS + 1 }, () => 1))).toThrow(
      /Numeric payload/,
    );
  });

  it("validates READY self-check and RESULT success/failure shapes", () => {
    const ready = parseFrameToParent({
      channel: PARENT_FRAME_CHANNEL,
      v: 1,
      type: "READY",
      nonce,
      runtime: { pyodide: "314.0.3", numpy: "2.4.3", selfCheck: "passed" },
    });
    expect(ready.type).toBe("READY");

    expect(() =>
      parseFrameToParent({
        channel: PARENT_FRAME_CHANNEL,
        v: 1,
        type: "READY",
        nonce,
        runtime: { pyodide: "314.0.3", numpy: "2.4.3", selfCheck: "failed" },
      }),
    ).toThrow(ProtocolValidationError);

    const ok = parseWorkerToFrame({
      channel: WORKER_CHANNEL,
      v: 1,
      type: "RESULT",
      nonce,
      runId,
      ok: true,
      value: { sum: 6 },
      durationMs: 12,
    });
    expect(toParentMessage(ok).type).toBe("RESULT");

    const frameRun = parseFrameToWorker({
      channel: WORKER_CHANNEL,
      v: 1,
      type: "RUN",
      nonce,
      runId,
      code: "1+1",
    });
    expect(frameRun.type).toBe("RUN");
  });

  it("rejects cyclic payloads", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => countNumericElements(cyclic)).toThrow(/Cyclic/);
  });
});
