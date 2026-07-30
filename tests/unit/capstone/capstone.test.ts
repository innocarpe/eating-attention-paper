import { describe, expect, it } from "vitest";

import { evaluateCapstoneEvidence } from "../../../src/domain/capstone";

const sha = "0123456789abcdef0123456789abcdef01234567";
const areas = [
  { area: "implementation" as const, score: 3, evidencePath: "implementation/README.md" },
  { area: "explanation" as const, score: 3, evidencePath: "explanation.md" },
  { area: "critique" as const, score: 4, evidencePath: "critique.md" },
];

describe("capstone evidence levels", () => {
  it("rejects branch-only URLs and short SHAs", () => {
    const rejected = evaluateCapstoneEvidence({
      selfAssessment: {
        repositoryUrl: "https://github.com/example/repo/tree/main",
        commitSha: "abc1234",
        areas,
      },
    });
    expect(rejected.complete).toBe(false);
    expect(rejected.level).toBe("none");
  });

  it("marks valid self-assessment and upgrades only with matching review commit", () => {
    const self = evaluateCapstoneEvidence({
      selfAssessment: {
        repositoryUrl: "https://github.com/example/attention-capstone",
        commitSha: sha,
        areas,
      },
    });
    expect(self).toMatchObject({ level: "self-assessed", complete: true, label: "자기평가 완주" });

    const reviewed = evaluateCapstoneEvidence({
      selfAssessment: {
        repositoryUrl: "https://github.com/example/attention-capstone",
        commitSha: sha,
        areas,
      },
      review: {
        repositoryUrl: "https://github.com/example/attention-capstone",
        commitSha: sha,
        reviewerId: "r1",
        reviewedAt: "2026-01-01",
        rubricRevision: "1",
        evidencePath: "review/review-record.md",
        areas,
      },
    });
    expect(reviewed).toMatchObject({ level: "reviewed", complete: true, label: "검토 완료" });
  });
});
