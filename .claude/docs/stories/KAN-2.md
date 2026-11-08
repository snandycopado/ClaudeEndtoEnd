# KAN-2: Replace Customer with country record types on Account (Australia, New Zealand, United States, Canada)

| | |
|---|---|
| Module | shared (Shared Account model); touches onboarding (`Onboarding_Manager`, task templates, `OnboardingTestFactory`) and LCM tests |
| Branch | feature/KAN-2-account-country-record-types |
| Status | Phase 1 deployed and verified in esm-dev (2026-11-08). Waiting for admin steps, then phase 2 |
| Author | Claude (story-analyst + impact-analyzer) |
| Source | https://suman-nandy.atlassian.net/browse/KAN-2 (Story, To Do) |

## Story
As a Sales user I want customer Accounts to carry a country record type (Australia, New Zealand, United States,
Canada) instead of the generic Customer record type, so that each country can have its own page layout inside the
single Account Lightning record page.

Jira text: "Add new record type to account. Account will have multiple record types 1. Australia 2. New Zealand
3. US 4. Canada. Keep one lightning page but page layout will be different for each country."

### Decisions (Suman Nandy, 2026-11-08)
| # | Question | Decision |
|---|---|---|
| D1 | Add or replace? | The 4 country record types **replace Customer**. Partner and Internal stay unchanged. |
| D2 | Customer record type | **Deactivate in KAN-2** and remove it from `Onboarding_Manager`. Existing Customer Accounts keep it. An architect decides on the data migration later. |
| D3 | Layout differences | **None for now.** The 4 layouts are identical copies, kept separate for future per-country changes. |
| D4 | Labels / API names | Australia / `Australia`, New Zealand / `New_Zealand`, **United States / `United_States`**, Canada / `Canada` |
| D5 | Permission set | `Onboarding_Manager` grants visibility. |
| D6 | Onboarding tasks | Country Accounts get the Customer tasks. **Copy the template records**: 2 per country, 8 new; no code change. |
| D7 | Default record type | **Australia**, set as the profile default by an admin (manual). |

## Acceptance criteria
1. Four new active Account record types exist: `Australia`, `New_Zealand`, `United_States`, `Canada`.
2. `Customer` is inactive. No user can create a new Customer Account. Existing Customer Accounts can still be viewed and edited.
   `Partner` and `Internal` are unchanged.
3. A Standard User with `Onboarding_Manager` can create an Account of each country record type and of Partner, but not
   of Customer (phase 2). *(Changed in build: "a user without the permission set cannot select the country record
   types" was dropped. D7 makes Australia the profile default, so every profile gets Australia, and that check would
   no longer hold. Code review, 2026-11-08.)*
4. Each country record type offers all four `Account_Status__c` values (New, Start Onboarding, Active, Inactive),
   with New as the default.
5. Each country record type has its own layout: `Account-Australia Account Layout`, `Account-New Zealand Account Layout`,
   `Account-United States Account Layout`, `Account-Canada Account Layout`. They are identical copies of `Account-Account Layout`
   for now (Onboarding section, `RecordTypeId`, `Email__c`, Onboarding Tasks and LCM Notifications related lists).
6. `Account_Record_Page` stays the only Account record page for every record type. No new FlexiPage.
7. Path on `Account_Status__c` shows for each country record type.
8. Start Onboarding on a country Account creates the same tasks a Customer Account got: KYC_Verification,
   Contract_Signature, Customer_Welcome_Call-equivalent and Billing_Account_Setup-equivalent.
9. No regression. The LCM vendor list still shows only `Internal` Accounts, and all existing tests pass (moved off Customer).
10. Bulk: 200 country Accounts insert and update to Start Onboarding through `AccountTrigger` within limits.

## Impact
| Change | Type | Folder / file | New or modified |
|---|---|---|---|
| Account.Australia, .New_Zealand, .United_States, .Canada | RecordType | force-app/main/default/objects/Account/recordTypes/ | New ×4 |
| Account.Customer | RecordType | …/recordTypes/Customer.recordType-meta.xml | Modified in place: `active` → false (phase 2) |
| Account-Australia / New Zealand / United States / Canada Account Layout | Layout | force-app/main/default/layouts/ | New ×4 (copies; original untouched) |
| Account_Onboarding_Australia / _New_Zealand / _United_States / _Canada | PathAssistant | force-app/main/default/pathAssistants/ | New ×4 (Customer steps). `Account_Onboarding_Customer` kept for existing records. |
| Onboarding_Manager | PermissionSet | force-app/main/default/permissionsets/ | Modified in place: +4 country `recordTypeVisibilities` (phase 1); Customer visibility removed (phase 2) |
| Onboarding_Task_Template.Customer_Welcome_Call_<Country>, .Billing_Account_Setup_<Country> | CustomMetadata | force-app/main/default/customMetadata/ | New ×8 (copies of the 2 Customer templates, `Account_Record_Type__c` = country DeveloperName). Customer originals kept. |
| OnboardingTestFactory | ApexClass (test) | classes/OnboardingTestFactory.cls | Modified: constants `AUSTRALIA`, `NEW_ZEALAND`, `UNITED_STATES`, `CANADA`; `standardTemplates()` country task |
| OnboardingServiceTest, OnboardingTaskControllerTest, LcmNotificationServiceTest | ApexClass (test) | classes/ | Modified: `CUSTOMER` → `AUSTRALIA` (an inactive record type can't be used in DML) |
| AccountTriggerHandlerTest | ApexClass (test) | classes/AccountTriggerHandlerTest.cls (+meta) | New |
| shared.md, onboarding.md, lifecycle-management.md, test.md | Rule docs | .claude/rules/ | Modified |

Not changed: `Account.object-meta.xml`, `Account_Record_Page`, `Account-Account Layout`, `Account_Status__c`,
`AccountTrigger`, `AccountTriggerHandler`, `OnboardingService`, `LcmNotificationService`, `settings/PathAssistant`.

- Frameworks used: none changed.
- Permission sets updated: `Onboarding_Manager`. `LCM_User` is not changed.
- Other modules affected (impact-analyzer):
  - **Onboarding:** templates are matched on `Account_Record_Type__c`, so the 8 new records keep Customer-equivalent tasks.
  - **LCM:** vendor filter `Internal`. Its tests currently create Customer Accounts as non-vendors and move to Australia.
  - **Exception framework:** `AppLoggerTest` inserts an Account with no record type, which uses the running user's default record type.
    If that default is still Customer when Customer is deactivated, the test can fail. Phase 2 must wait until the default is Australia (see Deployment).
- Layout / record page / Path: 4 layouts and 4 Paths. Layout assignment and the default record type are profile metadata, so they are manual admin steps.

## Design
This is metadata and configuration only; no production Apex changes.
1. **Record types.** Same pattern as Customer: `Account_Status__c` picklistValues (4 values, default New).
2. **Customer retirement.** Set `active=false` on the existing file, edited in place. Inactive record types stay on existing
   records, and those records stay viewable and editable, but no new record can use them. Deleting Customer and migrating its
   Accounts to countries are removals for an architect.
3. **Layouts.** 4 identical copies of `Account-Account Layout` (D3). They reference org-only fields (`CustomerPriority__c`,
   `SLA__c`, …), which must exist in the target org.
4. **One page.** `Account_Record_Page` is the org default (View override). Its Details panel renders the layout assigned to the
   profile and record type.
5. **Path.** One PathAssistant per country record type.
6. **Onboarding (D6).** Copy `Customer_Welcome_Call` and `Billing_Account_Setup` once per country. The Customer originals
   stay for existing Customer Accounts that are still onboarding.
7. **Two-phase deploy** (both phases are in this story):
   - **Phase 1:** add the countries (record types, layouts, Paths, templates, permission set additions, tests).
   - **Admin:** assign the layouts and make Australia the profile default.
   - **Phase 2:** deactivate Customer and remove it from `Onboarding_Manager`.

   This order means nobody's default record type is ever an inactive one.

## Test plan
| AC | Test class.method | Kind |
|---|---|---|
| 1 | AccountTriggerHandlerTest.countryRecordTypesExistAndAreActive | happy |
| 2 | AccountTriggerHandlerTest.customerRecordTypeIsInactive (phase 2; `getRecordTypeInfosByDeveloperName().get('Customer').isActive()` false) | happy |
| 2 | AccountTriggerHandlerTest.partnerAndInternalUnchanged | happy |
| 3 | AccountTriggerHandlerTest.onboardingManagerCanCreateEachCountryRecordType (runAs Standard User + `Onboarding_Manager`, `insert as user`) | permission |
| 3 | AccountTriggerHandlerTest.customerRecordTypeNotAvailable (phase 2) | negative |
| 4 | AccountTriggerHandlerTest.onboardingManagerCanCreateEachCountryRecordType (`newSObject(rtId, true)` → status New) + smoke: UI API picklist values per record type | happy |
| 5–7 | Manual smoke per country record type as a Standard User + read-only `ProfileLayout` / `PathAssistant` queries | happy |
| 8 | AccountTriggerHandlerTest.startOnboardingOnCountryAccountCreatesCustomerEquivalentTasks (per country; real CMDT and `templateOverride`) | happy |
| 9 | AccountTriggerHandlerTest.countryAccountNotListedAsVendor; regression of OnboardingServiceTest, OnboardingTaskControllerTest, LcmNotificationServiceTest, AppLoggerTest, TriggerHandlerTest | negative / happy |
| 10 | AccountTriggerHandlerTest.bulkInsertAndUpdate200CountryAccounts | bulk |

## Deployment
Through `node .claude/skills/sf-deploy/deploy.mjs` (dry run with RunLocalTests first), to the alias in `.claude/allowed-orgs`.

**Phase 1** is deployed in two steps:
- **1a:** the metadata, i.e. the record types, layouts, Paths, templates and permission set below.
- **1b:** the 5 test classes, once the record types exist in the org.

The first combined dry run (2026-11-08) failed 21/49 tests with "Record Type ID: this ID value isn't valid for the
user". A record type created in a check-only deploy isn't usable by test users through the permission set in that
same validation. Code review confirmed that the metadata itself is correct.
- Record types: `RecordType:Account.Australia`, `RecordType:Account.New_Zealand`, `RecordType:Account.United_States`, `RecordType:Account.Canada`
- Layouts: `Layout:Account-Australia Account Layout`, `Layout:Account-New Zealand Account Layout`,
  `Layout:Account-United States Account Layout`, `Layout:Account-Canada Account Layout`
- Paths: `PathAssistant:Account_Onboarding_Australia`, `PathAssistant:Account_Onboarding_New_Zealand`,
  `PathAssistant:Account_Onboarding_United_States`, `PathAssistant:Account_Onboarding_Canada`
- Onboarding templates: `CustomMetadata:Onboarding_Task_Template.<8 new records>`
- Permission set: `PermissionSet:Onboarding_Manager` (country visibility added)
- Test classes (step 1b): `ApexClass:OnboardingTestFactory`, `ApexClass:OnboardingServiceTest`, `ApexClass:OnboardingTaskControllerTest`,
  `ApexClass:LcmNotificationServiceTest`, `ApexClass:AccountTriggerHandlerTest`

**Admin steps between phases** (manual, because profiles are off-limits to Claude):
1. Page Layout Assignment per profile in use: each country record type → its country layout. Partner, Internal and Customer stay on `Account-Account Layout`.
2. Add the 4 country record types to each profile's record type settings where needed, and set **Australia as the default** Account record type (D7).
3. Assign `Onboarding_Manager` to the users who need it.
4. Confirm `Account_Record_Page` has no app, record type or profile overrides.

**Phase 2:**
- `RecordType:Account.Customer` (`active=false`)
- `PermissionSet:Onboarding_Manager` (Customer visibility removed)
- `ApexClass:AccountTriggerHandlerTest` (Customer-inactive tests enabled)

**Removals (architect, not Claude):** delete the Customer record type; migrate existing Customer Accounts to country record types
(data, needs a country source such as `BillingCountry`); retire the 2 Customer onboarding templates and `Account_Onboarding_Customer`
once no Customer Accounts remain.

## Risks and open questions
1. **Profile default = Customer.** If any profile still defaults to Customer when phase 2 runs, users on that profile get errors
   on New, and `AppLoggerTest` can fail. Mitigation: phase 2 only after the admin steps; the dry run will catch the test failure.
2. **Existing Customer Accounts** keep the inactive record type and the old layout until the architect migration.
   Reports and list views filtered on Customer need review.
3. **Layout assignment** can't be delivered by Claude (no profiles). AC5 can only be verified after the admin step.
4. **Org-only fields on the copied layouts.** The deploy fails in an org without them.
5. **Other picklists per record type** (Type, Industry, Rating, AccountSource, org-only picklists): assume all values; verify after deploy.
6. **Template naming.** The 8 new CMDT DeveloperNames (e.g. `Customer_Welcome_Call_Australia`) must stay within 40 characters.
   `Billing_Account_Setup_United_States` is 35, which is OK.
7. **Mobile:** the per-record-type layout applies; no extra work.
8. Experience Cloud / guest: none. Integrations: none. Frameworks: none.

## Approval
- Plan approved by: Suman Nandy on 2026-11-08 (branch stacked on feature/ESM-002-claude-folder, which is not yet on main)
- Sandbox verification by: … on … (phase 1 evidence below; manual UI checks for AC5–AC7 after the admin steps)

## Evidence: phase 1 (esm-dev, 2026-11-08)
- Code review (code-reviewer): 0 Blockers. 3 Majors fixed: the deploy split; the default-status test now uses
  `newSObject(rtId, true)`; the profile-dependent negative test was removed (see AC3). Code Analyzer ran the regex
  engine only (no Java or Python locally), so CI runs the full analyzer.
- Security review: PASS, 3 Minors fixed (permission set description, factory comment, explicit `as user` DML).
  `00h…` summaryLayout id: not sensitive, and already in the committed source layout.
- Combined dry run: failed 21/49 tests ("Record Type ID … isn't valid for the user"), which led to the 1a/1b split.
- 1a deploy: Succeeded, 21/21 components, RunLocalTests 42/42 passed.
- 1b deploy: Succeeded, 5/5 components, RunLocalTests 48/48 passed.
- Coverage: AccountTriggerHandler 100%, OnboardingService 97%. AccountTriggerHandlerTest and OnboardingServiceTest: 17/17 passed.
- Smoke test (read-only anonymous Apex and Tooling queries):
  - Record types: Australia, New Zealand, United States and Canada are active. Customer, Partner and Internal are still active (Customer is deactivated in phase 2).
  - Default status: `newSObject(rtId, true)` gives `New` for all 4 countries.
  - `Onboarding_Task_Template__mdt`: 8 records target the country record types.
  - PathAssistant: Account Onboarding - Australia, Canada, New Zealand and United States are all active and bound to their record types.
  - Layouts in the org: Australia, Canada, New Zealand and United States Account Layout.
  - `Onboarding_Manager` description is updated.
