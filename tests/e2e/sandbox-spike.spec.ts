import { expect, test } from "@playwright/test";

test.describe("M0B sandbox spike", () => {
  test("boots READY and runs a tiny NumPy program without parent fallback", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await page.goto("/sandbox/");
    await expect(page.getByRole("heading", { name: "제한된 Python 실행 경계" })).toBeVisible();

    await expect(page.getByRole("status")).toContainText(/Runtime ready/i, {
      timeout: 90_000,
    });

    await page.getByRole("button", { name: /^Run/ }).click();
    await expect(page.locator(".sandbox-runner__output pre")).toContainText("6", {
      timeout: 20_000,
    });

    const storageProbe = await page.evaluate(() => ({
      local: { ...localStorage },
      session: { ...sessionStorage },
    }));
    const serialized = JSON.stringify(storageProbe);
    expect(serialized).not.toMatch(/while True|np\.array|python-error/);
    expect(pageErrors.join("\n")).not.toMatch(/SandboxController requires|Failed to fetch worker/);
  });

  test("times out an infinite loop and recovers for a later normal run", async ({ page }) => {
    await page.goto("/sandbox/");
    await expect(page.getByRole("status")).toContainText(/Runtime ready/i, {
      timeout: 90_000,
    });

    await page.locator("#sandbox-code").fill("# INFINITE\nwhile True:\n    pass\n");
    const started = Date.now();
    await page.getByRole("button", { name: /^Run/ }).click();
    await expect(page.getByRole("status")).toContainText(/Timed out|Runtime ready/i, {
      timeout: 20_000,
    });
    const observed = Date.now() - started;
    expect(observed).toBeLessThan(10_000);

    await expect(page.getByRole("status")).toContainText(/Runtime ready/i, {
      timeout: 90_000,
    });

    await page.locator("#sandbox-code").fill(
      "import numpy as np\nfloat(np.array([1.0, 2.0, 3.0]).sum())\n",
    );
    await page.getByRole("button", { name: /^Run/ }).click();
    await expect(page.locator(".sandbox-runner__output pre")).toContainText("6", {
      timeout: 20_000,
    });
  });
});
