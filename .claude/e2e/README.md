# End-to-end UI tests (Playwright)

Claude (or a developer) opens the Salesforce developer org in Chromium, navigates to the tab, creates records
like a user, and verifies each feature in the UI **and** in the data (SOQL).

```
.claude/e2e/
├── playwright.config.js      one worker, serial journeys, screenshots on, trace/video on failure
├── global-setup.js           logs in via `sf org open --url-only` (alias from .claude/allowed-orgs)
├── lib/
│   ├── paths.js              fixed locations
│   ├── org.js                target alias guard, front-door URL, read-only soql()
│   ├── salesforce.js         Lightning helpers: openTab, clickNew, record type, fillField, save, Path, toast
│   └── test-data.js          uniqueName() (prefix E2E-), record types, expected tasks per country
├── pages/
│   └── onboarding-tracker.js page object for the onboardingTaskTracker LWC
├── specs/
│   └── onboarding/
│       ├── onboarding-journey.e2e.js    TC-01 … TC-08, TC-10 (serial, one Australia account)
│       ├── country-record-types.e2e.js  TC-09
│       └── boarding-automation-app.e2e.js TC-11 … TC-13 (KAN-8)
├── .auth/                     session state (git-ignored — live session)
└── results/                   report/, artifacts/, results.json (git-ignored)
```

## Prerequisites

- `npm install` and once `npx playwright install chromium`.
- The sf CLI is logged in to the alias in `.claude/allowed-orgs` (`sf org display --target-org <alias>`).
- The running user has the `Onboarding_Manager` permission set and the Account record page with the tracker.

## Commands

- `/write-e2e-test <KEY | feature>`: plan the TC-nn scenarios (Approve / Need improvement), then write the spec and page objects.
- `/run-e2e-test [all | module | KEY | TC ids] [watch | ui]`: run them, then report and triage the results.

## Run

`npm run test:e2e` · `npm run test:e2e:headed` (watch) · `npm run test:e2e -- -g "TC-06"` · `npm run test:e2e:report`

## Scenarios

| ID    | Scenario                                                                            | Verifies                                                                                                            |
| ----- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| TC-01 | Accounts tab → New → **Australia** → name → Save                                    | Record page opens; tracker empty state; Status New, record type Australia                                           |
| TC-02 | Path → **Start Onboarding** → Mark as Current                                       | 4 tasks in order (KYC, Contract, Billing, Welcome Call); 0 of 4; template keys for Australia (KAN-2)                |
| TC-03 | Tick a task → **Cancel**                                                            | Dialog "Complete "…"?"; nothing saved (KAN-7)                                                                       |
| TC-04 | Tick a task → **OK**                                                                | Badge Completed, "Completed by", 1 of 4, name not struck through (KAN-7, KAN-4)                                     |
| TC-05 | Untick the completed task                                                           | No dialog; In Progress; 0 of 4 (KAN-6)                                                                              |
| TC-06 | Complete all tasks                                                                  | Last-task warning; overall Completed; Account **Active**, completed date set                                        |
| TC-07 | Untick one task on the Active account                                               | Account back to **Start Onboarding**, completed date cleared (KAN-6)                                                |
| TC-08 | Click a task name                                                                   | Onboarding Task record page; no Edit / Delete / Clone (KAN-3)                                                       |
| TC-10 | Read the "Completed by … on …" line                                                 | Words separated by spaces as the user sees them (currently **fails**: renders "Completedby … on…")                  |
| TC-11 | App Launcher → **Boarding Automation**                                              | Nav bar: Home, Accounts, Contacts, Reports, Dashboards, Products in order; AppDefinition Standard/Lightning (KAN-8) |
| TC-12 | In the app: Accounts → New → Australia → Save                                       | Record page in the app with Path and tracker; record type Australia, Status New (KAN-8)                             |
| TC-13 | In the app: Products                                                                | Products list opens (KAN-8)                                                                                         |
| TC-09 | New Account record type list; create **United States** account and start onboarding | Country record types offered, Customer not; US template keys (KAN-2)                                                |

## Test data

Each run creates two Accounts named `E2E-AU-<timestamp>` and `E2E-US-<timestamp>` with their tasks. The suite
never deletes data; cleanup is a destructive change and is done only with the user's approval.
