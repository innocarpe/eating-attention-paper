import { useMemo, useState } from "preact/hooks";
import SandboxRunner from "../../sandbox/SandboxRunner";
import { CURRICULUM_MANIFEST } from "../../learning/manifest";
import { runEvaluator } from "../../evaluators/registry";

export interface ImplementationSandboxActivityProps {
  activityId: string;
  objectiveId: string;
}

/**
 * Sandbox is exploratory only. Grading uses the manifest implementation evaluator
 * with learner-provided ordered step IDs (accessible precomputed-trace equivalent).
 * No self-report correct/incorrect buttons. No code/output persistence.
 */
export default function ImplementationSandboxActivity({
  activityId,
  objectiveId,
}: ImplementationSandboxActivityProps) {
  const workerUrl = useMemo(() => {
    const base = import.meta.env.BASE_URL.endsWith("/")
      ? import.meta.env.BASE_URL
      : `${import.meta.env.BASE_URL}/`;
    return `${base}sandbox/pyodide-worker.js`;
  }, []);
  const activity = CURRICULUM_MANIFEST.activities[activityId];
  const evaluator = activity?.primaryEvidenceSpec.evaluator;
  const [stepText, setStepText] = useState("s1,s2");
  const [status, setStatus] = useState("step ID를 콤마로 입력한 뒤 채점하세요.");

  function grade() {
    if (!evaluator) {
      setStatus("evaluator metadata missing");
      return;
    }
    const traceStepIds = stepText
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const result = runEvaluator(
      { evaluatorId: evaluator.evaluatorId, revision: evaluator.evaluatorRevision },
      { traceStepIds },
      evaluator.params,
    );
    setStatus(
      `${activityId} / ${objectiveId} → ${result.outcome} via ${evaluator.evaluatorId}@${evaluator.evaluatorRevision}`,
    );
  }

  return (
    <section class="impl-sandbox-activity" aria-labelledby="impl-sandbox-title">
      <header>
        <h2 id="impl-sandbox-title">구현 활동 샌드박스</h2>
        <p>
          activity <code>{activityId}</code> · objective <code>{objectiveId}</code>
        </p>
        <p role="note">
          위 실행기는 탐색용입니다. 채점 미리보기는 학습자가 입력한 결정적 step trace를 매니페스트 evaluator로 계산합니다. 이 패널은 모듈 attempt 저장소에 자동 기록하지 않으며, 코드/출력 본문은 저장하지 않습니다.
        </p>
      </header>

      <SandboxRunner workerUrl={workerUrl} />

      <div class="impl-sandbox-activity__grade">
        <label>
          precomputed trace step IDs
          <input
            value={stepText}
            onInput={(event) => setStepText((event.currentTarget as HTMLInputElement).value)}
            aria-label="trace step ids"
          />
        </label>
        <button type="button" onClick={grade}>
          trace로 채점
        </button>
        <p role="status">{status}</p>
      </div>
    </section>
  );
}
