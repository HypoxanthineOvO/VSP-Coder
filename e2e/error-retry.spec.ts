import { expect, test } from "@playwright/test";

test.describe("error cards and retry recovery", () => {
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

  test("send failure renders a bottom error card and preserves the draft for retry", async ({ page }) => {
    await page.goto("/");
    await page.route("**/api/sessions/mock-main", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "Bad Gateway Authorization: Bearer secret-token" }) });
        return;
      }
      await route.fallback();
    });

    await page.getByPlaceholder("给 Codex 发消息...").fill("retry me");
    await page.getByRole("button", { name: /发送/ }).click();

    await expect(page.locator(".error-dock")).toContainText(/消息发送失败|上游服务暂不可用|请求失败/);
    await expect(page.locator(".error-dock")).toContainText("重试");
    await expect(page.locator(".error-dock")).not.toContainText("secret-token");
    await expect(page.getByPlaceholder("给 Codex 发消息...")).toHaveValue("retry me");
  });

  test("rate limit refresh renders cooldown retry semantics", async ({ page }) => {
    await page.goto("/");
    await page.route("**/api/state", async (route) => {
      await route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ error: "Too many requests token=secret" }) });
    });

    await page.getByTitle("刷新").first().click();

    await expect(page.locator(".error-dock")).toContainText(/429|请求过于频繁|限流/);
    await expect(page.locator(".error-dock")).toContainText(/稍后重试|重试/);
    await expect(page.locator(".error-card-actions button").first()).toBeDisabled();
    await expect(page.locator(".error-dock")).not.toContainText("secret");
  });

  test("SSE disconnect is visible as a reconnectable error", async ({ page }) => {
    await page.route("**/api/events", async (route) => {
      await route.fulfill({ status: 502, contentType: "text/plain", body: "event stream unavailable" });
    });

    await page.goto("/");

    await page.waitForTimeout(1900);
    await expect(page.locator(".error-dock")).toContainText(/实时连接|重新连接/);
    await expect(page.locator(".error-card.sse")).toHaveCount(1);
  });
});
