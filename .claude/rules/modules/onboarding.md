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
  `OnboardingTaskController.getTasks / completeTask`.
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
  Partner; Customer until KAN-2 phase 2).

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
