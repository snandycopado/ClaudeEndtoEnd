---
paths:
  - "force-app/**/*Onboarding*"
  - "force-app/**/*Onboarding*/**"
  - "force-app/**/onboardingTaskTracker/**"
  - "force-app/**/customMetadata/Onboarding_Task_Template.*"
  - "force-app/**/email/Onboarding_*/**"
  - "force-app/**/objects/Account/fields/Onboarding_*"
---

# Onboarding module (prefix: Onboarding / onboarding)

When an Account's status becomes **Start Onboarding**, create its onboarding tasks from Custom Metadata;
when every task is Completed, set the Account to **Active**.

## Entry points

- AccountTriggerHandler (shared) → `OnboardingService.startOnboarding(accountIds)` on the transition into Start Onboarding.
- OnboardingTaskTrigger → OnboardingTaskTriggerHandler (stamps Completed Date/By; `OnboardingService.evaluateCompletion`).
- LWC `onboardingTaskTracker` (Account_Record_Page): progress, task list, completion checkbox →
  `OnboardingTaskController.getTasks / completeTask`. Each task name is a link (KAN-3): `NavigationMixin`
  `standard__recordPage` to the Onboarding_Task__c record (href from `GenerateUrl`, `#` until resolved; modifier-click
  → new tab). The list reloads when Account status or the task roll-ups change (getRecord `optionalFields`).
  Completed tasks are **not** struck through (KAN-4): status shows via the green badge, the disabled checkbox and the
  "Completed by … on …" line.
- Onboarding Task record page = `Onboarding_Task__c-Onboarding Task Layout` (in source since KAN-3, edit in place):
  task fields read-only, Edit/Delete/Clone excluded. **UI-only control**: `Onboarding_Manager` still grants edit/delete
  on the object (completeTask needs `update as user`), so list views, API and Flows can still change or delete tasks.
  A validation rule (no Completed → other status) / `allowDelete=false` is an architect decision.
- `OnboardingEmailQueueable`: owner email per new task using `Email_Template_Name__c`
  (default `Onboarding_Task_Assigned`, folder email/Onboarding_Email_Templates).

## Key objects

- `Onboarding_Task_Template__mdt` — Task Description, Order, Account Record Type (DeveloperName; blank = all),
  Status (initial), Email Template Name, Is Active; Label = task name. 14 records: the 2 Customer templates
  (Customer_Welcome_Call, Billing_Account_Setup) are copied per country as `<Template>_<Country RT>` (KAN-2);
  the Customer originals stay for existing Customer Accounts.
- `Onboarding_Task__c` (master-detail to Account) — Status (Not Started / In Progress / Completed), Order,
  Description, Template_Key__c (prevents duplicates on restart), Completed_Date__c, Completed_By__c.
- Account fields: Onboarding_Tasks_Total__c, Onboarding_Tasks_Completed__c (roll-ups), Onboarding_Progress__c,
  Onboarding_Completed_Date__c.
- Permission set `Onboarding_Manager` (also record type visibility: Australia, New_Zealand, United_States, Canada,
  Partner; Customer `visible=false` since KAN-2. Permission set deploys don't remove omitted entries, so revoke with visible=false).

## Behaviour

- Restart creates only missing tasks; all complete → Active immediately.
- No matching templates → no tasks, stays in Start Onboarding, WARN logged.
- `OnboardingService` is `without sharing` on purpose (automation must finish regardless of Account access).
- Email failures never block onboarding — logged.

## Tests

OnboardingServiceTest, OnboardingTaskControllerTest. `OnboardingTestFactory`: `createOnboardingUser()`,
`createStandardUser(permsets)` (generic persona used by other modules too), `newAccount(name, rt, status)`,
`standardTemplates()` + `OnboardingService.templateOverride`.
Update tasks in tests with `new Onboarding_Task__c(Id = …, Status__c = …)` (API 67 FLS on DML).
