import { describe, expect, it } from "vitest";

import {
  createSandboxFrameSource,
  SANDBOX_IFRAME_ATTRIBUTE,
} from "../../../src/sandbox/frame-source";
import { PINNED_PYODIDE_CDN_BASE } from "../../../src/sandbox/limits";
import { PARENT_FRAME_CHANNEL, WORKER_CHANNEL } from "../../../src/sandbox/protocol";

describe("sandbox frame source", () => {
  it("emits an opaque allow-scripts document with pinned CDN CSP and no same-origin", () => {
    const html = createSandboxFrameSource();
    expect(SANDBOX_IFRAME_ATTRIBUTE).toBe("allow-scripts");
    expect(html).toContain('sandbox');
    expect(html).toContain("Content-Security-Policy");
    expect(html).toContain(PINNED_PYODIDE_CDN_BASE);
    expect(html).toContain("worker-src blob:");
    expect(html).toContain("connect-src");
    expect(html).toContain(PARENT_FRAME_CHANNEL);
    expect(html).toContain(WORKER_CHANNEL);
    expect(html).toContain('type: "BOOT"');
    expect(html).not.toContain("allow-same-origin");
    expect(html).not.toContain("localStorage");
    expect(html).not.toContain("indexedDB");
  });

  it("forwards only worker-channel events and recreates on timeout", () => {
    const html = createSandboxFrameSource();
    expect(html).toContain("recreateAndBoot");
    expect(html).toContain("EXECUTION_DEADLINE_MS");
    expect(html).toContain('type: "TIMEOUT"');
    expect(html).toContain("event.source !== parent");
  });
});
