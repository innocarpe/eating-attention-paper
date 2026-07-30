import { describe, expect, it } from "vitest";

import { getLesson, getOrderedLessons, LESSONS } from "../../../src/lessons/path";

describe("study lesson path", () => {
  it("has a contiguous beginner path with quizzes and next links", () => {
    const lessons = getOrderedLessons();
    expect(lessons.length).toBeGreaterThanOrEqual(7);
    expect(lessons[0]?.id).toBe("why-attention");
    expect(lessons.every((lesson) => lesson.quiz.choices.length >= 3)).toBe(true);
    expect(lessons.every((lesson) => lesson.sections.length >= 1)).toBe(true);

    for (const lesson of lessons) {
      if (lesson.nextId) {
        expect(getLesson(lesson.nextId)).toBeTruthy();
      }
    }

    const ids = new Set(LESSONS.map((lesson) => lesson.id));
    expect(ids.has("dot-product-attention")).toBe(true);
    expect(ids.has("multi-head")).toBe(true);
    expect(ids.has("encoder-decoder")).toBe(true);
  });
});
