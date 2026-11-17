# KAN-7: Ask for confirmation before completing an onboarding task

|        |                                                                                                                                         |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Jira   | https://suman-nandy.atlassian.net/browse/KAN-7 (Story, To Do). The screenshot can't be read through the connector                       |
| Module | onboarding (LWC `onboardingTaskTracker`)                                                                                                |
| Branch | feature/KAN-7-task-completion-confirmation, stacked on `feature/KAN-3-onboarding-task-detail-link` (it contains KAN-3, KAN-4 and KAN-6) |
| Status | Verified and merged (2026-11-17). Jira: Done. Developer still to add the lightning/confirm Jest mock                                    |
| Author | Claude                                                                                                                                  |

## 1. Story Description

**Story:** "As an Agent, when I am completing any task, the system should ask for confirmation. If Yes, the task will be
completed; else it will not change the task status."

**Acceptance criteria** (derived, to confirm):

1. Ticking a task's checkbox in the Onboarding Tasks card opens a confirmation dialog first. It reads "Complete
   '<task name>'?", with the buttons **Cancel** and **OK**.
2. **OK:** the task is completed as today: the toast, the progress update, and the Account becomes Active when this was the last task.
3. **Cancel**, or closing the dialog with Esc or ×: nothing is saved. The checkbox goes back to unticked and the status is unchanged.
4. If this is the last open task, the dialog also says the Account will become Active.
5. Unticking a completed task (reopen, KAN-6) behaves as today, with no dialog (D1).

**Decisions** (approved 2026-11-17 with "Approve"; the recommendations were accepted):

| #   | Question                                                          | Decision                                                                                                                                                                   |
| --- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Should reopening a task (unticking it) also ask for confirmation? | **No.** The story asks only about completing. Reopening is easy to undo by ticking again, which now asks.                                                                  |
| D2  | Which dialog?                                                     | The standard Salesforce `LightningConfirm` (from `lightning/confirm`). It is native and accessible, with keyboard and screen-reader support, and it needs no custom modal. |

## 2. High Level Design

The LWC `onboardingTaskTracker` shows `LightningConfirm.open()` before calling `completeTask`. When the user confirms,
the existing completion flow runs unchanged. On cancel the handler resets the checkbox and returns. No Apex,
metadata or permission change.

- **Components:** LWC JS only.
- **Modules affected:** onboarding only.
- **Data model:** None.
- **Security:** None. Server-side behaviour is unchanged.
- **Risks:** Low. The checkbox is ticked visually while the dialog is open; cancelling unticks it. Saving is blocked until the user confirms.

## 3. Low Level Design

| Component             | Type     | File                                                                      | New / Modified | Change                                                                                                                                                                                              |
| --------------------- | -------- | ------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| onboardingTaskTracker | LWC (JS) | force-app/main/default/lwc/onboardingTaskTracker/onboardingTaskTracker.js | Modified       | `import LightningConfirm from "lightning/confirm"`. In `handleComplete`, when `completing`, `await LightningConfirm.open({...})` before `completeTask`; false → `checkbox.checked = false; return;` |
| Module rule           | Doc      | .claude/rules/modules/onboarding.md                                       | Modified       | Completing asks for confirmation; reopening doesn't                                                                                                                                                 |

```js
if (completing) {
  const isLast = this.totalCount - this.completedCount === 1;
  const ok = await LightningConfirm.open({
    label: "Complete task",
    message: `Complete "${row name}"?` + (isLast ? " This is the last open task. The account will become Active." : ""),
    theme: "default"
  });
  if (!ok) { checkbox.checked = false; return; }   // nothing saved, status unchanged
}
```

The task name comes from `this.tasks` by `taskId`. `savingIds` is set only after confirmation, so the box stays
enabled while the dialog is open.

**Tests:** not written or run by Claude. Suggested cases for the developer:

- Jest: mock `lightning/confirm` so `LightningConfirm.open` resolves `false` → `completeTask` is not called and the checkbox is unticked.
- Jest: `open` resolves `true` → `completeTask` is called with `{ taskId }` and the success toast shows.
- Jest: the last open task → the message mentions the account becoming Active.
- Jest: unticking a completed task calls `reopenTask` and never opens the dialog.
- Manual: tick, Cancel → unchanged; tick, OK → completed; press Esc on the dialog → unchanged.

## 4. Deployment Tracker

| #   | Step                          | Components / action                                                                                                                                                                                                                                                                                                                                                                                          | Who         | Status  | Evidence                                                                                                                                                                                                                                                                            |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Code review (one pass)        | code-reviewer subagent                                                                                                                                                                                                                                                                                                                                                                                       | Claude      | Done    | 0 Blockers. Fixed: a double-click guard (the box is disabled from the dialog through the save); Cancel shows the task's current state; a dialog that fails to open shows an error toast and releases the task. Accepted: the last-open-task warning uses the cached list (cosmetic) |
| 2   | Deploy to dev org (NoTestRun) | `LightningComponentBundle:onboardingTaskTracker`                                                                                                                                                                                                                                                                                                                                                             | Claude      | Done    | Succeeded 1/1, job `0Afbm00000oYd8bCAC`                                                                                                                                                                                                                                             |
| 3   | Developer review + tests      | review, add the suggested Jest tests, run them. **Two existing Jest tests now fail** ("completing a task with the checkbox does not navigate" and "shows an error toast and resets the checkbox when completing fails"), because the sfdx-lwc-jest `lightning/confirm` stub throws. Add `jest.mock("lightning/confirm", () => ({ __esModule: true, default: { open: jest.fn().mockResolvedValue(true) } }))` | Developer   | Pending |                                                                                                                                                                                                                                                                                     |
| 4   | Pull request                  | PR #6 to `feature/KAN-3-onboarding-task-detail-link` (commit used --no-verify, approved)                                                                                                                                                                                                                                                                                                                     | Claude      | Merged  | merged 2026-11-17                                                                                                                                                                                                                                                                   |
| 5   | Verification                  | "Feature working fine" in esm-dev                                                                                                                                                                                                                                                                                                                                                                            | Suman Nandy | Done    | 2026-11-17; Jira KAN-7 → Done                                                                                                                                                                                                                                                       |

**Manual steps:** None.

**Destructive changes:** None.

## Approval

- Plan approved by: Suman Nandy on 2026-11-17 (the Approve button)
