---
name: story-to-plan
description: Turn a user story (e.g. "Implement ONB-012") into a design document in Confluence (master copy, folder User Story Design Document) plus a link file at .claude/docs/stories/<KEY>.md, then STOP for human approval. Use at the start of every story, before writing code.
---

# Story to impact plan

1. Get the story key, title, description and acceptance criteria. If only a key or link was given, read it
   from Jira via the Atlassian MCP (`getJiraIssue`); if that is unavailable, ask the user to paste the story.
2. Delegate the analysis to the `story-analyst` subagent (and `impact-analyzer` if shared Account metadata, a framework or an
   integration is touched). Give it the story text.
   Before that, read the module and framework design pages in Confluence that apply, and give them to the analyst as
   context (the **confluence-design** skill, "Read").
3. Write the design document **in Confluence** (the master copy) with the **confluence-design** skill ("Create"): a
   page `<KEY>: <title>` in the folder _User Story Design Document_, with the content of `plan-template.md` in this
   folder. Then write the link file `.claude/docs/stories/<KEY>.md`. If Confluence is unavailable, use that skill's
   fallback. The document has four sections:
   **1. Story Description**, **2. High Level Design**, **3. Low Level Design**, **4. Deployment Tracker** (including
   manual steps). Keep every section; write "None" rather than deleting one. List open questions in the summary.
   Do not plan Jest tests or test runs; list suggested test cases for the developer in the Low Level Design.
4. Branch name goes in the plan: `feature/<KEY>-<short-kebab-name>`.
5. STOP. Show the plan summary (files to change, risks, open questions with recommendations) and ask with the
   AskUserQuestion buttons **"Approve"** / **"Need improvement"** (see `.claude/commands/start-story.md` step 5).
   Include the Confluence page link so the user can review the full document there. On "Need improvement", get the
   text, update the Confluence page and ask again. Do not create the branch or edit any metadata until the user
   clicks Approve.
6. After approval, update the Confluence page: the Approval section (who/when) and Status Approved. Then read it again
   (people may have edited it) and continue with the build from that version.
