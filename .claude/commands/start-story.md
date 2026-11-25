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

- Look for the design document in Confluence (**confluence-design** skill, "Find") and the link file
  `.claude/docs/stories/<KEY>.md`. If either exists, read the Confluence page (the master copy), report how far it got
  (plan approved? branch? deployed? PR?) and ask: "Resume from <step> or re-plan?" Wait for the answer.
- `git status` and the current branch: warn about uncommitted changes. Do not create a branch yet.

## 5. Plan - STOP for approval

- Run the **story-to-plan** skill with the story text from Jira. It creates the design document in Confluence (folder _User Story
  Design Document_) and the link file `.claude/docs/stories/<KEY>.md`. Show the Confluence link with the summary.
- Show the plan summary, then ask for approval **with buttons** (the AskUserQuestion tool), never as a plain-text question:
  - question: "Approve the plan for <KEY>?" · header: "Plan"
  - options: **"Approve"** ("Build, deploy to esm-dev and open the PR without further questions") and
    **"Need improvement"** ("Tell me what to change in the plan").
  - Put the open questions with your recommendations in the summary; "Approve" means the recommendations are accepted.
- **Need improvement** (or text typed in "Other"/notes): if no text came with it, ask "What should be improved?" and
  wait. Update the Confluence page, show what changed, and ask the same two buttons again. Repeat until **Approve**.

## 6. Build (after approval only) — no questions from here on

Ask every open question in step 5, before approval. After approval, run straight through to the PR. Stop only for
a real blocker (a deploy failure you can't fix, a hook block, or a scope change), or to ask before a **destructive
change** (deleting a class, field, object or other metadata). Record deviations in the plan and the PR.
Follow "How you work" steps 2-7 in `.claude/CLAUDE.md`:

1. Branch `feature/<KEY>-<short-kebab-name>` from `develop` (from `main` until `develop` exists). Read the Confluence
   design page again before building: it is the master copy and may have been edited since approval.
2. Build — fast. **No Jest tests, no test runs.** The developer reviews, runs and adds tests. Put suggested test cases in
   the plan's Low Level Design.
3. **sf-code-review** skill (one pass): fix every Blocker.
4. **sf-deploy** skill: deploy the story's components with NoTestRun, without asking. Record the job id in the Deployment Tracker.
   Then the **e2e-test** skill (e2e-tester subagent): add the plan's `TC-nn` scenarios, run the module's E2E specs, record
   passed/failed in the Deployment Tracker. A story-caused failure → fix, redeploy, re-run.
5. Update the Deployment Tracker on the Confluence page (status, manual steps, E2E result), the module rule file, and the
   module's page in _Module Wise Design Document_ (**confluence-design** skill, "Update the module design page").
6. **pr-description** skill → `git push -u origin <branch>` → `gh pr create`. The PR is the approval point.
   List the manual steps, the E2E result and "Jest/Apex tests: developer to run" in the PR.

## 7. Verify the feature: buttons

When the PR is open, say clearly what was deployed and how to verify it in esm-dev (steps, the record to open,
and the hard-refresh tip for LWC changes). Then ask **with buttons** (AskUserQuestion):

- question: "Please verify <KEY> in esm-dev. Is the feature working?" · header: "Verify"
- options: **"Feature working fine"** ("Merge the PR, set Jira to Done and close the story") and
  **"Need improvement"** ("Tell me what to fix").

**Need improvement:** if no text came with it, ask "What should be improved?" and wait. Fix it on the same branch
(no new plan approval unless the scope changes), deploy (NoTestRun), push, comment on the PR, update the Deployment
Tracker, then ask the **Verify** buttons again.

**Feature working fine:** close the story without further questions:

1. Merge the PR: `gh pr merge <number> --merge` (keep the branch; stacked PRs depend on it). If the PR is stacked
   on another feature branch, say that it merged into that branch and reaches `main` when the base PR merges.
2. Jira: move <KEY> to **Done** and comment with the PR link and "Verified by <user> on <date>".
3. Confluence page: set Status to "Verified and merged" and record the verification in the Deployment Tracker.
   Update Status in the link file; commit and push.
4. End with exactly this line on its own: **✅ Process completed. Ready for the next story.**

## 8. Jira updates

- When the plan is approved, move <KEY> to In Progress and comment with the decisions, the branch name and
  the Confluence design document link.
- When the PR is open, comment the PR link on <KEY>.
- When the feature is verified, move <KEY> to Done (step 7).
- Never put org IDs, usernames or credentials in Jira comments.
