// KAN-2: country record types replace Customer; each country gets its own onboarding templates.
const { test, expect } = require("@playwright/test");
const sf = require("../../lib/salesforce");
const { soql } = require("../../lib/org");
const {
  COUNTRY_RECORD_TYPES,
  RETIRED_RECORD_TYPE,
  countryTasks,
  uniqueName
} = require("../../lib/test-data");
const { OnboardingTracker } = require("../../pages/onboarding-tracker");

test("TC-09 New Account offers the country record types (not Customer) and a United States account gets its own tasks", async ({
  page
}) => {
  await sf.openTab(page, "Accounts", "Account");
  const rtDialog = await sf.clickNew(page);
  expect(rtDialog, "record type selection is shown").not.toBeNull();

  const offered = await sf.recordTypeOptions(rtDialog);
  for (const rt of COUNTRY_RECORD_TYPES)
    expect(offered, `record type ${rt} offered`).toContain(rt);
  expect(offered, "retired Customer record type is not offered").not.toContain(
    RETIRED_RECORD_TYPE
  );

  const name = uniqueName("US");
  await sf.chooseRecordType(rtDialog, "United States");
  await sf.fillField(page, "Account Name", name);
  const accountId = await sf.saveRecord(page, "Account");
  await expect(sf.recordHeader(page)).toContainText(name);

  await sf.markPathStatus(page, "Start Onboarding");
  const expected = countryTasks("United_States");
  const tracker = new OnboardingTracker(page);
  await expect(tracker.taskLinks()).toHaveText(expected.map((t) => t.name));

  const [acc] = soql(
    `SELECT RecordType.DeveloperName FROM Account WHERE Id = '${accountId}'`
  );
  expect(acc.RecordType.DeveloperName).toBe("United_States");
  const keys = soql(
    `SELECT Template_Key__c FROM Onboarding_Task__c WHERE Account__c = '${accountId}' ORDER BY Order__c`
  ).map((t) => t.Template_Key__c);
  expect(keys).toEqual(expected.map((t) => t.key));
});
