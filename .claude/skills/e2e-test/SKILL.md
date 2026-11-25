---
name: e2e-test
description: Run or extend the Playwright end-to-end UI tests that open the developer org in a browser, navigate to the right tab, create records and verify a feature works (UI + SOQL). Use after a story is deployed, when the user asks to test a feature in the org, or to add E2E scenarios for a story.
---

# End-to-end UI tests (Playwright)

The suite lives in `.claude/e2e/` (see its README). It logs in through the sf CLI front door to the alias in
`.claude/allowed-orgs` only — no password, nothing stored in the repo.

Slash commands: `/write-e2e-test` (write scenarios) and `/run-e2e-test` (execute and triage).

## Run

```
npm run test:e2e                                   # whole suite, headless
npm run test:e2e -- specs/onboarding               # one module
npm run test:e2e -- -g "TC-04"                     # one scenario
npm run test:e2e:headed                            # watch the browser (demo / debugging)
npm run test:e2e:report                            # open the HTML report (screenshots, traces)
```

- One worker, no retries; journeys are serial, so a failure skips the steps after it.
- Results: `.claude/e2e/results/results.json` (read this, not the console), HTML report in `results/report/`.
  Both are git-ignored: traces contain a live session. Never commit, attach or upload them.

## After a story deploy (workflow step 5b)

1. Run the specs of the story's module. Use the **e2e-tester** subagent to keep long output out of the main context.
2. Record the result in the plan's Deployment Tracker: `E2E | <n> passed / <n> failed | results.json summary`.
3. A failure caused by the story: fix, redeploy, re-run. A failure from a selector, timing or org data: fix
   the spec or page object. An unrelated pre-existing failure: record it, do not block the PR.
4. List the E2E result in the PR's "Deployment and review" table.

## Add scenarios for a story

1. One scenario per acceptance criterion, ID `TC-<nn>`, title `TC-<nn> <behaviour> (<KEY>)`.
   List them in the plan's Low Level Design first (template: `scenario-template.md`).
2. Put module UI in a page object under `.claude/e2e/pages/<module>-*.js`; generic Lightning steps
   (tabs, New, record type, Path, toasts) are in `lib/salesforce.js` — reuse, don't duplicate.
3. Every scenario verifies **both** the UI and the data (`soql()` from `lib/org.js`, read-only).
4. Create data through the UI with `uniqueName(tag)` (prefix `E2E-`). Never hard-code record Ids.
5. Selectors: roles/labels and the component's own classes; scope to `:visible` (Lightning keeps earlier pages
   in the DOM). No fixed waits (`waitForTimeout`) — use `expect(...)` auto-waiting.

## Never

- Run against any org but the alias in `.claude/allowed-orgs`.
- Delete records. E2E data stays (prefix `E2E-`). Cleanup is a destructive data change: list the records
  (`sf data query -q "SELECT Id, Name FROM Account WHERE Name LIKE 'E2E-%'"`) and ask the user first.
- Print, log or store the front-door URL or session; never commit `.claude/e2e/.auth/` or `results/`.
- Change user permissions, profiles or org settings to make a test pass — report it instead.
