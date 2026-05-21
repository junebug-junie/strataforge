import { expect, test } from "@playwright/test";

test.describe("topic workspace live e2e", () => {
  test("atlas select, coverage toggle, advance status, copy prompt", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Atlas" })).toBeVisible({ timeout: 15_000 });

    const topicBtn = page.getByRole("button", { name: "Behavior Insights", exact: true });
    await expect(topicBtn).toBeVisible();
    await topicBtn.click();

    await expect(page.getByRole("heading", { name: "Behavior Insights", level: 2 })).toBeVisible();
    await expect(page.getByTestId("app-toast")).toContainText(/Opened topic/i);

    // Toggle out of scope on
    const oos = page.getByTestId("coverage-out_of_scope");
    await oos.click();
    await expect(page.getByTestId("app-toast")).toContainText(/Out of scope on/i, { timeout: 10_000 });
    await expect(oos).toHaveAttribute("aria-pressed", "true");

    // Toggle off
    await oos.click();
    await expect(page.getByTestId("app-toast")).toContainText(/Out of scope off/i, { timeout: 10_000 });
    await expect(oos).toHaveAttribute("aria-pressed", "false");

    // Advance status one step (expanded or reconciled depending on demo data)
    const advance = page.getByTestId("advance-status");
    if (await advance.isEnabled()) {
      await advance.click();
      await expect(page.getByTestId("app-toast")).toContainText(/Status advanced/i, { timeout: 10_000 });
    }

    // Copy expansion prompt
    await page.getByTestId("action-expand").click();
    await expect(page.getByTestId("app-toast")).toContainText(/Expansion prompt copied/i, {
      timeout: 10_000,
    });

    await page.getByTestId("copy-expand-prompt").click();
    await expect(page.getByTestId("app-toast")).toContainText(/Expansion prompt copied/i, {
      timeout: 10_000,
    });
  });
});
