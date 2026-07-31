import { useEffect, useMemo, useState } from "preact/hooks";
import {
  getLesson,
  getOrderedLessons,
  type LessonDefinition,
  type LessonQuiz,
  type PracticeProblem,
} from "../../lessons/path";
import AttentionLab from "./AttentionLab";
import EncoderDecoderLab from "./EncoderDecoderLab";
import MaskingLab from "./MaskingLab";
import MultiHeadLab from "./MultiHeadLab";
import PositionalLab from "./PositionalLab";
import SimilarityLab from "./SimilarityLab";

const STORAGE_KEY = "attention.study.progress.v2";

interface StudyProgress {
  completed: string[];
  lastLessonId: string | null;
  quizCorrect: Record<string, string[]>;
}

function loadProgress(): StudyProgress {
  if (typeof localStorage === "undefined") {
    return { completed: [], lastLessonId: null, quizCorrect: {} };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { completed: [], lastLessonId: null, quizCorrect: {} };
    const parsed = JSON.parse(raw) as Partial<StudyProgress>;
    return {
      completed: Array.isArray(parsed.completed)
        ? parsed.completed.filter((x): x is string => typeof x === "string")
        : [],
      lastLessonId: typeof parsed.lastLessonId === "string" ? parsed.lastLessonId : null,
      quizCorrect:
        parsed.quizCorrect && typeof parsed.quizCorrect === "object" ? parsed.quizCorrect : {},
    };
  } catch {
    return { completed: [], lastLessonId: null, quizCorrect: {} };
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

function QuizBlock({
  lessonId,
  quiz,
  alreadyCorrect,
  onCorrect,
}: {
  lessonId: string;
  quiz: LessonQuiz;
  alreadyCorrect: boolean;
  onCorrect: (quizId: string) => void;
}) {
  const [choice, setChoice] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const correct = alreadyCorrect || (checked && choice === quiz.correctId);

  return (
    <section class="study-quiz" aria-labelledby={`quiz-${quiz.id}`}>
      <h3 id={`quiz-${quiz.id}`}>{quiz.prompt}</h3>
      <div class="study-quiz__choices" role="radiogroup" aria-label={quiz.prompt}>
        {quiz.choices.map((item) => (
          <label key={item.id} class="study-quiz__choice">
            <input
              type="radio"
              name={`${lessonId}-${quiz.id}`}
              value={item.id}
              checked={choice === item.id}
              disabled={alreadyCorrect}
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
        {!alreadyCorrect ? (
          <button
            type="button"
            onClick={() => {
              if (!choice) return;
              setChecked(true);
              if (choice === quiz.correctId) onCorrect(quiz.id);
            }}
            disabled={!choice}
          >
            정답 확인
          </button>
        ) : null}
        {quiz.hint ? (
          <button type="button" class="button-secondary-ish" onClick={() => setShowHint(true)}>
            힌트
          </button>
        ) : null}
      </div>
      {showHint && quiz.hint ? <p class="study-lab__note">힌트: {quiz.hint}</p> : null}
      {alreadyCorrect || checked ? (
        <p role="status" class={correct ? "ok" : "bad"}>
          {correct ? "맞았습니다." : "아직입니다."} {quiz.explanation}
        </p>
      ) : null}
    </section>
  );
}

function PracticeBlock({ problem }: { problem: PracticeProblem }) {
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const ok =
    checked &&
    problem.acceptedAnswers.some((answer) => normalizeAnswer(answer) === normalizeAnswer(value));

  return (
    <section class="study-quiz" aria-labelledby={`practice-${problem.id}`}>
      <h3 id={`practice-${problem.id}`}>{problem.prompt}</h3>
      <label class="practice-input">
        답
        <input
          value={value}
          onInput={(event) => {
            setValue((event.currentTarget as HTMLInputElement).value);
            setChecked(false);
          }}
        />
      </label>
      <div class="study-actions">
        <button
          type="button"
          onClick={() => setChecked(true)}
          disabled={value.trim().length === 0}
        >
          확인
        </button>
        <button type="button" class="button-secondary-ish" onClick={() => setShowSteps(true)}>
          풀이 보기
        </button>
      </div>
      {checked ? (
        <p role="status" class={ok ? "ok" : "bad"}>
          {ok ? "맞았습니다." : "다시 해보세요."} {problem.explanation}
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
    quizCorrect: {},
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
  const correctQuizIds = new Set(progress.quizCorrect[lesson.id] ?? []);
  const allQuizzesCorrect = lesson.quizzes.every((quiz) => correctQuizIds.has(quiz.id));

  function persist(next: StudyProgress) {
    setProgress(next);
    saveProgress(next);
  }

  function selectLesson(id: string) {
    setLessonId(id);
    const next = { ...progress, lastLessonId: id };
    persist(next);
    const url = new URL(window.location.href);
    url.searchParams.set("lesson", id);
    window.history.replaceState({}, "", `${url.pathname}?${url.searchParams.toString()}`);
  }

  function markQuizCorrect(quizId: string) {
    const current = new Set(progress.quizCorrect[lesson.id] ?? []);
    current.add(quizId);
    const quizCorrect = {
      ...progress.quizCorrect,
      [lesson.id]: Array.from(current),
    };
    const lessonDone = lesson.quizzes.every((quiz) => current.has(quiz.id));
    const completed = lessonDone
      ? Array.from(new Set([...progress.completed, lesson.id]))
      : progress.completed;
    persist({
      ...progress,
      quizCorrect,
      completed,
      lastLessonId: lesson.id,
    });
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
            <strong>왜 배우나:</strong> {lesson.whyItMatters}
          </p>
          <section>
            <h2>이 레슨 목표</h2>
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
            <h2>손으로 풀어보기</h2>
            {lesson.practice.map((problem) => (
              <PracticeBlock key={problem.id} problem={problem} />
            ))}
          </section>
        ) : null}

        <section>
          <h2>이해 확인 퀴즈</h2>
          <p>
            이 레슨 퀴즈를 모두 맞춰야 완료로 표시됩니다. ({correctQuizIds.size}/
            {lesson.quizzes.length})
          </p>
          {lesson.quizzes.map((quiz) => (
            <QuizBlock
              key={quiz.id}
              lessonId={lesson.id}
              quiz={quiz}
              alreadyCorrect={correctQuizIds.has(quiz.id)}
              onCorrect={markQuizCorrect}
            />
          ))}
        </section>

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
            <button type="button" onClick={goNext} disabled={!allQuizzesCorrect && !completedSet.has(lesson.id)}>
              {allQuizzesCorrect || completedSet.has(lesson.id)
                ? "다음 레슨"
                : "퀴즈를 모두 맞추면 다음으로"}
            </button>
          ) : (
            <p role="status" class="ok">
              핵심 경로를 모두 봤습니다. 원문 §3을 다시 읽어보세요.
            </p>
          )}
        </div>
      </article>
    </div>
  );
}
