# Enterprise Solution Management — Salesforce

## Landscape

Sales Cloud. Standard Salesforce DX project — **the project structure is fixed and Claude never changes it**:
all metadata lives in `force-app/main/default/` (one package directory in sfdx-project.json).
Everything Claude-related lives in `.claude/` (this file, rules, agents, skills, hooks, docs); CI in `.github/`.
Operating model: .claude/docs/plan.md · Architecture and ADRs: .claude/docs/architecture/.

## Modules = file-name prefixes

Module knowledge is in `.claude/rules/` and loads automatically when you open matching files.
**New files must use their module's prefix**, or the module rules will not load for them.

| Area                          | Prefix / files                                                               | Rule file                                 | Status                 |
| ----------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------- | ---------------------- |
| Trigger framework             | TriggerHandler, Trigger_Setting__mdt                                         | rules/frameworks/trigger-framework.md     | Live — architect-owned |
| Exception framework           | AppLogger, _Exception, Error_Log_, ErrorLogEvent*                            | rules/frameworks/exception-framework.md   | Live — architect-owned |
| Integration framework         | Integration*                                                                 | rules/frameworks/integration-framework.md | Not built              |
| Shared Account model          | Account record types/status/email, layout, record page, Path, AccountTrigger | rules/shared.md                           | Live                   |
| Onboarding                    | Onboarding*, onboardingTaskTracker                                           | rules/modules/onboarding.md               | Live                   |
| Lifecycle Management          | Lcm*, LCM_*, lcmVendorNotifier                                               | rules/modules/lifecycle-management.md     | Live                   |
| Offboarding / SSO             | Offboarding*, offboarding*, Sso*, sso*                                       | rules/modules/offboarding.md, sso.md      | Planned                |
| Experience Cloud              | experiences/, networks/, sites/                                              | rules/experience.md                       | Planned                |
| Zapzilla / Product / DocuSign | Zapzilla*, Product*, DocuSign* (dsfs__ = managed, never edit)                | rules/integrations/*.md                   | Planned                |

## Non-negotiable patterns

- Triggers: one per object, all 7 events, body `new <Object>TriggerHandler().run();`. Logic lives in a
  handler extending `TriggerHandler`, which delegates to a `<Module>Service`.
- Errors: never swallow exceptions. `AppLogger.error(ex, 'Class', 'method', recordId)` then `AppLogger.save()`.
  Business-rule failures throw `ValidationException`.
- Callouts: only through the Integration framework + Named Credentials — not built yet: STOP and ask.
- Security: `with sharing` by default. API 67 enforces FLS on SOQL/DML — always state the access mode
  (`WITH USER_MODE` / `as user` for user actions; `AccessLevel.SYSTEM_MODE` for automation, logs, audit).
  `without sharing` only with the reason in the class header. Details: rules/apex.md.
- Every new field, object, record type or LWC-facing Apex class goes into the module's permission set in
  the same change. Permission sets only — never profiles.
- Bulkify: no SOQL/DML in loops; trigger paths handle 200 records.
- Configuration over code: Custom Metadata for switches and mappings.

## How you work (every user story)

Start every story with `/start-story <KEY or Jira link>` (.claude/commands/start-story.md).

1. Read the story. Write the plan to `.claude/docs/stories/<KEY>.md` (skill: story-to-plan) with four sections:
   Story Description, High Level Design, Low Level Design, Deployment Tracker (with manual steps). STOP for approval.
2. Branch `feature/<KEY>-short-name` from `develop` (from `main` until `develop` exists). Never commit to
   main or develop — a hook blocks it.
3. Build — fast. **Do not write Jest tests and do not run any tests** (Jest or Apex). The developer reviews the
   code, runs the tests and writes any that are needed. Suggest test cases in the plan's Low Level Design.
   Apex test classes: write one only when a story adds production Apex that otherwise has none, so the org's
   75% deploy gate can still be met later; don't execute it.
4. sf-code-review skill (code-reviewer subagent, one pass). Fix every Blocker.
5. sf-deploy skill: deploy the story's components to the alias in `.claude/allowed-orgs` **without asking**
   (no tests run: `NoTestRun`). Record the job id in the Deployment Tracker.
6. Update the Deployment Tracker (manual steps, status) and the module rule file in the same change.
7. pr-description skill → push the branch, open a PR. The PR is the approval point.

**After the plan is approved, do not ask questions.** Run steps 2–7 end to end. Stop only for a real blocker (a deploy
failure you cannot fix, a hook block, or a change of scope) or a **destructive change**. Record deviations in the plan
and the PR. Questions belong in planning, before "Approve this plan?".

**Destructive changes are the one exception: always ask first.** Deleting a class, trigger, field, object, record type
or any other metadata or data needs the user's explicit approval for that specific change, even after plan approval.

## Never

- Change the project structure: sfdx-project.json, .forceignore, folders under force-app/ (hook-enforced).
- Deploy to any org but the alias in .claude/allowed-orgs, deploy all of force-app, or deploy framework components.
- Delete metadata or data without the user's explicit approval for that deletion. Hooks still block deleting Apex
  and destructiveChanges files; if a hook blocks an approved deletion, it goes into the plan for an architect.
- Edit framework or shared Account metadata without asking (the hook asks); regenerate the Account layout,
  record page or Account.object-meta.xml — edit in place.
- Touch dsfs__ components, installedPackages/, or profiles.
- Commit credentials, org IDs or usernames — the GitHub repo is public.

## Commands (run `sf` from PowerShell; Git Bash breaks on the `C:\Program Files` path)

- Validate with tests (developer, optional): `node .claude/skills/sf-deploy/deploy.mjs --validate --tests <A,B> --metadata <Type:Name>`
- Deploy: `node .claude/skills/sf-deploy/deploy.mjs --metadata <Type:Name> [...]` (guarded; NoTestRun, no dry run)
- Tests (developer runs them, not Claude): `sf apex run test --class-names <Tests> --target-org <alias> --result-format human --code-coverage --wait 20`

## Guardrails

`.claude/settings.json` (deny/ask/allow) and `.claude/hooks/` block destructive commands, other orgs,
whole-project and framework deploys, commits on main/develop, and edits to protected files.
Proof: `node .claude/hooks/tests/run-guard-tests.mjs`. If a hook blocks you, do not work around it —
explain the block to the user.
