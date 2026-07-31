import { describe, expect, it } from "vitest";

import { getLesson, getOrderedLessons, LESSONS } from "../../../src/lessons/path";

describe("study lesson path", () => {
  it("has a contiguous beginner path with multi-quiz mastery gates", () => {
    const lessons = getOrderedLessons();
    expect(lessons.length).toBeGreaterThanOrEqual(7);
    expect(lessons[0]?.id).toBe("why-attention");
    expect(lessons.at(-1)?.id).toBe("training-and-critique");

    for (const lesson of lessons) {
      expect(lesson.goals.length).toBeGreaterThanOrEqual(2);
      expect(lesson.sections.length).toBeGreaterThanOrEqual(2);
      expect(lesson.quizzes.length).toBeGreaterThanOrEqual(2);
      expect(lesson.commonMistakes.length).toBeGreaterThanOrEqual(1);
      expect(lesson.recap.length).toBeGreaterThanOrEqual(2);
      for (const quiz of lesson.quizzes) {
        expect(quiz.choices.length).toBeGreaterThanOrEqual(3);
        expect(quiz.choices.some((choice) => choice.id === quiz.correctId)).toBe(true);
      }
      if (lesson.nextId) {
        expect(getLesson(lesson.nextId)).toBeTruthy();
      }
    }

    const ids = new Set(LESSONS.map((lesson) => lesson.id));
    expect(ids.has("dot-product-attention")).toBe(true);
    expect(ids.has("multi-head")).toBe(true);
    expect(ids.has("encoder-decoder")).toBe(true);
    expect(ids.has("positional-encoding")).toBe(true);
  });

  it("includes hands-on practice on core math lessons", () => {
    const embeddings = getLesson("embeddings");
    const attention = getLesson("dot-product-attention");
    expect(embeddings?.practice?.length ?? 0).toBeGreaterThanOrEqual(1);
    expect(attention?.practice?.length ?? 0).toBeGreaterThanOrEqual(1);
    expect(attention?.widget).toBe("attention");
    expect(getLesson("multi-head")?.widget).toBe("multihead");
    expect(getLesson("positional-encoding")?.widget).toBe("positional");
    expect(getLesson("encoder-decoder")?.widget).toBe("encoder-decoder");
  });
});
