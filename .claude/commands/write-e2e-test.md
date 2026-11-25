---
description: Write Playwright E2E UI test scenarios for a Jira story (or a described feature) - plan the TC-nn scenarios, approve with buttons, then write the spec and page objects.
argument-hint: [story key, Jira link, or feature description, e.g. KAN-12]
disable-model-invocation: true
---

# Write E2E automation tests

Input: `$ARGUMENTS`

Follow the **e2e-test** skill (`.claude/skills/e2e-test/SKILL.md`) and `.claude/rules/e2e.md`. This command writes
tests only. It does not change force-app metadata or deploy. To run the tests, use `/run-e2e-test`.

## 1. Get the requirement

- Empty input → ask: "Which story or feature? Give the Jira key/link or describe the behaviour." and wait.
- Jira key or link (`[A-Z][A-Z0-9]+-\d+`) → read it with the Atlassian MCP `getJiraIssue` (`view: "evidence"`,
  site `suman-nandy.atlassian.net` unless the link names another). Use the acceptance criteria.
- Read the story design document in Confluence (**confluence-design** skill; the link is in `.claude/docs/stories/<KEY>.md`):
  design, component names, existing E2E scenarios.
- Plain text → use it as the requirement.
- Identify the module (file prefix → `.claude/rules/modules/*.md`) and read that rule file.

## 2. Find what exists

- Read `.claude/e2e/README.md` and list the existing scenarios. Next free ID = highest `TC-nn` + 1.
- Reuse what exists: `lib/salesforce.js` (tabs, New, record type, fields, Path, toasts), `lib/org.js` (`soql()`),
  `lib/test-data.js` (`uniqueName()`), page objects in `pages/`.
- Read the components under test (LWC html/js, layouts, flexipage, Path, picklist values) to get real labels and
  selectors. The org state is the deployed code, not necessarily the current branch: check the story's branch if needed.

## 3. Propose the scenarios - STOP for approval

Show a table using `.claude/skills/e2e-test/scenario-template.md`: one or more `TC-nn` per acceptance criterion, with
user steps, the UI check, the SOQL check, and the AC. Also say which spec file and page object you will create or
change, and what test data the run creates (`E2E-…`).

Ask with buttons (AskUserQuestion), saying why: question "Write these E2E scenarios? I am asking because they become
part of the suite and run against esm-dev, creating E2E-… test records." · header "E2E plan" ·
options **"Approve"** ("Write the specs as listed") and **"Need improvement"** ("Tell me what to change").
Need improvement → ask what to change if no text came with it, revise, and ask again.

## 4. Write (after approval, no further questions)

- Spec: `.claude/e2e/specs/<module>/<feature>.e2e.js`, CommonJS, titles `TC-nn <behaviour> (<KEY>)`.
  Dependent steps → `test.describe.configure({ mode: "serial" })` with one record shared through the describe.
- Page object: `.claude/e2e/pages/<module>-<component>.js` for component-specific locators. Put generic Lightning
  steps in `lib/salesforce.js`, not in a spec.
- Every scenario checks the UI **and** the data with read-only `soql()`. Data is created through the UI with `uniqueName()`.
- Locators: roles, labels, the component's own classes; `:visible`; no `waitForTimeout`; no hard-coded Ids, URLs,
  usernames or org details.
- Check that it loads: `npx playwright test -c .claude/e2e/playwright.config.js --list` (this lists the tests, it does
  not run them). Fix syntax and import errors.
- Format: `npx prettier --write` on the changed files.

## 5. Record

- Add the scenarios to the Scenarios table in `.claude/e2e/README.md` and the file tree if new files were added.
- Story design page exists → add or update the **E2E scenarios** table in its Low Level Design, on the Confluence page.
- Finish with: the scenarios written (ID + title), the files created or changed, and
  "Run them with `/run-e2e-test <KEY or TC ids>`".
