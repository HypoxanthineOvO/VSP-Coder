import { expect, test } from "@playwright/test";

test.describe("session selection and reasoning reliability", () => {
  test.beforeEach(async ({ page }) => {
    await page.request.put("/api/config", { data: { dataMode: "dev-test" } });
  });

  test("session selection restores the last selected session after reload", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("vsp-coder-selection", JSON.stringify({
        projectId: "vsp-coder",
        sessionId: "mock-mobile",
        updatedAt: "2026-05-07T00:00:00.000Z"
      }));
    });

    await page.goto("/");
    await expect(page.locator(".session-card.active").first()).toContainText("移动端工作台调整");

    await page.reload();
    await expect(page.locator(".session-card.active").first()).toContainText("移动端工作台调整");
  });

  test("reasoning switch gives immediate feedback and settles on the chosen value", async ({ page }) => {
    await persistSelection(page, "mock-main");
    await page.goto("/");
    await expect(page.locator(".session-card.active").first()).toContainText("VSP-Coder 工作台会话");
    const reasoning = page.locator(".session-statusbar").getByLabel("切换当前会话 reasoning");

    await reasoning.selectOption("medium");

    await expect(page.locator(".session-statusbar")).toContainText(/模型切换中|已切换|medium/);
    await expect(reasoning).toHaveValue("medium");
  });

  test("reasoning switch rolls back when the backend rejects the update", async ({ page }) => {
    await persistSelection(page, "mock-main");
    await page.goto("/");
    await expect(page.locator(".session-card.active").first()).toContainText("VSP-Coder 工作台会话");
    const reasoning = page.locator(".session-statusbar").getByLabel("切换当前会话 reasoning");
    const previous = await reasoning.inputValue();
    const target = previous === "high" ? "medium" : "high";

    await page.route("**/api/sessions/*/actions", async (route) => {
      const request = route.request();
      const body = request.postDataJSON() as { type?: string } | null;
      if (request.method() === "POST" && body?.type === "switch_model") {
        await route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "fixture upstream failure" }) });
        return;
      }
      await route.fallback();
    });

    await reasoning.selectOption(target);

    await expect(page.locator(".inline-error")).toContainText("模型切换失败");
    await expect(reasoning).toHaveValue(previous);
  });

  test("unsupported reasoning is rejected without polluting session state", async ({ page }) => {
    const response = await page.request.post("/api/sessions/mock-main/actions", {
      data: { type: "switch_model", provider: "codex", model: "gpt-5.5", reasoning: "ultra" }
    });

    expect(response.status()).toBe(400);
    const state = await page.request.get("/api/state");
    const body = await state.json();
    const session = body.sessions.find((item: { id: string }) => item.id === "mock-main");
    expect(session.reasoning).not.toBe("ultra");
  });
});

async function persistSelection(page: import("@playwright/test").Page, sessionId: string) {
  await page.addInitScript((id) => {
    window.localStorage.setItem("vsp-coder-selection", JSON.stringify({
      projectId: "vsp-coder",
      sessionId: id,
      updatedAt: "2026-05-07T00:00:00.000Z"
    }));
  }, sessionId);
}
