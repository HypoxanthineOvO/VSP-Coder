import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const screenshotDir = join("test-results", "m5-m6-screenshots");

test.describe("responsive shell and motion system", () => {
  test.beforeEach(async ({ page }) => {
    await page.request.put("/api/config", { data: { dataMode: "dev-test" } });
    await page.addInitScript(() => {
      window.localStorage.setItem("vsp-coder-selection", JSON.stringify({
        projectId: "vsp-coder",
        sessionId: "mock-main",
        updatedAt: "2026-05-07T00:00:00.000Z"
      }));
    });
  });

  test("@screenshot responsive shell keeps navigation and composer reachable at 1280", async ({ page }) => {
    mkdirSync(screenshotDir, { recursive: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");

    await expect(page.locator(".session-rail")).toBeVisible();
    await expect(page.locator(".session-card.active").first()).toContainText("VSP-Coder 工作台会话");
    await expect(page.locator(".right-rail.collapsed")).toBeVisible();
    await expect(page.getByPlaceholder("给 Codex 发消息...")).toBeVisible();

    const pane = await page.locator(".message-pane").boundingBox();
    const composer = await page.locator(".composer").boundingBox();
    expect(pane?.width || 0).toBeGreaterThanOrEqual(520);
    expect(composer?.y || 0).toBeLessThan(800);
    const screenshot = await page.screenshot({ path: join(screenshotDir, "desktop-1280-collapsed-right.png"), fullPage: false });
    expect(screenshot.length).toBeGreaterThan(10_000);
  });

  test("@screenshot mobile drawer exposes project and session navigation", async ({ page }) => {
    mkdirSync(screenshotDir, { recursive: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await expect(page.locator(".mobile-topbar")).toBeVisible();
    await page.locator(".mobile-topbar").getByRole("button").first().click();
    await expect(page.locator(".session-rail.open")).toBeVisible();
    await expect(page.locator(".session-rail.open")).toContainText("当前 Project Session");
    await expect(page.locator(".session-rail.open")).toContainText("VSP-Coder 工作台会话");
    await page.waitForTimeout(240);
    const screenshot = await page.screenshot({ path: join(screenshotDir, "mobile-390-drawer.png"), fullPage: false });
    expect(screenshot.length).toBeGreaterThan(10_000);
  });

  test("composer grows for long input and supports explicit expand", async ({ page }) => {
    await page.goto("/");
    const composer = page.getByPlaceholder("给 Codex 发消息...");
    const initial = await composer.boundingBox();

    await composer.fill(Array.from({ length: 12 }, (_, index) => `长输入第 ${index + 1} 行`).join("\n"));
    await expect.poll(async () => (await composer.boundingBox())?.height || 0).toBeGreaterThan(initial?.height || 0);

    await page.getByRole("button", { name: "展开输入框" }).click();
    await expect(page.locator(".composer-input.expanded")).toBeVisible();
  });

  test("reduced-motion lowers motion token duration", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const duration = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--motion-base").trim());
    expect(duration).toBe("1ms");
  });
});
