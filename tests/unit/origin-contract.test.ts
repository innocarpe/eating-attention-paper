import { describe, expect, it } from "vitest";

import {
  createDeploymentOrigins,
  parseDeploymentOrigins,
} from "../../src/config/origins";
import {
  canTransitionRelease,
  isBlockingFinding,
  transitionRelease,
} from "../../src/release/contracts";

describe("deployment origin contracts", () => {
  it("accepts three distinct HTTPS origins", () => {
    const origins = createDeploymentOrigins({
      production: "https://learn.example.com",
      preview: "https://preview.learn.example.com",
      rc: "https://rc.learn.example.com",
    });

    expect(origins.production.origin).toBe("https://learn.example.com");
    expect(origins.preview.origin).toBe("https://preview.learn.example.com");
    expect(origins.rc.origin).toBe("https://rc.learn.example.com");
  });

  it("rejects same-origin and path fallback configuration", () => {
    expect(() =>
      createDeploymentOrigins({
        production: "https://learn.example.com",
        preview: "https://learn.example.com/preview",
        rc: "https://rc.learn.example.com",
      }),
    ).toThrow(/origin-only/);

    expect(() =>
      createDeploymentOrigins({
        production: "https://learn.example.com",
        preview: "https://learn.example.com",
        rc: "https://rc.learn.example.com",
      }),
    ).toThrow(/pairwise distinct/);
  });

  it("fails closed when production configuration is missing outside local development", () => {
    expect(() =>
      parseDeploymentOrigins({
        MODE: "production",
        PUBLIC_PREVIEW_ORIGIN: "https://preview.learn.example.com",
        PUBLIC_RC_ORIGIN: "https://rc.learn.example.com",
      }),
    ).toThrow(/Missing required deployment origin configuration/);

    expect(parseDeploymentOrigins({ MODE: "development" })).toBeNull();
  });
});

describe("release transition contracts", () => {
  it("permits only the ordered release progression with evidence", () => {
    expect(canTransitionRelease("SOURCE_VERIFIED", "PR_PREVIEW")).toBe(true);
    expect(canTransitionRelease("SOURCE_VERIFIED", "RC")).toBe(false);
    expect(canTransitionRelease("LAUNCHED", "SOURCE_VERIFIED")).toBe(false);

    expect(
      transitionRelease(
        "SOURCE_VERIFIED",
        "PR_PREVIEW",
        { previewVerified: true },
      ),
    ).toBe("PR_PREVIEW");

    expect(() =>
      transitionRelease("SOURCE_VERIFIED", "RC", { rcVerified: true }),
    ).toThrow(/Invalid release transition/);
  });

  it("enforces the locked severity and disposition policy", () => {
    const common = {
      evidence: "signed validation report",
      owner: "release-owner",
      retestStatus: "not-run" as const,
    };

    expect(
      isBlockingFinding({
        ...common,
        id: "F-HIGH",
        severity: "HIGH",
        disposition: "open",
      }),
    ).toBe(true);

    expect(
      isBlockingFinding({
        ...common,
        id: "F-MEDIUM",
        severity: "MEDIUM",
        disposition: "risk-accepted",
        publicIssueUrl: "https://github.com/example/project/issues/1",
      }),
    ).toBe(false);

    expect(() =>
      isBlockingFinding({
        ...common,
        id: "F-MEDIUM-NO-ISSUE",
        severity: "MEDIUM",
        disposition: "risk-accepted",
      }),
    ).toThrow(/public issue URL/);

    expect(() =>
      isBlockingFinding({
        ...common,
        id: "F-LOW-NO-ISSUE",
        severity: "LOW",
        disposition: "deferred",
      }),
    ).toThrow(/public issue URL/);
  });
});
