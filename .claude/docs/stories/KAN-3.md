# KAN-3: Onboarding Task Detail

|        |                                                                                                                                                      |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Module | onboarding (LWC `onboardingTaskTracker`). No shared Account metadata and no framework changes.                                                       |
| Branch | feature/KAN-3-onboarding-task-detail-link, stacked on `feature/KAN-2-account-country-record-types` (PR #2). Rebase onto `main` once #1 and #2 merge. |
| Status | Built and deployed to esm-dev (2026-11-10). PR open for review                                                                                       |
| Author | Claude (story-analyst)                                                                                                                               |
| Source | https://suman-nandy.atlassian.net/browse/KAN-3 (Story, To Do). The attached screenshot could not be read through the connector.                      |

## Story

As an onboarding user working an Account, I want to click a task in the Onboarding Tasks list so that the task's detail
page opens. Jira: "Onboarding task list are not clickable. User should able to click on each onboarding task and it
should open the onboarding task detail."

The list is the `onboardingTaskTracker` card on `Account_Record_Page`. It is the only UI that lists Onboarding Tasks:
no Account layout has an Onboarding Tasks related list in use there.

## Acceptance criteria (derived, to be confirmed)

1. In the Onboarding Tasks card, each task name is a link. This applies to every status and to every Account record type that shows the card.
2. A normal click opens that Onboarding Task's record page in view mode, in the same tab (a subtab in a console app).
3. The link has a real record URL. Ctrl/Cmd-click, middle-click and "Open link in new tab" open the task in a new browser tab.
4. The link is keyboard accessible: it can be reached with Tab and opened with Enter, and its accessible name contains the task name.
5. Ticking the completion checkbox does not navigate. Completion works as today: a toast, a progress refresh, and Account Active when the last task is done.
6. The detail page shows Task Name, Account, Status, Order, Description, Completed Date and Completed By (decision Q1).
7. A Standard User with `Onboarding_Manager` can open the detail of every task shown in the card. Access is controlled by the parent Account.
8. The card's loading, empty and error states are unchanged.

## Impact

| Change                                                                                | Type                     | Folder / file                                                                  | New or modified                              |
| ------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------ | -------------------------------------------- |
| Task name rendered as `<a href>` with a click handler                                 | LightningComponentBundle | force-app/main/default/lwc/onboardingTaskTracker/onboardingTaskTracker.html    | Modified                                     |
| `NavigationMixin`, URLs from `GenerateUrl`, `handleOpenTask`                          | LightningComponentBundle | …/onboardingTaskTracker/onboardingTaskTracker.js                               | Modified                                     |
| Keep the completed strike-through on the link (only if needed)                        | LightningComponentBundle | …/onboardingTaskTracker/onboardingTaskTracker.css                              | Modified                                     |
| Description: "click a task to open it"                                                | LightningComponentBundle | …/onboardingTaskTracker/onboardingTaskTracker.js-meta.xml                      | Modified                                     |
| Jest tests (the component has none today)                                             | Jest                     | …/onboardingTaskTracker/**tests**/onboardingTaskTracker.test.js                | New                                          |
| Contract/permission test: `getTasks` returns Id + Name for an Onboarding_Manager user | ApexClass (test)         | force-app/main/default/classes/OnboardingTaskControllerTest.cls                | Modified                                     |
| Onboarding Task page layout with the task fields (Q1)                                 | Layout                   | force-app/main/default/layouts/Onboarding_Task__c-<org layout>.layout-meta.xml | Retrieved from the org, then edited in place |
| Entry-point line for the link                                                         | Rule doc                 | .claude/rules/modules/onboarding.md                                            | Modified                                     |

- **Frameworks used:** none. `completeTask` keeps its AppLogger handling.
- **Apex:** no production change. `OnboardingTaskController.getTasks` already returns `Id` and `Name` (`WITH USER_MODE`).
- **Permission sets updated:** none needed. `Onboarding_Manager` already grants read/edit on `Onboarding_Task__c` and all its fields, plus `OnboardingTaskController`. There is no tab, and record-page navigation doesn't need one.
- **Other modules affected:** none.
- **Layout / record page / Path changes:** `Account_Record_Page` is unchanged. Onboarding_Task__c has no FlexiPage, so the default Lightning record page is used. Layout: see Q1.

## Design

An accessible anchor with `NavigationMixin`, the standard LWC navigation pattern.

- `OnboardingTaskTracker extends NavigationMixin(LightningElement)`.
- When `getTasks` data arrives, build one `standard__recordPage` pageReference per task
  (`objectApiName: 'Onboarding_Task__c'`, `actionName: 'view'`). Resolve them with `GenerateUrl` into a replaced `taskUrls` map, kept reactive. No hard-coded URLs.
- Template: `<a href={row.url} data-id={row.id} onclick={handleOpenTask}>{row.name}</a>`. The checkbox stays a separate sibling, so it never triggers navigation.
- `handleOpenTask`: on Ctrl, Meta, Shift or a non-primary button, let the browser handle the href (new tab). Otherwise `preventDefault()` and `Navigate`.
- If `GenerateUrl` fails, the click still uses `Navigate`, and the error is shown as a toast, not swallowed.
- Rejected alternatives:
  - a datatable URL column: it would mean rewriting the custom list;
  - a modal with `lightning-record-form`: it gives no shareable URL or new tab, and duplicates the record page.

## Test plan

Jest (`npm install`, then `npm run test:unit`; `@salesforce/sfdx-lwc-jest` is already configured). `getTasks` is a mocked wire adapter,
`completeTask` is mocked, and `lightning/navigation` `Navigate` and `GenerateUrl` are `jest.fn()`.

| Acceptance criterion | Test                                                                                                                                    | Kind             |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 1                    | renders a link for every task, including Completed                                                                                      | happy            |
| 2                    | plain click navigates to `standard__recordPage` / `Onboarding_Task__c` / `view` with the right recordId                                 | happy            |
| 3                    | href comes from GenerateUrl; ctrl/meta-click does not call Navigate                                                                     | happy / negative |
| 3                    | GenerateUrl failure: the click still navigates                                                                                          | negative         |
| 4                    | link is an `<a>` with an href and the task name; no `tabindex="-1"`                                                                     | happy            |
| 5                    | ticking the checkbox calls completeTask and does not navigate                                                                           | negative         |
| 5                    | completeTask failure shows an error toast and resets the checkbox                                                                       | negative         |
| 7                    | OnboardingTaskControllerTest.getTasksReturnsIdAndNameForOnboardingManager (runAs Standard User + Onboarding_Manager, Australia Account) | permission       |
| 8                    | empty state, error state (`role=alert`), spinner before data                                                                            | happy / negative |
| 2, 3, 5, 6           | Manual smoke in esm-dev as an Onboarding_Manager user: click, Ctrl-click, Enter key, checkbox, detail fields                            | manual           |

Bulk (200): not applicable, because no trigger or DML path changes. The existing tests stay green.

## Deployment

- Components: `LightningComponentBundle:onboardingTaskTracker`, `ApexClass:OnboardingTaskControllerTest`, and `Layout:Onboarding_Task__c-<org layout>` if Q1 is approved.
- Configuration after deploy: none. Users already have `Onboarding_Manager`. The layout is edited in place, so no profile assignment is needed.
- Removals for an architect: none.

## Risks and open questions

- **Q1 Detail page layout.** No Onboarding Task layout is in source. The org's default layout may show only Name, Account and system fields.
  Proposal: retrieve the existing layout and edit it in place to show Status, Order, Description, Completed Date and Completed By, with Template Key read-only. Don't create a new layout, because its assignment would need a profile change.
- **Q2 Edit and Delete become reachable.** `Onboarding_Manager` has edit and delete on Onboarding_Task__c. On the standard record page,
  users could delete a task (which changes the roll-ups) or set a completed task back. Today the card only allows "complete".
  Options: accept; remove Delete and Edit from the layout's buttons (no permission change); or tighten the permission set (architect).
- **Q3 Stale card after editing on the detail page.** Back on the Account, the card may show cached data until a refresh.
  Option: refresh the task list each time the card is shown again (small addition).
- **Q4 Same tab or new tab** on a normal click. Planned: same tab (console subtab), new tab on Ctrl-click.
- **Base branch.** Stacked on KAN-2, because the permission test uses the Australia record type. The KAN-3 PR targets the KAN-2 branch until PR #2 merges.

## Approval

- Plan approved by: Suman Nandy on 2026-11-10 ("resume", with the recommendations for Q1–Q4)
- Sandbox verification by: … on … (manual UI checks below are still to be done by a person)

## Decisions (2026-11-10)

| #   | Decision                                                                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | The existing org layout `Onboarding_Task__c-Onboarding Task Layout` was retrieved into source and edited in place. It shows Name, Account, Order, Status, Completed Date, Completed By, Description, Template Key and Email Template Name. Every task field is read-only. |
| Q2  | Edit, Delete and Clone are excluded from the layout. The permission set is unchanged.                                                                                                                                                                                     |
| Q3  | The task list reloads when the Account status or the task roll-ups change.                                                                                                                                                                                                |
| Q4  | A normal click opens the task in the same tab (a subtab in a console app). Ctrl, Cmd, Shift or middle-click opens a new tab.                                                                                                                                              |

## Evidence (esm-dev, 2026-11-10)

- Jest: `onboardingTaskTracker.test.js` passes 13/13. It covers the links, the GenerateUrl href, plain click → Navigate, modifier click → browser,
  a GenerateUrl failure (`#` placeholder, warning toast once), the out-of-order URL race, reload on a roll-up change, the checkbox not navigating,
  the completeTask error toast, and the empty / error / spinner states. ESLint is clean.
- Apex: new `OnboardingTaskControllerTest.getTasksReturnsIdAndNameForOnboardingManager`. OnboardingTaskControllerTest passes 4/4.
  `OnboardingTaskController` coverage is 100%.
- Code review: 0 Blockers. The 3 Majors were fixed:
  - The refresh now uses getRecord roll-ups. The first approach, `connectedCallback`, didn't work with Lightning's page cache.
  - The UI-only limitation is documented below and in onboarding.md.
  - onboarding.md is updated.
    Minors fixed: the refresh promise is caught, the URL race is guarded, the link is focusable before its URL resolves, and the warning shows once.
    Code Analyzer: ESLint, regex and retire-js found 0 violations. PMD didn't run because Java isn't installed locally, so CI runs it.
- Deploy: dry run Succeeded `0Afbm00000nVDG6CAO`, deploy Succeeded `0Afbm00000nVAZyCAO`. 3/3 components, RunLocalTests 51/51 passed.
- Smoke test (read-only):
  - the component description is updated in the org;
  - the layout retrieved back from the org has Edit, Delete and Clone excluded and the 11 fields above;
  - two demo Accounts have 4 tasks each, which a person can use for the UI check.
- **Still to check by hand** (as an Onboarding_Manager user on an Account with tasks):
  - click a task name → its record opens;
  - Ctrl-click → a new tab;
  - Tab, then Enter → the record opens;
  - ticking a checkbox doesn't navigate;
  - the task page has no Edit, Delete or Clone, and no pencil icons;
  - edit a task elsewhere, go back to the Account → the card has refreshed.

## Known limitation (architect follow-up)

Read-only fields and the removed buttons control **only the record page**. `Onboarding_Manager` still grants edit and delete on
Onboarding_Task__c, and edit on Status, Order and Description, which `completeTask` needs because it uses `update as user`. So list-view inline edit, the API,
Data Loader and Flows can still reopen a completed task or delete one. Options for an architect:

- a validation rule that blocks Completed → any other status;
- `allowDelete=false`, which also changes the `completeTaskFailureIsLoggedAndSurfaced` test setup.
