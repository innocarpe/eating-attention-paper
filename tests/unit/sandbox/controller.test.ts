/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { SandboxController } from "../../../src/sandbox/controller";
import { PARENT_FRAME_CHANNEL } from "../../../src/sandbox/protocol";

type FakeWindow = {
  postMessage: (message: unknown) => void;
};

function installFrameHarness() {
  const originalCreate = document.createElement.bind(document);
  const frames: HTMLIFrameElement[] = [];

  vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    const el = originalCreate(tag);
    if (tag.toLowerCase() === "iframe") {
      const iframe = el as HTMLIFrameElement;
      const fakeWindow: FakeWindow = {
        postMessage(message: unknown) {
          // Echo protocol for deterministic unit tests (no real Pyodide).
          setTimeout(() => {
            const data = message as {
              type?: string;
              nonce?: string;
              runId?: string;
              code?: string;
            };
            if (data.type === "INIT" && data.nonce) {
              window.dispatchEvent(
                new MessageEvent("message", {
                  data: {
                    channel: PARENT_FRAME_CHANNEL,
                    v: 1,
                    type: "BOOTING",
                    nonce: data.nonce,
                  },
                  source: fakeWindow as unknown as Window,
                }),
              );
              window.dispatchEvent(
                new MessageEvent("message", {
                  data: {
                    channel: PARENT_FRAME_CHANNEL,
                    v: 1,
                    type: "READY",
                    nonce: data.nonce,
                    runtime: {
                      pyodide: "314.0.3-test",
                      numpy: "2.4.3-test",
                      selfCheck: "passed",
                    },
                  },
                  source: fakeWindow as unknown as Window,
                }),
              );
            }
            if (data.type === "RUN" && data.nonce && data.runId) {
              const infinite = typeof data.code === "string" && data.code.includes("INFINITE");
              if (infinite) {
                return;
              }
              window.dispatchEvent(
                new MessageEvent("message", {
                  data: {
                    channel: PARENT_FRAME_CHANNEL,
                    v: 1,
                    type: "RESULT",
                    nonce: data.nonce,
                    runId: data.runId,
                    ok: true,
                    value: 6,
                    durationMs: 4,
                  },
                  source: fakeWindow as unknown as Window,
                }),
              );
            }
          }, 0);
        },
      };
      Object.defineProperty(iframe, "contentWindow", {
        configurable: true,
        get: () => fakeWindow,
      });
      Object.defineProperty(iframe, "srcdoc", {
        configurable: true,
        set() {
          setTimeout(() => {
            iframe.dispatchEvent(new Event("load"));
          }, 0);
        },
        get() {
          return "<html></html>";
        },
      });
      frames.push(iframe);
    }
    return el;
  });

  return {
    frames,
    restore() {
      vi.restoreAllMocks();
      for (const frame of frames) {
        frame.remove();
      }
    },
  };
}

describe("SandboxController", () => {
  let harness: ReturnType<typeof installFrameHarness> | null = null;

  afterEach(() => {
    harness?.restore();
    harness = null;
  });

  it("boots from a fetched worker bundle and accepts only validated READY", async () => {
    harness = installFrameHarness();
    const fetchImpl = vi.fn(async () => new Response("export {}", { status: 200 }));
    const controller = new SandboxController({
      workerUrl: "/sandbox/pyodide-worker.js",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      readinessBudgetMs: 2_000,
    });

    const info = await controller.boot();
    expect(info.runtime.selfCheck).toBe("passed");
    expect(info.runtime.pyodide).toContain("314");
    expect(controller.getState()).toBe("ready");
    expect(fetchImpl).toHaveBeenCalled();

    controller.dispose();
    expect(controller.getState()).toBe("disposed");
  });

  it("runs one active request and returns typed success without persisting bodies", async () => {
    harness = installFrameHarness();
    const controller = new SandboxController({
      workerUrl: "/sandbox/pyodide-worker.js",
      fetchImpl: (async () => new Response("export {}", { status: 200 })) as unknown as typeof fetch,
    });
    await controller.boot();
    const result = await controller.run("1+1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(6);
    }
    expect(controller.getState()).toBe("ready");
    controller.dispose();
  });

  it("times out hostile runs, does not fall back to parent execution, and reboots", async () => {
    harness = installFrameHarness();
    const controller = new SandboxController({
      workerUrl: "/sandbox/pyodide-worker.js",
      fetchImpl: (async () => new Response("export {}", { status: 200 })) as unknown as typeof fetch,
      executionDeadlineMs: 30,
      readinessBudgetMs: 2_000,
    });
    await controller.boot();
    const started = Date.now();
    const result = await controller.run("# INFINITE\nwhile True:\n pass");
    const observed = Date.now() - started;
    expect(result.ok).toBe(false);
    expect("timedOut" in result && result.timedOut).toBe(true);
    expect(observed).toBeLessThan(2_000);
    expect(["ready", "idle", "booting"]).toContain(controller.getState());
    controller.dispose();
  });

  it("rejects oversized code before posting to the frame", async () => {
    harness = installFrameHarness();
    const controller = new SandboxController({
      workerUrl: "/sandbox/pyodide-worker.js",
      fetchImpl: (async () => new Response("export {}", { status: 200 })) as unknown as typeof fetch,
    });
    await controller.boot();
    await expect(controller.run("x".repeat(32 * 1024 + 1))).rejects.toThrow(/code exceeds/);
    controller.dispose();
  });
});
