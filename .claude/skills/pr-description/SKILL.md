---
name: pr-description
description: Write the pull request description from the story plan and the branch diff - what changed, deploy job id, manual steps, reviewer checklist. Use when the story is deployed to the developer org and ready for a PR.
---

# PR description

1. Read `.claude/docs/stories/<KEY>.md` (Story Description, High and Low Level Design, Deployment Tracker).
2. `git diff <develop|main>...HEAD --stat` and `git log <develop|main>..HEAD --oneline`.
3. Fill `pr-template.md` in this folder. Every section, no placeholders left; "None" where nothing applies.
4. Evidence must be real output from this branch: the deploy job id and status, and the code-review result.
   Tests are not run by Claude: say "developer to run" and point to the suggested test cases in the plan.
5. End the description with: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
6. Once the plan is approved and the story is deployed, push and open the PR without asking:
   `git push -u origin <branch>` and `gh pr create --base develop --title "<KEY>: <title>" --body-file <file>`
   (base `main` until develop exists). The PR is the approval point. Show the PR link to the user.
