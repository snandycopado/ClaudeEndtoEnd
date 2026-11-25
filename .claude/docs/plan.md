# Claude-Driven Salesforce Delivery: Architecture & Operating Model

Nov 6, 2026 · Suman — the target operating model for this repo. "Status in this repo" notes (added
2026-11-07) record how the plan maps to what exists; everything else is the original plan.

## 1. Purpose and target outcome
Claude Code takes a user story, builds the change on a feature branch, validates it, and deploys it to the
developer's own sandbox only. A human verifies it there and is the only one who can move it toward QA.

Five building blocks, all versioned in the repo:
- **CLAUDE.md files** — project knowledge, loaded in layers so Claude only reads the module it is working on.
- **Subagents (6)** — isolated workers for analysis, test writing, review and security.
- **Skills (9)** — repeatable procedures (code review, deploy, scaffolding) every developer and Claude run the same way.
- **Guardrails (6 layers)** — org access, Claude permissions, hooks, Git protection, CI gates, enterprise policy.
- **Human checkpoints (3)** — plan approval, sandbox verification, pull-request review before QA.

Scope: Sales, Service and Experience Cloud; modules Onboarding, Offboarding, Single Sign-On, Lifecycle
Management; Zapzilla and Product integrations; DocuSign (managed package); Trigger, Exception Management and
Integration frameworks.

> Status in this repo: built — Trigger + Exception frameworks, Onboarding, Lifecycle Management (LCM).
> Planned areas have placeholder rule files in .claude/rules/.

## 2. Repository structure
Organised by business module (multiple package directories), with a CLAUDE.md at the root of each folder.

```
CLAUDE.md                 root: architecture, conventions, guardrails
CLAUDE.local.md           personal notes (git-ignored)
sfdx-project.json         one packageDirectory per folder with metadata
.mcp.json                 Salesforce DX MCP server (Jira/ADO MCP when chosen)
.claude/  settings.json, hooks/, agents/, skills/, rules/
core/     trigger-framework, exception-framework, integration-framework (+ test-framework)
shared/   Account/Contact/Case/Lead customisations used by several modules
modules/  onboarding, offboarding, sso, lifecycle-management
experience/               Experience Cloud
integrations/ zapzilla, product, docusign (extension points only, never edit dsfs__)
docs/     architecture/ (data model, ADRs), stories/ (one impact plan per story), claude-setup/
manifest/ package.xml; manifest/stories/<KEY>.xml; destructiveChanges is CI-only
scripts/  read-only anonymous Apex, CI scripts
.github/  CI workflows, CODEOWNERS, PR template
```
Folder rules: core/ changes need architect approval (CODEOWNERS); Claude reads it freely but asks before
editing. integrations/docusign/ holds only your own extension code. docs/stories/ keeps one plan per story.

> **Status in this repo — adapted (ADR-0001):** the project does not allow changes to the Salesforce
> structure, so the module folders above are NOT created. All metadata stays in force-app/main/default;
> everything Claude-related is in `.claude/` (CLAUDE.md, settings, hooks, agents, skills, rules, docs —
> plan, architecture, stories, story manifests) and CI in `.github/`. Only `.mcp.json` is at the root.
> Module and framework boundaries are file-name prefixes, listed in .claude/CLAUDE.md and enforced by
> .claude/hooks/lib/protected-paths.mjs and CODEOWNERS. Other deviations: hooks are Node `.mjs` (no `jq` on
> Windows); the review skill is `sf-code-review` (Claude Code ships a built-in `/code-review`); the alias
> allowlist is `.claude/allowed-orgs` (git-ignored) instead of CLAUDE.local.md.

## 3. CLAUDE.md strategy — three layers
| Layer | Files | Loaded when | Content |
|---|---|---|---|
| Root | CLAUDE.md | Every session | Landscape, folder map, patterns, how you work, never-list, commands |
| Framework | core/*/CLAUDE.md | Working in / calling a framework | How to extend, mandatory usage, example, what never to change |
| Domain | shared/, modules/*, experience/, integrations/* | Working in that folder | Purpose, objects, entry points, integrations, gotchas |
| Path rules | .claude/rules/apex.md, lwc.md, flows.md, test.md | Editing a matching file | Language-level practice |
| Personal | CLAUDE.local.md, ~/.claude/CLAUDE.md | That developer only | Org alias, preferences |

> Status: the Framework and Domain layers are path-scoped rules — .claude/rules/frameworks/*.md,
> shared.md, modules/*.md, experience.md, integrations/*.md — each with `paths:` globs on file-name
> prefixes, so they load exactly when Claude works on that module's files. Root = .claude/CLAUDE.md.

Rules: root under ~150 lines, module files under ~80; instructions, not essays; update a module's CLAUDE.md
in the same PR that changes the module.

## 4. Subagents (.claude/agents/)
| Subagent | When | Tools | Why |
|---|---|---|---|
| story-analyst | Start of every story | Read, Grep, Glob (+ tracker MCP) | Story → impact plan; read-only |
| impact-analyzer | Story touches shared/core/integrations | Read, Grep, Glob | Finds every reference without flooding context |
| apex-test-writer | After implementation | Read, Write/Edit (tests only), sf apex run test | Tests against the requirement |
| code-reviewer | Before deploy | Read, Grep, Glob, git diff, sf code-analyzer | Fresh-eyes review; cannot edit |
| security-reviewer | Experience Cloud, SSO, sharing, exposed Apex | Read, Grep, Glob | CRUD/FLS, sharing, guest, injection |
| deploy-validator | Deploy fails | Read, dry-run deploy, reports | Root cause in a few lines |

## 5. Skills (.claude/skills/)
| Skill | Purpose | Supporting files |
|---|---|---|
| story-to-plan | Story → impact plan; stops for approval | plan-template.md |
| sf-code-review | Checklist + Code Analyzer | checklist.md, code-analyzer-config.yml |
| sf-deploy | Dry run, tests, deploy to own org only | deploy.mjs (alias allowlist) |
| apex-test | Test pattern: TestDataFactory, bulk, negative, permission | test-template.cls |
| new-trigger-handler | Trigger + handler + test scaffold | templates/ |
| new-integration | Named/External Credential, callout class, mock | templates/, mock-template.cls |
| exception-handling | How and where to log | examples.md |
| lwc-component | LWC scaffold, LDS first, Jest | templates/ |
| pr-description | PR text from plan + diff | pr-template.md |

## 6. Guardrails — six layers
| # | Layer | Stops | How |
|---|---|---|---|
| 1 | Org access | Changes outside a dev org | Developers authorise only their own dev org; QA/UAT/prod credentials only in CI |
| 2 | Claude permissions | Dangerous commands / edits | .claude/settings.json deny / ask / allow |
| 3 | Hooks | What patterns miss | PreToolUse scripts inspect the full command / path; exit 2 blocks |
| 4 | Git protection | Unreviewed code on shared branches | Protected main/develop, PR required, CODEOWNERS, no force push |
| 5 | CI gates | Deletions, low coverage, violations | Deleted-file check, destructiveChanges check, Code Analyzer, check-only deploy |
| 6 | Enterprise policy | Loosening layers 2–3 | Managed settings deployed by IT |

Hook checks (guard-sf-command): target org not in the allowlist or missing; destructive flags; manifests
outside the story's package.xml; deploying core/; anonymous Apex with delete / emptyRecycleBin.
guard-protected-files: dsfs__, installedPackages/, profiles, file deletion in package directories.
CI on every PR: deleted metadata fails unless an architect labels it; destructiveChanges fails; Code
Analyzer severity 1–2 fails; check-only deploy with RunLocalTests and coverage threshold; CODEOWNERS approval.

> Status: layers 2, 3 and 5 are in the repo; layer 4 (branch protection) is applied with `gh` after the
> first PR; layer 1 is the `.claude/allowed-orgs` allowlist (esm-dev only); layer 6 needs IT.
> Gate evidence: `node .claude/hooks/tests/run-guard-tests.mjs`. Framework and whole-project deploys are blocked
> (deploys name their components); the Salesforce structure (sfdx-project.json, .forceignore, folders) is
> edit-blocked.

## 7. End-to-end workflow
1. Story → impact plan in .claude/docs/stories/<KEY>.md → **checkpoint 1: plan approval**.
2. Build on feature/<KEY>-short-name, tests, sf-code-review.
3. sf-deploy to the developer's own org → **checkpoint 2: human verifies in the org**.
4. pr-description → PR → CI → **checkpoint 3: PR review** → merge → pipeline deploys to QA.
Every failure loops back to the build step on the same branch.

## 8. Rollout
1. **Foundation** (weeks 1–2): restructure, root CLAUDE.md, settings.json, hooks, branch protection, CI.
   Gate: a test run proves a destructive command and a prod deploy are both blocked.
2. **Knowledge** (weeks 2–4): framework and domain CLAUDE.md files + rules; module owner signs off each.
   Gate: Claude answers 10 "where is X handled" questions per module correctly.
3. **Pilot** (weeks 4–6): subagents and skills; two developers run low-risk stories end to end.
   Gate: 5 stories reach QA with no Blocker found in PR review.
4. **Scale** (weeks 6–8): all developers; integration and Experience Cloud stories with security review; managed settings.

Keeping it current: update CLAUDE.md in the same PR; add one line to the relevant file when Claude repeats
a mistake; review all CLAUDE.md files and the checklist quarterly.
Measure per sprint: stories completed to sandbox without rework, PR findings by severity, first-time CI
pass rate, QA defects in Claude-built vs hand-built changes.

## Open questions
- [ ] Pipeline to QA: DevOps Center, Copado, Gearset or Git-based CI?
- [ ] Developer sandboxes or scratch orgs per developer? (scratch orgs need DocuSign in the definition)
- [ ] Where do stories live (Jira or Azure DevOps) for the story-analyst MCP?
- [ ] QA org for the CI check-only deploy (until then CI validates without an org, or against a dev org via secret).
