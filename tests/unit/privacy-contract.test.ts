import { describe, expect, it } from "vitest";

import {
  DEFAULT_PRIVACY_POLICY,
  assertSafeAnalyticsPayload,
  cleanCanonicalUrl,
  hasAnalyticsEnablementEvidence,
} from "../../src/privacy/policy";

const ALLOWED_PAGE_IDS = ["page:home", "page:diagnostic"] as const;

describe("privacy policy contract", () => {
  it("keeps analytics off with no SDK, endpoint, or referrer", () => {
    expect(DEFAULT_PRIVACY_POLICY.analytics).toEqual({
      enabled: false,
      sdk: null,
      endpoint: null,
    });
    expect(DEFAULT_PRIVACY_POLICY.referrerPolicy).toBe("no-referrer");
    expect(hasAnalyticsEnablementEvidence(DEFAULT_PRIVACY_POLICY.analyticsEnablementEvidence)).toBe(false);
  });

  it("strips query and fragment data from canonical URLs", () => {
    expect(cleanCanonicalUrl("https://learn.example.com/lesson?answer=secret#solution")).toBe(
      "https://learn.example.com/lesson",
    );
  });

  it("accepts only a fixed page ID and coarse performance bucket", () => {
    expect(() =>
      assertSafeAnalyticsPayload(
        { pageId: "page:home", performanceBucket: "1s-to-3s" },
        ALLOWED_PAGE_IDS,
      ),
    ).not.toThrow();

    for (const payload of [
      { pageId: "page:unknown", performanceBucket: "under-1s" },
      { pageId: "page:home", performanceBucket: "precise:1234ms" },
      { pageId: "page:home", performanceBucket: "under-1s", answer: "42" },
      { pageId: "page:home", performanceBucket: "under-1s", context: { code: "print(1)" } },
    ]) {
      expect(() => assertSafeAnalyticsPayload(payload, ALLOWED_PAGE_IDS)).toThrow();
    }
  });

  it("requires every processor, logging, ownership, DPA, and retention proof", () => {
    expect(
      hasAnalyticsEnablementEvidence({
        processorContractVerified: true,
        transportSchemaVerified: true,
        rawRequestLogsDisabled: true,
        edgeAndAccessLogsDisabled: true,
        ipUserAgentReferrerExcluded: true,
        cookiesAndSessionIdsExcluded: true,
        namedOwnerAssigned: true,
        dpaVerified: true,
        retentionDays: 90,
      }),
    ).toBe(true);
  });
});
