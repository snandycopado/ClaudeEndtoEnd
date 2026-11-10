---
name: sf-deploy
description: Guarded deploy to the developer's own org only - checks the alias allowlist, refuses framework components and whole-project deploys, then deploys the story's components with NoTestRun (dry run and tests only on request). Use when the user asks to deploy, push to the org, or validate a story.
---

# Guarded deploy

Preconditions: the sf-code-review skill reported no Blockers, and the story plan lists the components to deploy.

1. Name exactly the story's components — never the whole `force-app` or a whole metadata folder like
   `classes/`. Prefer `--metadata`; for many components write a story manifest
   `.claude/docs/stories/manifests/<KEY>.xml`.
   ```
   node .claude/skills/sf-deploy/deploy.mjs --metadata ApexClass:OnboardingService --metadata ApexClass:OnboardingServiceTest --metadata LightningComponentBundle:onboardingTaskTracker
   node .claude/skills/sf-deploy/deploy.mjs --manifest .claude/docs/stories/manifests/ONB-012.xml
   ```
   - Alias = first line of `.claude/allowed-orgs` (git-ignored).
   - Story workflow: one deploy with `NoTestRun`, **no dry run and no tests**, and **no asking first**. The developer
     runs the tests. Developer options: `--validate` (dry run first), `--dry-run-only`, `--tests A,B`, `--local-tests`.
   - Failures print in a few lines; on failure use the `deploy-validator` subagent with the job id.
   - Record the job id and status in the plan's Deployment Tracker.
2. Framework components (TriggerHandler, AppLogger, exception classes, Error_Log objects, Trigger_Setting__mdt,
   Integration* classes) are refused — tell the user an architect deploys them after PR review.
3. After a successful deploy: list manual steps (permission-set assignments, layout assignments, profile settings)
   in the Deployment Tracker. No smoke test: the developer verifies in the org.
4. Never another alias. Destructive flags (`--purge-on-delete`, destructiveChanges) only after the user explicitly
   approved that deletion. The hooks may still block them; then it goes to an architect. Never `--ignore-conflicts`
   without asking.
