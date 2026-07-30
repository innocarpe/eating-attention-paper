import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workerPath = resolve("public/sandbox/pyodide-worker.js");

describe("compiled sandbox worker bundle", () => {
  it("pins Pyodide 314.0.3 CDN, enforces READY network lock, and speaks the worker channel", () => {
    const source = readFileSync(workerPath, "utf8");
    expect(source).toContain("https://cdn.jsdelivr.net/pyodide/v314.0.3/full/");
    expect(source).toContain("attention-sandbox-worker");
    expect(source).toContain("Network access is disabled after sandbox READY");
    expect(source).toContain("loadPackage");
    expect(source).toContain("numpy");
    expect(source).toContain("selfCheck");
    // Denial inventory may mention storage names; worker must not write to them.
    expect(source).not.toMatch(/localStorage\s*=/);
    expect(source).not.toMatch(/indexedDB\s*\./);
    expect(source).not.toContain('channel:"attention-sandbox"');
    expect(source).not.toContain('channel: "attention-sandbox"');
  });
});
