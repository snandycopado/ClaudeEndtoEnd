// Logs the browser in once per run through the sf CLI front door (no password, nothing stored in the repo)
// and saves the session to .auth/ (git-ignored) for every test.
const { chromium } = require("@playwright/test");
const { mkdirSync, writeFileSync } = require("node:fs");
const { frontdoorUrl, targetAlias } = require("./lib/org");
const { AUTH_DIR, ORG_FILE, STATE_FILE } = require("./lib/paths");

module.exports = async function globalSetup() {
  const alias = targetAlias();
  const url = frontdoorUrl(alias); // secret: never log it
  mkdirSync(AUTH_DIR, { recursive: true });

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForURL(/\/lightning\//, { timeout: 120_000 });
    const baseUrl = new URL(page.url()).origin;
    await context.storageState({ path: STATE_FILE });
    writeFileSync(ORG_FILE, JSON.stringify({ alias, baseUrl }, null, 2));
    console.log(`E2E: logged in to ${alias}`);
  } finally {
    await browser.close();
  }
};
