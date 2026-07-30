import { useMemo, useState } from "preact/hooks";
import {
  evaluateCapstoneEvidence,
  type CapstoneAreaScore,
  type CapstoneReviewRecord,
  type CapstoneSelfAssessment,
} from "../../domain/capstone";

function area(
  areaName: CapstoneAreaScore["area"],
  score: number,
  evidencePath: string,
): CapstoneAreaScore {
  return { area: areaName, score, evidencePath };
}

export default function CapstonePanel() {
  const [repositoryUrl, setRepositoryUrl] = useState("https://github.com/example/attention-capstone");
  const [commitSha, setCommitSha] = useState("0123456789abcdef0123456789abcdef01234567");
  const [impl, setImpl] = useState(3);
  const [expl, setExpl] = useState(3);
  const [crit, setCrit] = useState(3);
  const [includeReview, setIncludeReview] = useState(false);

  const report = useMemo(() => {
    const selfAssessment: CapstoneSelfAssessment = {
      repositoryUrl,
      commitSha,
      areas: [
        area("implementation", impl, "implementation/README.md"),
        area("explanation", expl, "explanation.md"),
        area("critique", crit, "critique.md"),
      ],
    };
    const review: CapstoneReviewRecord | null = includeReview
      ? {
          repositoryUrl,
          commitSha,
          reviewerId: "reviewer@example.org",
          reviewedAt: "2026-01-01",
          rubricRevision: "1",
          evidencePath: "review/review-record.md",
          areas: selfAssessment.areas,
        }
      : null;
    return evaluateCapstoneEvidence({ selfAssessment, review });
  }, [repositoryUrl, commitSha, impl, expl, crit, includeReview]);

  return (
    <section class="capstone-panel" aria-labelledby="capstone-panel-title">
      <h2 id="capstone-panel-title">로컬 증거 점검기</h2>
      <p role="note">입력은 서버로 전송되지 않으며 데모 상태만 계산합니다.</p>
      <label>
        repository URL
        <input value={repositoryUrl} onInput={(e) => setRepositoryUrl((e.currentTarget as HTMLInputElement).value)} />
      </label>
      <label>
        commit SHA
        <input value={commitSha} onInput={(e) => setCommitSha((e.currentTarget as HTMLInputElement).value)} />
      </label>
      <label>
        implementation 0-4
        <input type="number" min={0} max={4} value={impl} onInput={(e) => setImpl(Number((e.currentTarget as HTMLInputElement).value))} />
      </label>
      <label>
        explanation 0-4
        <input type="number" min={0} max={4} value={expl} onInput={(e) => setExpl(Number((e.currentTarget as HTMLInputElement).value))} />
      </label>
      <label>
        critique 0-4
        <input type="number" min={0} max={4} value={crit} onInput={(e) => setCrit(Number((e.currentTarget as HTMLInputElement).value))} />
      </label>
      <label>
        <input type="checkbox" checked={includeReview} onChange={(e) => setIncludeReview((e.currentTarget as HTMLInputElement).checked)} />
        같은 commit의 독립 검토 기록 포함
      </label>
      <p role="status">
        상태: <strong>{report.label}</strong> ({report.level}) · complete={String(report.complete)}
      </p>
      {report.reasons.length ? (
        <ul>
          {report.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
