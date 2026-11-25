---
name: sf-code-review
description: Review Salesforce Apex, LWC, Flow and metadata changes on the current branch against project standards, with Salesforce Code Analyzer. Use before any deployment or when asked to review Salesforce code in this repo.
---
# Salesforce code review

Run this through the `code-reviewer` subagent so the review is not biased by having written the code
(add `security-reviewer` when the change touches sharing, permission sets, Experience Cloud, SSO or
`@AuraEnabled` methods).

1. List changed files: `git diff <develop|main>...HEAD --name-only` (use `develop` once it exists).
2. Run: `sf code-analyzer run --config-file .claude/skills/sf-code-review/code-analyzer-config.yml --target <changed files> --view table`
   (install once with `sf plugins install code-analyzer` if missing). PMD/CPD/SFGE need Java 11+ and the
   Flow engine Python 3.10+; if they are missing locally, say so in the report and rely on the checklist —
   CI runs the full analyzer.
3. Go through `checklist.md` for each file type changed.
4. Output a findings table (file, line, severity, rule, fix).
5. Any Blocker → stop and report; do not continue to sf-deploy. Fix, then review again.
