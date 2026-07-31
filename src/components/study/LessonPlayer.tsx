import { useEffect, useMemo, useState } from "preact/hooks";
import {
  getLesson,
  getOrderedLessons,
  type LessonDefinition,
  type PracticeProblem,
} from "../../lessons/path";
import AttentionLab from "./AttentionLab";
import EncoderDecoderLab from "./EncoderDecoderLab";
import MaskingLab from "./MaskingLab";
import MultiHeadLab from "./MultiHeadLab";
import PositionalLab from "./PositionalLab";
import SimilarityLab from "./SimilarityLab";

const STORAGE_KEY = "attention.study.progress.v3";

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
    const parsed = JSON.parse(raw) as Partial<StudyProgress>;
    return {
      completed: Array.isArray(parsed.completed)
        ? parsed.completed.filter((x): x is string => typeof x === "string")
        : [],
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

function normalizeAnswer(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function Widget({ lesson }: { lesson: LessonDefinition }) {
  switch (lesson.widget) {
    case "attention":
      return <AttentionLab />;
    case "similarity":
      return <SimilarityLab />;
    case "multihead":
      return <MultiHeadLab />;
    case "positional":
      return <PositionalLab />;
    case "encoder-decoder":
      return (
        <>
          <EncoderDecoderLab />
          <MaskingLab />
        </>
      );
    case "masking":
      return <MaskingLab />;
    default:
      return null;
  }
}

function PracticeBlock({ problem }: { problem: PracticeProblem }) {
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const hasCheck = (problem.acceptedAnswers?.length ?? 0) > 0;
  const ok =
    checked &&
    hasCheck &&
    problem.acceptedAnswers!.some(
      (answer) => normalizeAnswer(answer) === normalizeAnswer(value),
    );

  return (
    <section class="study-practice" aria-labelledby={`practice-${problem.id}`}>
      <h3 id={`practice-${problem.id}`}>{problem.prompt}</h3>
      {hasCheck ? (
        <label class="practice-input">
          답 (선택)
          <input
            value={value}
            onInput={(event) => {
              setValue((event.currentTarget as HTMLInputElement).value);
              setChecked(false);
            }}
          />
        </label>
      ) : null}
      <div class="study-actions">
        {hasCheck ? (
          <button
            type="button"
            onClick={() => setChecked(true)}
            disabled={value.trim().length === 0}
          >
            확인
          </button>
        ) : null}
        <button type="button" class="button-secondary-ish" onClick={() => setShowSteps(true)}>
          풀이 보기
        </button>
      </div>
      {checked && hasCheck ? (
        <p role="status" class={ok ? "ok" : "bad"}>
          {ok ? "맞았습니다." : "다시 계산해 보세요."} {problem.explanation}
        </p>
      ) : null}
      {showSteps ? (
        <ol>
          {problem.workedSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

export default function LessonPlayer({ initialId }: { initialId?: string }) {
  const lessons = useMemo(() => getOrderedLessons(), []);
  const [progress, setProgress] = useState<StudyProgress>({
    completed: [],
    lastLessonId: null,
  });
  const [lessonId, setLessonId] = useState(initialId || lessons[0]!.id);

  useEffect(() => {
    const loaded = loadProgress();
    setProgress(loaded);
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("lesson");
    if (fromQuery && getLesson(fromQuery)) {
      setLessonId(fromQuery);
      return;
    }
    if (initialId && getLesson(initialId)) {
      setLessonId(initialId);
      return;
    }
    if (loaded.lastLessonId && getLesson(loaded.lastLessonId)) {
      setLessonId(loaded.lastLessonId);
    }
  }, [initialId]);

  const lesson = getLesson(lessonId) ?? lessons[0]!;
  const completedSet = new Set(progress.completed);

  function persist(next: StudyProgress) {
    setProgress(next);
    saveProgress(next);
  }

  function selectLesson(id: string) {
    setLessonId(id);
    const completed = Array.from(new Set([...progress.completed, lessonId]));
    persist({ completed, lastLessonId: id });
    const url = new URL(window.location.href);
    url.searchParams.set("lesson", id);
    window.history.replaceState({}, "", `${url.pathname}?${url.searchParams.toString()}`);
  }

  function markCurrentReadAndNext() {
    const completed = Array.from(new Set([...progress.completed, lesson.id]));
    persist({ completed, lastLessonId: lesson.nextId ?? lesson.id });
    if (lesson.nextId) {
      setLessonId(lesson.nextId);
      const url = new URL(window.location.href);
      url.searchParams.set("lesson", lesson.nextId);
      window.history.replaceState({}, "", `${url.pathname}?${url.searchParams.toString()}`);
    }
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
                {completedSet.has(item.id) ? <em>읽음</em> : <em>{item.minutes}분</em>}
              </button>
            </li>
          ))}
        </ol>
        <p class="study-sidebar__progress">
          읽은 레슨 {progress.completed.length}/{lessons.length}
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
            <strong>왜 배우나:</strong> {lesson.whyItMatters}
          </p>
          <section>
            <h2>이 레슨에서 잡을 것</h2>
            <ul>
              {lesson.goals.map((goal) => (
                <li key={goal}>{goal}</li>
              ))}
            </ul>
          </section>
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

        {lesson.practice && lesson.practice.length > 0 ? (
          <section>
            <h2>손으로 따라 계산</h2>
            <p class="study-lab__note">필수는 아닙니다. 막히면 풀이만 펼쳐도 됩니다.</p>
            {lesson.practice.map((problem) => (
              <PracticeBlock key={problem.id} problem={problem} />
            ))}
          </section>
        ) : null}

        <section>
          <h2>흔한 오개념</h2>
          <ul>
            {lesson.commonMistakes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section>
          <h2>한 줄 복습</h2>
          <ul>
            {lesson.recap.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p class="paper-anchor">논문 위치: {lesson.paperAnchor}</p>
        </section>

        <div class="study-actions">
          {lesson.nextId ? (
            <button type="button" onClick={markCurrentReadAndNext}>
              다음 레슨
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                persist({
                  completed: Array.from(new Set([...progress.completed, lesson.id])),
                  lastLessonId: lesson.id,
                })
              }
            >
              이 레슨 읽음 표시
            </button>
          )}
        </div>
      </article>
    </div>
  );
}
