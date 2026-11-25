---
description: Run the Playwright E2E UI tests against the developer org - all, a module, a story or chosen TC ids - headless or in a visible browser, then report and triage the results.
argument-hint: [all | module | story key | TC ids, e.g. TC-04 TC-06] [watch | ui]
disable-model-invocation: true
---

# Run E2E automation tests

Input: `$ARGUMENTS`

Follow the **e2e-test** skill (`.claude/skills/e2e-test/SKILL.md`). Runs only against the alias in `.claude/allowed-orgs`.

## 1. Work out the scope and mode

| Input contains                  | Scope (Playwright arguments)           |
| ------------------------------- | -------------------------------------- |
| nothing or `all`                | the whole suite                        |
| a module name (e.g. onboarding) | `specs/<module>`                       |
| a story key (e.g. KAN-7)        | `-g "<KEY>"` (titles end in `(<KEY>)`) |
| TC ids (e.g. TC-04 TC-06)       | `-g "TC-04\|TC-06"`                    |

Mode:

- `watch` → visible browser in slow motion: `npm run test:e2e:watch -- <scope>` (set `E2E_SLOWMO` in ms to change speed).
- `ui` → interactive Playwright window: `npm run test:e2e:ui`. Start it in the background, tell the user to pick the
  tests and press ▶, and stop here: the user drives it.
- otherwise → headless: `npx playwright test -c .claude/e2e/playwright.config.js <scope>`.

Serial journeys: running one TC from the middle of a journey (e.g. TC-05) fails, because it needs the record that the
earlier steps create. For a TC inside a serial describe, run the whole describe (its spec file) and say so.

## 2. Pre-flight (no questions)

- Alias = first line of `.claude/allowed-orgs`. Check the CLI session: `sf org display --target-org <alias> --json`
  (run sf from PowerShell). Expired → stop and ask the user to log in again (`sf org login web --alias <alias>`); Claude
  never logs in itself.
- Missing `node_modules/@playwright/test` → `npm install`. Missing browser → `npx playwright install chromium`.

## 3. Run

- Run in the background (a full run takes about 3 minutes, 5 in watch mode) and wait for the notification.
- Never print the login URL or session.

## 4. Report and triage

- Read `.claude/e2e/results/results.json`. Use the **e2e-tester** subagent for triage when anything failed or the
  run is large.
- Classify each failure: **story bug** (the feature is wrong: give the evidence, never weaken the test),
  **spec bug** (selector, timing, wrong expectation: fix it in `.claude/e2e/` and re-run that scope once), or
  **org/data** (permissions, layout, session: report it, never change the org).
- Look at the screenshot of each failure (`.claude/e2e/results/artifacts/<test>/test-failed-1.png`).

Report:

```
E2E <scope>: <passed>/<total> passed (<duration>)
| TC | Scenario | Result | Cause (failures only) |
```

Then:

- the records created (names starting with `E2E-`, from `sf data query`). They are not deleted; cleanup needs the
  user's approval;
- "Report: `npm run test:e2e:report` · watch: `/run-e2e-test <scope> watch`";
- story design page exists for the scope → update, on the Confluence page, its Deployment Tracker row "E2E UI tests" with passed/failed and the date.
