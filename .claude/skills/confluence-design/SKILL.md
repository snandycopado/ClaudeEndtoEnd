---
name: confluence-design
description: Create, read and update the story design document in Confluence (the master copy), update the module design page for every story that changes a module, and read framework pages for context. Use whenever a story plan is written, revised, read before building, deployed, or its Deployment Tracker/status changes.
---

# Design documents in Confluence (master copy)

The design document for every story lives in **Confluence**. People may edit it there at any time, so Claude reads
it from Confluence before each step that depends on it. The repo keeps only a link file,
`.claude/docs/stories/<KEY>.md` (template: `link-stub.md` in this folder).

Location: `.claude/confluence.json`.

- Site `suman-nandy.atlassian.net`, space id `229378`.
- Folders:
  - **User Story Design Document** (`458753`): story designs;
  - **Module Wise Design Document** (`425985`): module designs;
  - **Framework Document** (`196610`): framework documents.

Tools: the Atlassian MCP. Load them with ToolSearch
`select:mcp__atlassian__searchConfluence,mcp__atlassian__getConfluenceContent,mcp__atlassian__createConfluenceContent,mcp__atlassian__updateConfluenceContent,mcp__atlassian__executeRead`.

## Find a story's page

`searchConfluence` with `cql: ancestor = 458753 AND type = page AND title ~ "<KEY>"`. Match the title prefix `<KEY>:` exactly.
Also check the link file for `Page id`.

## Read

- To use the design (build, review, PR): `getConfluenceContent` with `content_id`, `detail: "full"` and
  `content_format: "markdown"`.
- To edit it: read the draft again in HTML (`draft: true, detail: "full", content_format: "html"`) and keep the
  returned `snapshotToken`.
- Context for a story: search the module folder (`ancestor = 425985 AND title ~ "<module>"`) and, if a framework is
  touched, the framework folder (`ancestor = 196610`). Read the matching pages and follow them. If a page contradicts a
  rule file in `.claude/rules/`, report the conflict in the plan's open questions.

## Create (story-to-plan)

1. Once per task: `executeRead` with `name: getContentFormatGuide` and `inputs: {toolName: "createConfluencePage"}`.
   Write **Confluence HTML** as that guide describes; no storage XML (`ac:` tags).
2. Space instructions: space 229378 has none (checked 2026-11-25). If `getConfluenceSpace` later returns some, follow them.
3. `createConfluenceContent` with:
   - `cloudId`: the site;
   - `parent`: `{ "spaceId": "229378", "parentContentId": "458753" }`;
   - `contentType`: `"page"`;
   - `title`: `"<KEY>: <story title>"`;
   - `body`: `{ "format": "html", "value": … }`.
4. Body = the sections of `.claude/skills/story-to-plan/plan-template.md` in HTML:
   - Top: a details table covering Jira (smart link `data-card-appearance="inline"`), Module, Branch, and Status as a
     status lozenge: Draft `neutral`, Approved `blue`, Deployed `purple`, Verified and merged `green`.
   - `<h2>` per section: **1. Story Description** (with the acceptance criteria and the decisions table),
     **2. High Level Design**, **3. Low Level Design** (components table, suggested tests, E2E scenarios table),
     **4. Deployment Tracker** (the tracker table, Manual steps, Destructive changes), **Approval**.
   - Use a `panel-warning` for risks and open questions.
5. Write the link file `.claude/docs/stories/<KEY>.md` from `link-stub.md`. Use the link
   `https://suman-nandy.atlassian.net/wiki/pages/viewpage.action?pageId=<id>`, **not** the `webUrl` from the response:
   `webUrl` contains the personal space key, which is the owner's Atlassian account id, and the repo is public. Use the
   same link in Jira comments and PRs.

## Update (revisions, approval, tracker, status)

1. Read the current draft (HTML, `draft: true`) and take the `snapshotToken`.
2. Change **only** what the step owns:
   - the Status lozenge;
   - rows of the Deployment Tracker table;
   - the Approval section;
   - on "Need improvement", the sections being revised.
     Keep everything else as fetched, including edits people made, inline comments, `data-local-id`s and table widths.
3. `updateConfluenceContent` with `contentId`, the full HTML `body`, the `snapshotToken`, and
   `versionMessage: "<KEY>: <what changed>"`. On `snapshot_stale`: read the page again, reapply the change, then retry.
4. Update `Status` in the link file to match.

When each update happens (start-story):

| Moment               | Page update                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| Plan written         | Create the page, Status Draft                                                                      |
| Need improvement     | Revise the sections, Status Draft                                                                  |
| Approve              | Approval section (who/date), Status Approved                                                       |
| Deployed + E2E       | Tracker rows 1/1b (job id, E2E result), Status Deployed; **update the module design page** (below) |
| PR opened            | Tracker row "Pull request" (PR link)                                                               |
| Feature working fine | Tracker verified/merged rows, Status Verified and merged; module page: story marked verified       |

## Update the module design page (every story)

Every story that changes a module also updates that module's page in _Module Wise Design Document_ (ids in
`.claude/confluence.json` → `folders.moduleDesigns.pages`), in the same step as the module rule file. The module
page is the readable, current design of the module. The story page records the change.

1. Which page: the story's module from the plan.
   - Shared Account metadata (record types, Account_Status__c, layouts, record page, Path, AccountTrigger) →
     _Shared Account Data Model_.
   - A story touching several modules → every page it changes.
2. Read the page as an HTML draft (`draft: true, detail: "full"`) and take the `snapshotToken`.
3. Change only what the story changed, in the section where it belongs:
   - Entry points;
   - behaviour (by story);
   - Key objects (new fields, objects, CMDT records, permission set grants);
   - Behaviour rules;
   - Known limitations;
   - Tests (E2E TC ids).
     Describe the module as it is now, not the history. Keep edits people made.
4. Add the story to the page's **Stories** list as a link to its design page (`viewpage.action?pageId=<id>`), with
   one line on what it changed. Set `versionMessage: "<KEY>: <what changed>"`.
5. No page for the module yet (a new module) → create one in folder 425985 with the sections Purpose, Entry points,
   Key objects, Behaviour rules, Known limitations, Tests, Stories. Add its id to `.claude/confluence.json`.
6. Record "Module design page updated: <page>" in the story page's Deployment Tracker and in the PR.
7. Framework pages (folder 196610) change only when the story changed the framework itself, which already needs the
   architect's approval in the plan. Otherwise read them, never edit them.

If the story changes nothing in the module's design (for example a pure label fix), write "Module design page: no
change" in the tracker instead.

## Before building

After approval, read the page again in markdown, because someone may have edited it after you showed the summary.
If the scope changed (new or removed acceptance criteria or components), stop and ask; otherwise build from the page.

## Rules

- **Never** put org ids, usernames, passwords, tokens or org URLs on a page.
- **Never delete** a page or a section someone else wrote. Deleting pages is destructive: ask first.
- If Confluence is unavailable (MCP down or authentication needed), write the plan to `.claude/docs/stories/<KEY>.md`
  in full as a temporary copy, tell the user, and publish it to Confluence as soon as the connection is back.
  That page then becomes the master again.
- Module pages: updated by every story that changes the module (see above). Framework pages: read only, unless the
  story's approved plan changes the framework. Both use the same HTML rules. Never delete a section someone else wrote.
