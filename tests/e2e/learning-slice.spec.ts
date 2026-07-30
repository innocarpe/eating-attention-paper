import { expect, test } from "@playwright/test";

test.describe("M2 vertical learning slice", () => {
  test("diagnostic to module complete on primary path", async ({ page }) => {
    await page.goto("/learn/");
    await expect(page.getByRole("heading", { name: /수직 슬라이스/ })).toBeVisible();

    const correctRadios = page.getByRole("radio", { name: "정답" });
    const count = await correctRadios.count();
    for (let i = 0; i < count; i += 1) {
      await correctRadios.nth(i).check();
    }
    await page.getByRole("button", { name: "진단 평가" }).click();
    await expect(page.getByRole("status")).toContainText(/진단 추천/);

    await page.getByRole("button", { name: "본 경로로 바로 시작" }).click();
    const heading = page.getByRole("heading", { name: /활동 1\// });
    await expect(heading).toBeVisible();
    const label = await heading.textContent();
    const total = Number((label || "").match(/활동 1\/(\d+)/)?.[1] || "4");

    for (let i = 0; i < total; i += 1) {
      await page.getByRole("button", { name: "정답 제출" }).click();
      if (i < total - 1) {
        await page.getByRole("button", { name: "다음 활동" }).click();
      }
    }
    await page.getByRole("button", { name: "시도 완료" }).click();
    await expect(page.getByRole("heading", { name: "결과" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/최신 점수:/)).toContainText("%");
  });

  test("accessible delivery and abandon keep previous complete score semantics", async ({ page }) => {
    await page.goto("/learn/");
    await page.getByRole("button", { name: "본 경로로 바로 시작" }).click();
    await page.getByLabel("전달 경로").selectOption("accessible");
    await page.getByRole("button", { name: "정답 제출" }).click();
    await page.getByRole("button", { name: "시도 포기" }).click();
    await expect(page.getByRole("status")).toContainText(/포기|유지/);
  });
});
