/**
 * Minimal opaque-sandbox iframe srcdoc.
 *
 * The document runs under `<iframe sandbox="allow-scripts">` (no
 * allow-same-origin). It receives INIT with nonce + already-bundled worker
 * source text, creates an internal module Worker from a Blob, forwards only
 * validated protocol messages, terminates/recreates the worker on command,
 * and never exposes parent authority (no parent DOM, storage, or eval bridge).
 */

import {
  EXECUTION_DEADLINE_MS,
  PINNED_PYODIDE_CDN_BASE,
  PROTOCOL_VERSION,
} from "./limits";
import {
  PARENT_FRAME_CHANNEL,
  WORKER_CHANNEL,
} from "./protocol";

/**
 * Returns the full HTML document string for the sandboxed iframe `srcdoc`.
 * Bootstrap is self-contained; CSP allowlists only the pinned Pyodide CDN for BOOT.
 */
export function createSandboxFrameSource(): string {
  // Keep the bootstrap as a plain string so it can run inside opaque srcdoc
  // without bundler imports. Protocol constants are inlined from this module.
  const bootstrap = `
(function () {
  "use strict";

  var PARENT_CHANNEL = ${JSON.stringify(PARENT_FRAME_CHANNEL)};
  var WORKER_CHANNEL = ${JSON.stringify(WORKER_CHANNEL)};
  var PROTOCOL_VERSION = ${JSON.stringify(PROTOCOL_VERSION)};
  var EXECUTION_DEADLINE_MS = ${JSON.stringify(EXECUTION_DEADLINE_MS)};

  var parentOrigin = "*";
  var expectedNonce = null;
  var workerSourceText = null;
  var worker = null;
  var workerObjectUrl = null;
  var activeRunId = null;
  var runWatchdog = null;
  var runStartedAt = 0;
  var disposed = false;
  var ready = false;
  var booting = false;

  function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  function postToParent(message) {
    try {
      parent.postMessage(message, parentOrigin);
    } catch (_err) {
      // Parent may be gone; swallow.
    }
  }

  function fatal(kind, message) {
    if (expectedNonce == null) {
      return;
    }
    postToParent({
      channel: PARENT_CHANNEL,
      v: PROTOCOL_VERSION,
      type: "FATAL",
      nonce: expectedNonce,
      error: { kind: kind, message: String(message || kind) },
    });
  }

  function clearRunWatchdog() {
    if (runWatchdog != null) {
      clearTimeout(runWatchdog);
      runWatchdog = null;
    }
  }

  function revokeWorkerUrl() {
    if (workerObjectUrl != null) {
      try {
        URL.revokeObjectURL(workerObjectUrl);
      } catch (_err) {
        // ignore
      }
      workerObjectUrl = null;
    }
  }

  function terminateWorker() {
    clearRunWatchdog();
    activeRunId = null;
    if (worker != null) {
      try {
        worker.terminate();
      } catch (_err) {
        // ignore
      }
      worker = null;
    }
    revokeWorkerUrl();
    ready = false;
    booting = false;
  }

  function recreateAndBoot() {
    terminateWorker();
    if (disposed || workerSourceText == null || expectedNonce == null) {
      return;
    }
    try {
      var blob = new Blob([workerSourceText], {
        type: "text/javascript",
      });
      workerObjectUrl = URL.createObjectURL(blob);
      worker = new Worker(workerObjectUrl);
      worker.onmessage = onWorkerMessage;
      worker.onerror = function (event) {
        fatal(
          "worker-error",
          (event && event.message) || "Worker error",
        );
        terminateWorker();
      };
      worker.onmessageerror = function () {
        fatal("worker-message-error", "Worker message could not be deserialized");
        terminateWorker();
      };
      booting = true;
      ready = false;
      worker.postMessage({
        channel: WORKER_CHANNEL,
        v: PROTOCOL_VERSION,
        type: "BOOT",
        nonce: expectedNonce,
      });
    } catch (err) {
      fatal(
        "worker-create-failed",
        (err && err.message) || "Failed to create worker",
      );
      terminateWorker();
    }
  }

  function validateWorkerEnvelope(data) {
    if (!isRecord(data)) {
      return null;
    }
    if (data.channel !== WORKER_CHANNEL) {
      return null;
    }
    if (data.v !== PROTOCOL_VERSION) {
      return null;
    }
    if (typeof data.nonce !== "string" || data.nonce !== expectedNonce) {
      return null;
    }
    if (typeof data.type !== "string") {
      return null;
    }
    return data;
  }

  function forwardWorkerToParent(data) {
    var type = data.type;
    if (type === "BOOTING") {
      postToParent({
        channel: PARENT_CHANNEL,
        v: PROTOCOL_VERSION,
        type: "BOOTING",
        nonce: expectedNonce,
      });
      return;
    }
    if (type === "READY") {
      var runtime = data.runtime;
      if (
        !isRecord(runtime) ||
        typeof runtime.pyodide !== "string" ||
        typeof runtime.numpy !== "string" ||
        runtime.selfCheck !== "passed"
      ) {
        fatal("invalid-ready", "Worker READY failed self-check shape");
        terminateWorker();
        return;
      }
      ready = true;
      booting = false;
      postToParent({
        channel: PARENT_CHANNEL,
        v: PROTOCOL_VERSION,
        type: "READY",
        nonce: expectedNonce,
        runtime: {
          pyodide: runtime.pyodide,
          numpy: runtime.numpy,
          selfCheck: "passed",
        },
      });
      return;
    }
    if (type === "RESULT") {
      if (typeof data.runId !== "string" || data.runId !== activeRunId) {
        return;
      }
      clearRunWatchdog();
      activeRunId = null;
      if (data.ok === true) {
        postToParent({
          channel: PARENT_CHANNEL,
          v: PROTOCOL_VERSION,
          type: "RESULT",
          nonce: expectedNonce,
          runId: data.runId,
          ok: true,
          value: data.value,
          durationMs: data.durationMs,
        });
        return;
      }
      if (data.ok === false && isRecord(data.error)) {
        postToParent({
          channel: PARENT_CHANNEL,
          v: PROTOCOL_VERSION,
          type: "RESULT",
          nonce: expectedNonce,
          runId: data.runId,
          ok: false,
          error: {
            kind: String(data.error.kind || "error"),
            message: String(data.error.message || "error"),
          },
          durationMs: data.durationMs,
        });
      }
      return;
    }
    if (type === "TIMEOUT") {
      if (typeof data.runId !== "string" || data.runId !== activeRunId) {
        return;
      }
      clearRunWatchdog();
      var runId = data.runId;
      activeRunId = null;
      var observed =
        typeof data.observedTerminationMs === "number"
          ? data.observedTerminationMs
          : EXECUTION_DEADLINE_MS;
      postToParent({
        channel: PARENT_CHANNEL,
        v: PROTOCOL_VERSION,
        type: "TIMEOUT",
        nonce: expectedNonce,
        runId: runId,
        observedTerminationMs: observed,
      });
      // Force fresh worker so residue cannot leak into the next run.
      recreateAndBoot();
      return;
    }
    if (type === "FATAL") {
      var err = isRecord(data.error) ? data.error : { kind: "fatal", message: "fatal" };
      postToParent({
        channel: PARENT_CHANNEL,
        v: PROTOCOL_VERSION,
        type: "FATAL",
        nonce: expectedNonce,
        error: {
          kind: String(err.kind || "fatal"),
          message: String(err.message || "fatal"),
        },
      });
      terminateWorker();
    }
  }

  function onWorkerMessage(event) {
    if (disposed) {
      return;
    }
    var data = validateWorkerEnvelope(event.data);
    if (data == null) {
      return;
    }
    forwardWorkerToParent(data);
  }

  function armRunWatchdog(runId) {
    clearRunWatchdog();
    runStartedAt = Date.now();
    runWatchdog = setTimeout(function () {
      if (activeRunId !== runId) {
        return;
      }
      var observed = Date.now() - runStartedAt;
      activeRunId = null;
      runWatchdog = null;
      postToParent({
        channel: PARENT_CHANNEL,
        v: PROTOCOL_VERSION,
        type: "TIMEOUT",
        nonce: expectedNonce,
        runId: runId,
        observedTerminationMs: observed,
      });
      recreateAndBoot();
    }, EXECUTION_DEADLINE_MS);
  }

  function onParentMessage(event) {
    if (disposed) {
      return;
    }
    // Opaque sandbox frames have a null origin; accept only structured envelopes.
    // Source must be the embedding parent window.
    if (event.source !== parent) {
      return;
    }
    var data = event.data;
    if (!isRecord(data)) {
      return;
    }
    if (data.channel !== PARENT_CHANNEL || data.v !== PROTOCOL_VERSION) {
      return;
    }
    if (typeof data.type !== "string" || typeof data.nonce !== "string") {
      return;
    }

    if (data.type === "INIT") {
      if (expectedNonce != null) {
        // Only one INIT per frame lifetime.
        return;
      }
      if (typeof data.workerSource !== "string" || data.workerSource.length === 0) {
        return;
      }
      expectedNonce = data.nonce;
      workerSourceText = data.workerSource;
      postToParent({
        channel: PARENT_CHANNEL,
        v: PROTOCOL_VERSION,
        type: "BOOTING",
        nonce: expectedNonce,
      });
      recreateAndBoot();
      return;
    }

    if (expectedNonce == null || data.nonce !== expectedNonce) {
      return;
    }

    if (data.type === "RUN") {
      if (!ready || worker == null || booting) {
        return;
      }
      if (typeof data.runId !== "string" || typeof data.code !== "string") {
        return;
      }
      if (activeRunId != null) {
        // One active run only; ignore concurrent RUN.
        return;
      }
      activeRunId = data.runId;
      var payload = {
        channel: WORKER_CHANNEL,
        v: PROTOCOL_VERSION,
        type: "RUN",
        nonce: expectedNonce,
        runId: data.runId,
        code: data.code,
      };
      if (Object.prototype.hasOwnProperty.call(data, "inputs")) {
        payload.inputs = data.inputs;
      }
      try {
        worker.postMessage(payload);
        armRunWatchdog(data.runId);
      } catch (err) {
        activeRunId = null;
        clearRunWatchdog();
        fatal(
          "run-forward-failed",
          (err && err.message) || "Failed to forward RUN",
        );
      }
      return;
    }

    if (data.type === "TERMINATE") {
      var termRunId = typeof data.runId === "string" ? data.runId : activeRunId;
      clearRunWatchdog();
      if (worker != null) {
        try {
          worker.postMessage({
            channel: WORKER_CHANNEL,
            v: PROTOCOL_VERSION,
            type: "TERMINATE",
            nonce: expectedNonce,
            runId: termRunId || undefined,
          });
        } catch (_err) {
          // ignore
        }
      }
      // Hard kill + recreate so hostile state cannot linger.
      var killedRunId = activeRunId;
      var observed = runStartedAt > 0 ? Date.now() - runStartedAt : 0;
      activeRunId = null;
      if (killedRunId != null) {
        postToParent({
          channel: PARENT_CHANNEL,
          v: PROTOCOL_VERSION,
          type: "TIMEOUT",
          nonce: expectedNonce,
          runId: killedRunId,
          observedTerminationMs: observed,
        });
      }
      recreateAndBoot();
      return;
    }

    if (data.type === "DISPOSE") {
      disposed = true;
      if (worker != null) {
        try {
          worker.postMessage({
            channel: WORKER_CHANNEL,
            v: PROTOCOL_VERSION,
            type: "DISPOSE",
            nonce: expectedNonce,
          });
        } catch (_err) {
          // ignore
        }
      }
      terminateWorker();
      expectedNonce = null;
      workerSourceText = null;
      try {
        window.removeEventListener("message", onParentMessage);
      } catch (_err) {
        // ignore
      }
    }
  }

  window.addEventListener("message", onParentMessage);
})();
`.trim();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="referrer" content="no-referrer" />
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob: ${PINNED_PYODIDE_CDN_BASE}; worker-src blob:; child-src blob:; connect-src ${PINNED_PYODIDE_CDN_BASE}; img-src 'none'; style-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none';"
/>
<title>sandbox</title>
</head>
<body>
<script>
${bootstrap}
</script>
</body>
</html>`;
}

/** Sandbox attribute value for the host iframe element. No allow-same-origin. */
export const SANDBOX_IFRAME_ATTRIBUTE = "allow-scripts" as const;
