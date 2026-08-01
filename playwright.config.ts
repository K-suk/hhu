import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3000";
const useProductionServer = process.env.E2E_PRODUCTION_SERVER === "1";
const writeStagingJsonReport = process.env.E2E_JSON_REPORT === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: writeStagingJsonReport
    ? [
        ["line"],
        ["json", { outputFile: "staging-evidence/playwright-results.json" }],
        ["html", { open: "never" }],
        ["github"],
      ]
    : process.env.CI
      ? [["html", { open: "never" }], ["github"]]
      : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: useProductionServer
      ? "npm run build && npm run start -- --hostname 127.0.0.1"
      : "npm run dev -- --hostname 127.0.0.1",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: useProductionServer ? 300_000 : 120_000,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.E2E_SUPABASE_URL ??
        process.env.NEXT_PUBLIC_SUPABASE_URL ??
        "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.E2E_SUPABASE_ANON_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
        "e2e-placeholder-key",
      NEXT_PUBLIC_FORMSPREE_REPORT_ENDPOINT:
        process.env.E2E_REPORT_SUBMIT_URL ??
        process.env.NEXT_PUBLIC_FORMSPREE_REPORT_ENDPOINT ??
        "http://127.0.0.1:3000/api/test/report",
    },
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "webkit-mobile",
      use: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } },
    },
  ],
});
