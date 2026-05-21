import { expect, test } from "@playwright/test";
import { sampleDecomposeBundle, sampleLinkBundle } from "../src/sampleTopicBundles";

test.describe("topic workspace live e2e", () => {
  test("atlas select, coverage toggle, advance status, copy prompt", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Atlas tree" })).toBeVisible({
      timeout: 30_000,
    });

    const topicBtn = page.getByRole("button", { name: "Behavior Insights", exact: true });
    await topicBtn.click();

    await expect(page.getByRole("heading", { name: "Behavior Insights", level: 2 })).toBeVisible();
    await expect(page.getByTestId("app-toast")).toContainText(/Opened topic/i);

    const oos = page.getByTestId("coverage-out_of_scope");
    await oos.click();
    await expect(page.getByTestId("app-toast")).toContainText(/Out of scope on/i, { timeout: 10_000 });
    await oos.click();
    await expect(page.getByTestId("app-toast")).toContainText(/Out of scope off/i, { timeout: 10_000 });

    const advance = page.getByTestId("advance-status");
    if (await advance.isEnabled()) {
      await advance.click();
      await expect(page.getByTestId("app-toast")).toContainText(/Status advanced/i, {
        timeout: 10_000,
      });
    }

    await page.getByTestId("action-expand").click();
    await expect(page.getByTestId("app-toast")).toContainText(/Expansion prompt copied/i, {
      timeout: 10_000,
    });

    await page.getByTestId("action-boundary").click();
    await expect(page.getByTestId("app-toast")).toContainText(/Boundary check prompt copied/i, {
      timeout: 10_000,
    });
  });

  test("decompose session: import, accept, apply", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Atlas tree" })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("button", { name: "Behavior Insights", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Behavior Insights", level: 2 })).toBeVisible();

    await page.getByTestId("action-decompose").click();
    await expect(page.getByTestId("topic-session-decompose")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("app-toast")).toContainText(/decompose prompt copied/i);

    const bundle = sampleDecomposeBundle("topic:behavior-insights", "04-behavior-insights");
    await page.getByTestId("decompose-paste").fill(JSON.stringify(bundle));
    await page.getByTestId("import-decompose").click();
    await expect(page.getByTestId("app-toast")).toContainText(/Imported/i, { timeout: 10_000 });

    await page.getByTestId("accept-all-decompose").click();
    await expect(page.getByTestId("app-toast")).toContainText(/accepted/i, { timeout: 10_000 });

    await page.getByTestId("apply-decompose").click();
    await expect(page.getByTestId("app-toast")).toContainText(/Applied/i, { timeout: 15_000 });
  });

  test("link session: import, accept, apply dependency", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Atlas tree" })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("button", { name: "Behavior Insights", exact: true }).click();

    await page.getByTestId("action-link").click();
    await expect(page.getByTestId("topic-session-link")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("app-toast")).toContainText(/link prompt copied/i);

    const bundle = sampleLinkBundle("topic:behavior-insights", "topic:cat-profiles");
    await page.getByTestId("link-paste").fill(JSON.stringify(bundle));
    await page.getByTestId("import-link").click();
    await expect(page.getByTestId("app-toast")).toContainText(/Imported/i, { timeout: 10_000 });

    await page.getByTestId("accept-all-link").click();
    await page.getByTestId("apply-link").click();
    await expect(page.getByTestId("app-toast")).toContainText(/Applied/i, { timeout: 15_000 });

    await expect(
      page.getByTestId("ref-list-depends-on").getByRole("button", { name: "Cat Profiles" }),
    ).toBeVisible();
  });
});
