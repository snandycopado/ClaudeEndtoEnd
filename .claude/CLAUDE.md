# Enterprise Solution Management — Salesforce

## Landscape
Sales Cloud. Standard Salesforce DX project — **the project structure is fixed and Claude never changes it**:
all metadata lives in `force-app/main/default/` (one package directory in sfdx-project.json).
Everything Claude-related lives in `.claude/` (this file, rules, agents, skills, hooks, docs); CI in `.github/`.
Operating model: .claude/docs/plan.md · Architecture and ADRs: .claude/docs/architecture/.

## Modules = file-name prefixes
Module knowledge is in `.claude/rules/` and loads automatically when you open matching files.
**New files must use their module's prefix**, or the module rules will not load for them.

| Area | Prefix / files | Rule file | Status |
|---|---|---|---|
| Trigger framework | TriggerHandler, Trigger_Setting__mdt | rules/frameworks/trigger-framework.md | Live — architect-owned |
| Exception framework | AppLogger, *Exception, Error_Log*, ErrorLogEvent* | rules/frameworks/exception-framework.md | Live — architect-owned |
| Integration framework | Integration* | rules/frameworks/integration-framework.md | Not built |
| Shared Account model | Account record types/status/email, layout, record page, Path, AccountTrigger | rules/shared.md | Live |
| Onboarding | Onboarding*, onboardingTaskTracker | rules/modules/onboarding.md | Live |
| Lifecycle Management | Lcm*, LCM_*, lcmVendorNotifier | rules/modules/lifecycle-management.md | Live |
| Offboarding / SSO | Offboarding*, offboarding*, Sso*, sso* | rules/modules/offboarding.md, sso.md | Planned |
| Experience Cloud | experiences/, networks/, sites/ | rules/experience.md | Planned |
| Zapzilla / Product / DocuSign | Zapzilla*, Product*, DocuSign* (dsfs__ = managed, never edit) | rules/integrations/*.md | Planned |

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
1. Read the story. Write an impact plan to `.claude/docs/stories/<KEY>.md` (skill: story-to-plan). STOP for approval.
2. Branch `feature/<KEY>-short-name` from `develop` (from `main` until `develop` exists). Never commit to
   main or develop — a hook blocks it.
3. Build. Tests: 90%+ on changed classes, assert behaviour, bulk (200) + negative + permission tests,
   `System.runAs` a Standard User from `OnboardingTestFactory.createStandardUser(permsets)`.
4. sf-code-review skill (code-reviewer subagent). Fix every Blocker.
5. sf-deploy skill: dry run, then deploy the story's components to the alias in `.claude/allowed-orgs`.
6. Smoke-test in the org and record the evidence in the plan. Update the module rule file in the same change.
7. pr-description skill → push the branch, open a PR. The PR is the approval point.

**After the plan is approved, do not ask questions.** Run steps 2–7 end to end. Stop only for a real blocker (a deploy
or test failure you cannot fix, a hook block, or a change of scope). Record deviations in the plan and the PR.
Questions belong in planning, before "Approve this plan?".

## Never
- Change the project structure: sfdx-project.json, .forceignore, folders under force-app/ (hook-enforced).
- Deploy to any org but the alias in .claude/allowed-orgs, deploy all of force-app, or deploy framework components.
- Delete metadata or data, or create destructiveChanges files — removals go into the story plan for an architect.
- Edit framework or shared Account metadata without asking (the hook asks); regenerate the Account layout,
  record page or Account.object-meta.xml — edit in place.
- Touch dsfs__ components, installedPackages/, or profiles.
- Commit credentials, org IDs or usernames — the GitHub repo is public.

## Commands (run `sf` from PowerShell; Git Bash breaks on the `C:\Program Files` path)
- Validate: `sf project deploy start --dry-run --metadata ApexClass:<Name> --target-org <alias> --test-level RunLocalTests --wait 30`
- Deploy:   `node .claude/skills/sf-deploy/deploy.mjs --metadata <Type:Name> [...]` (guarded: dry run, then deploy)
- Tests:    `sf apex run test --class-names <Tests> --target-org <alias> --result-format human --code-coverage --wait 20`
- Smoke test: script in your scratchpad, `sf apex run --file <file> --target-org <alias>` (read-only, no delete).

## Guardrails
`.claude/settings.json` (deny/ask/allow) and `.claude/hooks/` block destructive commands, other orgs,
whole-project and framework deploys, commits on main/develop, and edits to protected files.
Proof: `node .claude/hooks/tests/run-guard-tests.mjs`. If a hook blocks you, do not work around it —
explain the block to the user.
