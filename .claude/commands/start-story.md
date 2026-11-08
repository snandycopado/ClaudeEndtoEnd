---
description: Start (or resume) a user story from Jira - read it, plan it, stop for approval, then build to PR.
argument-hint: [story key or Jira link, e.g. KAN-12]
disable-model-invocation: true
---
# Start a user story

Input: `$ARGUMENTS`

## 1. Get the story key
- If the input is empty, ask: "Which story? Give the key (e.g. KAN-12) or the Jira link." and wait.
- Extract the key (`[A-Z][A-Z0-9]+-\d+`) from a key or any Jira link (`/browse/KAN-12`,
  `?selectedIssue=KAN-12`). Upper-case it.
- Jira site: the host of the link if one was given, otherwise `suman-nandy.atlassian.net`.

## 2. Read it from Jira (Atlassian MCP)
- `getJiraIssue` with `cloudId` = the site, `view: "evidence"`. If it has comments, read them with
  `listJiraIssueComments`. Follow linked issues only if the description depends on them.
- If the Atlassian tools are unavailable or need authentication: tell the user to run `/mcp` →
  atlassian → Authenticate, or to paste the story text. Do not continue without the story.

## 3. Readiness check - STOP if not ready
- STOP and say what is missing if the description or acceptance criteria are empty or still template
  text (`…`, `As a … I want …`).
- Warn (do not stop) if the issue type is not Story, or the status is Done / Closed.
- Show a short summary: key, summary, type, status, acceptance criteria as a numbered list.

## 4. Existing work
- If `.claude/docs/stories/<KEY>.md` exists, read it, report how far it got (plan approved? branch?
  deployed? PR?) and ask: "Resume from <step> or re-plan?" Wait for the answer.
- `git status` and the current branch: warn about uncommitted changes. Do not create a branch yet.

## 5. Plan - STOP for approval
- Run the **story-to-plan** skill with the story text from Jira. It writes
  `.claude/docs/stories/<KEY>.md` and ends with "Approve this plan?". Wait for explicit approval.

## 6. Build (after approval only)
Follow "How you work" steps 2-7 in `.claude/CLAUDE.md`:
1. Branch `feature/<KEY>-<short-kebab-name>` from `develop` (from `main` until `develop` exists).
2. Build; tests via the **apex-test** skill / `apex-test-writer` agent (90%+, bulk 200, negative, permission).
3. **sf-code-review** skill - fix every Blocker.
4. **sf-deploy** skill - dry run, then deploy the story's components only.
5. Smoke test; record evidence in the plan; update the module rule file.
6. **pr-description** skill. Ask before `git push` and before opening the PR.

## 7. Jira updates - only with permission
Never write to Jira without asking. Offer at these points:
- After plan approval: "Move <KEY> to In Progress and comment with the plan and branch name?"
- After the PR is open: "Comment the PR link on <KEY>?"
