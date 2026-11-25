// KAN-8: the Boarding Automation Lightning app (App Launcher, tabs in order, onboarding works inside it, Products).
const { test, expect } = require("@playwright/test");
const sf = require("../../lib/salesforce");
const { soql } = require("../../lib/org");
const { uniqueName } = require("../../lib/test-data");
const { OnboardingTracker } = require("../../pages/onboarding-tracker");

const APP = "Boarding Automation";
const NAV = [
  "Home",
  "Accounts",
  "Contacts",
  "Reports",
  "Dashboards",
  "Products"
];

test.describe("Boarding Automation app (KAN-8)", () => {
  test("TC-11 App Launcher opens Boarding Automation with its six tabs in order (KAN-8)", async ({
    page
  }) => {
    await sf.openApp(page, APP);
    expect(await sf.navItems(page)).toEqual(NAV);

    const [app] = soql(
      "SELECT DeveloperName, NavType, UiType FROM AppDefinition WHERE DeveloperName = 'Boarding_Automation'"
    );
    expect(app, "app exists in the org").toBeTruthy();
    expect(app.NavType).toBe("Standard");
    expect(app.UiType).toBe("Lightning");
  });

  test("TC-12 Inside the app, a new Australia account opens with the Path and the onboarding tracker (KAN-8)", async ({
    page
  }) => {
    await sf.openApp(page, APP);
    await sf.clickNavItem(page, "Accounts");
    await expect(page).toHaveURL(/\/lightning\/o\/Account\/(list|home)/);

    const rtDialog = await sf.clickNew(page);
    expect(rtDialog, "record type selection is shown").not.toBeNull();
    await sf.chooseRecordType(rtDialog, "Australia");
    const name = uniqueName("APP");
    await sf.fillField(page, "Account Name", name);
    const accountId = await sf.saveRecord(page, "Account");

    await expect(sf.appName(page)).toHaveText(APP);
    await expect(sf.recordHeader(page)).toContainText(name);
    await expect(sf.currentPathStep(page)).toContainText("New");
    await expect(new OnboardingTracker(page).emptyState()).toBeVisible();

    const [acc] = soql(
      `SELECT Account_Status__c, RecordType.DeveloperName FROM Account WHERE Id = '${accountId}'`
    );
    expect(acc.RecordType.DeveloperName).toBe("Australia");
    expect(acc.Account_Status__c).toBe("New");
  });

  test("TC-13 The Products tab opens the Products list (KAN-8)", async ({
    page
  }) => {
    await sf.openApp(page, APP);
    await sf.clickNavItem(page, "Products");
    await expect(page).toHaveURL(/\/lightning\/o\/Product2\/(list|home)/);
    await expect(
      page
        .locator(
          ".slds-page-header:visible, lst-list-view-manager-header:visible"
        )
        .first()
    ).toContainText("Products");
  });
});
