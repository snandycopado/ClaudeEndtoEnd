// CommonJS on purpose: an .mjs config hangs with Playwright 1.49 on Node 24 (Windows).
// End-to-end UI tests against the developer org (alias in .claude/allowed-orgs). Run: npm run test:e2e
const { defineConfig, devices } = require("@playwright/test");
const { join } = require("node:path");
const { E2E_DIR, RESULTS_DIR, STATE_FILE } = require("./lib/paths");

module.exports = defineConfig({
  testDir: join(E2E_DIR, "specs"),
  testMatch: "**/*.e2e.js",
  outputDir: join(RESULTS_DIR, "artifacts"),
  globalSetup: join(E2E_DIR, "global-setup.js"),
  // One org, shared data: run one test at a time. Journeys are serial inside a spec file.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 240_000,
  expect: { timeout: 30_000 },
  reporter: [
    ["list"],
    ["html", { outputFolder: join(RESULTS_DIR, "report"), open: "never" }],
    ["json", { outputFile: join(RESULTS_DIR, "results.json") }]
  ],
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    storageState: STATE_FILE,
    actionTimeout: 30_000,
    navigationTimeout: 120_000,
    screenshot: "on",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    // Watch mode: E2E_SLOWMO=<ms> slows every click/type so a person can follow it (npm run test:e2e:watch).
    launchOptions: { slowMo: Number(process.env.E2E_SLOWMO || 0) }
  }
});
