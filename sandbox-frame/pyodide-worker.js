/**
 * Hostile-code Pyodide worker (M0B spike) — classic worker bundle.
 * Loaded as text into an opaque iframe, then run from a Blob URL.
 */
/* eslint-disable no-undef */
(function () {
  "use strict";

  var WORKER_CHANNEL = "attention-sandbox-worker";
  var PROTOCOL_VERSION = 1;
  var PINNED_PYODIDE_CDN_BASE = "https://cdn.jsdelivr.net/pyodide/v314.0.3/full/";
  var PINNED_PYODIDE_VERSION = "314.0.3";
  var CODE_MAX_BYTES = 32 * 1024;
  var MAX_NUMERIC_ELEMENTS = 10000;
  var EXECUTION_DEADLINE_MS = 3000;

  var expectedNonce = null;
  var pyodide = null;
  var ready = false;
  var booting = false;
  var disposed = false;
  var activeRunId = null;
  var runWatchdog = null;
  var runStartedAt = 0;
  var originalFetch = null;
  var networkLocked = false;

  function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  function utf8ByteLength(value) {
    return new TextEncoder().encode(value).byteLength;
  }

  function post(message) {
    try {
      self.postMessage(message);
    } catch {
      // ignore
    }
  }

  function fatal(kind, message) {
    if (expectedNonce == null) {
      return;
    }
    post({
      channel: WORKER_CHANNEL,
      v: PROTOCOL_VERSION,
      type: "FATAL",
      nonce: expectedNonce,
      error: { kind: kind, message: String(message || kind).slice(0, 512) },
    });
  }

  function clearRunWatchdog() {
    if (runWatchdog != null) {
      clearTimeout(runWatchdog);
      runWatchdog = null;
    }
  }

  function countNumericElements(value, seen) {
    seen = seen || new WeakSet();
    if (value == null) return 0;
    if (typeof value === "number") return Number.isFinite(value) ? 1 : 0;
    if (typeof value === "boolean" || typeof value === "string" || typeof value === "bigint") {
      return 0;
    }
    if (typeof value !== "object") return 0;
    if (seen.has(value)) {
      throw new Error("Cyclic structure is not allowed.");
    }
    seen.add(value);

    if (ArrayBuffer.isView(value)) {
      var viewLen = value.byteLength / (value.BYTES_PER_ELEMENT || 1);
      if (viewLen > MAX_NUMERIC_ELEMENTS) {
        throw new Error("Numeric payload exceeds " + MAX_NUMERIC_ELEMENTS + " elements.");
      }
      return viewLen;
    }
    if (value instanceof ArrayBuffer) {
      if (value.byteLength > MAX_NUMERIC_ELEMENTS) {
        throw new Error("Numeric payload exceeds " + MAX_NUMERIC_ELEMENTS + " elements.");
      }
      return value.byteLength;
    }
    if (Array.isArray(value)) {
      var total = 0;
      for (var i = 0; i < value.length; i += 1) {
        total += countNumericElements(value[i], seen);
        if (total > MAX_NUMERIC_ELEMENTS) {
          throw new Error("Numeric payload exceeds " + MAX_NUMERIC_ELEMENTS + " elements.");
        }
      }
      return total;
    }
    var objectTotal = 0;
    var values = Object.values(value);
    for (var j = 0; j < values.length; j += 1) {
      objectTotal += countNumericElements(values[j], seen);
      if (objectTotal > MAX_NUMERIC_ELEMENTS) {
        throw new Error("Numeric payload exceeds " + MAX_NUMERIC_ELEMENTS + " elements.");
      }
    }
    return objectTotal;
  }

  function sanitizeResult(value) {
    if (value == null) return null;
    if (typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
    if (typeof value === "bigint") return value.toString();
    if (value && typeof value.toJs === "function") {
      try {
        var converted = value.toJs({ dict_converter: Object.fromEntries });
        if (typeof value.destroy === "function") value.destroy();
        countNumericElements(converted);
        return converted;
      } catch (err) {
        if (value && typeof value.destroy === "function") {
          try {
            value.destroy();
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

  function assertPinnedUrl(url) {
    try {
      var parsed = new URL(url, PINNED_PYODIDE_CDN_BASE);
      return parsed.href.indexOf(PINNED_PYODIDE_CDN_BASE) === 0;
    } catch {
      return false;
    }
  }

  function installNetworkLock() {
    if (networkLocked) return;
    originalFetch = self.fetch.bind(self);
    self.fetch = function () {
      return Promise.reject(new Error("Network access is disabled after sandbox READY."));
    };
    try {
      self.XMLHttpRequest = undefined;
    } catch {
      // ignore
    }
    try {
      self.WebSocket = undefined;
    } catch {
      // ignore
    }
    try {
      self.EventSource = undefined;
    } catch {
      // ignore
    }
    networkLocked = true;
  }

  function denyJsBridge(runtime) {
    return runtime.runPythonAsync(
      [
        "import sys",
        "from importlib.abc import MetaPathFinder",
        "class _BlockJs(MetaPathFinder):",
        "    def find_spec(self, fullname, path=None, target=None):",
        "        if fullname == 'js' or fullname.startswith('js.'):",
        "            raise ImportError('js module is disabled in this sandbox')",
        "sys.modules.pop('js', None)",
        "sys.meta_path = [finder for finder in sys.meta_path if not isinstance(finder, _BlockJs)]",
        "sys.meta_path.insert(0, _BlockJs())",
        "'ok'",
      ].join("\n"),
    );
  }

  function denialSelfCheck(runtime) {
    return runtime
      .runPythonAsync(
        "try:\n import js\n result='exposed'\nexcept Exception:\n result='denied'\nresult",
      )
      .then(function (jsProbe) {
        if (String(jsProbe) !== "denied") {
          throw new Error("Denial self-check failed: js module is reachable.");
        }
      });
  }

  function bootRuntime() {
    if (booting) {
      return Promise.reject(new Error("Boot already in progress."));
    }
    booting = true;
    post({
      channel: WORKER_CHANNEL,
      v: PROTOCOL_VERSION,
      type: "BOOTING",
      nonce: expectedNonce,
    });

    return new Promise(function (resolve, reject) {
      try {
        var fetchImpl = originalFetch || self.fetch.bind(self);
        self.fetch = function (input, init) {
          var url =
            typeof input === "string"
              ? input
              : input && input.url
                ? input.url
                : String(input);
          if (!assertPinnedUrl(url)) {
            return Promise.reject(
              new Error("Only the pinned Pyodide CDN may be fetched during BOOT."),
            );
          }
          return fetchImpl(input, init);
        };

        // Classic worker: importScripts is the reliable CDN bootstrap path.
        importScripts(PINNED_PYODIDE_CDN_BASE + "pyodide.js");
        if (typeof loadPyodide !== "function") {
          throw new Error("loadPyodide was not provided by the pinned runtime.");
        }

        loadPyodide({ indexURL: PINNED_PYODIDE_CDN_BASE })
          .then(function (runtime) {
            return runtime.loadPackage("numpy").then(function () {
              return runtime;
            });
          })
          .then(function (runtime) {
            return runtime
              .runPythonAsync("import numpy as np\nnp.__version__")
              .then(function (numpyVersion) {
                installNetworkLock();
                return denyJsBridge(runtime).then(function () {
                  return denialSelfCheck(runtime).then(function () {
                  return runtime
                    .runPythonAsync(
                      "import numpy as np\nfloat(np.array([1.0, 2.0, 3.0]).sum())",
                    )
                    .then(function (smoke) {
                      if (Number(smoke) !== 6) {
                        throw new Error("NumPy smoke check failed.");
                      }
                      pyodide = runtime;
                      ready = true;
                      booting = false;
                      var info = {
                        pyodide: runtime.version || PINNED_PYODIDE_VERSION,
                        numpy: String(numpyVersion),
                        selfCheck: "passed",
                      };
                      post({
                        channel: WORKER_CHANNEL,
                        v: PROTOCOL_VERSION,
                        type: "READY",
                        nonce: expectedNonce,
                        runtime: info,
                      });
                      resolve(info);
                    });
                  });
                });
              });
          })
          .catch(function (err) {
            booting = false;
            ready = false;
            pyodide = null;
            var message = err && err.message ? err.message : String(err);
            fatal("boot-failed", message);
            reject(err);
          });
      } catch (err) {
        booting = false;
        ready = false;
        pyodide = null;
        var message = err && err.message ? err.message : String(err);
        fatal("boot-failed", message);
        reject(err);
      }
    });
  }

  function armWatchdog(runId) {
    clearRunWatchdog();
    runStartedAt = Date.now();
    runWatchdog = setTimeout(function () {
      if (activeRunId !== runId || expectedNonce == null) return;
      var observed = Date.now() - runStartedAt;
      activeRunId = null;
      runWatchdog = null;
      post({
        channel: WORKER_CHANNEL,
        v: PROTOCOL_VERSION,
        type: "TIMEOUT",
        nonce: expectedNonce,
        runId: runId,
        observedTerminationMs: observed,
      });
      try {
        self.close();
      } catch {
        // ignore
      }
    }, EXECUTION_DEADLINE_MS);
  }

  function runCode(runId, code, inputs) {
    if (!ready || pyodide == null || expectedNonce == null) return Promise.resolve();
    if (activeRunId != null) return Promise.resolve();
    if (utf8ByteLength(code) > CODE_MAX_BYTES) {
      post({
        channel: WORKER_CHANNEL,
        v: PROTOCOL_VERSION,
        type: "RESULT",
        nonce: expectedNonce,
        runId: runId,
        ok: false,
        error: {
          kind: "code-too-large",
          message: "code exceeds " + CODE_MAX_BYTES + " bytes",
        },
        durationMs: 0,
      });
      return Promise.resolve();
    }

    try {
      if (inputs !== undefined) countNumericElements(inputs);
    } catch (err) {
      post({
        channel: WORKER_CHANNEL,
        v: PROTOCOL_VERSION,
        type: "RESULT",
        nonce: expectedNonce,
        runId: runId,
        ok: false,
        error: {
          kind: "invalid-inputs",
          message: err && err.message ? err.message : "invalid inputs",
        },
        durationMs: 0,
      });
      return Promise.resolve();
    }

    activeRunId = runId;
    armWatchdog(runId);
    var startedAt = Date.now();

    try {
      if (inputs !== undefined) {
        pyodide.globals.set("inputs", inputs);
      }
    } catch {
      // continue without inputs binding
    }

    return pyodide
      .runPythonAsync(code)
      .then(function (raw) {
        if (activeRunId !== runId) return;
        var value = sanitizeResult(raw);
        clearRunWatchdog();
        activeRunId = null;
        post({
          channel: WORKER_CHANNEL,
          v: PROTOCOL_VERSION,
          type: "RESULT",
          nonce: expectedNonce,
          runId: runId,
          ok: true,
          value: value,
          durationMs: Date.now() - startedAt,
        });
      })
      .catch(function (err) {
        if (activeRunId !== runId) return;
        clearRunWatchdog();
        activeRunId = null;
        var message = err && err.message ? err.message : String(err);
        post({
          channel: WORKER_CHANNEL,
          v: PROTOCOL_VERSION,
          type: "RESULT",
          nonce: expectedNonce,
          runId: runId,
          ok: false,
          error: { kind: "python-error", message: message.slice(0, 512) },
          durationMs: Date.now() - startedAt,
        });
      })
      .then(function () {
        try {
          if (pyodide && pyodide.globals && typeof pyodide.globals.delete === "function") {
            pyodide.globals.delete("inputs");
          }
        } catch {
          // ignore
        }
      });
  }

  function parseInbound(data) {
    if (!isRecord(data)) return null;
    if (data.channel !== WORKER_CHANNEL || data.v !== PROTOCOL_VERSION) return null;
    if (typeof data.type !== "string" || typeof data.nonce !== "string") return null;
    if (expectedNonce != null && data.nonce !== expectedNonce) return null;

    if (data.type === "BOOT") {
      return { type: "BOOT", nonce: data.nonce };
    }
    if (data.type === "RUN") {
      if (typeof data.runId !== "string" || typeof data.code !== "string") return null;
      return {
        type: "RUN",
        nonce: data.nonce,
        runId: data.runId,
        code: data.code,
        inputs: Object.prototype.hasOwnProperty.call(data, "inputs") ? data.inputs : undefined,
      };
    }
    if (data.type === "TERMINATE") {
      return {
        type: "TERMINATE",
        nonce: data.nonce,
        runId: typeof data.runId === "string" ? data.runId : undefined,
      };
    }
    if (data.type === "DISPOSE") {
      return { type: "DISPOSE", nonce: data.nonce };
    }
    return null;
  }

  self.onmessage = function (event) {
    if (disposed) return;
    var message = parseInbound(event.data);
    if (message == null) return;

    if (message.type === "BOOT") {
      if (expectedNonce != null) return;
      expectedNonce = message.nonce;
      bootRuntime().catch(function () {
        // fatal already posted
      });
      return;
    }

    if (expectedNonce == null || message.nonce !== expectedNonce) return;

    if (message.type === "RUN") {
      runCode(message.runId, message.code, message.inputs);
      return;
    }

    if (message.type === "TERMINATE" || message.type === "DISPOSE") {
      disposed = message.type === "DISPOSE" ? true : disposed;
      clearRunWatchdog();
      activeRunId = null;
      if (message.type === "DISPOSE") {
        ready = false;
        pyodide = null;
      }
      try {
        self.close();
      } catch {
        // ignore
      }
    }
  };
})();
