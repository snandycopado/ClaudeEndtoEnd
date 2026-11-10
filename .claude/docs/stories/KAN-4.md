# KAN-4: Completed task should not appear as struck-through text

|        |                                                                                                                                                |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Jira   | https://suman-nandy.atlassian.net/browse/KAN-4 (Story, To Do). The description is a screenshot only, which can't be read through the connector |
| Module | onboarding (LWC `onboardingTaskTracker`)                                                                                                       |
| Branch | feature/KAN-4-completed-task-no-strikethrough, stacked on `feature/KAN-3-onboarding-task-detail-link` (same CSS and markup)                    |
| Status | Verified and merged (2026-11-10). Jira: Done                                                                                                   |
| Author | Claude                                                                                                                                         |

## 1. Story Description

**Story (Jira summary):** "Completed tash should not appear as Stricted text". In the Onboarding Tasks card, a completed
task's name is shown with a line through it. It should be shown as normal text.

**Acceptance criteria** (derived, to confirm):

1. In the Onboarding Tasks card, a Completed task's name has no strike-through. This applies to the plain name and to the
   KAN-3 link.
2. A completed task is still clearly marked as completed: the green "Completed" badge, the ticked and disabled checkbox,
   and the "Completed by … on …" line all stay.
3. Not Started and In Progress tasks look exactly as before.
4. The task-name link from KAN-3 keeps working for completed tasks.

**Decisions** (approved 2026-11-10):

| #   | Question                                                                                      | Decision                                                                                                 |
| --- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| D1  | Should a completed task's name stay greyed (muted colour) once the strike-through is removed? | **No.** It shows in the normal link colour. The badge, checkbox and "Completed by" line show the status. |
| D2  | Is this only the Onboarding Tasks card?                                                       | **Yes.** It is the only place task names were struck through.                                            |

## 2. High Level Design

A styling-only change to the `onboardingTaskTracker` LWC. Remove the strike-through, and with D1 the muted colour, from
completed task names. Completion stays visible through the existing badge, checkbox and completion line, so no new UI is
needed.

- **Components:** LWC CSS and one getter in the JS. No Apex, metadata or configuration.
- **Modules affected:** onboarding only.
- **Data model:** None.
- **Security:** None. No permission set change.
- **Risks:** Low. Visual only. If KAN-3 changes before it merges, rebase this branch.

## 3. Low Level Design

| Component             | Type                           | File                                                                       | New / Modified | Change                                                                                    |
| --------------------- | ------------------------------ | -------------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------- |
| onboardingTaskTracker | LightningComponentBundle (CSS) | force-app/main/default/lwc/onboardingTaskTracker/onboardingTaskTracker.css | Modified       | Remove the `.task-done` and `.task-done .task-link` rules (line-through and muted colour) |
| onboardingTaskTracker | LightningComponentBundle (JS)  | …/onboardingTaskTracker/onboardingTaskTracker.js                           | Modified       | `rows` → `nameClass` is always `slds-text-heading_small`, with no `task-done` class       |
| Module rule           | Doc                            | .claude/rules/modules/onboarding.md                                        | Modified       | Note that completed tasks are not struck through and their status is shown by the badge   |

No HTML change: the name `<p class={row.nameClass}>` and its link stay as they are.

**Tests:** not written or run by Claude. Suggested cases for the developer:

- Jest: a Completed row's name `<p>` has no `task-done` class.
- Jest: the Completed badge, the disabled checkbox and the "Completed by" line still render for a completed task.
- Manual: on an Account with a completed task, the name is normal text, the badge is green and the link opens the task.

## 4. Deployment Tracker

| #   | Step                     | Components / action                                               | Who         | Status  | Evidence                                                                                                                          |
| --- | ------------------------ | ----------------------------------------------------------------- | ----------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Code review (one pass)   | code-reviewer subagent                                            | Claude      | Done    | 0 Blockers, 0 Majors. Minor: `nameClass` is now a constant (left as it is). The existing Jest suite doesn't reference `task-done` |
| 2   | Deploy to dev org        | `LightningComponentBundle:onboardingTaskTracker` (NoTestRun)      | Claude      | Done    | Succeeded 1/1, job `0Afbm00000nUrM2CAK`                                                                                           |
| 3   | Developer review + tests | review the CSS and JS change, run Jest, check the card in esm-dev | Developer   | Pending |                                                                                                                                   |
| 4   | Pull request             | PR #4 to `feature/KAN-3-onboarding-task-detail-link`              | Claude      | Merged  | merged 2026-11-10                                                                                                                 |
| 5   | Verification             | "Feature working fine" in esm-dev                                 | Suman Nandy | Done    | 2026-11-10; Jira KAN-4 → Done                                                                                                     |

Deviation: this branch was cut from KAN-3, before the new deploy script, so the deploy ran `sf project deploy start`
directly with `--test-level NoTestRun` to esm-dev (the same guard hook applies) instead of `deploy.mjs`.

**Manual steps:** None.

**Destructive changes:** None. Only CSS rules inside the component are removed; no metadata is deleted.

## Approval

- Plan approved by: Suman Nandy on 2026-11-10 ("yes", with the recommendations for D1 and D2)
