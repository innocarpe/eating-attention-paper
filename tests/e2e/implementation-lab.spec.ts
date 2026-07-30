import { expect, test } from "@playwright/test";

test.describe("implementation lab sandbox integration", () => {
  test("loads implementation lab with sandbox and trace evaluator grading", async ({ page }) => {
    await page.goto("/modules/implementation-lab/");
    await expect(page.getByRole("heading", { name: "구현 활동 랩" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "구현 활동 샌드박스" })).toBeVisible();
    await expect(page.getByRole("status").first()).toContainText(/Runtime ready|Preparing|Local|탐색|채점|step/i, {
      timeout: 90_000,
    });
    await page.getByLabel("trace step ids").fill("s1,s2");
    await page.getByRole("button", { name: "trace로 채점" }).click();
    await expect(page.getByText(/→ correct via implementation\.trace-match/)).toBeVisible();
    const storage = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    expect(storage).not.toMatch(/while True|Traceback|np\.array/);
  });
});
