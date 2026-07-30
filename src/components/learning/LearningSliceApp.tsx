import { useMemo, useState } from "preact/hooks";
import { CURRICULUM_MANIFEST } from "../../learning/manifest";
import {
  abandonAttempt,
  beginModuleAttempt,
  createLearningStore,
  demoInputForActivity,
  gradeDiagnosticAnswers,
  finishAttempt,
  getSliceActivities,
  getSliceModule,
  gradeActivity,
  latestScore,
  masteryForProgress,
  resetLocalProgress,
  submitExplanation,
  type ProgressV1,
  type RouteRecommendation,
} from "../../lib/learning-runtime";

type Step = "diagnostic" | "module" | "result";

function emptyDiagAnswers(): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const item of CURRICULUM_MANIFEST.diagnostic.items.filter((i) => i.required)) {
    out[item.itemId] = null;
  }
  return out;
}

export default function LearningSliceApp() {
  const store = useMemo(() => createLearningStore(), []);
  const module = useMemo(() => getSliceModule(), []);
  const activities = useMemo(() => getSliceActivities(), []);

  const [step, setStep] = useState<Step>("diagnostic");
  const [diagAnswers, setDiagAnswers] = useState<Record<string, string | null>>(emptyDiagAnswers);
  const [recommendation, setRecommendation] = useState<RouteRecommendation | null>(null);
  const [routeOverride, setRouteOverride] = useState<RouteRecommendation | null>(null);
  const [delivery, setDelivery] = useState<"primary" | "accessible">("primary");
  const [progress, setProgress] = useState<ProgressV1>(() => store.getSnapshot());
  const [status, setStatus] = useState("진단으로 시작하세요. 모든 기록은 이 브라우저에만 남습니다.");
  const [activeIndex, setActiveIndex] = useState(0);

  const score = latestScore(progress);
  const mastery = masteryForProgress(progress);
  const inProgress = progress.modules[module.moduleId]?.inProgressAttempt ?? null;

  function commit(next: ProgressV1, message: string) {
    const saved = store.commit(next);
    setProgress(saved);
    setStatus(message);
  }

  function runDiagnostic() {
    const result = gradeDiagnosticAnswers(diagAnswers);
    setRecommendation(result.recommendation);
    setStatus(`진단 추천: ${result.recommendation} (evaluator 채점). 원하면 다른 경로로 바로 시작할 수 있습니다.`);
  }

  function startModule(override: RouteRecommendation | null = null) {
    setRouteOverride(override);
    const next = beginModuleAttempt(store.getSnapshot(), {
      abandonExisting: true,
    });
    commit(next, `모듈 시도를 시작했습니다 (${override ?? recommendation ?? "main"} 경로).`);
    setActiveIndex(0);
    setStep("module");
  }

  function answerCurrent(mode: "pass" | "fail" | "blank") {
    if (!inProgress) return;
    const activity = activities[activeIndex];
    if (!activity) return;
    const graded = gradeActivity({
      progress,
      activityId: activity.activityId,
      input: demoInputForActivity(activity, mode),
      delivery,
    });
    commit(graded.progress, `${activity.activityId}: ${graded.outcome} (${delivery})`);
  }

  function explainCurrent(passed: boolean) {
    if (!inProgress) return;
    const activity = activities[activeIndex];
    if (!activity) return;
    const next = submitExplanation({
      progress,
      activityId: activity.activityId,
      passed,
    });
    commit(next, `${activity.activityId} 오답 설명: ${passed ? "pass" : "fail"}`);
  }

  function completeModule() {
    try {
      const next = finishAttempt(progress);
      commit(next, "시도를 완료했습니다. 최신 complete attempt만 점수에 사용됩니다.");
      setStep("result");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "complete failed");
    }
  }

  function abandonModule() {
    const next = abandonAttempt(progress);
    commit(next, "진행 중 시도를 포기했습니다. 이전 complete 점수는 유지됩니다.");
    setStep("result");
  }

  function resetAll() {
    resetLocalProgress(store);
    setProgress(store.getSnapshot());
    setDiagAnswers(emptyDiagAnswers());
    setRecommendation(null);
    setRouteOverride(null);
    setStep("diagnostic");
    setStatus("로컬 진도를 초기화했습니다.");
  }

  const current = activities[activeIndex];
  const currentEvidence = current
    ? inProgress?.evidence[current.activityId]
    : undefined;

  return (
    <section class="learning-slice" aria-labelledby="learning-slice-title">
      <header>
        <h1 id="learning-slice-title">수직 슬라이스: {module.title}</h1>
        <p class="learning-slice__note" role="note">
          진단 → {delivery === "primary" ? "기본" : "접근성"} 활동 → 완료 시도 → 80%/설명 관문 → 재시도/포기.
          답안·설명 원문은 저장하지 않습니다. 네트워크로 학습 데이터를 보내지 않습니다.
        </p>
        <p role="status" aria-live="polite" class="learning-slice__status">
          {status}
        </p>
      </header>

      <div class="learning-slice__toolbar">
        <label>
          전달 경로
          <select
            value={delivery}
            onChange={(event) =>
              setDelivery((event.currentTarget as HTMLSelectElement).value as "primary" | "accessible")
            }
          >
            <option value="primary">primary</option>
            <option value="accessible">accessible</option>
          </select>
        </label>
        <button type="button" onClick={resetAll}>
          로컬 진도 초기화
        </button>
      </div>

      {step === "diagnostic" ? (
        <section aria-labelledby="diag-title">
          <h2 id="diag-title">준비 진단 (70% 경계)</h2>
          <ul class="learning-slice__list">
            {CURRICULUM_MANIFEST.diagnostic.items
              .filter((item) => item.required)
              .map((item) => (
                <li key={item.itemId}>
                  <fieldset>
                    <legend>
                      [{item.domain}] {item.title}
                    </legend>
                    <label>
                      <input
                        type="radio"
                        name={item.itemId}
                        checked={diagAnswers[item.itemId] === "correct"}
                        onChange={() =>
                          setDiagAnswers((prev) => ({ ...prev, [item.itemId]: "correct" }))
                        }
                      />
                      정답
                    </label>
                    <label>
                      <input
                        type="radio"
                        name={item.itemId}
                        checked={diagAnswers[item.itemId] === "wrong"}
                        onChange={() =>
                          setDiagAnswers((prev) => ({ ...prev, [item.itemId]: "wrong" }))
                        }
                      />
                      오답
                    </label>
                    <label>
                      <input
                        type="radio"
                        name={item.itemId}
                        checked={diagAnswers[item.itemId] === null}
                        onChange={() =>
                          setDiagAnswers((prev) => ({ ...prev, [item.itemId]: null }))
                        }
                      />
                      미응답
                    </label>
                  </fieldset>
                </li>
              ))}
          </ul>
          <div class="learning-slice__actions">
            <button type="button" onClick={runDiagnostic}>
              진단 평가
            </button>
            <button type="button" onClick={() => startModule(null)} disabled={!recommendation}>
              추천 경로로 모듈 시작
            </button>
            <button type="button" onClick={() => startModule("main")}>
              본 경로로 바로 시작
            </button>
            <button type="button" onClick={() => startModule("remedial-math-then-main")}>
              수학 보충 후 시작
            </button>
          </div>
          {recommendation ? (
            <p>
              현재 추천: <strong>{recommendation}</strong>
              {routeOverride ? ` / 선택: ${routeOverride}` : ""}
            </p>
          ) : null}
        </section>
      ) : null}

      {step === "module" && current ? (
        <section aria-labelledby="module-title">
          <h2 id="module-title">
            활동 {activeIndex + 1}/{activities.length}: {current.title}
          </h2>
          <p>
            stage={current.stage} · objective={current.objectiveId} · delivery={delivery}
          </p>
          <p>
            현재 기록: {currentEvidence?.outcome ?? "없음"}
            {currentEvidence?.explanationOutcome
              ? ` / explanation=${currentEvidence.explanationOutcome}`
              : ""}
          </p>
          <div class="learning-slice__actions">
            <button type="button" onClick={() => answerCurrent("pass")}>
              정답 제출
            </button>
            <button type="button" onClick={() => answerCurrent("fail")}>
              오답 제출
            </button>
            <button type="button" onClick={() => answerCurrent("blank")}>
              미응답 제출
            </button>
            <button type="button" onClick={() => explainCurrent(true)}>
              오답 설명 통과
            </button>
            <button type="button" onClick={() => explainCurrent(false)}>
              오답 설명 실패
            </button>
          </div>
          <div class="learning-slice__actions">
            <button
              type="button"
              disabled={activeIndex <= 0}
              onClick={() => setActiveIndex((value) => Math.max(0, value - 1))}
            >
              이전 활동
            </button>
            <button
              type="button"
              disabled={activeIndex >= activities.length - 1}
              onClick={() => setActiveIndex((value) => Math.min(activities.length - 1, value + 1))}
            >
              다음 활동
            </button>
            <button type="button" onClick={completeModule}>
              시도 완료
            </button>
            <button type="button" onClick={abandonModule}>
              시도 포기
            </button>
          </div>
        </section>
      ) : null}

      {step === "result" ? (
        <section aria-labelledby="result-title">
          <h2 id="result-title">결과</h2>
          <p>
            최신 점수:{" "}
            {score
              ? `${score.correct}/${score.total} (${score.percent}%) mastered=${String(score.mastered)}`
              : "없음 (stale/in-progress/abandoned는 점수에 쓰지 않음)"}
          </p>
          <p>
            mastery status: <strong>{mastery.status}</strong>
          </p>
          <div class="learning-slice__actions">
            <button type="button" onClick={() => startModule(routeOverride)}>
              새 시도 시작
            </button>
            <button type="button" onClick={() => setStep("diagnostic")}>
              진단으로
            </button>
          </div>
        </section>
      ) : null}
    </section>
  );
}
