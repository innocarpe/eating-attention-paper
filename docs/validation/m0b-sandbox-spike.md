# M0B Hostile Pyodide containment spike

## Scope

Prove that learner Python can only run inside an opaque `sandbox="allow-scripts"` iframe's internal Worker, with:

- pinned Pyodide `314.0.3` + NumPy
- BOOT readiness budget 30s (separate from run deadline)
- RUN wall-clock deadline 3s
- observed termination target ≤ 3.25s
- no parent-thread fallback execution
- no persistence of code / free explanation / output / error bodies
- post-READY denial of general network and `js` bridge authority

## Architecture

1. Parent `SandboxController` fetches the compiled worker bundle as trusted text.
2. Parent mounts an iframe with `sandbox="allow-scripts"` and `srcdoc` from `createSandboxFrameSource()`.
3. Parent sends `INIT { nonce, workerSource }`.
4. Frame creates a **classic** Worker from a Blob URL and sends `BOOT`.
5. Worker `importScripts` the pinned CDN loader, loads NumPy, installs js-bridge denial + network lock, emits `READY`.
6. Parent sends `RUN`; frame + parent watchdogs enforce the 3s deadline and recreate on timeout.

## Automated evidence (completed)

Commands:

```sh
npm run lint
npm test
npm run build
npm run test:e2e
```

Observed:

- unit/integration tests green (protocol, limits, frame source, controller, worker bundle)
- static build emits `/sandbox/` and `/sandbox/pyodide-worker.js`
- Playwright Chromium e2e:
  - READY under readiness budget
  - NumPy starter run returns `6`
  - infinite loop times out and a later normal run succeeds
  - no code/output bodies written to `localStorage` / `sessionStorage`

## Remaining human multi-browser sign-off

Still required before calling a full multi-browser M0B go memo for production launch (not required to continue M1+ implementation):

1. Firefox + Safari smoke of `/sandbox/`
2. Signed browser version + artifact SHA note
3. Explicit hostile sample checklist attachment in release evidence pack

## No-weakening rule

If any real-runtime denial or timeout recovery check fails, do not relax network prohibition after READY, persistent storage prohibition, Worker + opaque iframe requirement, 3 second execution deadline, or small-tensor numeric cap.
