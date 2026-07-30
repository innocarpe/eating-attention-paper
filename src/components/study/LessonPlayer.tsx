import { useEffect, useMemo, useState } from "preact/hooks";
import { getLesson, getOrderedLessons, type LessonDefinition } from "../../lessons/path";
import AttentionLab from "./AttentionLab";
import SimilarityLab from "./SimilarityLab";

const STORAGE_KEY = "attention.study.progress.v1";

interface StudyProgress {
  completed: string[];
  lastLessonId: string | null;
}

function loadProgress(): StudyProgress {
  if (typeof localStorage === "undefined") {
    return { completed: [], lastLessonId: null };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { completed: [], lastLessonId: null };
    const parsed = JSON.parse(raw) as StudyProgress;
    return {
      completed: Array.isArray(parsed.completed) ? parsed.completed.filter((x) => typeof x === "string") : [],
      lastLessonId: typeof parsed.lastLessonId === "string" ? parsed.lastLessonId : null,
    };
  } catch {
    return { completed: [], lastLessonId: null };
  }
}

function saveProgress(progress: StudyProgress): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function Widget({ lesson }: { lesson: LessonDefinition }) {
  switch (lesson.widget) {
    case "attention":
      return <AttentionLab />;
    case "similarity":
      return <SimilarityLab />;
    case "multihead":
      return (
        <section class="study-lab">
          <h3>그림으로 보기: Multi-Head</h3>
          <p>
            한 문장을 여러 시선으로 동시에 본다고 생각하면 쉽습니다. head마다 다른 Q/K/V 투영을 배우고,
            마지막에 이어 붙여 합칩니다.
          </p>
          <div class="head-grid" aria-hidden="true">
            <div>Head 1: 대명사 연결</div>
            <div>Head 2: 수식/형용사</div>
            <div>Head 3: 위치 패턴</div>
            <div>Head 4: 동사-목적어</div>
          </div>
        </section>
      );
    case "positional":
      return (
        <section class="study-lab">
          <h3>그림으로 보기: 위치 인코딩</h3>
          <p>
            같은 단어 “bank”라도 문장 앞/뒤 위치에 따라 다른 위치 벡터가 더해집니다. Attention이 순서
            단서를 쓰려면 이 신호가 필요합니다.
          </p>
          <ol>
            <li>토큰 임베딩: 단어 정체성</li>
            <li>위치 인코딩: 몇 번째인지</li>
            <li>둘을 더해 Encoder/Decoder 입력으로 사용</li>
          </ol>
        </section>
      );
    case "encoder-decoder":
      return (
        <section class="study-lab">
          <h3>그림으로 보기: Encoder → Decoder</h3>
          <ol>
            <li>Encoder: 원문 전체 self-attention</li>
            <li>Decoder: 이미 생성한 단어 self-attention (미래 마스크)</li>
            <li>Decoder: 원문 표현을 보는 cross-attention</li>
            <li>다음 단어 예측</li>
          </ol>
        </section>
      );
    default:
      return null;
  }
}

export default function LessonPlayer({ initialId }: { initialId?: string }) {
  const lessons = useMemo(() => getOrderedLessons(), []);
  const [progress, setProgress] = useState<StudyProgress>({ completed: [], lastLessonId: null });
  const [lessonId, setLessonId] = useState(initialId || lessons[0]!.id);
  const [choice, setChoice] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const loaded = loadProgress();
    setProgress(loaded);
    if (!initialId && loaded.lastLessonId && getLesson(loaded.lastLessonId)) {
      setLessonId(loaded.lastLessonId);
    }
  }, [initialId]);

  const lesson = getLesson(lessonId) ?? lessons[0]!;
  const completedSet = new Set(progress.completed);
  const correct = checked && choice === lesson.quiz.correctId;

  function selectLesson(id: string) {
    setLessonId(id);
    setChoice(null);
    setChecked(false);
    const next = { ...progress, lastLessonId: id };
    setProgress(next);
    saveProgress(next);
  }

  function checkAnswer() {
    if (!choice) return;
    setChecked(true);
    if (choice === lesson.quiz.correctId) {
      const completed = Array.from(new Set([...progress.completed, lesson.id]));
      const next = { completed, lastLessonId: lesson.id };
      setProgress(next);
      saveProgress(next);
    }
  }

  function goNext() {
    if (lesson.nextId) selectLesson(lesson.nextId);
  }

  return (
    <div class="study-player">
      <aside class="study-sidebar" aria-label="학습 목차">
        <h2>0→100 목차</h2>
        <ol>
          {lessons.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                class={item.id === lesson.id ? "is-active" : undefined}
                onClick={() => selectLesson(item.id)}
              >
                <span>
                  {item.order}. {item.title}
                </span>
                {completedSet.has(item.id) ? <em>완료</em> : <em>{item.minutes}분</em>}
              </button>
            </li>
          ))}
        </ol>
        <p class="study-sidebar__progress">
          완료 {progress.completed.length}/{lessons.length}
        </p>
      </aside>

      <article class="study-main" aria-labelledby="lesson-title">
        <header>
          <p class="eyebrow">
            LESSON {lesson.order} · {lesson.englishTerm}
          </p>
          <h1 id="lesson-title">{lesson.title}</h1>
          <p class="lede">{lesson.summary}</p>
          <p>
            <strong>왜 먼저 배우나:</strong> {lesson.whyItMatters}
          </p>
        </header>

        {lesson.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}

        {lesson.formula ? (
          <section>
            <h2>핵심 식</h2>
            <pre class="formula">{lesson.formula}</pre>
          </section>
        ) : null}

        {lesson.workedExample ? (
          <section>
            <h2>{lesson.workedExample.title}</h2>
            <ol>
              {lesson.workedExample.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p>
              <strong>결과:</strong> {lesson.workedExample.result}
            </p>
          </section>
        ) : null}

        <Widget lesson={lesson} />

        <section class="study-quiz" aria-labelledby="quiz-title">
          <h2 id="quiz-title">이해 확인</h2>
          <p>{lesson.quiz.prompt}</p>
          <div class="study-quiz__choices" role="radiogroup" aria-label="퀴즈 선택지">
            {lesson.quiz.choices.map((item) => (
              <label key={item.id} class="study-quiz__choice">
                <input
                  type="radio"
                  name={`quiz-${lesson.id}`}
                  value={item.id}
                  checked={choice === item.id}
                  onChange={() => {
                    setChoice(item.id);
                    setChecked(false);
                  }}
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
          <div class="study-actions">
            <button type="button" onClick={checkAnswer} disabled={!choice}>
              정답 확인
            </button>
            {lesson.nextId ? (
              <button type="button" onClick={goNext}>
                다음 레슨
              </button>
            ) : null}
          </div>
          {checked ? (
            <p role="status" class={correct ? "ok" : "bad"}>
              {correct ? "맞았습니다." : "아직입니다."} {lesson.quiz.explanation}
            </p>
          ) : null}
        </section>

        <section>
          <h2>흔한 오개념</h2>
          <p>{lesson.commonMistake}</p>
          <p class="paper-anchor">논문 위치: {lesson.paperAnchor}</p>
        </section>
      </article>
    </div>
  );
}
