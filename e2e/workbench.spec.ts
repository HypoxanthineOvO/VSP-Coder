import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const screenshotDir = join("test-results", "m1-screenshots");
const viewports = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "desktop-1280", width: 1280, height: 800 },
  { name: "tablet-1024", width: 1024, height: 768 },
  { name: "tablet-768", width: 768, height: 900 },
  { name: "mobile-390", width: 390, height: 844 }
];

test.describe("workbench smoke and screenshot baseline", () => {
  for (const viewport of viewports) {
    test(`@screenshot renders nonblank workbench at ${viewport.name}`, async ({ page }) => {
      mkdirSync(screenshotDir, { recursive: true });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/");

      await expect(page.locator("body")).toContainText("VSP-Coder");
      await expect(page.getByPlaceholder("给 Codex 发消息...")).toBeVisible();

      const screenshot = await page.screenshot({
        path: join(screenshotDir, `${viewport.name}.png`),
        fullPage: false
      });
      expect(screenshot.length).toBeGreaterThan(10_000);
    });
  }

  test("core controls are reachable in dev-test fixture mode", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByPlaceholder("给 Codex 发消息...")).toBeVisible();
    await expect(page.locator(".session-statusbar")).toContainText("queued");
    await expect(page.getByRole("button", { name: /发送/ })).toBeVisible();
  });
});
