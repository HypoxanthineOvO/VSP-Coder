import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.VSP_CODER_E2E_PORT || 4197);
const baseURL = `http://127.0.0.1:${port}`;
const stateDir = process.env.VSP_CODER_E2E_STATE_DIR || ".vsp-coder/e2e-state";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  workers: 1,
  expect: {
    timeout: 8_000
  },
  fullyParallel: false,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: {
    command: `npm run build && VSP_DEV_FIXTURES=1 VSP_CODER_STATE_DIR=${stateDir} VSP_CODER_HOST=127.0.0.1 VSP_CODER_PORT=${port} npm run start -w @vsp-coder/server`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
