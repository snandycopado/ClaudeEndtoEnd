// Generic Lightning Experience helpers: navigation, the New-record flow, Path, toasts, record header.
// Module page objects (pages/*.js) build on these. Lightning keeps earlier pages in the DOM, so every
// locator here is limited to what is visible.
const { expect, test } = require("@playwright/test");
const { readFileSync } = require("node:fs");
const { ORG_FILE } = require("./paths");

function baseUrl() {
  return JSON.parse(readFileSync(ORG_FILE, "utf8")).baseUrl;
}

async function waitForLightning(page) {
  await expect(
    page.locator("one-appnav, .slds-global-header").first()
  ).toBeVisible({ timeout: 120_000 });
}

/** Open a tab the way a user does: the app's navigation bar, else the App Launcher search. */
async function openTab(page, tabLabel, objectApiName) {
  await page.goto(`${baseUrl()}/lightning/page/home`);
  await waitForLightning(page);
  const navLink = page
    .locator(`one-app-nav-bar a[title="${tabLabel}"]`)
    .first();
  await page
    .locator("one-app-nav-bar")
    .first()
    .waitFor({ timeout: 60_000 })
    .catch(() => {});
  if (await navLink.isVisible().catch(() => false)) {
    await navLink.click();
  } else {
    // Tab not in this app's navigation: search it in the App Launcher.
    try {
      await page.getByRole("button", { name: "App Launcher" }).click();
      const search = page.getByPlaceholder(/Search apps and items/);
      await search.waitFor({ timeout: 20_000 });
      await search.fill(tabLabel);
      await page
        .locator(`a[data-label="${tabLabel}"], one-app-launcher-menu-item a`)
        .filter({ hasText: new RegExp(`^\\s*${tabLabel}\\s*$`) })
        .first()
        .click({ timeout: 20_000 });
    } catch {
      // Launcher did not render its results in time: open the tab by URL and record that in the report.
      test.info().annotations.push({
        type: "navigation",
        description: `App Launcher fallback: opened ${tabLabel} by URL`
      });
      await page.keyboard.press("Escape").catch(() => {});
      await page.goto(`${baseUrl()}/lightning/o/${objectApiName}/home`);
    }
  }
  await expect(page).toHaveURL(
    new RegExp(`/lightning/o/${objectApiName}/(list|home)`)
  );
}

/** Open a Lightning app from the App Launcher (no URL fallback: finding the app is what's being tested). */
async function openApp(page, appLabel) {
  await page.goto(`${baseUrl()}/lightning/page/home`);
  await waitForLightning(page);
  await page.getByRole("button", { name: "App Launcher" }).click();
  const search = page.getByPlaceholder(/Search apps and items/);
  await search.waitFor({ timeout: 30_000 });
  await search.fill(appLabel);
  await page
    .locator(`a[data-label="${appLabel}"], one-app-launcher-menu-item a`)
    .filter({ hasText: new RegExp(`^\\s*${appLabel}\\s*$`) })
    .first()
    .click({ timeout: 30_000 });
  await expect(appName(page)).toHaveText(appLabel);
}

/** The current app's name in the navigation bar. */
function appName(page) {
  return page
    .locator("one-appnav .appName, one-appnav .slds-context-bar__app-name")
    .first();
}

/** Labels of the current app's navigation items, in order. */
async function navItems(page) {
  const bar = page.locator("one-app-nav-bar:visible").first();
  await bar.locator("one-app-nav-bar-item-root").first().waitFor();
  return bar.locator("one-app-nav-bar-item-root").evaluateAll((items) =>
    items.map((el) => {
      const a = el.querySelector("a");
      return ((a && a.getAttribute("title")) || el.innerText)
        .split("\n")[0]
        .trim();
    })
  );
}

/** Click a navigation item of the current app. */
async function clickNavItem(page, label) {
  await page
    .locator(`one-app-nav-bar a[title="${label}"]:visible`)
    .first()
    .click();
}

async function openRecord(page, objectApiName, recordId) {
  await page.goto(`${baseUrl()}/lightning/r/${objectApiName}/${recordId}/view`);
  await waitForLightning(page);
  await expect(recordHeader(page)).toBeVisible({ timeout: 60_000 });
}

function recordHeader(page) {
  return page
    .locator(
      "records-highlights2:visible, .slds-page-header_record-home:visible"
    )
    .first();
}

/** Click "New" on the list view. Returns the record type modal, or null when the user has one record type. */
async function clickNew(page) {
  await page.getByRole("button", { name: "New", exact: true }).first().click();
  const next = page.getByRole("button", { name: "Next", exact: true });
  const save = page.locator('button[name="SaveEdit"]');
  await expect(next.or(save).first()).toBeVisible();
  if (await next.isVisible())
    return page.getByRole("dialog").filter({ has: next });
  return null;
}

/** Labels of the record types offered in the record type modal. */
async function recordTypeOptions(dialog) {
  const labels = await dialog.locator("label").allInnerTexts();
  return labels.map((l) => l.split("\n")[0].trim()).filter(Boolean);
}

async function chooseRecordType(dialog, label) {
  // Exact text: the label's text runs into its description ("AustraliaCustomer accounts…").
  await dialog.getByText(label, { exact: true }).first().click();
  await dialog.getByRole("button", { name: "Next", exact: true }).click();
}

/** Fill a text field on the open record form by its label. */
async function fillField(page, label, value) {
  const byLayout = page.locator(
    `records-record-layout-item[field-label="${label}"] input:visible`
  );
  const byRole = page.getByRole("textbox", {
    name: new RegExp(`^\\*?\\s*${label}$`)
  });
  await byLayout.or(byRole).first().fill(value);
}

/** Save the open record form; returns the new record's Id from the URL. */
async function saveRecord(page, objectApiName) {
  await page.locator('button[name="SaveEdit"]').click();
  await page.waitForURL(
    new RegExp(`/lightning/r/${objectApiName}/[a-zA-Z0-9]{15,18}/view`),
    { timeout: 60_000 }
  );
  return page.url().match(/\/r\/\w+\/([a-zA-Z0-9]{15,18})\/view/)[1];
}

/** Path: select a step and click "Mark as Current <field>". */
async function markPathStatus(page, value) {
  const step = page
    .locator(
      `.slds-path__nav a[title="${value}"]:visible, .slds-path__nav [data-tab-name="${value}"]:visible`
    )
    .first();
  await step.click();
  await page
    .getByRole("button", { name: /^Mark as Current/ })
    .first()
    .click();
  await expect(currentPathStep(page)).toContainText(value);
}

function currentPathStep(page) {
  return page
    .locator(
      ".slds-path__nav .slds-is-current:visible, .slds-path__nav .slds-is-active:visible"
    )
    .first();
}

function toast(page, text) {
  return page
    .locator(".forceToastMessage, .slds-notify_toast")
    .filter({ hasText: text })
    .first();
}

module.exports = {
  baseUrl,
  waitForLightning,
  openTab,
  openApp,
  appName,
  navItems,
  clickNavItem,
  openRecord,
  recordHeader,
  clickNew,
  recordTypeOptions,
  chooseRecordType,
  fillField,
  saveRecord,
  markPathStatus,
  currentPathStep,
  toast
};
