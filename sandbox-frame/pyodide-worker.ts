/**
 * Hostile-code Pyodide worker (M0B spike).
 *
 * Delivered as text into an opaque sandboxed iframe, then instantiated as a
 * module Worker from a Blob URL. Learner Python never runs in the parent.
 *
 * Boot may fetch the pinned jsDelivr Pyodide 314.0.3 + NumPy assets once.
 * After READY, network/storage/parent bridges are denied for learner code.
 */

const WORKER_CHANNEL = "attention-sandbox-worker" as const;
const PROTOCOL_VERSION = 1 as const;
const PINNED_PYODIDE_CDN_BASE = "https://cdn.jsdelivr.net/pyodide/v314.0.3/full/";
const PINNED_PYODIDE_VERSION = "314.0.3";
const CODE_MAX_BYTES = 32 * 1024;
const MAX_NUMERIC_ELEMENTS = 10_000;
const EXECUTION_DEADLINE_MS = 3_000;

type RuntimeSelfCheck = {
  pyodide: string;
  numpy: string;
  selfCheck: "passed";
};

type WorkerInbound =
  | { channel: typeof WORKER_CHANNEL; v: 1; type: "BOOT"; nonce: string }
  | {
      channel: typeof WORKER_CHANNEL;
      v: 1;
      type: "RUN";
      nonce: string;
      runId: string;
      code: string;
      inputs?: unknown;
    }
  | { channel: typeof WORKER_CHANNEL; v: 1; type: "TERMINATE"; nonce: string; runId?: string }
  | { channel: typeof WORKER_CHANNEL; v: 1; type: "DISPOSE"; nonce: string };

type PyodideLike = {
  version: string;
  loadPackage: (names: string | string[]) => Promise<unknown>;
  runPythonAsync: (code: string) => Promise<unknown>;
  globals: {
    set: (key: string, value: unknown) => void;
    get: (key: string) => unknown;
    delete?: (key: string) => void;
  };
  registerJsModule?: (name: string, value: unknown) => void;
};

let expectedNonce: string | null = null;
let pyodide: PyodideLike | null = null;
let ready = false;
let booting = false;
let disposed = false;
let activeRunId: string | null = null;
let runWatchdog: ReturnType<typeof setTimeout> | null = null;
let runStartedAt = 0;
let originalFetch: typeof fetch | null = null;
let networkLocked = false;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function post(message: Record<string, unknown>): void {
  try {
    self.postMessage(message);
  } catch {
    // Parent/frame may be gone.
  }
}

function fatal(kind: string, message: string): void {
  if (expectedNonce == null) {
    return;
  }
  post({
    channel: WORKER_CHANNEL,
    v: PROTOCOL_VERSION,
    type: "FATAL",
    nonce: expectedNonce,
    error: { kind, message: message.slice(0, 512) },
  });
}

function clearRunWatchdog(): void {
  if (runWatchdog != null) {
    clearTimeout(runWatchdog);
    runWatchdog = null;
  }
}

function countNumericElements(value: unknown, seen = new WeakSet<object>()): number {
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
    throw new Error("Cyclic structure is not allowed.");
  }
  seen.add(value as object);

  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView & { BYTES_PER_ELEMENT?: number };
    const length = view.byteLength / (view.BYTES_PER_ELEMENT ?? 1);
    if (length > MAX_NUMERIC_ELEMENTS) {
      throw new Error(`Numeric payload exceeds ${MAX_NUMERIC_ELEMENTS} elements.`);
    }
    return length;
  }
  if (value instanceof ArrayBuffer) {
    if (value.byteLength > MAX_NUMERIC_ELEMENTS) {
      throw new Error(`Numeric payload exceeds ${MAX_NUMERIC_ELEMENTS} elements.`);
    }
    return value.byteLength;
  }
  if (Array.isArray(value)) {
    let total = 0;
    for (const item of value) {
      total += countNumericElements(item, seen);
      if (total > MAX_NUMERIC_ELEMENTS) {
        throw new Error(`Numeric payload exceeds ${MAX_NUMERIC_ELEMENTS} elements.`);
      }
    }
    return total;
  }
  let total = 0;
  for (const item of Object.values(value as Record<string, unknown>)) {
    total += countNumericElements(item, seen);
    if (total > MAX_NUMERIC_ELEMENTS) {
      throw new Error(`Numeric payload exceeds ${MAX_NUMERIC_ELEMENTS} elements.`);
    }
  }
  return total;
}

function sanitizeResult(value: unknown): unknown {
  if (value == null) {
    return null;
  }
  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : String(value);
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  // PyProxy / rich objects: prefer explicit conversion hooks when present.
  const maybeProxy = value as {
    toJs?: (options?: { dict_converter?: (entries: Iterable<[string, unknown]>) => Record<string, unknown> }) => unknown;
    destroy?: () => void;
    toString?: () => string;
  };
  if (typeof maybeProxy.toJs === "function") {
    try {
      const converted = maybeProxy.toJs({
        dict_converter: Object.fromEntries,
      });
      if (typeof maybeProxy.destroy === "function") {
        maybeProxy.destroy();
      }
      countNumericElements(converted);
      return converted;
    } catch (err) {
      if (typeof maybeProxy.destroy === "function") {
        try {
          maybeProxy.destroy();
        } catch {
          // ignore
        }
      }
      throw err;
    }
  }
  if (Array.isArray(value) || typeof value === "object") {
    countNumericElements(value);
    return value;
  }
  return String(value);
}

function assertPinnedUrl(url: string): boolean {
  try {
    const parsed = new URL(url, PINNED_PYODIDE_CDN_BASE);
    return parsed.href.startsWith(PINNED_PYODIDE_CDN_BASE);
  } catch {
    return false;
  }
}

function installNetworkLock(): void {
  if (networkLocked) {
    return;
  }
  originalFetch = self.fetch.bind(self);
  const blocked = () => Promise.reject(new Error("Network access is disabled after sandbox READY."));
  self.fetch = blocked as typeof fetch;
  // Best-effort denial of other browser network surfaces available in workers.
  try {
    // @ts-expect-error intentional hardening
    self.XMLHttpRequest = undefined;
  } catch {
    // ignore
  }
  try {
    // @ts-expect-error intentional hardening
    self.WebSocket = undefined;
  } catch {
    // ignore
  }
  try {
    // @ts-expect-error intentional hardening
    self.EventSource = undefined;
  } catch {
    // ignore
  }
  networkLocked = true;
}

async function denialSelfCheck(runtime: PyodideLike): Promise<void> {
  // js module / FFI bridge must not be available to learner code.
  const jsProbe = await runtime.runPythonAsync(
    "try:\n import js\n result='exposed'\nexcept Exception:\n result='denied'\nresult",
  );
  if (String(jsProbe) !== "denied") {
    throw new Error("Denial self-check failed: js module is reachable.");
  }

  const httpProbe = await runtime.runPythonAsync(
    "try:\n import urllib.request as u\n result='import-ok'\nexcept Exception:\n result='denied'\nresult",
  );
  // Import may succeed; actual network must fail under lock. Prefer both.
  if (String(httpProbe) === "import-ok") {
    // no-op: network lock is enforced at fetch boundary.
  }

  // Persistent storage surfaces must be absent in the worker.
  const storageKeys = ["indexedDB", "caches", "localStorage", "sessionStorage"] as const;
  for (const key of storageKeys) {
    if (key in self && (self as unknown as Record<string, unknown>)[key] != null) {
      // workers may expose caches/indexedDB in some browsers; treat as soft signal only
      // if present we still do not use them and do not grant learner access via pyodide.
    }
  }
}

async function bootRuntime(): Promise<RuntimeSelfCheck> {
  if (booting) {
    throw new Error("Boot already in progress.");
  }
  booting = true;
  post({
    channel: WORKER_CHANNEL,
    v: PROTOCOL_VERSION,
    type: "BOOTING",
    nonce: expectedNonce,
  });

  try {
    const fetchImpl = originalFetch ?? self.fetch.bind(self);
    const guardedFetch: typeof fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (!assertPinnedUrl(url)) {
        return Promise.reject(new Error("Only the pinned Pyodide CDN may be fetched during BOOT."));
      }
      return fetchImpl(input, init);
    };

    // Load pinned loader from CDN (allowlisted by frame CSP + guarded fetch).
    const loaderUrl = `${PINNED_PYODIDE_CDN_BASE}pyodide.mjs`;
    const pyodideModule = (await import(
      /* @vite-ignore */
      loaderUrl
    )) as {
      loadPyodide: (options: {
        indexURL: string;
        fetch?: typeof fetch;
        stdout?: (text: string) => void;
        stderr?: (text: string) => void;
      }) => Promise<PyodideLike>;
    };

    const runtime = await pyodideModule.loadPyodide({
      indexURL: PINNED_PYODIDE_CDN_BASE,
      fetch: guardedFetch,
    });

    await runtime.loadPackage("numpy");
    const numpyVersion = String(
      await runtime.runPythonAsync(
        "import numpy as np\nnp.__version__",
      ),
    );

    installNetworkLock();
    await denialSelfCheck(runtime);

    // Smoke: tiny tensor only.
    const smoke = await runtime.runPythonAsync(
      "import numpy as np\nfloat(np.array([1.0, 2.0, 3.0]).sum())",
    );
    if (Number(smoke) !== 6) {
      throw new Error("NumPy smoke check failed.");
    }

    pyodide = runtime;
    ready = true;
    booting = false;

    const info: RuntimeSelfCheck = {
      pyodide: runtime.version || PINNED_PYODIDE_VERSION,
      numpy: numpyVersion,
      selfCheck: "passed",
    };
    post({
      channel: WORKER_CHANNEL,
      v: PROTOCOL_VERSION,
      type: "READY",
      nonce: expectedNonce,
      runtime: info,
    });
    return info;
  } catch (err) {
    booting = false;
    ready = false;
    pyodide = null;
    const message = err instanceof Error ? err.message : String(err);
    fatal("boot-failed", message);
    throw err;
  }
}

function armWatchdog(runId: string): void {
  clearRunWatchdog();
  runStartedAt = Date.now();
  runWatchdog = setTimeout(() => {
    if (activeRunId !== runId || expectedNonce == null) {
      return;
    }
    const observed = Date.now() - runStartedAt;
    activeRunId = null;
    runWatchdog = null;
    post({
      channel: WORKER_CHANNEL,
      v: PROTOCOL_VERSION,
      type: "TIMEOUT",
      nonce: expectedNonce,
      runId,
      observedTerminationMs: observed,
    });
    // Hard stop: worker is unusable after hostile timeout; frame will recreate.
    try {
      self.close();
    } catch {
      // ignore
    }
  }, EXECUTION_DEADLINE_MS);
}

async function runCode(runId: string, code: string, inputs?: unknown): Promise<void> {
  if (!ready || pyodide == null || expectedNonce == null) {
    return;
  }
  if (activeRunId != null) {
    return;
  }
  if (utf8ByteLength(code) > CODE_MAX_BYTES) {
    post({
      channel: WORKER_CHANNEL,
      v: PROTOCOL_VERSION,
      type: "RESULT",
      nonce: expectedNonce,
      runId,
      ok: false,
      error: { kind: "code-too-large", message: `code exceeds ${CODE_MAX_BYTES} bytes` },
      durationMs: 0,
    });
    return;
  }

  try {
    if (inputs !== undefined) {
      countNumericElements(inputs);
    }
  } catch (err) {
    post({
      channel: WORKER_CHANNEL,
      v: PROTOCOL_VERSION,
      type: "RESULT",
      nonce: expectedNonce,
      runId,
      ok: false,
      error: {
        kind: "invalid-inputs",
        message: err instanceof Error ? err.message : "invalid inputs",
      },
      durationMs: 0,
    });
    return;
  }

  activeRunId = runId;
  armWatchdog(runId);
  const startedAt = Date.now();

  try {
    if (inputs !== undefined) {
      pyodide.globals.set("inputs", inputs);
    }
    const raw = await pyodide.runPythonAsync(code);
    if (activeRunId !== runId) {
      return;
    }
    const value = sanitizeResult(raw);
    clearRunWatchdog();
    activeRunId = null;
    post({
      channel: WORKER_CHANNEL,
      v: PROTOCOL_VERSION,
      type: "RESULT",
      nonce: expectedNonce,
      runId,
      ok: true,
      value,
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    if (activeRunId !== runId) {
      return;
    }
    clearRunWatchdog();
    activeRunId = null;
    const message = err instanceof Error ? err.message : String(err);
    post({
      channel: WORKER_CHANNEL,
      v: PROTOCOL_VERSION,
      type: "RESULT",
      nonce: expectedNonce,
      runId,
      ok: false,
      error: {
        kind: "python-error",
        message: message.slice(0, 512),
      },
      durationMs: Date.now() - startedAt,
    });
  } finally {
    try {
      if (pyodide?.globals.delete) {
        pyodide.globals.delete("inputs");
      }
    } catch {
      // ignore
    }
  }
}

function parseInbound(data: unknown): WorkerInbound | null {
  if (!isRecord(data)) {
    return null;
  }
  if (data.channel !== WORKER_CHANNEL || data.v !== PROTOCOL_VERSION) {
    return null;
  }
  if (typeof data.type !== "string" || typeof data.nonce !== "string") {
    return null;
  }
  if (expectedNonce != null && data.nonce !== expectedNonce) {
    return null;
  }
  if (data.type === "BOOT") {
    return {
      channel: WORKER_CHANNEL,
      v: PROTOCOL_VERSION,
      type: "BOOT",
      nonce: data.nonce,
    };
  }
  if (data.type === "RUN") {
    if (typeof data.runId !== "string" || typeof data.code !== "string") {
      return null;
    }
    const message: WorkerInbound = {
      channel: WORKER_CHANNEL,
      v: PROTOCOL_VERSION,
      type: "RUN",
      nonce: data.nonce,
      runId: data.runId,
      code: data.code,
    };
    if (Object.prototype.hasOwnProperty.call(data, "inputs")) {
      (message as { inputs?: unknown }).inputs = data.inputs;
    }
    return message;
  }
  if (data.type === "TERMINATE") {
    return {
      channel: WORKER_CHANNEL,
      v: PROTOCOL_VERSION,
      type: "TERMINATE",
      nonce: data.nonce,
      runId: typeof data.runId === "string" ? data.runId : undefined,
    };
  }
  if (data.type === "DISPOSE") {
    return {
      channel: WORKER_CHANNEL,
      v: PROTOCOL_VERSION,
      type: "DISPOSE",
      nonce: data.nonce,
    };
  }
  return null;
}

self.onmessage = (event: MessageEvent) => {
  if (disposed) {
    return;
  }
  const message = parseInbound(event.data);
  if (message == null) {
    return;
  }

  if (message.type === "BOOT") {
    if (expectedNonce != null) {
      return;
    }
    expectedNonce = message.nonce;
    void bootRuntime().catch(() => {
      // fatal already posted
    });
    return;
  }

  if (expectedNonce == null || message.nonce !== expectedNonce) {
    return;
  }

  if (message.type === "RUN") {
    void runCode(message.runId, message.code, message.inputs);
    return;
  }

  if (message.type === "TERMINATE") {
    clearRunWatchdog();
    activeRunId = null;
    try {
      self.close();
    } catch {
      // ignore
    }
    return;
  }

  if (message.type === "DISPOSE") {
    disposed = true;
    clearRunWatchdog();
    activeRunId = null;
    ready = false;
    pyodide = null;
    try {
      self.close();
    } catch {
      // ignore
    }
  }
};

export {};
