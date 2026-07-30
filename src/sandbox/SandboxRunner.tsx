/**
 * Accessible Preact spike UI for the hostile Pyodide sandbox.
 *
 * - Fixed safe starter code (no free-form persistence)
 * - Explicit Run button
 * - Status live region
 * - Output/error displayed ephemerally (never localStorage / analytics)
 * - Character count and local-only / no-network notice
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { CODE_MAX_BYTES } from "./limits";
import { SandboxController } from "./controller";
import type { SandboxControllerState, SandboxRunResult } from "./protocol";

export interface SandboxRunnerProps {
  /**
   * URL of the leader-compiled worker bundle
   * (e.g. new URL("../../sandbox-frame/pyodide-worker.ts", import.meta.url).href
   * after bundling, or a static asset path).
   */
  workerUrl: string;
}

const STARTER_CODE = `# Safe starter — local sandbox only (no network)
import numpy as np

a = np.array([1.0, 2.0, 3.0])
print(a.sum())
a.sum()
`;

type UiPhase =
  | "idle"
  | "booting"
  | "ready"
  | "running"
  | "done"
  | "error"
  | "timeout"
  | "disposed";

function statusLabel(phase: UiPhase, controllerState: SandboxControllerState): string {
  switch (phase) {
    case "booting":
      return "Preparing Python runtime (local only)…";
    case "ready":
      return "Runtime ready. Local sandbox — no network.";
    case "running":
      return "Running (3 second limit)…";
    case "timeout":
      return "Timed out. Runtime was terminated and is rebooting.";
    case "error":
      return "Run finished with an error. Nothing was saved.";
    case "done":
      return "Run finished. Output is not stored.";
    case "disposed":
      return "Sandbox disposed.";
    default:
      if (controllerState === "booting") {
        return "Preparing Python runtime (local only)…";
      }
      return "Idle. Press Run to execute locally.";
  }
}

function formatResultBody(result: SandboxRunResult): { kind: "ok" | "error" | "timeout"; text: string } {
  if ("timedOut" in result && result.timedOut) {
    return {
      kind: "timeout",
      text: result.error.message,
    };
  }
  if (result.ok) {
    let text: string;
    try {
      text =
        typeof result.value === "string"
          ? result.value
          : JSON.stringify(result.value, null, 2) ?? String(result.value);
    } catch {
      text = String(result.value);
    }
    return { kind: "ok", text };
  }
  return {
    kind: "error",
    text: `${result.error.kind}: ${result.error.message}`,
  };
}

function utf8ByteLength(value: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value).byteLength;
  }
  return unescape(encodeURIComponent(value)).length;
}

/**
 * Spike runner component. Mount with a compiled `workerUrl`.
 * Does not use localStorage or analytics.
 */
export function SandboxRunner({ workerUrl }: SandboxRunnerProps) {
  const controllerRef = useRef<SandboxController | null>(null);
  const [code, setCode] = useState(STARTER_CODE);
  const [controllerState, setControllerState] = useState<SandboxControllerState>("idle");
  const [phase, setPhase] = useState<UiPhase>("idle");
  const [output, setOutput] = useState<{ kind: "ok" | "error" | "timeout"; text: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const codeBytes = useMemo(() => utf8ByteLength(code), [code]);
  const overLimit = codeBytes > CODE_MAX_BYTES;

  useEffect(() => {
    const controller = new SandboxController({
      workerUrl,
      onStateChange: (state) => {
        setControllerState(state);
        if (state === "ready") {
          setPhase((current) => (current === "timeout" || current === "booting" ? "ready" : current));
        } else if (state === "booting") {
          setPhase((current) => (current === "timeout" ? "booting" : current));
        }
      },
    });
    controllerRef.current = controller;

    let cancelled = false;
    setPhase("booting");
    setBusy(true);
    void controller
      .boot()
      .then(() => {
        if (cancelled) {
          return;
        }
        setPhase("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        setPhase("error");
        setOutput({
          kind: "error",
          text: err instanceof Error ? err.message : "Failed to prepare runtime.",
        });
      })
      .finally(() => {
        if (!cancelled) {
          setBusy(false);
        }
      });

    return () => {
      cancelled = true;
      controller.dispose();
      controllerRef.current = null;
    };
  }, [workerUrl]);

  const onRun = useCallback(async () => {
    const controller = controllerRef.current;
    if (controller == null || busy || overLimit) {
      return;
    }
    // Clear previous ephemeral output; never persist.
    setOutput(null);
    setBusy(true);
    setPhase("running");
    try {
      const result = await controller.run(code);
      const body = formatResultBody(result);
      setOutput(body);
      if (body.kind === "timeout") {
        setPhase(controller.getState() === "ready" ? "ready" : "timeout");
      } else if (body.kind === "error") {
        setPhase("error");
      } else {
        setPhase("done");
      }
    } catch (err) {
      setPhase("error");
      setOutput({
        kind: "error",
        text: err instanceof Error ? err.message : "Run failed.",
      });
    } finally {
      setBusy(false);
    }
  }, [busy, code, overLimit]);

  const liveStatus = statusLabel(phase, controllerState);
  const runDisabled = busy || overLimit || controllerState === "disposed";

  return (
    <section
      class="sandbox-runner"
      aria-labelledby="sandbox-runner-title"
      data-controller-state={controllerState}
    >
      <header class="sandbox-runner__header">
        <h2 id="sandbox-runner-title">Python sandbox (spike)</h2>
        <p class="sandbox-runner__notice" role="note">
          Local-only execution inside an opaque sandboxed iframe. No network, no
          package install, no persistent storage. Code and output are not saved
          and are not sent to any server.
        </p>
      </header>

      <div class="sandbox-runner__editor">
        <label for="sandbox-code">Python source</label>
        <textarea
          id="sandbox-code"
          name="sandbox-code"
          rows={12}
          spellcheck={false}
          autocomplete="off"
          autocapitalize="off"
          value={code}
          onInput={(event) => {
            setCode((event.currentTarget as HTMLTextAreaElement).value);
          }}
          aria-describedby="sandbox-code-meta sandbox-status"
          disabled={controllerState === "disposed"}
        />
        <div id="sandbox-code-meta" class="sandbox-runner__meta">
          <span>
            {codeBytes.toLocaleString()} / {CODE_MAX_BYTES.toLocaleString()} bytes
          </span>
          {overLimit ? (
            <span role="alert" class="sandbox-runner__limit-alert">
              Code exceeds the 32 KiB limit.
            </span>
          ) : null}
        </div>
      </div>

      <div class="sandbox-runner__actions">
        <button
          type="button"
          onClick={() => {
            void onRun();
          }}
          disabled={runDisabled}
          aria-busy={busy}
        >
          {phase === "running" ? "Running…" : "Run"}
        </button>
      </div>

      <p
        id="sandbox-status"
        class="sandbox-runner__status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {liveStatus}
      </p>

      {output != null ? (
        <div
          class="sandbox-runner__output"
          data-kind={output.kind}
          aria-label={
            output.kind === "ok"
              ? "Program output"
              : output.kind === "timeout"
                ? "Timeout"
                : "Error"
          }
        >
          <h3>
            {output.kind === "ok"
              ? "Output"
              : output.kind === "timeout"
                ? "Timeout"
                : "Error"}
          </h3>
          <pre>{output.text}</pre>
        </div>
      ) : null}
    </section>
  );
}

export default SandboxRunner;
