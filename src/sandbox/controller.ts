/**
 * Parent-side sandbox controller.
 *
 * Owns BOOTING → READY → RUNNING, separate readiness/execution timers,
 * source-checked postMessage, one active run, termination/recreation after
 * timeout, stale-result rejection, and disposal.
 *
 * Learner code NEVER executes in the parent. The only path is:
 * opaque sandboxed iframe → internal Worker (bundle text delivered via INIT).
 */

import {
  CODE_MAX_BYTES,
  EXECUTION_DEADLINE_MS,
  OBSERVED_TERMINATION_TARGET_MS,
  PROTOCOL_VERSION,
  READINESS_BUDGET_MS,
} from "./limits";
import {
  createSandboxFrameSource,
  SANDBOX_IFRAME_ATTRIBUTE,
} from "./frame-source";
import {
  createChannelNonce,
  createRunId,
  PARENT_FRAME_CHANNEL,
  parseFrameToParent,
  ProtocolValidationError,
  type FrameToParent,
  type ParentToFrame,
  type RuntimeSelfCheck,
  type SandboxControllerState,
  type SandboxRunResult,
} from "./protocol";

export interface SandboxControllerOptions {
  /**
   * URL of the leader-compiled worker bundle (`sandbox-frame/pyodide-worker`).
   * Fetched as trusted static text before INIT and sent into the frame.
   */
  workerUrl: string;
  /** Optional host element that receives the hidden iframe. Defaults to document.body. */
  mount?: HTMLElement;
  /** Override readiness budget (tests only). */
  readinessBudgetMs?: number;
  /** Override execution deadline (tests only). */
  executionDeadlineMs?: number;
  /** Optional fetch implementation (tests). */
  fetchImpl?: typeof fetch;
  /** Called when controller state changes (no code/output bodies). */
  onStateChange?: (state: SandboxControllerState) => void;
}

export interface SandboxBootInfo {
  runtime: RuntimeSelfCheck;
}

type PendingRun = {
  runId: string;
  startedAt: number;
  resolve: (result: SandboxRunResult) => void;
  timer: ReturnType<typeof setTimeout> | null;
};

function utf8ByteLength(value: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value).byteLength;
  }
  return unescape(encodeURIComponent(value)).length;
}

/**
 * Host controller for one opaque sandbox session.
 *
 * Lifecycle:
 * 1. `boot()` fetches worker bundle text, mounts `sandbox="allow-scripts"` iframe,
 *    sends INIT with cryptographic nonce + worker source, waits for validated READY.
 * 2. `run(code, inputs?)` sends one RUN, arms the 3s deadline, resolves typed result
 *    or timeout (then reboots). Stale results for other run ids are dropped.
 * 3. `dispose()` tears down iframe, timers, and listeners permanently.
 */
export class SandboxController {
  private readonly workerUrl: string;
  private readonly mount: HTMLElement | null;
  private readonly readinessBudgetMs: number;
  private readonly executionDeadlineMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly onStateChange?: (state: SandboxControllerState) => void;

  private state: SandboxControllerState = "idle";
  private nonce: string | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private workerSourceText: string | null = null;
  private runtime: RuntimeSelfCheck | null = null;
  private pendingRun: PendingRun | null = null;
  private readinessTimer: ReturnType<typeof setTimeout> | null = null;
  private bootPromise: Promise<SandboxBootInfo> | null = null;
  private bootResolve: ((info: SandboxBootInfo) => void) | null = null;
  private bootReject: ((error: Error) => void) | null = null;
  private messageListener: ((event: MessageEvent) => void) | null = null;
  private disposed = false;

  constructor(options: SandboxControllerOptions) {
    if (typeof options.workerUrl !== "string" || options.workerUrl.length === 0) {
      throw new Error("SandboxController requires a non-empty workerUrl.");
    }
    this.workerUrl = options.workerUrl;
    this.mount = options.mount ?? (typeof document !== "undefined" ? document.body : null);
    this.readinessBudgetMs = options.readinessBudgetMs ?? READINESS_BUDGET_MS;
    this.executionDeadlineMs = options.executionDeadlineMs ?? EXECUTION_DEADLINE_MS;
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
    this.onStateChange = options.onStateChange;
  }

  /** Current controller state. Never includes code/output bodies. */
  getState(): SandboxControllerState {
    return this.state;
  }

  /** Runtime identity from the last validated READY, if any. */
  getRuntime(): RuntimeSelfCheck | null {
    return this.runtime;
  }

  /**
   * Fetch the compiled worker bundle, mount the opaque iframe, INIT, and wait
   * for a validated READY (worker self-check must report selfCheck: "passed").
   * READY is never synthesized by the parent.
   */
  async boot(): Promise<SandboxBootInfo> {
    if (this.disposed || this.state === "disposed") {
      throw new Error("SandboxController is disposed.");
    }
    if (this.state === "ready" && this.runtime != null) {
      return { runtime: this.runtime };
    }
    if (this.bootPromise != null) {
      return this.bootPromise;
    }

    this.bootPromise = this.performBoot();
    try {
      return await this.bootPromise;
    } finally {
      this.bootPromise = null;
    }
  }

  /**
   * Execute learner code inside the opaque iframe worker.
   * Resolves with success, failure, or typed timeout. On timeout the controller
   * reboots a fresh frame/worker before the promise settles when possible.
   * Does not fall back to parent-thread execution.
   */
  async run(code: string, inputs?: unknown): Promise<SandboxRunResult> {
    if (this.disposed || this.state === "disposed") {
      throw new Error("SandboxController is disposed.");
    }
    if (typeof code !== "string") {
      throw new Error("code must be a string.");
    }
    if (utf8ByteLength(code) > CODE_MAX_BYTES) {
      throw new Error(`code exceeds ${CODE_MAX_BYTES} bytes.`);
    }
    if (this.pendingRun != null || this.state === "running") {
      throw new Error("Only one active run is allowed.");
    }

    if (this.state !== "ready") {
      await this.boot();
    }
    if (this.state !== "ready" || this.iframe == null || this.nonce == null) {
      throw new Error("Sandbox is not ready.");
    }

    const runId = createRunId();
    const message: ParentToFrame = {
      channel: PARENT_FRAME_CHANNEL,
      v: PROTOCOL_VERSION,
      type: "RUN",
      nonce: this.nonce,
      runId,
      code,
    };
    if (inputs !== undefined) {
      (message as { inputs?: unknown }).inputs = inputs;
    }

    return new Promise<SandboxRunResult>((resolve) => {
      const startedAt = Date.now();
      const timer = setTimeout(() => {
        void this.handleLocalTimeout(runId, startedAt);
      }, this.executionDeadlineMs);

      this.pendingRun = { runId, startedAt, resolve, timer };
      this.setState("running");

      try {
        this.postToFrame(message);
      } catch (err) {
        this.clearPendingTimer();
        this.pendingRun = null;
        this.setState(this.runtime != null ? "ready" : "idle");
        resolve({
          ok: false,
          runId,
          error: {
            kind: "post-failed",
            message: err instanceof Error ? err.message : "Failed to post RUN",
          },
          durationMs: Date.now() - startedAt,
        });
      }
    });
  }

  /** Tear down iframe, timers, and listeners. Safe to call multiple times. */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    if (this.nonce != null && this.iframe != null) {
      try {
        this.postToFrame({
          channel: PARENT_FRAME_CHANNEL,
          v: PROTOCOL_VERSION,
          type: "DISPOSE",
          nonce: this.nonce,
        });
      } catch {
        // ignore
      }
    }

    this.rejectBoot(new Error("SandboxController disposed."));
    this.failPendingRun({
      kind: "disposed",
      message: "SandboxController disposed.",
    });
    this.teardownFrame();
    this.workerSourceText = null;
    this.runtime = null;
    this.nonce = null;
    this.setState("disposed");
  }

  private async performBoot(): Promise<SandboxBootInfo> {
    this.setState("booting");
    this.runtime = null;

    try {
      if (this.workerSourceText == null) {
        this.workerSourceText = await this.fetchWorkerSource();
      }

      this.teardownFrame();
      this.nonce = createChannelNonce(16);
      await this.mountFrame();

      const bootInfo = await new Promise<SandboxBootInfo>((resolve, reject) => {
        this.bootResolve = resolve;
        this.bootReject = reject;
        this.readinessTimer = setTimeout(() => {
          this.bootReject = null;
          this.bootResolve = null;
          this.teardownFrame();
          this.setState("idle");
          reject(
            new Error(
              `Sandbox readiness exceeded ${this.readinessBudgetMs}ms budget.`,
            ),
          );
        }, this.readinessBudgetMs);

        try {
          this.postToFrame({
            channel: PARENT_FRAME_CHANNEL,
            v: PROTOCOL_VERSION,
            type: "INIT",
            nonce: this.nonce!,
            workerSource: this.workerSourceText!,
          });
        } catch (err) {
          this.clearReadinessTimer();
          this.bootResolve = null;
          this.bootReject = null;
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      });

      return bootInfo;
    } catch (err) {
      if (this.state !== "disposed") {
        this.setState("idle");
      }
      throw err;
    }
  }

  private async fetchWorkerSource(): Promise<string> {
    const response = await this.fetchImpl(this.workerUrl, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-cache",
    });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch worker bundle: HTTP ${response.status}`,
      );
    }
    const text = await response.text();
    if (typeof text !== "string" || text.length === 0) {
      throw new Error("Worker bundle is empty.");
    }
    return text;
  }

  private mountFrame(): Promise<void> {
    if (typeof document === "undefined") {
      return Promise.reject(
        new Error("SandboxController requires a document to mount an iframe."),
      );
    }
    const host = this.mount ?? document.body;
    if (host == null) {
      return Promise.reject(new Error("SandboxController has no mount element."));
    }

    const iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", SANDBOX_IFRAME_ATTRIBUTE);
    iframe.setAttribute("referrerpolicy", "no-referrer");
    iframe.setAttribute("aria-hidden", "true");
    iframe.setAttribute("title", "Python sandbox");
    iframe.tabIndex = -1;
    // Visually hidden but active. Do not use display:none (some browsers delay workers).
    iframe.style.cssText =
      "position:absolute;width:0;height:0;border:0;clip:rect(0 0 0 0);overflow:hidden;";

    const loaded = new Promise<void>((resolve, reject) => {
      const onLoad = () => {
        iframe.removeEventListener("load", onLoad);
        iframe.removeEventListener("error", onError);
        resolve();
      };
      const onError = () => {
        iframe.removeEventListener("load", onLoad);
        iframe.removeEventListener("error", onError);
        reject(new Error("Sandbox iframe failed to load."));
      };
      iframe.addEventListener("load", onLoad);
      iframe.addEventListener("error", onError);
    });

    iframe.srcdoc = createSandboxFrameSource();

    this.messageListener = (event: MessageEvent) => {
      this.onMessage(event);
    };
    window.addEventListener("message", this.messageListener);

    host.appendChild(iframe);
    this.iframe = iframe;
    return loaded;
  }

  private teardownFrame(): void {
    this.clearReadinessTimer();

    if (this.messageListener != null) {
      window.removeEventListener("message", this.messageListener);
      this.messageListener = null;
    }

    if (this.iframe != null) {
      try {
        this.iframe.removeAttribute("srcdoc");
      } catch {
        // ignore
      }
      try {
        this.iframe.remove();
      } catch {
        // ignore
      }
      this.iframe = null;
    }
  }

  private postToFrame(message: ParentToFrame): void {
    const frameWindow = this.iframe?.contentWindow;
    if (frameWindow == null) {
      throw new Error("Sandbox iframe is not available.");
    }
    // Opaque sandboxed iframes expose a unique origin; target "*" with source checks on receive.
    frameWindow.postMessage(message, "*");
  }

  private onMessage(event: MessageEvent): void {
    if (this.disposed || this.state === "disposed") {
      return;
    }
    if (this.iframe == null || event.source !== this.iframe.contentWindow) {
      return;
    }

    let message: FrameToParent;
    try {
      message = parseFrameToParent(event.data);
    } catch (err) {
      if (err instanceof ProtocolValidationError) {
        return;
      }
      return;
    }

    if (this.nonce == null || message.nonce !== this.nonce) {
      return;
    }

    switch (message.type) {
      case "BOOTING":
        // Informational; readiness timer already armed.
        return;
      case "READY":
        this.onReady(message.runtime);
        return;
      case "RESULT":
        this.onResult(message);
        return;
      case "TIMEOUT":
        this.onTimeoutMessage(message);
        return;
      case "FATAL":
        this.onFatal(message);
        return;
    }
  }

  private onReady(runtime: RuntimeSelfCheck): void {
    if (this.state !== "booting" && this.bootResolve == null) {
      // Stale READY after we moved on.
      return;
    }
    // READY only accepted from validated worker self-check (parseFrameToParent).
    this.runtime = runtime;
    this.clearReadinessTimer();
    this.setState("ready");
    const resolve = this.bootResolve;
    this.bootResolve = null;
    this.bootReject = null;
    if (resolve != null) {
      resolve({ runtime });
    }
  }

  private onResult(message: Extract<FrameToParent, { type: "RESULT" }>): void {
    const pending = this.pendingRun;
    if (pending == null || pending.runId !== message.runId) {
      // Stale or mismatched run id — drop.
      return;
    }
    this.clearPendingTimer();
    this.pendingRun = null;
    this.setState("ready");

    if (message.ok) {
      pending.resolve({
        ok: true,
        runId: message.runId,
        value: message.value,
        durationMs: message.durationMs,
      });
      return;
    }
    pending.resolve({
      ok: false,
      runId: message.runId,
      error: message.error,
      durationMs: message.durationMs,
    });
  }

  private onTimeoutMessage(message: Extract<FrameToParent, { type: "TIMEOUT" }>): void {
    const pending = this.pendingRun;
    if (pending == null || pending.runId !== message.runId) {
      return;
    }
    this.clearPendingTimer();
    this.pendingRun = null;

    const result: SandboxRunResult = {
      ok: false,
      runId: message.runId,
      timedOut: true,
      observedTerminationMs: message.observedTerminationMs,
      error: {
        kind: "timeout",
        message: `Execution exceeded ${this.executionDeadlineMs}ms (observed ${message.observedTerminationMs}ms; target ≤${OBSERVED_TERMINATION_TARGET_MS}ms).`,
      },
    };

    // Frame already recreates worker; parent reboots fully for a clean READY.
    this.setState("idle");
    this.runtime = null;
    void this.boot().finally(() => {
      pending.resolve(result);
    });
  }

  private async handleLocalTimeout(runId: string, startedAt: number): Promise<void> {
    const pending = this.pendingRun;
    if (pending == null || pending.runId !== runId) {
      return;
    }
    this.clearPendingTimer();
    this.pendingRun = null;

    const observedTerminationMs = Date.now() - startedAt;
    if (this.nonce != null && this.iframe != null) {
      try {
        this.postToFrame({
          channel: PARENT_FRAME_CHANNEL,
          v: PROTOCOL_VERSION,
          type: "TERMINATE",
          nonce: this.nonce,
          runId,
        });
      } catch {
        // ignore
      }
    }

    const result: SandboxRunResult = {
      ok: false,
      runId,
      timedOut: true,
      observedTerminationMs,
      error: {
        kind: "timeout",
        message: `Execution exceeded ${this.executionDeadlineMs}ms (observed ${observedTerminationMs}ms; target ≤${OBSERVED_TERMINATION_TARGET_MS}ms).`,
      },
    };

    this.runtime = null;
    this.setState("idle");
    try {
      await this.boot();
    } catch {
      // Boot failure is independent; still surface timeout to the caller.
    }
    pending.resolve(result);
  }

  private onFatal(message: Extract<FrameToParent, { type: "FATAL" }>): void {
    const error = new Error(message.error.message);
    error.name = `SandboxFatal:${message.error.kind}`;

    this.failPendingRun(message.error);
    this.rejectBoot(error);
    this.runtime = null;
    this.teardownFrame();
    if (!this.disposed) {
      this.setState("idle");
    }
  }

  private failPendingRun(error: { kind: string; message: string }): void {
    const pending = this.pendingRun;
    if (pending == null) {
      return;
    }
    this.clearPendingTimer();
    this.pendingRun = null;
    pending.resolve({
      ok: false,
      runId: pending.runId,
      error,
      durationMs: Date.now() - pending.startedAt,
    });
  }

  private rejectBoot(error: Error): void {
    this.clearReadinessTimer();
    const reject = this.bootReject;
    this.bootReject = null;
    this.bootResolve = null;
    if (reject != null) {
      reject(error);
    }
  }

  private clearReadinessTimer(): void {
    if (this.readinessTimer != null) {
      clearTimeout(this.readinessTimer);
      this.readinessTimer = null;
    }
  }

  private clearPendingTimer(): void {
    if (this.pendingRun?.timer != null) {
      clearTimeout(this.pendingRun.timer);
      this.pendingRun.timer = null;
    }
  }

  private setState(next: SandboxControllerState): void {
    if (this.state === next) {
      return;
    }
    this.state = next;
    if (this.onStateChange != null) {
      try {
        this.onStateChange(next);
      } catch {
        // Listener errors must not break the controller.
      }
    }
  }
}
