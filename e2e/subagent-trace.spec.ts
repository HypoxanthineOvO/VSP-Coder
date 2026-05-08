import { expect, test } from "@playwright/test";

test.describe("subagent trace interaction", () => {
  test.beforeEach(async ({ page }) => {
    await page.request.put("/api/config", { data: { dataMode: "dev-test" } });
    await page.addInitScript(() => {
      window.localStorage.setItem("vsp-coder-tool-display-mode", "simple");
      window.localStorage.setItem("vsp-coder-selection", JSON.stringify({
        projectId: "vsp-coder",
        sessionId: "mock-main",
        updatedAt: "2026-05-08T00:00:00.000Z"
      }));
    });
  });

  test("subagent trace remains visible in simple mode and opens detail", async ({ page }) => {
    await page.goto("/");

    await page.getByPlaceholder("给 Codex 发消息...").fill("please use subagent explorer to audit this");
    await page.getByRole("button", { name: /发送/ }).click();

    const trace = page.locator(".messages .subagent-trace", { hasText: "Subagent Gauss · running" }).first();
    await expect(trace).toBeVisible();
    await trace.click();

    await expect(page.locator(".subagent-modal")).toContainText("只读 trace");
    await expect(page.locator(".subagent-modal")).toContainText("Gauss");
    await expect(page.locator(".subagent-modal")).toContainText("当前 provider 未暴露");
  });
});
