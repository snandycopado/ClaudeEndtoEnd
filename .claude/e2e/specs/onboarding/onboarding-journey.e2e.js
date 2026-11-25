// Onboarding journey on one Australia Account, as an agent works it in the UI.
// Covers KAN-2 (country record type + templates), KAN-3 (task link, read-only task), KAN-4 (no strike-through),
// KAN-6 (reopen, Active reverts), KAN-7 (confirmation dialog). Serial: each step builds on the previous one.
const { test, expect } = require("@playwright/test");
const sf = require("../../lib/salesforce");
const { soql } = require("../../lib/org");
const { countryTasks, uniqueName } = require("../../lib/test-data");
const { OnboardingTracker } = require("../../pages/onboarding-tracker");

test.describe.configure({ mode: "serial" });

const TASKS = countryTasks("Australia");
const NAMES = TASKS.map((t) => t.name);
const accountName = uniqueName("AU");
let accountId;

const account = () =>
  soql(
    `SELECT Account_Status__c, RecordType.DeveloperName, Onboarding_Tasks_Total__c, Onboarding_Tasks_Completed__c, Onboarding_Completed_Date__c FROM Account WHERE Id = '${accountId}'`
  )[0];
const tasks = () =>
  soql(
    `SELECT Name, Status__c, Template_Key__c, Completed_Date__c FROM Onboarding_Task__c WHERE Account__c = '${accountId}' ORDER BY Order__c`
  );
const task = (name) => tasks().find((t) => t.Name === name);

async function openAccount(page) {
  await sf.openRecord(page, "Account", accountId);
  const tracker = new OnboardingTracker(page);
  await expect(tracker.root).toBeVisible();
  return tracker;
}

test.describe("Onboarding journey - Australia account", () => {
  test("TC-01 Create an Australia account from the Accounts tab", async ({
    page
  }) => {
    await sf.openTab(page, "Accounts", "Account");
    const rtDialog = await sf.clickNew(page);
    expect(rtDialog, "record type selection is shown").not.toBeNull();
    await sf.chooseRecordType(rtDialog, "Australia");
    await sf.fillField(page, "Account Name", accountName);
    accountId = await sf.saveRecord(page, "Account");

    await expect(sf.recordHeader(page)).toContainText(accountName);
    const tracker = new OnboardingTracker(page);
    await expect(tracker.emptyState()).toBeVisible();

    const acc = account();
    expect(acc.Account_Status__c).toBe("New");
    expect(acc.RecordType.DeveloperName).toBe("Australia");
    expect(tasks()).toHaveLength(0);
  });

  test("TC-02 Start Onboarding on the Path generates the Australia tasks", async ({
    page
  }) => {
    const tracker = await openAccount(page);
    await sf.markPathStatus(page, "Start Onboarding");

    await expect(tracker.rows()).toHaveCount(TASKS.length);
    await expect(tracker.taskLinks()).toHaveText(NAMES);
    await expect(tracker.progress()).toHaveText(
      `0 of ${TASKS.length} tasks completed`
    );
    await expect(tracker.overallBadge()).toHaveText("In Progress");
    await expect(tracker.accountStatus()).toContainText("Start Onboarding");

    const acc = account();
    expect(acc.Account_Status__c).toBe("Start Onboarding");
    expect(acc.Onboarding_Tasks_Total__c).toBe(TASKS.length);
    expect(tasks().map((t) => t.Template_Key__c)).toEqual(
      TASKS.map((t) => t.key)
    );
  });

  test("TC-03 Cancel on the confirmation dialog saves nothing (KAN-7)", async ({
    page
  }) => {
    const tracker = await openAccount(page);
    const first = NAMES[0];
    await tracker.toggle(first);

    const dialog = tracker.confirmDialog();
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(`Complete "${first}"?`);
    await expect(dialog).not.toContainText("last open task");
    await tracker.confirm("Cancel");

    await expect(tracker.checkbox(first)).not.toBeChecked();
    await expect(tracker.progress()).toHaveText(
      `0 of ${TASKS.length} tasks completed`
    );
    expect(task(first).Status__c).not.toBe("Completed");
  });

  test("TC-04 OK completes the task, no strike-through (KAN-7, KAN-4)", async ({
    page
  }) => {
    const tracker = await openAccount(page);
    const first = NAMES[0];
    await tracker.toggle(first);
    await tracker.confirm("OK");

    await expect(sf.toast(page, "Task completed")).toBeVisible();
    await expect(tracker.rowBadge(first)).toHaveText("Completed");
    await expect(tracker.checkbox(first)).toBeChecked();
    await expect(tracker.row(first)).toContainText(/Completed\s*by\s*\S/); // wording is checked strictly in TC-10
    await expect(tracker.progress()).toHaveText(
      `1 of ${TASKS.length} tasks completed`
    );
    expect(await tracker.nameDecoration(first)).not.toContain("line-through");

    const t = task(first);
    expect(t.Status__c).toBe("Completed");
    expect(t.Completed_Date__c).not.toBeNull();
  });

  test("TC-05 Unticking a completed task reopens it without a dialog (KAN-6)", async ({
    page
  }) => {
    const tracker = await openAccount(page);
    const first = NAMES[0];
    await tracker.toggle(first);

    await expect(sf.toast(page, "Task reopened")).toBeVisible();
    await expect(tracker.confirmDialog()).toHaveCount(0);
    await expect(tracker.rowBadge(first)).toHaveText("In Progress");
    await expect(tracker.checkbox(first)).not.toBeChecked();
    await expect(tracker.progress()).toHaveText(
      `0 of ${TASKS.length} tasks completed`
    );
    expect(task(first).Status__c).toBe("In Progress");
  });

  test("TC-06 Completing every task makes the account Active (last-task warning)", async ({
    page
  }) => {
    const tracker = await openAccount(page);
    for (const [i, name] of NAMES.entries()) {
      await tracker.toggle(name);
      const dialog = tracker.confirmDialog();
      await expect(dialog).toBeVisible();
      const isLast = i === NAMES.length - 1;
      if (isLast)
        await expect(dialog).toContainText(
          "This is the last open task. The account will become Active."
        );
      else await expect(dialog).not.toContainText("last open task");
      await tracker.confirm("OK");
      await expect(tracker.progress()).toHaveText(
        `${i + 1} of ${TASKS.length} tasks completed`
      );
    }

    await expect(tracker.overallBadge()).toHaveText("Completed");
    await expect(tracker.accountStatus()).toContainText("Active");
    await expect(sf.currentPathStep(page)).toContainText("Active");

    const acc = account();
    expect(acc.Account_Status__c).toBe("Active");
    expect(acc.Onboarding_Completed_Date__c).not.toBeNull();
    expect(acc.Onboarding_Tasks_Completed__c).toBe(TASKS.length);
  });

  test("TC-07 Reopening a task on an Active account reverts it to Start Onboarding (KAN-6)", async ({
    page
  }) => {
    const tracker = await openAccount(page);
    const last = NAMES[NAMES.length - 1];
    await tracker.toggle(last);

    await expect(sf.toast(page, "Task reopened")).toBeVisible();
    await expect(tracker.progress()).toHaveText(
      `${TASKS.length - 1} of ${TASKS.length} tasks completed`
    );
    await expect(tracker.overallBadge()).toHaveText("In Progress");
    await expect(tracker.accountStatus()).toContainText("Start Onboarding");

    const acc = account();
    expect(acc.Account_Status__c).toBe("Start Onboarding");
    expect(acc.Onboarding_Completed_Date__c).toBeNull();
  });

  test("TC-08 Task name opens the read-only task record (KAN-3)", async ({
    page
  }) => {
    const tracker = await openAccount(page);
    const first = NAMES[0];
    await tracker.row(first).locator("a.task-link").click();

    await page.waitForURL(
      /\/lightning\/r\/Onboarding_Task__c\/[a-zA-Z0-9]{15,18}\/view/
    );
    const header = sf.recordHeader(page);
    await expect(header).toContainText(first);
    for (const action of ["Edit", "Delete", "Clone"]) {
      await expect(
        header.getByRole("button", { name: action, exact: true })
      ).toHaveCount(0);
    }
  });

  test('TC-10 The "Completed by … on …" line reads correctly', async ({
    page
  }) => {
    const tracker = await openAccount(page);
    const first = NAMES[0]; // completed in TC-06 and still completed
    const line = tracker
      .row(first)
      .locator("p")
      .filter({ hasText: /^\s*Completed/ });
    // What the user sees (innerText), with the words separated by spaces.
    await expect(line).toHaveText(/^Completed by \S.* on \S/, {
      useInnerText: true
    });
  });
});
