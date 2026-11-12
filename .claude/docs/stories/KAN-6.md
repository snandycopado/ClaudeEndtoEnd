# KAN-6: Allow a completed task to be moved back to In Progress

|        |                                                                                                                            |
| ------ | -------------------------------------------------------------------------------------------------------------------------- |
| Jira   | https://suman-nandy.atlassian.net/browse/KAN-6 (Story, To Do). The screenshot can't be read through the connector          |
| Module | onboarding (LWC `onboardingTaskTracker`, `OnboardingTaskController`, `OnboardingService`)                                  |
| Branch | feature/KAN-6-reopen-onboarding-task, stacked on `feature/KAN-3-onboarding-task-detail-link` (it contains KAN-3 and KAN-4) |
| Status | Deployed to dev org (2026-11-12). PR open, awaiting verification                                                           |
| Author | Claude                                                                                                                     |

## 1. Story Description

**Story:** "As a Salesforce Agent, I want to uncheck the completed task and again move the task to In Progress.
Currently this check box is read only after completion."

**Acceptance criteria** (derived, to confirm):

1. In the Onboarding Tasks card, the checkbox of a Completed task can be unticked. Today it is disabled.
2. Unticking it sets the task to **In Progress**. Completed Date and Completed By are cleared; the existing trigger already does this.
3. The card refreshes: the badge shows In Progress, the "Completed by … on …" line disappears, the progress bar drops, and a toast confirms "Task reopened".
4. If the Account was **Active** because onboarding had completed, it goes back to **Start Onboarding** and Onboarding Completed Date is cleared (D1).
5. Ticking the task again completes it as today, and the Account becomes Active again when every task is Completed.
6. If the save fails, an error toast shows and the checkbox goes back to ticked.

**Decisions** (approved 2026-11-12 with "Approve"; the recommendations were accepted):

| #   | Question                                                                                          | Decision                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | When a task on an **Active** Account is reopened, should the Account go back to Start Onboarding? | **Yes.** Onboarding is no longer complete. This only applies to Accounts that onboarding activated (Onboarding Completed Date is set), so Accounts made Active some other way are left alone. |
| D2  | Should reopening ask "Are you sure?" first?                                                       | **No.** A toast confirms it, and ticking the box again undoes it.                                                                                                                             |
| D3  | Can the status be changed on the task's record page too?                                          | **No.** It stays read-only there (KAN-3). The card is the one place to complete or reopen a task.                                                                                             |

## 2. High Level Design

The checkbox becomes a toggle. Ticking it calls the existing `completeTask`; unticking calls a new
`reopenTask(taskId)` that sets the task to In Progress, in user mode like `completeTask`. The existing
`OnboardingTaskTrigger` then clears the completion stamp and calls `OnboardingService.evaluateCompletion`. That method is
extended both ways: it activates the Account when all tasks are complete (as today), and it moves an onboarding-activated
Account back to Start Onboarding when one isn't.

- **Components:** LWC (JS and HTML), Apex controller (new method) and Apex service (logic extended). No new metadata.
- **Modules affected:** onboarding. AccountTriggerHandler (shared) runs when the Account goes back to Start Onboarding. That is safe: `startOnboarding` only creates missing tasks, so nothing is duplicated and no emails go out for existing tasks.
- **Data model:** None. It uses the existing Status values (Not Started / In Progress / Completed) and the existing Account fields.
- **Security:** `reopenTask` uses `update as user`, like `completeTask`. `Onboarding_Manager` already grants edit on Status and access to the controller class, so no permission set change.
- **Risks:**
  - Path and Account status move backwards (Active → Start Onboarding). That is intended (D1), but reports counting Active Accounts will change when tasks are reopened.
  - Re-entering Start Onboarding runs `startOnboarding`. If a template was added since the first run, its task is created at that point. This is existing behaviour.

## 3. Low Level Design

| Component                | Type       | File                                                                      | New / Modified | Change                                                                                                            |
| ------------------------ | ---------- | ------------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------- |
| OnboardingService        | ApexClass  | force-app/main/default/classes/OnboardingService.cls                      | Modified       | Constant `TASK_IN_PROGRESS = 'In Progress'`. `evaluateCompletion` also reopens onboarding-activated Accounts      |
| OnboardingTaskController | ApexClass  | force-app/main/default/classes/OnboardingTaskController.cls               | Modified       | New `@AuraEnabled reopenTask(Id taskId)`                                                                          |
| onboardingTaskTracker    | LWC (JS)   | force-app/main/default/lwc/onboardingTaskTracker/onboardingTaskTracker.js | Modified       | Checkbox toggles: ticked → completeTask, unticked → reopenTask. `isDisabled` only while saving. Toasts and labels |
| onboardingTaskTracker    | LWC (HTML) | …/onboardingTaskTracker.html                                              | Modified       | None expected; the same `onchange={handleComplete}` handles both directions                                       |
| Module rule              | Doc        | .claude/rules/modules/onboarding.md                                       | Modified       | Tasks can be reopened. Account reverts to Start Onboarding                                                        |

**OnboardingService.evaluateCompletion(Set&lt;Id&gt; accountIds)**, one SOQL and one DML, bulk-safe:

```apex
for (Account acc : [SELECT Id, Account_Status__c, Onboarding_Completed_Date__c, (SELECT Status__c FROM Onboarding_Tasks__r)
                    FROM Account WHERE Id IN :accountIds
                    AND Account_Status__c IN (:ACCOUNT_START_ONBOARDING, :ACCOUNT_ACTIVE) WITH SYSTEM_MODE]) {
    Boolean done = !acc.Onboarding_Tasks__r.isEmpty() && allCompleted(acc.Onboarding_Tasks__r);
    if (acc.Account_Status__c == ACCOUNT_START_ONBOARDING && done)  -> Active + Onboarding_Completed_Date__c = now   (unchanged)
    if (acc.Account_Status__c == ACCOUNT_ACTIVE && !done && acc.Onboarding_Completed_Date__c != null)
                                                                  -> Start Onboarding + Onboarding_Completed_Date__c = null (new)
}
Database.update(changes, AccessLevel.SYSTEM_MODE);
```

**OnboardingTaskController.reopenTask(Id taskId):** `update as user new Onboarding_Task__c(Id = taskId, Status__c = OnboardingService.TASK_IN_PROGRESS)`.
It uses the same try/catch as `completeTask`: `AppLogger.error` + `save`, then `AuraHandledException` with the DML message.

**LWC `handleComplete(event)`:**

- `checked` → `completeTask`; not checked → `reopenTask`.
- Then `refreshApex` + `notifyRecordUpdateAvailable`, so Path and the Account status update.
- Toast: "Task completed" or "Task reopened". On failure, an error toast and the checkbox goes back to its previous state.
- `isDisabled = savingIds.has(t.Id)`. `checkboxLabel` reads "Mark … as completed" or "Mark … as in progress".

**Tests:** not written or run by Claude. Both classes already have test classes. Suggested cases for the developer:

- `OnboardingTaskControllerTest.reopenTaskSetsInProgress`: complete, then reopen; Status is In Progress and the stamps are null.
- `OnboardingServiceTest`: when every task is completed the Account is Active; after one task is reopened it's Start Onboarding and Onboarding Completed Date is null. Also a negative case: an Account that is Active with no completed date is not changed.
- Bulk: 200 Accounts with all tasks done, reopen one task each in a single update; all of them go back to Start Onboarding.
- Jest: unticking a completed task calls `reopenTask` and shows the "Task reopened" toast; a failure resets the checkbox to ticked.

## 4. Deployment Tracker

| #   | Step                          | Components / action                                                                                                   | Who       | Status  | Evidence                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Code review (one pass)        | code-reviewer subagent                                                                                                | Claude    | Done    | 0 Blockers. 1 Major fixed: an Active Account whose tasks were all deleted no longer reverts; before the fix it would recreate and re-email every task. Minors: the rule file now records that adding or undeleting an open task also reverts the Account. Existing tests: none expected to fail. The Jest suite has no explicit `reopenTask` mock, which the developer will need for new tests |
| 2   | Deploy to dev org (NoTestRun) | `ApexClass:OnboardingService`, `ApexClass:OnboardingTaskController`, `LightningComponentBundle:onboardingTaskTracker` | Claude    | Done    | Succeeded 3/3, job `0Afbm00000noL1rCAE`                                                                                                                                                                                                                                                                                                                                                        |
| 3   | Developer review + tests      | review, add the suggested tests, run them                                                                             | Developer | Pending |                                                                                                                                                                                                                                                                                                                                                                                                |
| 4   | Pull request                  | PR to `feature/KAN-3-onboarding-task-detail-link`                                                                     | Claude    | Done    | see Jira comment                                                                                                                                                                                                                                                                                                                                                                               |
| 5   | Verification                  | Verify buttons                                                                                                        | User      | Pending |                                                                                                                                                                                                                                                                                                                                                                                                |

Deviation: this branch was cut from KAN-3, which predates the new deploy script, so the deploy used `sf project deploy start --test-level NoTestRun` directly against esm-dev.

**Manual steps:** None. There are no permission or profile changes.

**Destructive changes:** None.

## Approval

- Plan approved by: Suman Nandy on 2026-11-12 (the Approve button)
